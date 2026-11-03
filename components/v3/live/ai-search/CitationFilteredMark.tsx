"use client";

/**
 * Asterisk on a figure that counts one category or leaves runs out. The chip and the
 * Clear category button change the category. The window note names the runs left out.
 */
export function CitationFilteredMark({ category, note = "" }: { category: string | null; note?: string }) {
  if (!category && !note) return null;
  const filter = category ? `${category} only. Clear the category to see all categories.` : "";
  const description = [filter, note].filter(Boolean).join(" ");
  const title = category ? "Category filter" : "Runs left out";
  return (
    <span
      className="ifai-term citation-figure-filtered"
      data-citation-filtered={category ?? ""}
      data-citation-window={note ? "" : undefined}
      data-ifai-tooltip-title={title}
      data-ifai-tooltip-desc={description}
      tabIndex={0}
      aria-label={`${title}: ${description}`}
    >
      *
    </span>
  );
}
