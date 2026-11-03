"use client";

import type { ReactNode } from "react";
import { AiTerm } from "@/components/v3/live/ai-search/AiTerm";
import { SOURCE_MIX_CAVEAT } from "@/components/v3/live/ai-search/CitationRoleNote";
import { BrandStackBar, OwnedShareBar, RankedShareBars } from "@/components/v3/live/ai-search/CitationShareBars";
import type { CitationPie } from "@/lib/ai-search/citation-pies";
import type {
  OwnedByQuestionType,
  OwnedPresence,
  RoleOwnedGroup,
  RoleOwnedPresence,
} from "@/lib/ai-search/citation-insights";
import type { HeadlineRole } from "@/lib/ai-search/question-role";
import { SMALL_SAMPLE_LABEL, pct } from "@/lib/ai-search/summary";

const count = (n: number) => n.toLocaleString("en-US");

/** Caveat on the question-type counts. Shown in their tooltips. */
export const ROLE_ASSOCIATION_CAVEAT = "An association, not proof of cause.";

const ROLE_TERMS: Partial<Record<HeadlineRole, "unbranded discovery" | "branded consideration">> = {
  unbranded_discovery: "unbranded discovery",
  branded_consideration: "branded consideration",
};

function RoleName({ role, label }: { role: HeadlineRole; label: string }) {
  const term = ROLE_TERMS[role];
  return term ? <AiTerm term={term}>{label}</AiTerm> : <span>{label}</span>;
}

function BrandSites({ pie }: { pie: CitationPie | null }) {
  return (
    <div className="citation-tile-follow" data-citation-brands>
      <h4 className="citation-card-kicker">
        Brand sites in <AiTerm term="unbranded discovery">unbranded discovery</AiTerm>
      </h4>
      {pie == null ? (
        <p data-citation-reconcile>The brand chart is hidden because its slices do not match the brand-site link total.</p>
      ) : pie.total === 0 ? (
        <p className="citation-card-note">No brand website was cited in unbranded discovery answers.</p>
      ) : (
        <BrandStackBar
          pie={pie}
          tip={`${count(pie.total)} brand-website links in unbranded discovery. ${pie.slices.map((slice) => `${slice.label} ${slice.count}`).join(". ")}. Retail and editorial sites are in the source mix.`}
        />
      )}
    </div>
  );
}

function PresenceCard({
  presence,
  scopeNoun,
  unbrandedPie,
  unbranded,
  brands,
}: {
  presence: OwnedPresence;
  scopeNoun: string;
  unbrandedPie: CitationPie | null;
  unbranded: { withOwned: number; resolved: number } | null;
  brands: ReactNode;
}) {
  const ratio = unbranded
    ? `${unbranded.withOwned} of ${unbranded.resolved}`
    : `${presence.answersWithOwned} of ${presence.answered}`;
  const share = unbranded
    ? pct(unbranded.withOwned, unbranded.resolved)
    : presence.answered > 0
      ? pct(presence.answersWithOwned, presence.answered)
      : "No answers";
  return (
    <section className="citation-card citation-tile citation-card-presence" data-citation-presence>
      <h3 className="citation-card-kicker">
        <AiTerm term="Fender-owned">Fender-owned</AiTerm> pages
      </h3>
      <div className="citation-tile-figure">
        <div>
          <p className="citation-tile-pct" data-citation-hero-pct>
            {share}
          </p>
          <p className="citation-hero-ratio" data-citation-hero-ratio>
            <span data-citation-hero-value>{ratio}</span>{" "}
            {unbranded ? (
              <>
                <AiTerm term="unbranded discovery">unbranded discovery</AiTerm> answers cited a Fender-owned page
              </>
            ) : (
              `${scopeNoun} cited at least one Fender-owned page`
            )}
          </p>
        </div>
      </div>
      {unbranded && unbrandedPie && unbrandedPie.total > 0 ? (
        <OwnedShareBar
          id="unbranded"
          owned={unbranded.withOwned}
          total={unbrandedPie.total}
          name={unbrandedPie.title}
          tip={`Same ${ratio} answers. ${unbrandedPie.slices.map((slice) => `${slice.count} ${slice.label}`).join(". ")}. Total ${unbrandedPie.total} unbranded discovery answers.`}
        />
      ) : !unbranded && presence.answered > 0 ? (
        <OwnedShareBar
          id="presence"
          owned={presence.answersWithOwned}
          total={presence.answered}
          name="Answers that cited a Fender-owned page"
          tip={`${ratio} ${scopeNoun} cited at least one Fender-owned page.`}
        />
      ) : null}
      {brands}
    </section>
  );
}

function SourceMixCard({ pie, onPickClass }: { pie: CitationPie | null; onPickClass: (key: string) => void }) {
  return (
    <section className="citation-card citation-tile" data-citation-mix>
      <h3 className="citation-card-kicker citation-kicker-row">
        <span>
          Links by <AiTerm term="source class">source class</AiTerm>
        </span>
        {pie && pie.total > 0 ? <span className="citation-kicker-total">{count(pie.total)} links</span> : null}
      </h3>
      {pie == null ? (
        <p data-citation-reconcile>The source-mix chart is hidden because its slices do not match the link total.</p>
      ) : pie.total === 0 ? (
        <p className="citation-card-note">No links in this view.</p>
      ) : (
        <RankedShareBars pie={pie} ownedKey="fender_owned" caveat={SOURCE_MIX_CAVEAT} onPick={onPickClass} />
      )}
    </section>
  );
}

function RoleGroupButton({
  role,
  group,
  share,
  onPick,
}: {
  role: RoleOwnedPresence;
  group: RoleOwnedGroup;
  share: number;
  onPick: (role: RoleOwnedPresence, group: RoleOwnedGroup) => void;
}) {
  if (group.resolved <= 0 || share <= 0) return null;
  const lead = `Fender led ${group.fenderLed} of ${group.resolved}`;
  const sample = group.smallSample ? ` · ${SMALL_SAMPLE_LABEL}` : "";
  return (
    <button
      type="button"
      className={`citation-role-seg citation-role-seg-${group.key}`}
      style={{ flexGrow: share, flexBasis: 0 }}
      data-citation-role-group={`${role.role}:${group.key}`}
      data-role-n={group.resolved}
      data-ai-pick={`role_owned:${role.role}:${group.key}`}
      onClick={() => onPick(role, group)}
      aria-label={`${role.roleLabel}: ${group.label}, ${group.resolved} resolved answers. ${lead}${sample}.`}
    >
      <span className="citation-role-seg-count">{group.resolved}</span>
    </button>
  );
}

function RoleOwnedCard({
  byType,
  applicable,
  showSmallSample,
  onPickGroup,
}: {
  byType: OwnedByQuestionType | null;
  applicable: boolean;
  showSmallSample: boolean;
  onPickGroup: (role: RoleOwnedPresence, group: RoleOwnedGroup) => void;
}) {
  const kicker = <h3 className="citation-card-kicker">Fender-owned pages by question type</h3>;
  if (!applicable) {
    return (
      <section className="citation-card citation-tile" data-citation-association>
        {kicker}
        <p className="citation-card-note">
          Lead rates come from shopping answers. Choose Shopping answers or All answers to see them.
        </p>
      </section>
    );
  }
  if (!byType || !byType.ok) {
    return (
      <section className="citation-card citation-tile" data-citation-association>
        {kicker}
        <p data-citation-reconcile>
          The role bars are hidden because owned and not-owned groups do not match each role&apos;s
          resolved total.
        </p>
      </section>
    );
  }

  return (
    <section className="citation-card citation-tile" data-citation-association>
      {kicker}
      <ul className="citation-role-list">
        {byType.roles.map((role) => {
          const total = Math.max(role.resolved, 1);
          return (
            <li key={role.role} data-citation-role={role.role} data-role-resolved={role.resolved}>
              <div className="citation-role-label">
                <strong>
                  <RoleName role={role.role} label={role.roleLabel} />
                </strong>
                <span>
                  {role.withOwned} of {role.resolved}
                </span>
              </div>
              <div
                className="citation-role-track citation-chart-tip ifai-term"
                role="img"
                tabIndex={0}
                data-ifai-tooltip-title={role.roleLabel}
                data-ifai-tooltip-desc={`${role.withOwned} of ${role.resolved} ${role.roleLabel} answers cited a Fender-owned page. ${role.withoutOwned} did not. ${ROLE_ASSOCIATION_CAVEAT}`}
                aria-label={`${role.roleLabel}: ${role.withOwned} of ${role.resolved} resolved answers cited a Fender-owned page. ${role.withoutOwned} did not. ${ROLE_ASSOCIATION_CAVEAT}`}
              >
                <RoleGroupButton
                  role={role}
                  group={role.groups[0]}
                  share={role.groups[0].resolved / total}
                  onPick={onPickGroup}
                />
                <RoleGroupButton
                  role={role}
                  group={role.groups[1]}
                  share={role.groups[1].resolved / total}
                  onPick={onPickGroup}
                />
              </div>
              <ul className="citation-role-leads">
                {role.groups.map((group) => {
                  if (group.resolved <= 0) return null;
                  const led = `Fender led ${group.fenderLed} of ${group.resolved}`;
                  const desc = `${led} ${role.roleLabel.toLowerCase()} answers that ${group.key === "cited_owned" ? "cited a Fender-owned page" : "cited no Fender-owned page"}. ${ROLE_ASSOCIATION_CAVEAT}`;
                  return (
                    <li key={group.key} data-citation-role-lead={`${role.role}:${group.key}`}>
                      {group.label}:{" "}
                      <span
                        className="ifai-term"
                        data-ifai-tooltip-title={role.roleLabel}
                        data-ifai-tooltip-desc={desc}
                        tabIndex={0}
                        aria-label={`${role.roleLabel}: ${desc}`}
                      >
                        {led}
                      </span>
                      {showSmallSample && group.smallSample ? ` · ${SMALL_SAMPLE_LABEL}` : ""}
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
      {showSmallSample ? (
        <p className="citation-card-caveat" data-citation-small-sample>
          Counts from one run.
        </p>
      ) : null}
    </section>
  );
}

/** Compact source-role tiles in two columns. The gaps tile comes in as the last child. */
export function CitationExecutiveGrid({
  presence,
  scopeNoun,
  unbrandedPie,
  mixPie,
  brandPie,
  byQuestionType,
  rolesApplicable,
  showSmallSample,
  onPickRoleGroup,
  onPickClass,
  children,
}: {
  presence: OwnedPresence;
  scopeNoun: string;
  unbrandedPie: CitationPie | null;
  mixPie: CitationPie | null;
  brandPie: CitationPie | null;
  byQuestionType: OwnedByQuestionType | null;
  rolesApplicable: boolean;
  showSmallSample: boolean;
  onPickRoleGroup: (role: RoleOwnedPresence, group: RoleOwnedGroup) => void;
  onPickClass: (key: string) => void;
  children?: ReactNode;
}) {
  return (
    <div className="citation-glance-tiles" data-citation-exec>
      <PresenceCard
        presence={presence}
        scopeNoun={scopeNoun}
        unbrandedPie={unbrandedPie}
        unbranded={
          rolesApplicable && byQuestionType?.ok
            ? { withOwned: byQuestionType.insight.withOwned, resolved: byQuestionType.insight.resolved }
            : null
        }
        brands={rolesApplicable ? <BrandSites pie={brandPie} /> : null}
      />
      <SourceMixCard pie={mixPie} onPickClass={onPickClass} />
      <RoleOwnedCard
        byType={byQuestionType}
        applicable={rolesApplicable}
        showSmallSample={showSmallSample}
        onPickGroup={onPickRoleGroup}
      />
      {children}
    </div>
  );
}
