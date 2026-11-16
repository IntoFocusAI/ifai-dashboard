"use client";

/**
 * Asterisk on a figure that counts one category, a custom mix of engines, or leaves runs out.
 * The chips and the Clear category button change the filter. The window note names the runs left out.
 */
export function CitationFilteredMark({
  category,
  engines = null,
  note = "",
}: {
  category: string | null;
  /** The engine chips when they match no preset, as one label. */
  engines?: string | null;
  note?: string;
}) {
  if (!category && !engines && !note) return null;
  const parts = [
    engines ? `${engines} only. Choose a preset to see every engine in it.` : "",
    category ? `${category} only. Clear the category to see all categories.` : "",
    note,
  ];
  const description = parts.filter(Boolean).join(" ");
  const title = category && engines ? "Engine and category filter" : category ? "Category filter" : engines ? "Engine filter" : "Runs left out";
  return (
    <span
      className="ifai-term citation-figure-filtered"
      data-citation-filtered={category ?? ""}
      data-citation-engine-filtered={engines ? "" : undefined}
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
