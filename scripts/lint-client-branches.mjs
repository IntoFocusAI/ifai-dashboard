#!/usr/bin/env node
/* lint:clients - flags code that branches on which client it is (X-35, decision 105, parity chunk C8).

   A client key or a brand name compared to a literal, outside lib/client/ and data/clients/,
   is a hand-written client difference. Differences must come from the settings record and the
   client's data (data/clients/<key>.json), read through the lib/client accessors.

   What it flags (each finding prints file:line, then "use instead:" with the settings field or brand
   helper to read in its place, from FIX_RULES below):
     x === "fender"            == != === !== against a client key or brand name literal, either side
     case "ledlenser":         a switch case on one
     .includes("fmic")         includes, startsWith, endsWith, indexOf with one
     isFenderClient()          a call to a helper named after one: is<Name>... with a client or brand name

   The literals come from data/clients/*.json: client_key, set_aside_key, display_name, brand name
   terms, portfolio brands, lead brand label parts and Amazon brand names. "fender", "ledlenser",
   "fmic" and "squier" are always included.

   Scope: app/, components/, lib/ and proxy.ts, .ts .tsx .js .mjs files. Out of scope: lib/client/,
   data/clients/, e2e/, scripts/, docs/ (tests and tooling name clients on purpose).

   Usage:
     node scripts/lint-client-branches.mjs            prints findings, exit 1 when there are any
     node scripts/lint-client-branches.mjs --strict   same, spelled out
     node scripts/lint-client-branches.mjs --report   prints findings, always exit 0 (CI, while the
                                                      parity rounds clear the list) */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = new URL("..", import.meta.url).pathname;

export const SCAN_DIRS = ["app", "components", "lib", "proxy.ts"];
export const OUT_OF_SCOPE = ["lib/client/", "data/clients/"];
export const ALWAYS_TERMS = ["fender", "ledlenser", "fmic", "squier"];

/** The literals a client comparison can name, lowercase, from the settings files. */
export function loadTerms(root = ROOT) {
  const terms = new Set(ALWAYS_TERMS);
  const dir = join(root, "data/clients");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const s = JSON.parse(readFileSync(join(dir, file), "utf8"));
    for (const t of [
      s.client_key,
      s.set_aside_key,
      s.display_name,
      ...(s.brand_name_terms ?? []),
      ...(s.portfolio_brands ?? []),
      ...String(s.lead_brand_label ?? "").split("/"),
      ...(s.amazon_brand_names ?? []),
    ]) {
      if (typeof t === "string" && t.trim().length >= 3) terms.add(t.trim().toLowerCase());
    }
  }
  return [...terms];
}

const QUOTED = `(["'\`])([^"'\`\\n]+)\\1`;
const EQ_AFTER = new RegExp(`(?:===|!==|==|!=)\\s*${QUOTED}`, "g");
const EQ_BEFORE = new RegExp(`${QUOTED}\\s*(?:===|!==|==|!=)`, "g");
const CASE = new RegExp(`\\bcase\\s+${QUOTED}\\s*:`, "g");
const METHOD = new RegExp(`\\.(?:includes|startsWith|endsWith|indexOf)\\(\\s*${QUOTED}`, "g");

const cap = (t) => t.replace(/[^a-z0-9]/gi, "").replace(/^./, (c) => c.toUpperCase());

/** A call to a helper named after a client or brand, such as isFenderClient(). */
function helperCall(text, terms) {
  for (const m of text.matchAll(/(?<!function\s)\bis([A-Z][A-Za-z0-9]*)\s*\(/g)) {
    const name = m[1];
    const hit = terms.find((t) => cap(t) && name.startsWith(cap(t)));
    if (hit) return { literal: m[0].replace(/\s*\($/, ""), term: hit };
  }
  return null;
}

/** Blanks comments so a sentence that names a client is not a finding. Keeps line numbers. */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .split("\n")
    .map((line) => {
      let quote = "";
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (quote) {
          if (ch === "\\") i++;
          else if (ch === quote) quote = "";
        } else if (ch === '"' || ch === "'" || ch === "`") quote = ch;
        else if (ch === "/" && line[i + 1] === "/") return line.slice(0, i);
      }
      return line;
    });
}

/* What to use instead, by what the branch is about. The first rule whose pattern matches the line (or
   the file) wins. Each names a settings field in data/clients/<key>.json and the accessor that reads
   it, or a brand helper in lib/brand-copy.ts. */
const S = "activeClientSettings()";
export const FIX_RULES = [
  { re: /RECHECK_DAYS|recheck|intervalDays/i, use: `the retailer's recheck_days setting: ${S}.retailers.find((r) => r.key === "walmart")?.recheck_days` },
  { re: /Walmart|Musician|\bmf_|retailer/i, use: `the retailers and data_sources settings: ${S}.retailers (names, keys) and ${S}.data_sources.<key>` },
  { re: /on_brand_sheet|brand_sheet/i, use: `the data_sources.brand_sheet setting: ${S}.data_sources.brand_sheet` },
  { re: /naming\s*===?\s*["']/, use: `the column_naming setting (already a settings field): compare to a named constant from lib/client/column-aliases.ts, not a client name` },
  { re: /hasFenderEstimates|analyst[_-]estimates/i, use: `the analyst_estimates setting: ${S}.analyst_estimates (null reads "Analyst estimate not prepared yet for <Brand>")` },
  { re: /clientKey\s*===?\s*["']|\?client=/, use: `the is_default setting: defaultClientKey() from lib/client` },
  { re: /\blead\b|LeadFilter/, use: `the lead brand: leadBrand() (lead_brand_label) from lib/brand-copy.ts, or a neutral filter value such as "lead"` },
  { re: /dealers|sells through|partner/i, use: `the seller_type setting: activeClient().sellerModel ("Partner-led" or "Brand-led")` },
  { re: /DOMAINS|domain|isOwnedDomain|BRAND_SITE|SITE_NAMES/i, use: `the owned_domains and portfolio_brands settings: activeClient().brandSiteDomains, ${S}.portfolio_brands; brandSite() for the label` },
  { re: /Fender, Squier|Fender or|FMIC brand|Squier counts|fender\|squier|Fender-owned/i, use: `brand helpers in lib/brand-copy.ts: leadBrandOr() (lead_brand_phrase), leadBrand(), brandOwned(); ${S}.brand_name_terms or portfolio_brands for lists` },
  { re: /SPEC_FIELD_SET|SPECS_PLACEHOLDER|FINDABILITY_COLUMNS/, use: `the vertical and product_types settings (${S}.vertical), or the shared approved field lists table (decision 107)` },
  { re: /Stratocaster|neck, pickup|specs\b/i, use: `the product_line_terms or vertical setting (${S}.product_line_terms, ${S}.vertical) for vertical-specific copy` },
  { re: /ROTATION_RULE|rotation/i, use: `the catalog_rotation_rule setting: ${S}.catalog_rotation_rule (null names the rule without counts)` },
  { re: /narrative|base\b/i, use: `copy built from settings for every client (brandName(), ${S}.display_name), with Fender's hand-written text moved into data, not a branch` },
  { re: /canvas-client|schema/i, use: `the data_schema and column_naming settings: activeClient().schema, ${S}.column_naming` },
];
export const DEFAULT_FIX = `a settings field from data/clients/<key>.json read through lib/client (activeClient(), ${S}), or a brand helper in lib/brand-copy.ts (brandName(), leadBrand(), leadBrandOr(), brandSite(), brandOwned())`;
const HELPER_DEFINITION_FIX = "remove this helper once its callers read settings fields (each caller's finding names the field)";

/** What to use instead of the branch on this line. `context` is the lines around it; the line itself wins, then the context, then the file name. */
export function suggestFix(text, file = "", context = "") {
  if (/export function is[A-Z]\w*\s*\(/.test(`${text}\n${context}`)) return HELPER_DEFINITION_FIX;
  const rule =
    FIX_RULES.find((r) => r.re.test(text)) ?? FIX_RULES.find((r) => r.re.test(context)) ?? FIX_RULES.find((r) => r.re.test(file));
  return rule ? rule.use : DEFAULT_FIX;
}

/** Findings in one source text: [{ file, line, literal, text, fix }]. Pure, for the unit test. */
export function lintSource(source, file, terms) {
  const wanted = new Set(terms.map((t) => t.toLowerCase()));
  const found = [];
  const lines = stripComments(source);
  lines.forEach((text, index) => {
    const fix = () => suggestFix(text, file, lines.slice(Math.max(0, index - 1), index + 3).join("\n"));
    const call = helperCall(text, [...wanted]);
    if (call) found.push({ file, line: index + 1, literal: call.literal, text: text.trim(), fix: fix() });
    for (const re of [EQ_AFTER, EQ_BEFORE, CASE, METHOD]) {
      re.lastIndex = 0;
      for (const m of text.matchAll(re)) {
        const literal = m[2];
        if (wanted.has(literal.trim().toLowerCase())) {
          found.push({ file, line: index + 1, literal, text: text.trim(), fix: fix() });
          break;
        }
      }
    }
  });
  const seen = new Set();
  return found.filter((f) => (seen.has(f.line) ? false : seen.add(f.line)));
}

function* walk(path) {
  const stat = statSync(path);
  if (stat.isFile()) return void (yield path);
  for (const name of readdirSync(path)) {
    if (name === "node_modules" || name === ".next" || name.startsWith(".")) continue;
    yield* walk(join(path, name));
  }
}

/** Every finding in the repo. */
export function lintRepo(root = ROOT) {
  const terms = loadTerms(root);
  const findings = [];
  for (const dir of SCAN_DIRS) {
    for (const full of walk(join(root, dir))) {
      const file = relative(root, full).split(sep).join("/");
      if (!/\.(tsx?|jsx?|mjs)$/.test(file)) continue;
      if (OUT_OF_SCOPE.some((p) => file.startsWith(p))) continue;
      findings.push(...lintSource(readFileSync(full, "utf8"), file, terms));
    }
  }
  return findings;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = process.argv.includes("--report");
  const findings = lintRepo();
  for (const f of findings) {
    console.log(`${f.file}:${f.line}: branches on a client (${f.literal}): ${f.text}`);
    console.log(`  use instead: ${f.fix}`);
  }
  const files = new Set(findings.map((f) => f.file)).size;
  console.log(`lint:clients ${findings.length} finding${findings.length === 1 ? "" : "s"} in ${files} file${files === 1 ? "" : "s"}`);
  process.exit(report || findings.length === 0 ? 0 : 1);
}
