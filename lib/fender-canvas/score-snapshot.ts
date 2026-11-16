import type { AiSearchRead } from "@/lib/ai-search/types";
import type { ClientKey } from "@/lib/client/active-client";
import {
  commerceInputsFromLive,
  consensusFromLive,
  foundationInputsFromLive,
} from "@/lib/fender-canvas/consensus-scores-from-live";
import type { ConsensusScore } from "@/lib/fender-canvas/consensus-scores";
import type { SpecPageSummary } from "@/lib/fender-canvas/machine-readability";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";
import type { FindabilityRead } from "@/lib/findability/copy";

/**
 * The weekly score save (decision 94). The scores come from consensusFromLive, the function the
 * Summary → Performance cards use, on the same reads the screen makes. No second copy of the formula.
 */

/** The reads the Performance cards score from, as the dashboard makes them on first load. */
export type ScoreSnapshotReads = {
  findability: FindabilityRead;
  specPages: SpecPageSummary | null;
  retail: RetailCanvasRead;
  /** The AI read for the default date pill (last 30 days, engines All), as Summary shows it. */
  ai: AiSearchRead;
  /** What that AI read covered, kept with the inputs. */
  aiWindow: { pillLabel: string; runCount: number; enginesReady: boolean; newestRunAt: string | null } | null;
};

export type ScoreSnapshot = {
  /** client_key in public tables: "fmic" or "ledlenser". */
  clientKey: string;
  weekStart: string;
  consensus: number | null;
  foundation: number | null;
  commerce: number | null;
  actuation: number | null;
  inputs: Record<string, unknown>;
};

/** Monday (UTC) of the week holding `at`, as YYYY-MM-DD. */
export function weekStartUtc(at: Date): string {
  const day = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  const offset = (day.getUTCDay() + 6) % 7;
  day.setUTCDate(day.getUTCDate() - offset);
  return day.toISOString().slice(0, 10);
}

function rounded(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value * 100) / 100;
}

function pillarRecord(pillar: ConsensusScore["foundation"]) {
  return {
    score: rounded(pillar.score),
    weight: rounded(pillar.weight),
    included: pillar.included,
    coverage: pillar.coverage,
    components: pillar.components.map((component) =>
      component.included
        ? { id: component.id, included: true, score: rounded(component.score), weight: rounded(component.weight), coverage: component.coverage }
        : { id: component.id, included: false, score: null, weight: null, coverage: null },
    ),
  };
}

/**
 * One client's scores for one week, or null when the retail read did not load (the cards then read
 * "not available until the retail reading loads", and nothing is saved).
 */
export function scoreSnapshotFromReads(
  client: { key: ClientKey; setAsideKey: string },
  weekStart: string,
  reads: ScoreSnapshotReads,
  savedFrom: { commit: string | null } = { commit: null },
): ScoreSnapshot | null {
  // A viewer who has not saved their own authorized-seller list sees the placeholder (null here).
  const consensus = consensusFromLive({
    findability: reads.findability,
    specPages: reads.specPages,
    retail: reads.retail,
    ai: reads.ai,
    authorizedPartners: null,
  });
  if (!consensus) return null;
  return {
    clientKey: client.setAsideKey,
    weekStart,
    consensus: rounded(consensus.score),
    foundation: rounded(consensus.foundation.included ? consensus.foundation.score : null),
    commerce: rounded(consensus.commerce.included ? consensus.commerce.score : null),
    actuation: rounded(consensus.actuation.included ? consensus.actuation.score : null),
    inputs: {
      client: client.key,
      foundationInputs: foundationInputsFromLive(reads),
      commerceInputs: commerceInputsFromLive(reads.retail, null),
      coverage: consensus.coverage,
      pillars: {
        foundation: pillarRecord(consensus.foundation),
        commerce: pillarRecord(consensus.commerce),
        actuation: pillarRecord(consensus.actuation),
      },
      reads: {
        findability: reads.findability.phase,
        specPages: reads.specPages ? "ready" : "failed",
        retail: reads.retail.phase,
        ai: reads.ai.phase,
      },
      aiWindow: reads.aiWindow,
      commit: savedFrom.commit,
    },
  };
}

function sqlNumber(value: number | null): string {
  return value == null ? "null" : String(value);
}

/** A dollar-quote tag that does not occur in the text, so the JSON goes in unchanged. */
function dollarQuote(text: string): string {
  let tag = "scores";
  let n = 0;
  while (text.includes(`$${tag}$`)) tag = `scores${(n += 1)}`;
  return `$${tag}$${text}$${tag}$`;
}

const CLIENT_KEY = /^[a-z0-9-]{2,40}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** One call to the save function. Numbers and keys are checked; the inputs JSON is dollar-quoted. */
export function snapshotSaveSql(snapshot: ScoreSnapshot): string {
  if (!CLIENT_KEY.test(snapshot.clientKey)) throw new Error(`Bad client key: ${snapshot.clientKey}`);
  if (!DAY.test(snapshot.weekStart)) throw new Error(`Bad week: ${snapshot.weekStart}`);
  const args = [
    `'${snapshot.clientKey}'`,
    `date '${snapshot.weekStart}'`,
    sqlNumber(snapshot.consensus),
    sqlNumber(snapshot.foundation),
    sqlNumber(snapshot.commerce),
    sqlNumber(snapshot.actuation),
    `${dollarQuote(JSON.stringify(snapshot.inputs))}::jsonb`,
  ];
  return `select public.canvas_score_snapshot_save(${args.join(", ")});`;
}
