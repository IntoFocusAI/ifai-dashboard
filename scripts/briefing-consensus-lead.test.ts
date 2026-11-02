// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/briefing-consensus-lead.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  BRIEFING_CONSENSUS_UNAVAILABLE,
  briefingConsensusSentence,
} from "../lib/fender-canvas/briefing-consensus-sentence.ts";
import { consensusFromLive } from "../lib/fender-canvas/consensus-scores-from-live.ts";
import { scoreToneColor } from "../lib/fender-canvas/consensus-score-display.ts";
import { formatPct, formatRatio } from "../lib/fender-canvas/format.ts";
import type { FindabilityRow } from "../lib/findability/outcomes.ts";

const root = new URL("..", import.meta.url).pathname;
const read = (path: string) => readFileSync(join(root, path), "utf8");

function findabilityRow(asin: string, state: string): FindabilityRow {
  return {
    asin,
    title: "Listing",
    category: "Solid Body",
    product_kind: "instrument",
    latest_state: state,
    latest_canonical_url: null,
    latest_variant_sku: null,
    confidence: null,
    explanation: null,
    source_method: null,
    http_status: null,
    latest_attempt_at: null,
    jsonld_status: "not_checked",
    counts_as_confirmed: false,
    counts_as_finished_search: false,
    counts_as_ambiguous: false,
    counts_as_unchecked: state === "not_checked",
    counts_as_completed_not_found: false,
    counts_as_blocked: false,
    counts_as_timeout: false,
    counts_as_parse_failure: false,
    counts_as_unsupported: false,
  };
}

test("consensus sentence uses the same rounded score and pillar coverage as the score card", () => {
  assert.equal(
    briefingConsensusSentence({ score: 72, coverage: { numerator: 2, denominator: 3 } }),
    "AI Consensus is 72, from 2 of 3 pillars.",
  );
  assert.equal(
    briefingConsensusSentence({ score: 72.4, coverage: { numerator: 2, denominator: 3 } }),
    `AI Consensus is ${formatPct(72.4, 0).replace(/%$/, "")}, from ${formatRatio(2, 3)} pillars.`,
  );
  assert.equal(
    briefingConsensusSentence({ score: 0, coverage: { numerator: 1, denominator: 3 } }),
    "AI Consensus is 0, from 1 of 3 pillars.",
  );
  const sentence = briefingConsensusSentence({
    score: 72,
    coverage: { numerator: 2, denominator: 3 },
  });
  assert.equal(sentence.split(".").filter((part) => part.trim()).length, 1);
  assert.equal(scoreToneColor(72), "var(--success-green)");
  assert.equal(scoreToneColor(70), "var(--warning-amber)");
  assert.equal(scoreToneColor(40), "var(--warning-amber)");
  assert.equal(scoreToneColor(39.9), "var(--danger-red)");
});

test("a missing consensus score is one sentence and does not invent a number", () => {
  assert.equal(briefingConsensusSentence(null), BRIEFING_CONSENSUS_UNAVAILABLE);
  assert.equal(
    briefingConsensusSentence({ score: null, coverage: { numerator: 0, denominator: 3 } }),
    BRIEFING_CONSENSUS_UNAVAILABLE,
  );
  assert.equal(
    briefingConsensusSentence({ score: Number.NaN, coverage: { numerator: 2, denominator: 3 } }),
    BRIEFING_CONSENSUS_UNAVAILABLE,
  );
  assert.equal(BRIEFING_CONSENSUS_UNAVAILABLE, "AI Consensus is not available.");
  assert.doesNotMatch(BRIEFING_CONSENSUS_UNAVAILABLE, /\d/);
});

test("the live score feeds the Briefing sentence, including when that score is missing", () => {
  const rows = [
    findabilityRow("B000000001", "exact_official_product"),
    findabilityRow("B000000002", "exact_official_product"),
    findabilityRow("B000000003", "not_checked"),
  ];
  const retail = {
    phase: "ready" as const,
    snapshot: {
      suppressedListings: { status: "unavailable" as const, issueCount: null, missingMessage: "Not stored.", detail: null },
      mapLeakage: { status: "unavailable" as const, issueCount: null, missingMessage: "Not stored.", detail: null },
      unnestedBundles: { status: "unavailable" as const, issueCount: null, missingMessage: "Not stored.", detail: null },
      amazonSpecGaps: { status: "unavailable" as const, issueCount: null, missingMessage: "Not stored.", detail: null },
      controlledBuyBox: { controlled: 72, known: 100, population: 100 },
      headline: null,
    },
  };
  const consensus = consensusFromLive({
    findability: { phase: "ready", rows, dealerBundleLoaded: false },
    specPages: null,
    retail,
    ai: { phase: "error", message: "no run" },
  });
  assert.ok(consensus);
  assert.equal(consensus.coverage.numerator, 2);
  assert.equal(consensus.coverage.denominator, 3);
  const sentence = briefingConsensusSentence(consensus);
  const shown = formatPct(consensus.score, 0).replace(/%$/, "");
  assert.equal(sentence, `AI Consensus is ${shown}, from 2 of 3 pillars.`);
  assert.match(sentence, /^AI Consensus is \d+, from 2 of 3 pillars\.$/);

  assert.equal(
    briefingConsensusSentence(
      consensusFromLive({
        findability: { phase: "error", message: "failed" },
        specPages: null,
        retail: { phase: "error" },
        ai: { phase: "error", message: "failed" },
      }),
    ),
    BRIEFING_CONSENSUS_UNAVAILABLE,
  );
});

test("Briefing renders the consensus sentence and score before the findings hero", () => {
  const spokes = read("components/v3/build-live-spokes.tsx");
  const lead = read("components/v3/live/BriefingConsensusLead.tsx");
  const card = read("components/v3/live/ConsensusScoreView.tsx");
  const hub = spokes.slice(spokes.indexOf("\n  hub:"), spokes.indexOf("\n  ecommerce:"));
  const tab0 = hub.slice(hub.indexOf("\n    0:"), hub.indexOf("\n    1:"));
  const tab1 = hub.slice(hub.indexOf("\n    1:"));

  const consensusAt = tab0.indexOf("<BriefingConsensusLead");
  const heroAt = tab0.indexOf("<BriefingRetailHero");
  const essayAt = tab0.indexOf("htmlBlock(bindCopy(HUB_BRIEFING_HTML");
  assert.ok(consensusAt >= 0 && heroAt > consensusAt && essayAt > heroAt);
  assert.equal(tab0.includes("FenderDivisionsTable"), false);
  assert.equal(tab0.includes("ConsensusLeadBand"), false);

  const scoresAt = tab1.indexOf("<ConsensusScoresPanel");
  const divisionsAt = tab1.indexOf("<FenderDivisionsTable");
  assert.ok(scoresAt >= 0 && divisionsAt > scoresAt);
  assert.equal(tab1.includes("BriefingConsensusLead"), false);
  assert.match(
    tab1,
    /<ConsensusScoresPanel bundle=\{bundle\} retail=\{retail\} \/>\s*<FenderDivisionsTable divisions=\{bundle\.divisions\} \/>/,
  );

  const sentenceAt = lead.indexOf("briefingConsensusSentence(consensus)");
  const cardAt = lead.indexOf("<ScoreHeroCard");
  assert.ok(sentenceAt >= 0 && cardAt > sentenceAt);
  assert.match(lead, /consensusFromLive\(/);
  assert.match(lead, /id="consensus"/);
  assert.match(lead, /label="AI Consensus"/);
  assert.match(lead, /score=\{consensus\?\.score \?\? null\}/);
  assert.match(lead, /coverage=\{consensus\?\.coverage \?\? null\}/);
  assert.doesNotMatch(lead, /consensusScore\(|foundationScore\(|commerceScore\(/);
  assert.doesNotMatch(
    lead,
    /ConsensusLeadBand|ActuationHeroCard|CONSENSUS_EXPLAINER|FenderDivisionsTable|why it matters|Featured Offer|\stitle=/,
  );
  assert.match(card, /function ScoreHeroCard/);
  assert.match(card, /scoreToneColor\(score\)/);
  assert.doesNotMatch(read("lib/fender-canvas/briefing-consensus-sentence.ts"), /CONSENSUS_EXPLAINER_BODY/);
});
