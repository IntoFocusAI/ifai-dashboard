import {
  citationEvidence,
  groupCitations,
  ownedDomains,
  SOURCE_CLASS_LABELS,
  SOURCE_CLASS_ORDER,
  type CitationEvidence,
  type CitationRead,
  type CitationScope,
  type SourceClass,
} from "@/lib/ai-search/citations";
import { citationStorageCaution } from "@/lib/ai-search/review-runs";
import {
  HEADLINE_ROLES,
  ROLE_LABELS,
  isHeadlineRole,
  questionRole,
  roleTally,
  type HeadlineRole,
} from "@/lib/ai-search/question-role";
import { callOutcome, categoryLabel, isSmallSample } from "@/lib/ai-search/run-metrics";
import type { AiCallRow, AiSearchSnapshot } from "@/lib/ai-search/types";
import { brandName, brandOwned, isFenderClient } from "@/lib/brand-copy";

export type OwnedPresence = {
  /** Shopping (or scoped) answers that cited at least one Fender-owned page. */
  answersWithOwned: number;
  answered: number;
  ownedLinks: number;
  totalLinks: number;
};

export type RoleOwnedGroup = {
  key: "cited_owned" | "no_owned";
  label: string;
  /** Resolved answers in this group. */
  resolved: number;
  fenderLed: number;
  smallSample: boolean;
  simulationIds: string[];
};

export type RoleOwnedPresence = {
  role: HeadlineRole;
  roleLabel: string;
  /** Resolved answers for this role. Matches summarizeRun().roles.<role>.resolved. */
  resolved: number;
  withOwned: number;
  withoutOwned: number;
  groups: [RoleOwnedGroup, RoleOwnedGroup];
  ok: boolean;
};

export type OwnedByQuestionType = {
  roles: RoleOwnedPresence[];
  /** Executive lead: unbranded discovery owned-citation share of resolved. */
  insight: {
    role: HeadlineRole;
    roleLabel: string;
    withOwned: number;
    resolved: number;
  };
  ok: boolean;
};

export type CitationGap = {
  category: string;
  categoryLabel: string;
  /** Competitor-led headline-role answers in this category with no Fender-owned citation. */
  count: number;
  /** Leading competitor brand among those losing answers. */
  competitor: string;
  /** Top third-party domains cited in those same answers, by link count. */
  topDomains: Array<{ domain: string; links: number; sourceClass: SourceClass }>;
  simulationIds: string[];
};

export type DomainBar = {
  domain: string;
  links: number;
  answers: number;
  sourceClass: SourceClass;
  classLabel: string;
};

export type SourceMixSlice = {
  key: SourceClass;
  label: string;
  count: number;
};

export type SourceMix = {
  total: number;
  slices: SourceMixSlice[];
  ok: boolean;
};

export type OwnedPie = {
  total: number;
  owned: number;
  other: number;
  ok: boolean;
};

function answeredInScope(calls: AiCallRow[], scope: CitationScope): AiCallRow[] {
  return calls.filter((call) => {
    if (call.call_status !== "answered") return false;
    if (scope === "all") return true;
    return call.prompt_kind === scope;
  });
}

/** Commercial answered calls among the scoped answered set. */
function shoppingAnswered(calls: AiCallRow[], scope: CitationScope): AiCallRow[] {
  return answeredInScope(calls, scope).filter((call) => call.prompt_kind === "commercial");
}

function ownedAnswerIds(rows: CitationEvidence[]): Set<string> {
  return new Set(rows.filter((row) => row.sourceClass === "fender_owned").map((row) => row.simulationId));
}

function isResolvedOutcome(call: AiCallRow): boolean {
  const outcome = callOutcome(call);
  return (
    outcome === "fender_win" ||
    outcome === "fender_win_disqualified" ||
    outcome === "competitor_win"
  );
}

/** A. Share of scoped answers that cited at least one Fender-owned page, plus owned link share. */
export function ownedPresence(read: CitationRead): OwnedPresence {
  const ownedIds = ownedAnswerIds(read.rows);
  const ownedLinks = read.rows.filter((row) => row.sourceClass === "fender_owned").length;
  return {
    answersWithOwned: ownedIds.size,
    answered: read.answered,
    ownedLinks,
    totalLinks: read.rows.length,
  };
}

export function ownedPie(read: CitationRead): OwnedPie | null {
  const owned = read.rows.filter((row) => row.sourceClass === "fender_owned").length;
  const other = read.rows.length - owned;
  if (owned < 0 || other < 0) return null;
  const ok = owned + other === read.rows.length;
  if (!ok) return null;
  return { total: read.rows.length, owned, other, ok };
}

/**
 * B. Fender-owned page presence by headline question role (unbranded discovery and
 * branded consideration). Denominators are resolved answers, matching summarizeRun().roles.
 * Lead rates inside each owned / not-owned group use callOutcome fender_win / resolved.
 */
export function ownedByQuestionType(
  calls: AiCallRow[],
  read: CitationRead,
  scope: CitationScope,
): OwnedByQuestionType | null {
  if (scope === "probe") return null;
  const ownedIds = ownedAnswerIds(read.rows);

  const roles: RoleOwnedPresence[] = HEADLINE_ROLES.map((role) => {
    const expected = roleTally(calls, role);
    const resolvedCalls = calls.filter(
      (call) =>
        call.prompt_kind === "commercial" &&
        questionRole(call) === role &&
        isResolvedOutcome(call),
    );
    const withOwnedCalls = resolvedCalls.filter((call) => ownedIds.has(call.id));
    const withoutOwnedCalls = resolvedCalls.filter((call) => !ownedIds.has(call.id));

    const toGroup = (
      key: "cited_owned" | "no_owned",
      label: string,
      groupCalls: AiCallRow[],
    ): RoleOwnedGroup => {
      let fenderLed = 0;
      for (const call of groupCalls) {
        if (callOutcome(call) === "fender_win") fenderLed += 1;
      }
      return {
        key,
        label,
        resolved: groupCalls.length,
        fenderLed,
        smallSample: false,
        simulationIds: groupCalls.map((call) => call.id).sort(),
      };
    };

    const groups: [RoleOwnedGroup, RoleOwnedGroup] = [
      toGroup("cited_owned", `Cited a ${brandOwned()} page`, withOwnedCalls),
      toGroup("no_owned", `No ${brandOwned()} page`, withoutOwnedCalls),
    ];
    const largest = Math.max(groups[0].resolved, groups[1].resolved);
    groups[0].smallSample = isSmallSample(groups[0].resolved, largest);
    groups[1].smallSample = isSmallSample(groups[1].resolved, largest);

    const withOwned = groups[0].resolved;
    const withoutOwned = groups[1].resolved;
    const ok =
      withOwned + withoutOwned === expected.resolved &&
      resolvedCalls.length === expected.resolved;

    return {
      role,
      roleLabel: ROLE_LABELS[role],
      resolved: expected.resolved,
      withOwned,
      withoutOwned,
      groups,
      ok,
    };
  });

  const unbranded = roles[0];
  return {
    roles,
    insight: {
      role: unbranded.role,
      roleLabel: unbranded.roleLabel,
      withOwned: unbranded.withOwned,
      resolved: unbranded.resolved,
    },
    ok: roles.every((role) => role.ok),
  };
}

/**
 * One run's unbranded owned-page count for the All time / date-range chips.
 * A run whose citation URLs were not stored stays unlabeled rather than showing a blended or zero rate.
 */
export function citationRangeLabel(snapshot: AiSearchSnapshot): string {
  const declared = snapshot.storedCitationCount ?? snapshot.citations.length;
  if (citationStorageCaution(snapshot.run.audit_run_id) || snapshot.citations.length < declared) {
    return "Citations not listed";
  }
  const read = citationEvidence(snapshot.calls, snapshot.citations, "commercial");
  const byType = ownedByQuestionType(snapshot.calls, read, "commercial");
  if (!byType || byType.insight.resolved <= 0) return "No unbranded answers";
  return `${byType.insight.withOwned} of ${byType.insight.resolved} unbranded`;
}

/**
 * C. Shopping categories ranked by competitor-led answers with no Fender-owned citation.
 * Restricted to unbranded discovery and branded consideration so gaps match the
 * dashboard's two headline rates (product-fact and shopping-guidance stay out).
 */
export function citationGaps(
  calls: AiCallRow[],
  read: CitationRead,
  scope: CitationScope,
): { gaps: CitationGap[]; totalLosing: number; ok: boolean } | null {
  if (scope === "probe") return null;
  const shopping = shoppingAnswered(calls, scope);
  const ownedIds = ownedAnswerIds(read.rows);
  const rowsBySim = new Map<string, CitationEvidence[]>();
  for (const row of read.rows) {
    const list = rowsBySim.get(row.simulationId) ?? [];
    list.push(row);
    rowsBySim.set(row.simulationId, list);
  }

  const losing = shopping.filter(
    (call) =>
      callOutcome(call) === "competitor_win" &&
      !ownedIds.has(call.id) &&
      isHeadlineRole(questionRole(call)),
  );
  const byCategory = new Map<string, AiCallRow[]>();
  for (const call of losing) {
    const key = call.category ?? "";
    byCategory.set(key, [...(byCategory.get(key) ?? []), call]);
  }

  const gaps: CitationGap[] = [...byCategory.entries()]
    .map(([category, bucket]) => {
      const brands = new Map<string, number>();
      for (const call of bucket) {
        const brand = call.primary_brand?.trim() || "Brand not recorded";
        brands.set(brand, (brands.get(brand) ?? 0) + 1);
      }
      const competitor =
        [...brands.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ??
        "Brand not recorded";

      const domainCounts = new Map<string, { links: number; sourceClass: SourceClass }>();
      for (const call of bucket) {
        for (const row of rowsBySim.get(call.id) ?? []) {
          if (row.sourceClass === "fender_owned") continue;
          const entry = domainCounts.get(row.domain) ?? { links: 0, sourceClass: row.sourceClass };
          entry.links += 1;
          domainCounts.set(row.domain, entry);
        }
      }
      const topDomains = [...domainCounts.entries()]
        .map(([domain, entry]) => ({ domain, links: entry.links, sourceClass: entry.sourceClass }))
        .sort((a, b) => b.links - a.links || a.domain.localeCompare(b.domain))
        .slice(0, 3);

      return {
        category,
        categoryLabel: categoryLabel(category),
        count: bucket.length,
        competitor,
        topDomains,
        simulationIds: bucket.map((call) => call.id).sort(),
      };
    })
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));

  const rankedSum = gaps.reduce((sum, gap) => sum + gap.count, 0);
  return { gaps, totalLosing: losing.length, ok: rankedSum === losing.length };
}

export function topDomainBars(read: CitationRead, limit = 10): DomainBar[] {
  return groupCitations(read.rows, (row) => row.domain)
    .slice(0, limit)
    .map((group) => {
      const sourceClass =
        read.rows.find((row) => row.domain === group.key)?.sourceClass ?? ("other" as SourceClass);
      return {
        domain: group.key,
        links: group.rows,
        answers: group.answers,
        sourceClass,
        classLabel: SOURCE_CLASS_LABELS[sourceClass],
      };
    });
}

const BRAND_SITE_NAMES: Array<[string, string]> = [
  ["fender.com", "Fender"],
  ["squier.com", "Fender"],
  ["yamaha.com", "Yamaha"],
  ["gibson.com", "Gibson"],
  ["epiphone.com", "Epiphone"],
  ["taylorguitars.com", "Taylor"],
  ["prsguitars.com", "PRS"],
  ["ibanez.com", "Ibanez"],
  ["sire-usa.com", "Sire"],
  ["boss.info", "Boss"],
  ["positivegrid.com", "Positive Grid"],
  ["martinguitar.com", "Martin"],
  ["schecterguitars.com", "Schecter"],
  ["gretschguitars.com", "Gretsch"],
  ["jacksonguitars.com", "Jackson"],
  ["charvel.com", "Charvel"],
  ["evhgear.com", "EVH"],
];

function brandFromDomain(domain: string): string | null {
  const host = domain.toLowerCase();
  if (!isFenderClient() && ownedDomains().some((root) => host === root || host.endsWith(`.${root}`))) return brandName();
  for (const [root, brand] of BRAND_SITE_NAMES) {
    if (host === root || host.endsWith(`.${root}`)) return brand;
  }
  return null;
}

/**
 * Brand websites cited in unbranded discovery answers. Retail, editorial, and
 * community links stay in the source mix. Slices are link counts and sum to the total.
 */
export function unbrandedBrandSites(
  calls: AiCallRow[],
  read: CitationRead,
): { total: number; slices: Array<{ brand: string; links: number; fenderOwned: boolean }>; ok: boolean } | null {
  const unbrandedIds = new Set(
    calls
      .filter(
        (call) =>
          call.prompt_kind === "commercial" &&
          call.call_status === "answered" &&
          questionRole(call) === "unbranded_discovery",
      )
      .map((call) => call.id),
  );
  const counts = new Map<string, number>();
  const owned = new Set<string>();
  let seen = 0;
  for (const row of read.rows) {
    if (!unbrandedIds.has(row.simulationId)) continue;
    if (row.sourceClass !== "fender_owned" && row.sourceClass !== "competitor_brand") continue;
    const brand = brandFromDomain(row.domain);
    if (!brand) continue;
    seen += 1;
    counts.set(brand, (counts.get(brand) ?? 0) + 1);
    if (row.sourceClass === "fender_owned") owned.add(brand);
  }
  const slices = [...counts.entries()]
    .map(([brand, links]) => ({ brand, links, fenderOwned: owned.has(brand) }))
    .sort((a, b) => b.links - a.links || a.brand.localeCompare(b.brand));
  const total = slices.reduce((sum, slice) => sum + slice.links, 0);
  if (total !== seen) return null;
  return { total, slices, ok: true };
}

export function sourceMix(read: CitationRead): SourceMix | null {
  const grouped = groupCitations(read.rows, (row) => row.sourceClass);
  const slices = SOURCE_CLASS_ORDER.map((key) => ({
    key,
    label: SOURCE_CLASS_LABELS[key],
    count: grouped.find((group) => group.key === key)?.rows ?? 0,
  })).filter((slice) => slice.count > 0);
  const sum = slices.reduce((n, slice) => n + slice.count, 0);
  if (sum !== read.rows.length) return null;
  return { total: read.rows.length, slices, ok: true };
}
