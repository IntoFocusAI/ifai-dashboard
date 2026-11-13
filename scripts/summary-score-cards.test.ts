// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/summary-score-cards.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  consensusWeightRows,
  SCORE_CARD_TIPS,
  SCORE_CARD_TITLES,
} from "../components/v3/live/score-card-tips.ts";
import { CONSENSUS_EXPLAINER_BODY } from "../lib/fender-canvas/consensus-score-display.ts";
import { consensusScore, type CommerceInputs, type FoundationInputs } from "../lib/fender-canvas/consensus-scores.ts";

/* Worker 26.14: Summary → Performance score cards. Four titled cards with custom tooltips, no
   side panel, and a Consensus chevron that opens the pillar weights (H-07, SC-01 to SC-04). */

function read(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const share = (numerator: number, denominator: number) => ({ numerator, denominator });

const FOUNDATION: FoundationInputs = {
  exactOfficialPages: share(30, 100),
  machineReadableSpecs: share(40, 100),
  requiredMarketplaceSpecs: share(50, 100),
  unbrandedNamedMost: share(60, 100),
  factCheckMatch: share(70, 100),
};

const COMMERCE: CommerceInputs = {
  controlledBuyBox: share(80, 100),
  notSuppressed: share(90, 100),
  activeProductsAvailable: null,
  notSplintered: share(70, 100),
  noMapViolation: share(60, 100),
};

test("the four score cards carry their titles and plain tooltips", () => {
  assert.deepEqual(SCORE_CARD_TITLES, {
    consensus: "AI Consensus Score",
    foundation: "AI Foundation Score",
    commerce: "AI Commerce Score",
    actuation: "AI Actuation Score",
  });
  assert.equal(SCORE_CARD_TIPS.consensus, CONSENSUS_EXPLAINER_BODY);
  assert.match(SCORE_CARD_TIPS.actuation, /^AI Actuation is not included yet because [^.]+\.$/);
  for (const tip of Object.values(SCORE_CARD_TIPS)) {
    const sentences = tip.split(/\.\s+/).filter(Boolean);
    assert.ok(sentences.length <= 4, tip);
    assert.doesNotMatch(tip, /—|–/, "no em or en dashes");
    assert.doesNotMatch(tip, /\b\w+'(t|re|ve|ll|d|m)\b/i, "no contractions");
  }
  for (const id of ["foundation", "commerce", "actuation"] as const) {
    assert.ok(SCORE_CARD_TIPS[id].split(/\.\s+/).filter(Boolean).length <= 2, id);
  }
});

test("the weight breakdown adds up to the computed AI Consensus", () => {
  const consensus = consensusScore(FOUNDATION, COMMERCE);
  const rows = consensusWeightRows(consensus);
  assert.deepEqual(
    rows.map((row) => row.id),
    ["foundation", "commerce", "actuation"],
  );
  const [foundation, commerce, actuation] = rows;

  // Weights are the ones consensusScore assigned: 40 and 40 rescaled to 50 each while Actuation is out.
  assert.equal(foundation.weight, consensus.foundation.weight);
  assert.equal(commerce.weight, consensus.commerce.weight);
  assert.equal(foundation.weight, 50);
  assert.equal(commerce.weight, 50);
  assert.equal(foundation.score, consensus.foundation.score);
  assert.equal(commerce.score, consensus.commerce.score);

  assert.equal(actuation.included, false);
  assert.equal(actuation.weight, null);
  assert.equal(actuation.contribution, null);

  const total = rows.reduce((sum, row) => sum + (row.contribution ?? 0), 0);
  assert.ok(consensus.score != null);
  assert.ok(Math.abs(total - consensus.score) < 1e-9, `${total} vs ${consensus.score}`);
});

test("a pillar with no score drops out of the breakdown and the other carries the whole weight", () => {
  const empty: FoundationInputs = {
    exactOfficialPages: null,
    machineReadableSpecs: null,
    requiredMarketplaceSpecs: null,
    unbrandedNamedMost: null,
    factCheckMatch: null,
  };
  const consensus = consensusScore(empty, COMMERCE);
  const rows = consensusWeightRows(consensus);
  assert.equal(rows[0].included, false);
  assert.equal(rows[0].weight, null);
  assert.equal(rows[1].weight, 100);
  assert.ok(Math.abs((rows[1].contribution ?? 0) - (consensus.score ?? NaN)) < 1e-9);
});

test("Performance has no side panel and the Consensus card opens its weights like the pillars", () => {
  const view = read("components/v3/live/ConsensusScoreView.tsx");
  const breakdown = read("components/v3/live/ConsensusWeightBreakdown.tsx");
  const band = view.slice(view.indexOf("export function ConsensusLeadBand"), view.indexOf("export function CommerceHeroCard"));

  assert.doesNotMatch(view, /ConsensusExplainer|CONSENSUS_EXPLAINER_TITLE|data-consensus-explainer|ceo-callout/);
  assert.match(view, /className="ifai-term"/);
  assert.match(view, /data-ifai-tooltip-desc=\{tip\}/);
  assert.doesNotMatch(view, /(?<![\w-])title=\{|(?<![\w-])title="/, "custom tooltips only");

  for (const id of ["consensus", "foundation", "commerce"]) {
    assert.match(band, new RegExp(`titleTip=\\{SCORE_CARD_TIPS\\.${id}\\}`));
    assert.match(band, new RegExp(`onToggle=\\{\\(\\) => toggle\\("${id}"\\)\\}`));
  }
  assert.match(band, /<ActuationHeroCard pillar=\{consensus\.actuation\} wide \/>/);
  assert.match(band, /open === "consensus" \? <ConsensusWeightBreakdown consensus=\{consensus\} id=\{COMPONENTS_ID\} \/>/);

  assert.match(breakdown, /consensusWeightRows\(consensus\)/);
  assert.match(breakdown, /Not included/);
  assert.match(breakdown, /StatusMark/);
  assert.ok(view.split("\n").length <= 400);
  assert.ok(breakdown.split("\n").length <= 400);
});
