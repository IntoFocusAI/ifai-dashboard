"use client";

/** Asterisk on a figure that counts one category. The chip and Clear category button change it. */
export function CitationFilteredMark({ category }: { category: string | null }) {
  if (!category) return null;
  const description = `${category} only. Clear the category to see all categories.`;
  return (
    <span
      className="ifai-term citation-figure-filtered"
      data-citation-filtered={category}
      data-ifai-tooltip-title="Category filter"
      data-ifai-tooltip-desc={description}
      tabIndex={0}
      aria-label={`Category filter: ${description}`}
    >
      *
    </span>
  );
}
