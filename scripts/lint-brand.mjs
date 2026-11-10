#!/usr/bin/env node
/* lint:brand — fast brand-rule checks with no dependencies.

   Rules (each prints file:line):
     font-weight     font-weight above 600 in .css files, and fontWeight above 600
                     in .ts/.tsx style objects (components/, app/, lib/)
     native-title    title= on an intrinsic JSX element (<div title=…>); tooltips
                     must be custom (components/, app/, lib/)
     tsx-size        .tsx file over 400 lines (components/, app/, lib/)
     contraction     contraction in client-facing copy
     emoji           emoji in client-facing copy
     em-dash         em dash in client-facing copy (a string that is only "—" is
                     reported as em-dash-placeholder so it can be triaged apart)

   Client-facing copy = string literals, template literal text and JSX text in
   components/ and lib/fender-canvas/. Comments, tests, className strings,
   console.* calls and import paths are skipped.

   Usage: node scripts/lint-brand.mjs [--summary] [--rule=<name>]
   Exit 1 when any violation is found. */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const MAX_TSX_LINES = 400;

/* Allow-list. Each entry is a repo-relative path prefix and the rules it skips.
   Keep it short and say why. */
const ALLOW = [
  // Internal SDK docs and design-system playground; not shown to clients.
  { path: "components/sdk/", rules: ["contraction", "emoji", "em-dash", "em-dash-placeholder"], why: "internal SDK docs, not client-facing" },
];

const args = process.argv.slice(2);
const summaryOnly = args.includes("--summary");
const onlyRule = args.find((a) => a.startsWith("--rule="))?.slice(7);

const SKIP_DIRS = new Set(["node_modules", ".next", "out", "dist", "__tests__"]);
function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const rel = (p) => relative(ROOT, p).split(sep).join("/");
const isTest = (r) => /\.(test|spec)\.(t|j)sx?$/.test(r) || r.includes("/__tests__/");
const allowed = (r, rule) => ALLOW.some((a) => r.startsWith(a.path) && a.rules.includes(rule));

const findings = [];
function report(file, line, rule, text) {
  if (allowed(file, rule)) return;
  if (onlyRule && onlyRule !== rule) return;
  findings.push({ file, line, rule, text: text.replace(/\s+/g, " ").trim().slice(0, 100) });
}

/* ---------- Scanner ----------
   Returns { code, strings }. `code` is the source with comments and string
   contents replaced by spaces (newlines kept, so offsets and lines line up).
   What remains in `code` outside real code is JSX text. `strings` lists each
   string literal / template chunk with its start offset. */
const KEYWORDS_BEFORE_EXPR = new Set(["return", "case", "typeof", "in", "of", "from", "import", "export", "default", "else", "yield", "await", "void", "delete", "throw", "new"]);

function scan(src) {
  const out = src.split("");
  const strings = [];
  const n = src.length;
  let i = 0;
  // stack of template-literal brace depths: when a `${` opens we push the depth.
  const tplStack = [];
  let braceDepth = 0;

  const blank = (a, b) => { for (let k = a; k < b; k++) if (out[k] !== "\n") out[k] = " "; };
  const prevSignificant = (pos) => {
    let k = pos - 1;
    while (k >= 0 && /\s/.test(out[k])) k--;
    if (k < 0) return { ch: "", word: "" };
    const ch = out[k];
    let w = "";
    if (/[A-Za-z_$]/.test(ch)) {
      let j = k;
      while (j >= 0 && /[A-Za-z0-9_$]/.test(out[j])) j--;
      w = out.slice(j + 1, k + 1).join("");
    }
    return { ch, word: w };
  };
  const startsExpr = (pos) => {
    const { ch, word } = prevSignificant(pos);
    if (ch === "") return true;
    if (word) return KEYWORDS_BEFORE_EXPR.has(word);
    if (/[0-9)\]]/.test(ch)) return false;
    return true; // operator, paren, bracket, brace, comma, etc.
  };

  function readTemplate(start) {
    // i points just after the opening backtick
    let chunkStart = start;
    while (i < n) {
      const c = src[i];
      if (c === "\\") { i += 2; continue; }
      if (c === "`") {
        strings.push({ start: chunkStart, text: src.slice(chunkStart, i), template: true });
        blank(chunkStart, i);
        i++;
        return true;
      }
      if (c === "$" && src[i + 1] === "{") {
        strings.push({ start: chunkStart, text: src.slice(chunkStart, i), template: true });
        blank(chunkStart, i);
        i += 2;
        tplStack.push(braceDepth);
        braceDepth++;
        return false; // back to code; resume template on matching }
      }
      i++;
    }
    blank(chunkStart, n);
    return true;
  }

  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === "/" && d === "/") {
      const e = src.indexOf("\n", i);
      const end = e < 0 ? n : e;
      blank(i, end);
      i = end;
      continue;
    }
    if (c === "/" && d === "*") {
      const e = src.indexOf("*/", i + 2);
      const end = e < 0 ? n : e + 2;
      blank(i, end);
      i = end;
      continue;
    }
    if (c === "\"" || c === "'") {
      // An apostrophe after a word character is JSX text ("Don't"), not a string.
      if (c === "'" && !startsExpr(i)) { i++; continue; }
      if (c === "\"" && !startsExpr(i)) {
        // JSX attribute values follow `=`, which startsExpr accepts; a quote after
        // a word is JSX text.
        i++; continue;
      }
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== "\n") { if (src[j] === "\\") j++; j++; }
      strings.push({ start: i + 1, text: src.slice(i + 1, j), template: false });
      blank(i + 1, j);
      i = j + 1;
      continue;
    }
    if (c === "`") {
      i++;
      readTemplate(i);
      continue;
    }
    if (c === "/" && startsExpr(i) && d !== ">") {
      // Regex literal. Guard against JSX closing tags (`</div>`), which follow `<`.
      const { ch } = prevSignificant(i);
      if (ch !== "<") {
        let j = i + 1;
        let inClass = false;
        let ok = false;
        while (j < n && src[j] !== "\n") {
          if (src[j] === "\\") { j += 2; continue; }
          if (src[j] === "[") inClass = true;
          else if (src[j] === "]") inClass = false;
          else if (src[j] === "/" && !inClass) { ok = true; break; }
          j++;
        }
        if (ok) { blank(i + 1, j); i = j + 1; continue; }
      }
    }
    if (c === "{") { braceDepth++; i++; continue; }
    if (c === "}") {
      braceDepth--;
      if (tplStack.length && tplStack[tplStack.length - 1] === braceDepth) {
        tplStack.pop();
        i++;
        readTemplate(i);
        continue;
      }
      i++;
      continue;
    }
    i++;
  }
  return { code: out.join(""), strings };
}

function lineStarts(src) {
  const starts = [0];
  for (let k = 0; k < src.length; k++) if (src[k] === "\n") starts.push(k + 1);
  return starts;
}
function lineOf(starts, off) {
  let lo = 0, hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= off) lo = mid; else hi = mid - 1;
  }
  return lo + 1;
}

/* ---------- Copy rules ---------- */
const CONTRACTION = new RegExp(
  String.raw`\b(?:[A-Za-z]+n['’]t|(?:I|you|we|they|it|that|there|here|what|who|let|he|she|where|how|this)['’](?:s|re|ve|ll|d|m)|I['’]m|[A-Za-z]+['’](?:re|ve|ll))\b`,
  "i",
);
const EMOJI = /\p{Emoji_Presentation}|\p{Extended_Pictographic}️/u;
const EM_DASH = /—|\\u2014|&mdash;|&#8212;/;
const ENTITY_APOS = /&apos;|&rsquo;|&#39;|&#x27;/g;

function checkCopy(file, text, line, ctx) {
  const t = text.replace(ENTITY_APOS, "'");
  const m = t.match(CONTRACTION);
  if (m) report(file, line, "contraction", `${m[0]}  in  ${ctx}`);
  if (EMOJI.test(t)) report(file, line, "emoji", ctx);
  if (EM_DASH.test(t)) {
    const placeholder = /^\s*(—|\\u2014|&mdash;)\s*$/.test(t);
    report(file, line, placeholder ? "em-dash-placeholder" : "em-dash", ctx);
  }
}

const CLASSNAME_BEFORE = /(?:className|class)\s*[=:]\s*\{?\s*(?:[\w.]+\s*\?\s*|.*\|\|\s*|.*&&\s*)?$|(?:\bcn|clsx|classNames|twMerge|cx)\(\s*[^)]*$/;

function lintCopy(file, src) {
  const { code, strings } = scan(src);
  const starts = lineStarts(src);
  const lines = src.split("\n");
  for (const s of strings) {
    if (!s.text) continue;
    const line = lineOf(starts, s.start);
    const before = code.slice(Math.max(0, s.start - 80), s.start - 1);
    const beforeLine = before.slice(before.lastIndexOf("\n") + 1);
    if (CLASSNAME_BEFORE.test(beforeLine)) continue;
    const srcLine = lines[line - 1] ?? "";
    if (/console\.\w+\(/.test(srcLine)) continue;
    if (/^\s*(import|export)\b.*\bfrom\b/.test(srcLine)) continue;
    checkCopy(file, s.text, line, s.text);
  }
  // JSX text: whatever copy survives in `code` (strings and comments are blanked,
  // and real code never contains contractions, em dashes or emoji).
  const codeLines = code.split("\n");
  codeLines.forEach((l, k) => {
    if (!/[A-Za-z'’—&\p{Extended_Pictographic}]/u.test(l)) return;
    checkCopy(file, l, k + 1, l);
  });
}

/* ---------- Font weight ---------- */
const CSS_WEIGHT = /font-weight\s*:\s*(\d+|bold|bolder)\b/gi;
const CSS_FONT_SHORTHAND = /(?:^|[;{\s])font\s*:\s*[^;]*?\b(700|800|900|bold|bolder)\b/gi;
const TS_WEIGHT = /fontWeight\s*:\s*["'`]?(\d+|bold|bolder)\b/g;
const heavy = (v) => (/^\d+$/.test(v) ? Number(v) > 600 : /^bold(er)?$/i.test(v));

function lintCss(file, src) {
  const noComments = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  noComments.split("\n").forEach((l, k) => {
    for (const re of [CSS_WEIGHT, CSS_FONT_SHORTHAND]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(l))) if (heavy(m[1])) report(file, k + 1, "font-weight", l);
    }
  });
}
function lintTsWeight(file, src) {
  const { code, strings } = scan(src);
  // Re-insert string contents so `fontWeight: "700"` is visible, but keep
  // comments blanked.
  const arr = code.split("");
  for (const s of strings) for (let k = 0; k < s.text.length; k++) arr[s.start + k] = s.text[k];
  arr.join("").split("\n").forEach((l, k) => {
    TS_WEIGHT.lastIndex = 0;
    let m;
    while ((m = TS_WEIGHT.exec(l))) if (heavy(m[1])) report(file, k + 1, "font-weight", l);
    // Tailwind arbitrary weights / bold classes inside className strings
    if (/\bfont-(bold|extrabold|black|\[(7|8|9)00\])\b/.test(l)) report(file, k + 1, "font-weight", l);
  });
}

/* ---------- Native title ---------- */
function lintTitle(file, src) {
  const { code } = scan(src);
  const starts = lineStarts(src);
  const tagRe = /<([a-z][a-z0-9]*)(?=[\s/>])/g;
  let m;
  while ((m = tagRe.exec(code))) {
    // Must look like JSX: previous significant char is not an identifier/number/`)`.
    let k = m.index - 1;
    while (k >= 0 && /\s/.test(code[k])) k--;
    if (k >= 0 && /[A-Za-z0-9_$)\]]/.test(code[k])) continue;
    // Walk to the end of the opening tag at brace depth 0.
    let j = m.index + m[0].length;
    let depth = 0;
    let attrStart = j;
    while (j < code.length) {
      const c = code[j];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0 && code[j - 1] !== "=") break;
      j++;
    }
    const attrs = code.slice(attrStart, j);
    // Find title= at depth 0
    let dd = 0;
    for (let q = 0; q < attrs.length; q++) {
      const c = attrs[q];
      if (c === "{") dd++;
      else if (c === "}") dd--;
      else if (dd === 0 && /\btitle=$/.test(attrs.slice(Math.max(0, q - 6), q + 1)) && !/[\w-]/.test(attrs[q - 6] ?? " ")) {
        const off = attrStart + q;
        const line = lineOf(starts, off);
        report(file, line, "native-title", `<${m[1]} … title=`);
      }
    }
  }
}

/* ---------- Run ---------- */
const roots = ["components", "app", "lib"].map((d) => join(ROOT, d));
const files = roots.flatMap((r) => walk(r)).map((p) => ({ abs: p, rel: rel(p) }));

for (const { abs, rel: r } of files) {
  if (isTest(r)) continue;
  const isCss = r.endsWith(".css");
  const isTsx = r.endsWith(".tsx");
  const isTs = r.endsWith(".ts");
  if (!isCss && !isTsx && !isTs) continue;
  const src = readFileSync(abs, "utf8");
  if (isCss) { lintCss(r, src); continue; }
  lintTsWeight(r, src);
  if (isTsx) {
    lintTitle(r, src);
    const n = src.split("\n").length - (src.endsWith("\n") ? 1 : 0);
    if (n > MAX_TSX_LINES) report(r, 1, "tsx-size", `${n} lines (max ${MAX_TSX_LINES})`);
  }
  if (r.startsWith("components/") || r.startsWith("lib/fender-canvas/")) lintCopy(r, src);
}

findings.sort((a, b) => a.rule.localeCompare(b.rule) || a.file.localeCompare(b.file) || a.line - b.line);
const counts = {};
for (const f of findings) counts[f.rule] = (counts[f.rule] ?? 0) + 1;

if (!summaryOnly) {
  for (const f of findings) console.log(`${f.file}:${f.line}  [${f.rule}]  ${f.text}`);
  if (findings.length) console.log("");
}
console.log("lint:brand summary");
for (const rule of ["font-weight", "native-title", "tsx-size", "contraction", "emoji", "em-dash", "em-dash-placeholder"]) {
  console.log(`  ${rule.padEnd(20)} ${counts[rule] ?? 0}`);
}
console.log(`  ${"total".padEnd(20)} ${findings.length}`);
if (ALLOW.length) {
  console.log("allow-listed:");
  for (const a of ALLOW) console.log(`  ${a.path}  (${a.rules.join(", ")}): ${a.why}`);
}
process.exit(findings.length ? 1 : 0);
