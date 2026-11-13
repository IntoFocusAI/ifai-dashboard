"use client";

import "@/components/v3/live/ai-search/fact-checks.css";
import { StatusMark } from "@/components/v3/live/StatusMark";
import { AiStaleMark } from "@/components/v3/live/ai-search/AiStaleMark";
import { AiStatusTag } from "@/components/v3/live/ai-search/AiStatusTag";
import { AiTerm } from "@/components/v3/live/ai-search/AiTerm";
import { CitationPieDisc } from "@/components/v3/live/ai-search/CitationPieDisc";
import { CopyTip } from "@/components/v3/live/ai-search/CopyTip";
import type { DriftRead } from "@/lib/ai-search/drift";
import {
  CATALOG_PRODUCTS_TITLE,
  CATALOG_PRODUCTS_UNIT,
  FACT_CHECK_ACCURACY_TITLE,
  FACT_CHECK_METHOD_TITLE,
  catalogProductsFigure,
  catalogProductsPie,
  catalogProductsSubline,
  catalogProductsNotAskedTip,
  catalogProductsTip,
  catalogProductsUnavailableTip,
  contradictionCount,
  factCheckAccuracyLead,
  factCheckAccuracyPie,
  factCheckAccuracyPieTip,
  factCheckAccuracyStatus,
  factCheckAccuracyTip,
  factCheckHeadline,
  factCheckMethodLine,
} from "@/lib/ai-search/fact-check-copy";
import { catalogCycles, catalogProductsLead, rotationSummary } from "@/lib/ai-search/probe-catalog";
import type { AiSearchSnapshot } from "@/lib/ai-search/types";
import { dataStatusColor } from "@/lib/canvas-sdk/data-status";
import { brandName } from "@/lib/brand-copy";

/**
 * Product Fact Checks opens on "N of M catalog products checked" on every engine choice
 * (A-05, decision 13), then Accuracy. Each tooltip names the engines its figure covers.
 * A selection from before the catalog rotation keeps the question-count method line.
 */
export function FactCheckLead({
  snapshot,
  drift,
  windowed,
}: {
  snapshot: AiSearchSnapshot;
  drift: DriftRead;
  windowed: boolean;
}) {
  const { coverage } = drift;
  const accuracy = factCheckAccuracyLead(coverage);
  const pie = factCheckAccuracyPie(coverage);
  const status = factCheckAccuracyStatus(accuracy.tone);
  const catalog = catalogProductsLead(snapshot);
  const rotation = rotationSummary(catalogCycles(snapshot), windowed);
  const askingEngines = catalog?.askingEngines ?? [];
  const method = catalog ? null : factCheckMethodLine(coverage, windowed);
  const catalogPie = catalog?.phase === "ready" ? catalogProductsPie(catalog) : null;

  return (
    <div className="content-box ai-drift-summary">
      <div className="ai-fact-figures" data-ai-fact-figures>
        {catalog ? (
          <div className="ai-fact-catalog-lead" data-ai-catalog-lead={catalog.phase}>
            <div className="ai-fact-figure-row">
              <span className="ai-lead-figure" data-ai-catalog-figure>
                {catalog.phase === "ready" ? (
                  <CopyTip label={CATALOG_PRODUCTS_TITLE} description={catalogProductsTip(catalog, rotation, windowed)}>
                    {catalogProductsFigure(catalog)}
                  </CopyTip>
                ) : (
                  <CopyTip
                    label={CATALOG_PRODUCTS_TITLE}
                    description={
                      catalog.phase === "not-asked"
                        ? catalogProductsNotAskedTip(catalog, windowed)
                        : catalogProductsUnavailableTip(catalog.askingEngines)
                    }
                  >
                    Not available*
                  </CopyTip>
                )}
              </span>
              <AiStaleMark questions={null} />
              <span className="ai-fact-figure-unit">{CATALOG_PRODUCTS_UNIT}</span>
              {catalogPie && catalog.phase === "ready" ? (
                <CitationPieDisc
                  pie={catalogPie}
                  sizeClass="citation-pie-disc citation-pie-disc-accuracy"
                  tip={catalogProductsTip(catalog, rotation, windowed)}
                />
              ) : null}
            </div>
            <p className="ai-fact-lead-sub" data-ai-catalog-sub>
              {catalogProductsSubline(coverage, rotation)}
            </p>
          </div>
        ) : null}

          {accuracy.rate && pie ? (
            <div className="ai-fact-accuracy-col" data-ai-accuracy-figure-col>
              <div className="ai-fact-figure-row">
                <span
                  className="ai-lead-figure"
                  data-ai-accuracy-figure
                  style={status ? { color: dataStatusColor(status) } : undefined}
                >
                  <CopyTip
                    label={FACT_CHECK_ACCURACY_TITLE}
                    description={factCheckAccuracyTip(coverage, windowed, askingEngines)}
                  >
                    {accuracy.rate} Accuracy
                  </CopyTip>
                </span>
                <AiStaleMark questions="probe" />
                <CitationPieDisc
                  pie={pie}
                  sizeClass="citation-pie-disc citation-pie-disc-accuracy"
                  tip={factCheckAccuracyPieTip(coverage, askingEngines)}
                />
              </div>
              {status ? <StatusMark status={status} /> : null}
            </div>
          ) : null}
        <div className="ai-lead-explainer ai-fact-explainer" data-ai-accuracy-row data-ai-accuracy-lead>
          <div className="content-box-title">
            <span>
              Do AI answers match {brandName()}&apos;s published <AiTerm term="product fact check">product facts</AiTerm>?
            </span>
            <AiStatusTag tone={coverage.contradictions ? "danger" : "success"} data-ai-fact-result>
              {coverage.contradictions ? contradictionCount(coverage.contradictions) : "No contradictions found"}
            </AiStatusTag>
          </div>
          <p className="ai-fact-headline" data-ai-fact-headline>
            {factCheckHeadline(coverage, windowed)}
          </p>
          {method ? (
            <p className="ai-fact-method" data-ai-fact-method>
              <CopyTip label={FACT_CHECK_METHOD_TITLE} description={method.tip}>
                {method.products}
              </CopyTip>{" "}
              · {method.verified}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
