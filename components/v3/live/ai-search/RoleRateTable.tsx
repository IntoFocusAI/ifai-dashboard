"use client";

import type { ReactNode } from "react";
import { clientColumn, type RetailColumn } from "@/components/v3/live/ResizableTable";
import { AiTerm } from "@/components/v3/live/ai-search/AiTerm";
import { EvidenceLink } from "@/components/v3/live/ai-search/EvidenceLink";
import { AI_TABS } from "@/lib/ai-search/canvas-surfaces";
import type { AiTermKey } from "@/lib/ai-search/definitions";
import { scopeEvidence, type EvidenceScope } from "@/lib/ai-search/evidence-focus";
import {
  HEADLINE_ROLES,
  ROLE_LABELS,
  sumRoleTallies,
  type HeadlineRole,
  type RoleGroupTally,
} from "@/lib/ai-search/question-role";
import { isSmallSample, type OutcomeTally } from "@/lib/ai-search/run-metrics";
import {
  SMALL_SAMPLE_LABEL,
  formatObservedRate,
  pct,
  resolvedPhrase,
  roleRateSort,
  summarizeRun,
} from "@/lib/ai-search/summary";
import type { AiSearchSnapshot } from "@/lib/ai-search/types";
import { formatInt } from "@/lib/fender-canvas/format";

const SIM = AI_TABS.simulations;

const ROLE_TERMS: Record<HeadlineRole, AiTermKey> = {
  unbranded_discovery: "unbranded discovery",
  branded_consideration: "branded consideration",
};

export function roleColumn(role: HeadlineRole, width = 196): RetailColumn {
  const name = ROLE_LABELS[role];
  return {
    ...clientColumn(role, name, "number", width, 150),
    label: <AiTerm term={ROLE_TERMS[role]}>{name}</AiTerm>,
  };
}

export { roleRateSort };

export function largestResolved(groups: readonly RoleGroupTally[], role: HeadlineRole): number {
  return Math.max(0, ...groups.map((group) => group.roles[role].resolved));
}

function roleLink(
  role: HeadlineRole,
  outcome: "fender_win" | "resolved",
  label: string,
  children: ReactNode,
  scope?: EvidenceScope,
) {
  return (
    <EvidenceLink focus={scopeEvidence({ field: "role", value: `${role}/${outcome}` }, scope)} tab={SIM} label={label}>
      {children}
    </EvidenceLink>
  );
}

/** One role's exact rate. A small sample keeps the percentage and is marked, not hidden. */
export function RoleCount({
  role,
  tally,
  largestResolved: largest,
  showSmallSample = true,
  scope,
}: {
  role: HeadlineRole;
  tally: OutcomeTally;
  largestResolved: number;
  /** False on pooled windows. Defaults true so a single run still shows the mark. */
  showSmallSample?: boolean;
  /** Narrows both count links, for a row on a filtered tab. */
  scope?: EvidenceScope;
}) {
  const figure = formatObservedRate(tally.fenderWins, tally.resolved);
  if (figure == null) {
    return <span data-ai-role-count={role}>No resolved answers</span>;
  }
  const small = showSmallSample && isSmallSample(tally.resolved, largest);
  const name = ROLE_LABELS[role];
  return (
    <span data-ai-role-count={role} data-ai-rate={figure} data-small-sample={small ? "true" : undefined}>
      {pct(tally.fenderWins, tally.resolved)} ({roleLink(role, "fender_win", `${name}: Fender/Squier leads`, formatInt(tally.fenderWins), scope)} of{" "}
      {roleLink(role, "resolved", `${name}: resolved answers`, formatInt(tally.resolved), scope)})
      {small ? (
        <>
          {" "}
          <AiTerm term="small sample">{SMALL_SAMPLE_LABEL}</AiTerm>
        </>
      ) : null}
    </span>
  );
}

/** Two rates for one engine-and-category cell. They are not combined into one rate. */
export function RolePair({
  unbranded,
  branded,
  largestUnbranded,
  largestBranded,
  showSmallSample = true,
}: {
  unbranded: OutcomeTally;
  branded: OutcomeTally;
  largestUnbranded: number;
  largestBranded: number;
  showSmallSample?: boolean;
}) {
  return (
    <>
      <div>
        Unbranded{" "}
        <RoleCount
          role="unbranded_discovery"
          tally={unbranded}
          largestResolved={largestUnbranded}
          showSmallSample={showSmallSample}
        />
      </div>
      <div>
        Branded{" "}
        <RoleCount
          role="branded_consideration"
          tally={branded}
          largestResolved={largestBranded}
          showSmallSample={showSmallSample}
        />
      </div>
    </>
  );
}

export function RoleSumLine({
  groups,
  preface,
}: {
  groups: readonly RoleGroupTally[];
  preface: string;
}) {
  return (
    <p className="ai-role-footnote" data-ai-role-totals>
      {preface ? <>{preface} </> : null}
      {HEADLINE_ROLES.map((role, index) => {
        const tally = sumRoleTallies(groups, role);
        const name = ROLE_LABELS[role];
        return (
          <span key={role} data-ai-role-total={role}>
            {index > 0 ? " " : null}
            <AiTerm term={ROLE_TERMS[role]}>{name}</AiTerm>
            {": "}
            {tally.resolved > 0 ? (
              <>
                Fender/Squier leads {roleLink(role, "fender_win", `${name}: Fender/Squier leads`, formatInt(tally.fenderWins))} of{" "}
                {roleLink(role, "resolved", `${name}: resolved answers`, formatInt(tally.resolved))} resolved answers (
                {pct(tally.fenderWins, tally.resolved)}).
              </>
            ) : (
              "no resolved answers."
            )}
          </span>
        );
      })}
    </p>
  );
}

function keptOut(tally: OutcomeTally): string {
  const parts = [resolvedPhrase(tally)];
  if (tally.unresolved > 0) parts.push(`${formatInt(tally.unresolved)} with no clear leader`);
  if (tally.errors > 0) parts.push(`${formatInt(tally.errors)} provider errors`);
  return parts.join(", ");
}

/** What stays out of the two rates, in the same words as the Run Summary cards. */
export function KeptOutNote({
  snapshot,
  inlineCaveats = true,
}: {
  snapshot: AiSearchSnapshot;
  /**
   * False leaves each caveat to its term's tooltip, which already says it, and drops the
   * denominator line. Only for a tab that shows the resolved term beside its rates.
   */
  inlineCaveats?: boolean;
}) {
  const s = summarizeRun(snapshot);
  const caveat = (text: string) => (inlineCaveats ? `. ${text}` : ".");
  return (
    <ul className="ai-role-footnote">
      <li>
        <AiTerm term="brand-associated discovery">Brand-associated discovery</AiTerm>:{" "}
        <EvidenceLink focus={{ field: "role", value: "brand_associated_discovery/resolved" }} tab={SIM}>
          {keptOut(s.roles.associated)}
        </EvidenceLink>
        {caveat("Counted on its own, not inside unbranded discovery.")}
      </li>
      <li>
        <AiTerm term="shopping guidance">Shopping guidance</AiTerm>:{" "}
        <EvidenceLink focus={{ field: "role", value: "shopping_guidance" }} tab={SIM}>
          {keptOut(s.roles.guidance)}
        </EvidenceLink>
        {caveat("Not in either rate above.")}
      </li>
      <li>
        <AiTerm term="product-fact question">Product-fact questions</AiTerm>:{" "}
        <EvidenceLink focus={{ field: "role", value: "product_fact" }} tab={SIM}>
          {keptOut(s.roles.productFact)}
        </EvidenceLink>
        {caveat("These are still stored as shopping prompts, and they are not in either rate above.")}
      </li>
      <li>
        <EvidenceLink focus={{ field: "kind", value: "probe" }} tab={SIM}>
          {s.probesAnswered} answered
        </EvidenceLink>{" "}
        <AiTerm term="product fact check">product fact checks</AiTerm> stay on their own tab.
      </li>
      {inlineCaveats ? (
        <li>
          Answers with <AiTerm term="no clear leader">no clear leader</AiTerm> and{" "}
          <AiTerm term="provider error">provider errors</AiTerm> stay out of both denominators.
        </li>
      ) : null}
    </ul>
  );
}
