import type { ReactNode } from "react";
import fenderNarrative from "@/data/fender-v3-spec.json";
import type { SpokeDefinition, SpokeId } from "@/components/v3/spoke-data-types";
import { activeClient } from "@/lib/client/active-client";
import { bindCopy } from "@/lib/fender-canvas/template-vars";

type NarrativeSpoke = {
  badge: string;
  title: string;
  desc: string;
  tabs: string[];
  navLabel: string;
  next: SpokeId;
  tabTemplates: string[];
};

type NarrativeSpec = { spokes: Record<SpokeId, NarrativeSpoke> };

const NO_ESTIMATE_HTML = `
<div class="content-box">
  <div class="content-box-title">Revenue Estimates</div>
  <div class="metric-grid-2">
    <div class="metric-card-sm">
      <span class="metric-card-label">Phase 1 Quick-Win Lift</span>
      <div class="metric-card-val">{phase_one_lift}</div>
      <span class="metric-card-sub">Analyst estimate</span>
    </div>
    <div class="metric-card-sm">
      <span class="metric-card-label">Full Enterprise Potential</span>
      <div class="metric-card-val">{enterprise_potential}</div>
      <span class="metric-card-sub">Analyst estimate</span>
    </div>
  </div>
</div>
`;

/**
 * Brand-led briefing for a client other than Fender. Fender's briefing describes its
 * dealer network and multi-brand portfolio; this one describes only what the reads show.
 */
function brandLedBriefingHtml(brand: string): string {
  return `
<div class="ceo-callout">
  <div class="ceo-callout-header">
    <span>What is changing what AI assistants recommend for ${brand}?</span>
  </div>
  <div class="ceo-callout-body">
    Shoppers ask AI assistants what to buy before they land on a product page. The figures in this briefing come from the latest catalog, offer, simulation, and spec reads.
    <br/><br/>
    A withheld Buy Box removes the one-click path shoppers and assistants use when they name a product someone can buy.
    <br/><br/>
    <strong>Active offers:</strong> {active_offer_clarity}
    <br/><br/>
    <strong>${brand}'s selling model on Amazon:</strong>
    <ul style="margin:4px 0 0 16px; padding:0;">
      <li><strong>Brand-led:</strong> ${brand}'s own seller accounts are meant to hold the Buy Box. Listings held by Amazon Retail or another seller are counted separately in Catalog Health.</li>
    </ul>
  </div>
</div>
`;
}

function brandText(text: string, brand: string): string {
  return text
    .replace(/Fender\/Squier/g, brand)
    .replace(/Fender's/g, `${brand}'s`)
    .replace(/\bFender\b/g, brand);
}

/** Narrative copy for the brand on screen. Fender's is the hand-written original. */
export function clientNarrative(): NarrativeSpec {
  const base = fenderNarrative as unknown as NarrativeSpec;
  const client = activeClient();
  if (client.key === "fender") return base;
  const brand = client.brandName;
  const spokes = {} as Record<SpokeId, NarrativeSpoke>;
  for (const id of Object.keys(base.spokes) as SpokeId[]) {
    const row = base.spokes[id];
    spokes[id] = {
      ...row,
      badge: brandText(row.badge, brand),
      title: brandText(row.title, brand),
      desc: brandText(row.desc, brand),
      tabTemplates: row.tabTemplates.map((t) => brandText(t, brand)),
    };
  }
  spokes.hub = {
    ...spokes.hub,
    desc: `Overview of ${brand}'s Amazon catalog health.`,
    tabTemplates: [brandLedBriefingHtml(brand), "", NO_ESTIMATE_HTML],
  };
  spokes.suggestions = {
    ...spokes.suggestions,
    desc: "Action items for listing hygiene and AI search visibility",
    tabTemplates: spokes.suggestions.tabTemplates.map((t, i) => (i === 1 ? NO_ESTIMATE_HTML : t)),
  };
  return { spokes };
}

/** Static narrative config (templates use `{metric_id}` placeholders filled at render). */
export function buildNarrativeSpokes(): Record<SpokeId, SpokeDefinition> {
  const out = {} as Record<SpokeId, SpokeDefinition>;
  const spokes = clientNarrative().spokes;

  for (const id of Object.keys(spokes) as SpokeId[]) {
    const row = spokes[id];
    out[id] = {
      badge: row.badge,
      title: row.title,
      desc: row.desc,
      tabs: row.tabs,
      navLabel: row.navLabel,
      next: row.next,
      render: (tabIdx: number): ReactNode | string => row.tabTemplates[tabIdx] ?? "",
    };
  }
  return out;
}

export function bindNarrativeSpoke(
  spoke: SpokeDefinition,
  vars: Record<string, string>,
): SpokeDefinition {
  return {
    ...spoke,
    desc: bindCopy(spoke.desc, vars),
    tabs: spoke.tabs.map((t) => bindCopy(t, vars)),
    render: (tabIdx) => {
      const template = spoke.render(tabIdx);
      if (typeof template !== "string") return template;
      return bindCopy(template, vars);
    },
  };
}
