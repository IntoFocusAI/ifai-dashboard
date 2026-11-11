"use client";

import { brandSite, isFenderClient } from "@/lib/brand-copy";

const ADDITIONAL_PROPERTY_DESC = () =>
  `The Schema.org field that can carry ${isFenderClient() ? "neck, pickup, and hardware specs" : "detailed product specs"}. When it is missing from a found page, an assistant has no spec block to read there.`;

export function AdditionalPropertyTerm() {
  return (
    <span
      className="ifai-term"
      data-ifai-tooltip-title="additionalProperty"
      data-ifai-tooltip-desc={ADDITIONAL_PROPERTY_DESC()}
      tabIndex={0}
      aria-label={`additionalProperty: ${ADDITIONAL_PROPERTY_DESC()}`}
    >
      additionalProperty
    </span>
  );
}

export function AplusExplanation() {
  return (
    <div className="ceo-callout">
      <div className="ceo-callout-header">
        <span>What is Amazon A+ content, and why does it win AI queries?</span>
      </div>
      <div className="ceo-callout-body">
        Comparison tables have not been measured. A+ Content is the enhanced modules on a product
        page: graphics, diagrams, and comparison charts. When a comparison table is on the page,
        Amazon&apos;s shopping assistant and other AI models can read the columns and repeat how
        your lineup steps up.
      </div>
    </div>
  );
}
