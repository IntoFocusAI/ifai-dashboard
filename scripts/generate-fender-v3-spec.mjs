/**
 * One-off helper: refresh data/fender-v3-spec.json tab templates from spoke-data.ts
 * by applying placeholder rules. Run after editing narrative in spoke-data.ts:
 *   node scripts/generate-fender-v3-spec.mjs
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const spokePath =
  process.argv[2] ??
  join(root, ".tmp/spoke-data-source.ts");

function loadSpokeSource() {
  if (process.argv[2]) return readFileSync(spokePath, "utf8");
  const fromGit = spawnSync("git", ["show", "HEAD:components/v3/spoke-data.ts"], {
    cwd: root,
    encoding: "utf8",
  });
  if (fromGit.status === 0 && fromGit.stdout.includes("export const spokeData")) {
    return fromGit.stdout;
  }
  throw new Error(
    "Pass a legacy spoke-data.ts path, or commit spoke-data with inline spokeData for git show.",
  );
}
const outPath = join(root, "data/fender-v3-spec.json");

const RULES = [
  [/3,430/g, "{catalog_skus}"],
  [/3,159/g, "{catalog_skus}"],
  [/993/g, "{bb_total}"],
  [/29\.0%/g, "{active_offer_coverage_pct}"],
  [/71\.0%/g, "{bb_no_offer_pct}"],
  [/7\.4%/g, "{bb_1p_pct}"],
  [/92\.6%/g, "{bb_unharvested_pct}"],
  [/\b74 of 993\b/g, "{bb_1p} of {bb_total}"],
  [/\b919 of 993\b/g, "{bb_unharvested} of {bb_total}"],
  [/\b2,437 of 3,430\b/g, "{bb_no_offer} of {catalog_skus}"],
  [/2\.2%/g, "{seller_harvested_pct}"],
  [/\b74 of 3,430\b/g, "{seller_harvested} of {catalog_skus}"],
  [/73\.3%/g, "{sim_win_pct}"],
  [/33\.3%/g, "{beginner_win_pct}"],
  [/66\.7%/g, "{beginner_top_competitor_pct}"],
  [/16\.7%/g, "{beginner_win_pct}"],
  [/102 Sims/g, "{sim_total} Sims"],
  [/102 calls/g, "{sim_total} calls"],
  [/102 simulations/gi, "{sim_total} simulations"],
  [/All \(102\)/g, "All ({sim_total})"],
  [/\b74\b/g, "{bb_1p}"],
  [/\b919\b/g, "{bb_unharvested}"],
  [/2,437/g, "{bb_no_offer}"],
  [/\b75 of 102\b/g, "{sim_resolved} of {sim_total}"],
  [/\b55 of 75\b/g, "{sim_wins} of {sim_resolved}"],
  [/29\.2%/g, "{spec_fender_found_pct}"],
  [/31\.8%/g, "{spec_fender_found_pct}"],
  [/\b62 of 993\b/g, "{spec_checked} of {bb_total}"],
  [/\b22 of ~993\b/g, "{spec_checked} of ~{bb_total}"],
  [/97\.6%/g, "{spec_avg_amazon_pct}"],
  [/91\.7%/g, "{spec_avg_amazon_pct}"],
  [/14 Flagged/g, "{map_violation_skus} Flagged"],
  [/\b14 splinter\b/gi, "{map_violation_skus} splinter"],
  [/\b14 rogue\b/gi, "{map_violation_skus} rogue"],
  [/\b14 core\b/gi, "14 core"],
  [/\b14 pilot\b/gi, "14 pilot"],
  [/\b14 Lines\b/g, "14 Lines"],
  [/\b14 SKUs\b/g, "14 SKUs"],
  [/\b14 Urgent\b/g, "{map_violation_skus} Urgent"],
  [/\b14 Active\b/g, "{map_violation_skus} Active"],
  [/-\$77\.58/g, "{amz_avg_drift}"],
  [/\b118 active-offer\b/g, "{amz_below_map} active-offer"],
  [/2,420\+/g, "{bundle_reviews}"],
  [/\+\$680K/g, "{phase_one_lift}"],
  [/\+\$38M to \$62M/g, "{enterprise_potential}"],
];

function applyRules(text) {
  let next = text;
  for (const [re, rep] of RULES) next = next.replace(re, rep);
  return next;
}

const src = loadSpokeSource();
const spokeBlock = src.match(/export const spokeData[\s\S]*?^};/m);
if (!spokeBlock) {
  console.error("Could not parse spokeData from spoke-data.ts");
  process.exit(1);
}

/** Minimal parse: pull desc strings and render spokeTabs([...]) arrays per spoke id */
const spokeIds = ["hub", "ecommerce", "aeo", "specs", "competitors", "suggestions", "roadmap"];
const out = { spokes: {} };

for (const id of spokeIds) {
  const re = new RegExp(`${id}:\\s*\\{([\\s\\S]*?)\\n  \\},`, "m");
  const m = spokeBlock[0].match(re);
  if (!m) continue;
  const block = m[1];
  const badge = block.match(/badge:\s*"([^"]+)"/)?.[1] ?? "";
  const title = block.match(/title:\s*"([^"]+)"/)?.[1] ?? "";
  const desc = applyRules(block.match(/desc:\s*"([^"]+)"/)?.[1] ?? "");
  const navLabel = block.match(/navLabel:\s*"([^"]+)"/)?.[1] ?? "";
  const next = block.match(/next:\s*"([^"]+)"/)?.[1] ?? "";
  const tabsRaw = block.match(/tabs:\s*\[([\s\S]*?)\],/)?.[1] ?? "";
  const tabs = [...tabsRaw.matchAll(/"([^"]+)"/g)].map((x) => applyRules(x[1]));
  const renderMatch = block.match(/render:\s*spokeTabs\(\[([\s\S]*?)\]\),/);
  const tabBodies = [];
  if (renderMatch) {
    const arr = renderMatch[1];
    const strings = [...arr.matchAll(/\n"([\s\S]*?)",?\n/g)].map((x) => x[1]);
    for (const s of strings) tabBodies.push(applyRules(s.replace(/\\n/g, "\n").replace(/\\"/g, '"')));
  }
  out.spokes[id] = { badge, title, desc, tabs, navLabel, next, tabTemplates: tabBodies };
}

writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`);
console.log(`Wrote ${outPath}`);
