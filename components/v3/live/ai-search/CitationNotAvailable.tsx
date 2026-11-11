"use client";

/** A missing citation input. The reason is in the tooltip. */
export function CitationNotAvailable({ description }: { description: string }) {
  return (
    <span
      className="ifai-term"
      data-citation-not-available
      data-ifai-tooltip-title="Not available"
      data-ifai-tooltip-desc={description}
      tabIndex={0}
      aria-label={`Not available: ${description}`}
    >
      Not available*
    </span>
  );
}
