#!/usr/bin/env node
/* lint:status — X-34 status color checks (brand book pp. 10-11, decisions 26, 27).

   Rules (each finding prints file:line):
     status-without-mark  A .tsx file that paints a status color (Oxblood, Champagne,
                          Pine: the status tokens, their danger/warning/success aliases,
                          dataStatusColor/dataStatusFill, or a class the stylesheets paint
                          in a status color) but never renders the mark and word
                          (StatusMark, StatusFigure, StatusGlyph, AiStatusTag, or the
                          mark path itself). Status color without the mark is the X-34
                          defect. Plain .ts helpers that only return a color are checked
                          where they render, by e2e/status-marks.spec.ts on every tab.
     non-brand-hex        A hex color with a hue (not a gray) in components/ or lib/ that is
                          not in the brand book: old red, amber, green, sky blue, or indigo.
     status-on-control    A stylesheet paints a status color on a button, a menu item, or a
                          star (status colors only on data, decision 27).

   Scope: components/ and lib/. Out of scope, with the reason:
     components/intofocus-portal, lib/intofocus-portal  not routed (no app/ page imports it)
     components/marketing, lib/marketing                the marketing site, not the dashboard
     components/staff, components/v3/prompts, lib/prompts  owned by open PRs 204 and 206
     (app/ is not scanned: its profile and security pages sit outside the client tabs)
     components/v3/FenderBrandCanvas.tsx                owned by open PR 110 (a fallback hex)

   Usage: node scripts/lint-status-marks.mjs   (exit 1 on any finding) */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

export const OUT_OF_SCOPE = [
  "components/intofocus-portal/",
  "lib/intofocus-portal/",
  "components/marketing/",
  "lib/marketing/",
  "components/staff/",
  "components/v3/prompts/",
  "lib/prompts/",
  "components/v3/FenderBrandCanvas.tsx",
];

/** Brand book V2 colors (pp. 7-11, 22-23) plus the light-theme status tints PR 148 set. */
export const BRAND_HEX = new Set(
  (
    "070b14 0b1220 0e2420 141e33 17583f 194257 1f6b4f 230f14 262010 307191 334155 475569 " +
    "4e97bc 64748b 6ab792 6e1f2a 6e5617 7f6420 8b95a7 8c232f a7d8f0 aeb8c7 c9d4df cc5b63 " +
    "d4b66f d4ebf7 e4e9ee f8fafc f9fafb dfe5eb f9f1f2 f8f5ec eef6f2"
  ).split(" "),
);

/* Files that paint a status color with no mark of their own, each with the reason. */
export const ALLOW_STATUS_WITHOUT_MARK = new Map([
  ["components/v3/live/StatusMark.tsx", "the mark itself"],
  // Map: decisions 59 and 91. Bubble and satellite figures carry the glyph without the word
  // (HeroFigureText, NodeTooltip); the ring color follows the same figure.
  ["lib/canvas-sdk/CanvasGraph.tsx", "map rings follow the bubble figure's glyph (decisions 59, 91)"],
  ["lib/canvas-sdk/GraphPrimitives.tsx", "map rings follow the bubble figure's glyph (decisions 59, 91)"],
]);

/* Text that paints a status color in a .ts/.tsx file. */
const STATUS_PAINT = [
  /var\(--(?:status-(?:bad|okay|good)(?:-tint|-deep|-main|-ink)?|danger-(?:red|text|bg)|success-(?:green|text|bg)|warning-(?:amber|text|bg)|color-amber)\)/,
  /\bdataStatus(?:Color|Fill)\(/,
  /\btone-(?:danger|warning|success)\b/,
  /\b(?:content-box|ceo-callout|fo-reading|action-card) (?:critical|warning|ok)\b/,
  /\bcc-sev-(?:critical|high)\b/,
  /\bcc-quadrant-critical\b/,
  /\bticker-badge-(?:danger|warning|success)\b/,
  /\btag-(?:danger|warning|success|queued)\b/,
];

/* Text that renders the mark and word next to the color. */
const STATUS_MARK = /\b(?:StatusMark|StatusFigure|StatusGlyph|AiStatusTag|DATA_STATUS_MARK_PATH)\b/;

const SKIP_DIRS = new Set(["node_modules", ".next", "out", "dist", "__tests__"]);
function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const isTest = (r) => /\.(test|spec)\.(t|j)sx?$/.test(r);
const inScope = (r) => !OUT_OF_SCOPE.some((prefix) => r.startsWith(prefix)) && !isTest(r);

/** Strip comments so prose about colors does not count. Keeps line breaks. */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`\\])\/\/.*$/gm, (m, lead) => lead + " ".repeat(m.length - lead.length));
}

function hexIsChromatic(hex) {
  const h = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  const [r, g, b] = [0, 2, 4].map((k) => parseInt(h.slice(k, k + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max - min >= 0.08;
}

export function lintStatusMarks(root = ROOT) {
  const findings = [];
  const files = [...walk(join(root, "components")), ...walk(join(root, "lib"))]
    .map((p) => ({ abs: p, rel: relative(root, p).split(sep).join("/") }))
    .filter((f) => /\.(tsx?|css)$/.test(f.rel) && inScope(f.rel));

  for (const f of files) {
    const src = stripComments(readFileSync(f.abs, "utf8"));
    const lines = src.split("\n");

    // non-brand-hex: every file type.
    lines.forEach((line, i) => {
      for (const m of line.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)) {
        const hex = m[1].toLowerCase();
        const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
        if (BRAND_HEX.has(full) || !hexIsChromatic(hex)) continue;
        // `#abc` inside a URL fragment or an id selector is not a color.
        if (/[\w-]$/.test(line.slice(0, m.index))) continue;
        findings.push({ file: f.rel, line: i + 1, rule: "non-brand-hex", text: `#${hex}` });
      }
    });

    if (f.rel.endsWith(".css")) {
      // status-on-control: a status color on a button, menu item, or star.
      let selector = "";
      lines.forEach((line, i) => {
        if (line.includes("{")) selector = line.split("{")[0].trim() || selector;
        if (line.trim().startsWith("--")) return;
        if (!STATUS_PAINT[0].test(line)) return;
        if (/(btn|button|menu-item|star)\b/.test(selector) && !/data-status/.test(selector)) {
          findings.push({ file: f.rel, line: i + 1, rule: "status-on-control", text: selector });
        }
      });
      continue;
    }

    // status-without-mark: .tsx files.
    if (!f.rel.endsWith(".tsx")) continue;
    if (ALLOW_STATUS_WITHOUT_MARK.has(f.rel) || STATUS_MARK.test(src)) continue;
    lines.forEach((line, i) => {
      if (STATUS_PAINT.some((re) => re.test(line))) {
        findings.push({ file: f.rel, line: i + 1, rule: "status-without-mark", text: line.trim().slice(0, 100) });
      }
    });
  }
  return findings;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const findings = lintStatusMarks();
  for (const f of findings) console.log(`${f.file}:${f.line}  ${f.rule}  ${f.text}`);
  console.log(findings.length ? `\n${findings.length} status color issue(s).` : "lint:status: no issues.");
  process.exit(findings.length ? 1 : 0);
}

