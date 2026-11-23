import { readdirSync, readFileSync } from "node:fs";
import { Canvas, expect, test } from "./fixtures";

/* Worker 28.13, parity chunk C1: the client list and each client's brand come from
   data/clients/*.json. For every client in the settings files: the switcher lists them all in
   order, switching loads the other brand, the Summary bubble shows the settings logo, and every
   map bubble opens its panel. */

type Settings = { client_key: string; display_name: string; logo_src: string | null; is_default: boolean };

const ORDER = ["fender.json", "ledlenser.json"];
const clients: Settings[] = readdirSync("data/clients")
  .filter((f) => f.endsWith(".json"))
  .sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99))
  .map((f) => JSON.parse(readFileSync(`data/clients/${f}`, "utf8")) as Settings);

const href = (c: Settings) => (c.is_default ? "/dashboard" : `/dashboard?client=${c.client_key}`);

for (const client of clients) {
  test.describe(`client settings (${client.client_key})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.context().addCookies(
        clients.map((c) => ({ name: `ifai_guest_${c.client_key}`, value: "1", domain: "localhost", path: "/" })),
      );
      await page.goto(href(client));
      await expect(page.locator(".graph-node").first()).toBeVisible({ timeout: 60_000 });
    });

    test("the switcher lists every settings file and switching loads that brand", async ({ page }) => {
      const select = page.locator('select[aria-label="Client brand"]');
      await expect(select).toHaveValue(client.client_key);
      await expect(select.locator("option")).toHaveText(clients.map((c) => c.display_name));
      const other = clients.find((c) => c.client_key !== client.client_key)!;
      await select.selectOption(other.client_key);
      await expect(page).toHaveURL(new RegExp(`${href(other).replace("?", "\\?")}$`));
      await expect(page.locator('select[aria-label="Client brand"]')).toHaveValue(other.client_key);
    });

    test("the Summary bubble shows the settings logo, and every bubble opens", async ({ page }) => {
      test.setTimeout(180_000);
      const canvas = new Canvas(page);
      if (client.logo_src) {
        await expect(canvas.bubble("hub").locator(`image[href="${client.logo_src}"]`)).toHaveCount(1);
      }
      const ids = await page.locator(".spoke-primary").evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-graph-node-id") ?? ""));
      expect(ids).toHaveLength(6);
      for (const id of ["hub", ...ids]) {
        await canvas.clickBubble(id);
        await expect(canvas.bubble(id)).toHaveClass(/\bnode-selected\b/);
        await expect(canvas.panel).toBeVisible();
      }
    });
  });
}
