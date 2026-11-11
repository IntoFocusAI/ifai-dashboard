// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/ai-search-run-summary-lead.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { leadRateTip, roleRateLead, UNBRANDED_RATE_BANDS } from "../lib/ai-search/summary.ts";

const flat = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8").replace(/\s+/g, " ");
const PANEL = "components/v3/live/ai-search/RunSummaryPanel.tsx";
const SURFACE = "components/v3/live/ai-search/AiSearchSurface.tsx";

test("Run Summary opens on the two lead rates, then the trend, then the breakdowns (X-03)", () => {
  const panel = flat(PANEL);
  const body = panel.slice(panel.indexOf("function SummaryBody"));
  const order = [
    "<SummaryLead snapshot={snapshot} unit={unit} mixed={mixed} />",
    "{trend ? <div style={{ marginTop: 12 }}>{trend}</div> : null}",
    "<WinCard snapshot={snapshot} />",
    "<EngineTable ",
    "<CategoryTable ",
    "<RunCompletenessCard snapshot={snapshot} />",
  ].map((part) => {
    const at = body.indexOf(part);
    assert.ok(at >= 0, part);
    return at;
  });
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  assert.match(panel, /const trend = useTrendSlot\(\);/);
});

test("each lead rate is a colored percentage with its disc and N of M, like Run Details and Engine Comparison", () => {
  const panel = flat(PANEL);
  const lead = panel.slice(panel.indexOf("function RoleRate"), panel.indexOf("function keptOut"));
  assert.match(lead, /const lead = roleRateLead\(tally, bands\);/);
  assert.match(lead, /className="ai-lead-figure" style=\{\{ color: lead\.color \}\} data-ai-win-rate=\{tally\.role\} data-ai-lead-figure=\{tally\.role\}/);
  assert.match(lead, /<MixedScoringTip mixed=\{mixed\} basis=\{\{ label: `\$\{label\} rate`, note: leadRateTip\(tally\) \}\}> \{lead\.rate\} <\/MixedScoringTip>/);
  assert.match(lead, /<CitationPieDisc pie=\{ratePie\(`summary-\$\{tally\.role\}`, label, tally\)\}/);
  assert.match(lead, /data-ai-role-total=\{tally\.role\}/);
  assert.match(lead, /\{formatInt\(tally\.fenderWins\)\} \{leadBrand\(\)\} leads <\/EvidenceLink>\{" "\} of\{" "\} <EvidenceLink focus=\{\{ field: "role", value: `\$\{tally\.role\}\/resolved` \}\} tab=\{SIM\}> \{formatInt\(tally\.resolved\)\} <\/EvidenceLink>/);
  assert.match(lead, /`No resolved answers in this \$\{unit\}`/);
  assert.doesNotMatch(lead, /\btitle=/);
  assert.match(panel, /label="Unbranded Discovery" bands=\{UNBRANDED_RATE_BANDS\}/);
  assert.match(panel, /label="Branded Consideration" bands=\{BRANDED_RATE_BANDS\}/);

  const rate = roleRateLead({ fenderWins: 26, resolved: 43 }, UNBRANDED_RATE_BANDS);
  assert.equal(rate.rate, "60.5%");
  assert.ok(rate.color);
  assert.match(leadRateTip({ fenderWins: 26, resolved: 43 }), /^26 of 43 resolved answers named Fender\/Squier most\./);
});

test("the surface hands the trend to Run Summary once the selection loads, and keeps it on top otherwise", () => {
  const surface = flat(SURFACE);
  assert.match(surface, /if \(read\.phase === "ready"\) return <TrendSlot value=\{<CollapsibleTrend \/>\}>\{children\}<\/TrendSlot>;/);
  const fallback = surface.slice(surface.indexOf('if (read.phase === "ready")'));
  assert.match(fallback, /<> <CollapsibleTrend \/> \{children\} <\/>/);
  assert.match(surface, /export function useTrendSlot\(\): ReactNode \{ return useContext\(TrendSlot\); \}/);
});
