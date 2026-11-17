import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { AI_READ_MS, Canvas } from "./fixtures";
import {
  PARITY_DIR,
  clientUrl,
  findForeign,
  foreignTerms,
  layoutGaps,
  normalizeLine,
  parityClients,
  type ClientCapture,
  type ParitySettings,
  type Surface,
} from "./client-parity-lib";

/* Worker 28.16, parity chunk C8 (X-35, decisions 84 and 105): the automatic client-matching test.

   Two steps, run as two Playwright projects (see playwright.config.ts):
   1. "@parity-collect": for every client in data/clients/ plus the made-up fixture client, open
      every bubble and tab, the minimal view and the deck, and write down bubble names, tab names,
      section headings and table column headers (structure, not values) and the screen text.
   2. "@parity-compare": fail where the clients' structure differs, and fail where a client's
      screens show another client's brand names, owned domains, product-type words or vertical
      words.
   These checks are EXPECTED to fail until the parity rounds land (docs/client-parity-gaps.md).
   The fixture client needs a build made with NEXT_PUBLIC_TEST_CLIENT_FILES="$(node scripts/test-client-files.mjs)". */

const clients = parityClients();

/** Runs in the page: headings, table column headers and visible text under `rootSelector`. */
async function read(page: Page, rootSelector: string) {
  return page.evaluate((sel) => {
    const root = document.querySelector<HTMLElement>(sel);
    if (!root) return { headings: [] as string[], columns: [] as string[], text: "" };
    const heads = ["h1", "h2", "h3", "h4", "h5", "h6", ".content-box-title", ".roadmap-phase-title", ".stock-loss-title",
      ".deck-title-body", ".deck-marker-title", ".drilldown-title-main"].join(",");
    const clean = (s: string) => s.replace(/\s+/g, " ").trim();
    const headings = [...new Set([...root.querySelectorAll<HTMLElement>(heads)].map((e) => clean(e.innerText)).filter(Boolean))];
    const columns = [...root.querySelectorAll("table")]
      .map((t) => [...t.querySelectorAll("th")].map((th) => clean((th as HTMLElement).innerText)).filter(Boolean).join(" | "))
      .filter(Boolean);
    return { headings, columns, text: root.innerText };
  }, rootSelector);
}

/** Waits until the panel text stops changing: the reads behind a tab can take up to a minute. */
async function settle(page: Page, rootSelector: string, maxMs = AI_READ_MS) {
  const start = Date.now();
  let last = "";
  let since = Date.now();
  while (Date.now() - start < maxMs) {
    const now = await page.evaluate((sel) => document.querySelector<HTMLElement>(sel)?.innerText ?? "", rootSelector);
    if (now !== last) {
      last = now;
      since = Date.now();
    } else if (Date.now() - since >= 2_000 && !/\bLoading\b/.test(now)) {
      return;
    }
    await page.waitForTimeout(400);
  }
}

const log = (message: string) => {
  if (process.env.PARITY_VERBOSE) console.log(`[parity ${new Date().toISOString().slice(11, 19)}] ${message}`);
};

/* Structure, not values. Three things on a screen come from the client's own data, so they are written
   down by kind and not by name: the question categories (decision 106: columns on Engine Comparison and
   the battlecard figures in the minimal picker), the count in "N contradictions", and every sentence
   on a deck slide (a deck slide keeps its id, its column headers and how many headings it has). */
const DATA_STATE: [RegExp, string][] = [[/\b(\d[\d,]*|NO) CONTRADICTIONS( FOUND)?/gi, "CONTRADICTIONS"]];

function surface(id: string, client: ParitySettings, parts: { headings: string[]; columns: string[]; text: string }, extra: string[] = []): Surface {
  const kind = (l: string) => DATA_STATE.reduce((out, [re, to]) => out.replace(re, to), l);
  const columns = parts.columns.map((c) => (id.endsWith("/Engine Comparison") ? `${c.split(" | ")[0]} | <one column per question category>` : c));
  const headings = id.startsWith("deck/") ? [`${parts.headings.length} headings`] : parts.headings.map((h) => `heading: ${h}`);
  const lines = [
    ...extra.map((l) => normalizeLine(l.replace(/^(picker option: battlecards-).+(-unbranded)$/, "$1<category>$2"), client, false)),
    ...headings.map((h) => normalizeLine(kind(h), client)),
    ...columns.map((c) => normalizeLine(`columns: ${c}`, client)),
  ];
  return { id, lines: [...new Set(lines.map((l) => `${id} > ${l}`))], text: parts.text };
}

async function collectMap(page: Page, client: ParitySettings): Promise<Surface[]> {
  const canvas = new Canvas(page);
  const out: Surface[] = [];
  const bubbles = await page.locator(".graph-node.spoke-primary, .graph-node[data-graph-node-id='hub']").evaluateAll((nodes) =>
    nodes.map((n) => ({ id: n.getAttribute("data-graph-node-id") ?? "", title: [...n.querySelectorAll(".node-title")].map((t) => t.textContent ?? "").join(" ").replace(/\s+/g, " ").trim() })),
  );
  out.push({
    id: "map",
    lines: bubbles.map((b) => `map > bubble ${b.id}: ${normalizeLine(b.title, client)}`),
    text: bubbles.map((b) => b.title).join("\n"),
  });
  for (const bubble of bubbles) {
    log(`open ${bubble.id}`);
    await canvas.clickBubble(bubble.id);
    await expect(canvas.panel).toBeVisible();
    const tabs = await page.locator(".drilldown-tab-btn").allInnerTexts();
    const names = tabs.map((t) => t.replace(/\s+/g, " ").trim());
    for (let i = 0; i < Math.max(names.length, 1); i++) {
      if (names.length) await page.locator(".drilldown-tab-btn").nth(i).click();
      log(`tab ${bubble.id}/${names[i]}`);
      await settle(page, ".drilldown-panel");
      const id = `${bubble.id}/${names[i] ?? "(no tabs)"}`;
      const tabLines = i === 0 ? [`tabs: ${normalizeLine(names.join(" | "), client)}`] : [];
      out.push(surface(id, client, await read(page, ".drilldown-panel"), tabLines));
    }
  }
  return out;
}

async function collectMinimal(page: Page, client: ParitySettings): Promise<Surface> {
  log("minimal view");
  await page.locator("[data-view-mode='minimal']").click();
  await expect(page.locator("[data-minimal-view]")).toBeVisible();
  await settle(page, "[data-minimal-view]", 30_000);
  const slots = await page.evaluate(() => ({
    small: document.querySelectorAll("[data-minimal-view] .canvas-metric-widget").length,
    large: document.querySelectorAll("[data-minimal-view] .large-metric-slot").length,
  }));
  await page.getByRole("button", { name: "Add metric to large slot 1" }).click();
  const dialog = page.getByRole("dialog", { name: "Choose metric for large slot 1" });
  await expect(dialog).toBeVisible();
  await settle(page, "[role='dialog']", 30_000);
  const groups = await dialog.locator(".metric-widget-group h3").allInnerTexts();
  const options = await dialog.locator("[data-metric-option]").evaluateAll((n) => n.map((e) => e.getAttribute("data-metric-option") ?? ""));
  const dialogText = await dialog.innerText();
  const parts = await read(page, "[data-minimal-view]");
  const extra = [`slots: ${slots.small} small, ${slots.large} large`, ...groups.map((g) => `picker group: ${g}`), ...options.map((o) => `picker option: ${o}`)];
  return surface("minimal", client, { ...parts, text: `${parts.text}\n${dialogText}` }, extra);
}

async function collectDeck(page: Page, client: ParitySettings): Promise<Surface[]> {
  log("deck");
  await page.locator("[data-deck-open]").click({ timeout: 60_000 });
  const deck = page.locator("[data-deck][data-deck-slide-count]");
  await expect(deck).toBeVisible({ timeout: AI_READ_MS });
  const ids = await page.locator("[data-deck-slide]").evaluateAll((n) => n.map((e) => e.getAttribute("data-deck-slide") ?? ""));
  const out: Surface[] = [{ id: "deck", lines: ids.map((id) => `deck > slide ${id}`), text: "" }];
  for (const id of ids) {
    const parts = await read(page, `[data-deck-slide='${id}']`);
    out.push(surface(`deck/${id}`, client, parts));
  }
  return out;
}

/** A made-up client has no data in the database. Its views exist and hold no rows, so every read for its
 *  schema answers an empty list. This is what a new client looks like before Watson loads its data. */
async function answerWithNoRows(page: Page, client: ParitySettings) {
  await page.route("**/rest/v1/**", (route) => {
    const headers = route.request().headers();
    if (headers["accept-profile"] !== client.data_schema && headers["content-profile"] !== client.data_schema) return route.continue();
    return route.fulfill({ status: 200, contentType: "application/json", headers: { "content-range": "*/0" }, body: "[]" });
  });
}

/** Runs one phase. A phase that cannot open is itself a finding: it is written down, not thrown. */
async function phase(id: string, client: ParitySettings, page: Page, run: () => Promise<Surface[]>): Promise<Surface[]> {
  try {
    return await run();
  } catch {
    const text = await page.evaluate(() => document.body.innerText).catch(() => "");
    return [{ id, lines: [`${id} > did not open`], text }];
  }
}

test.describe("client parity: collect", () => {
  for (const client of clients) {
    test(`@parity-collect ${client.client_key}`, async ({ page }) => {
      test.setTimeout(40 * 60_000);
      page.setDefaultTimeout(20_000);
      await page.context().addCookies(
        clients.map((c) => ({ name: `ifai_guest_${c.client_key}`, value: "1", domain: "localhost", path: "/" })),
      );
      if (client.fixture) await answerWithNoRows(page, client);
      const open = async (query = "") => {
        await page.goto(clientUrl(client, query));
        await expect(page.locator(".graph-node").first()).toBeVisible({ timeout: 60_000 });
      };
      const surfaces: Surface[] = [];
      surfaces.push(...(await phase("map", client, page, async () => (await open(), collectMap(page, client)))));
      surfaces.push(...(await phase("minimal", client, page, async () => (await open(), [await collectMinimal(page, client)]))));
      surfaces.push(...(await phase("deck", client, page, async () => (await open("spoke=hub"), collectDeck(page, client)))));
      mkdirSync(PARITY_DIR, { recursive: true });
      const capture: ClientCapture = { client_key: client.client_key, surfaces };
      writeFileSync(`${PARITY_DIR}/${client.client_key}.json`, JSON.stringify(capture, null, 1));
    });
  }
});

const captures = (): ClientCapture[] => clients.map((c) => JSON.parse(readFileSync(`${PARITY_DIR}/${c.client_key}.json`, "utf8")) as ClientCapture);
const group = (id: string) => (id === "map" ? "map" : id.startsWith("deck") ? "deck" : id === "minimal" ? "minimal" : id.split("/")[0]);

test.describe("client parity: compare", () => {
  function compare(label: string, keys: string[], file: string) {
    const all = captures().filter((c) => keys.includes(c.client_key));
    const names = new Set(all.flatMap((c) => c.surfaces.map((s) => group(s.id))));
    const failures: string[] = [];
    const report: unknown[] = [];
    for (const g of names) {
      for (const gap of layoutGaps(all, (id) => group(id) === g)) {
        report.push({ group: g, ...gap });
        failures.push(`[${g}] ${gap.line}  (has: ${gap.has.join(", ") || "none"}; lacks: ${gap.lacks.join(", ")})`);
      }
    }
    writeFileSync(`${PARITY_DIR}/${file}`, JSON.stringify(report, null, 1));
    expect(failures, `${label}:\n${failures.join("\n")}`).toEqual([]);
  }

  test(`@parity-compare every bubble, tab, heading and column matches across ${clients.map((c) => c.client_key).join(", ")}`, () => {
    compare("layout differences", clients.map((c) => c.client_key), "layout-gaps.json");
  });

  test("@parity-compare the clients that have data match each other", () => {
    compare("layout differences between clients with data", clients.filter((c) => !c.fixture).map((c) => c.client_key), "layout-gaps-with-data.json");
  });

  for (const client of clients) {
    test(`@parity-compare ${client.client_key} shows no other client's names, domains or vertical words`, () => {
      const terms = foreignTerms(client, clients);
      const capture = captures().find((c) => c.client_key === client.client_key)!;
      const hits = capture.surfaces.flatMap((s) => findForeign(client, s, terms));
      writeFileSync(`${PARITY_DIR}/foreign-${client.client_key}.json`, JSON.stringify(hits, null, 1));
      const lines = hits.map((h) => `${h.surface}: "${h.term}" (${h.kind}, from ${h.from}) in "${h.context}"`);
      expect(lines, `foreign content on ${client.client_key}:\n${lines.join("\n")}`).toEqual([]);
    });
  }
});
