import type { CitationPieSlice, PieDiscData } from "@/lib/ai-search/citation-pies";
import { keyColor, sliceColors } from "@/lib/ai-search/pie-tones";

/**
 * One key's chart color: ice blue for the measured figure, the second blue for the one other
 * series, gray for the rest (brand book, decision 27). Pies color by slice with `sliceColors`.
 */
export function sliceColor(key: string): string {
  return keyColor(key);
}

function gradient(slices: CitationPieSlice[], total: number): string {
  const colors = sliceColors(slices);
  let angle = 0;
  return slices
    .map((slice, index) => {
      const start = angle;
      angle += (slice.count / total) * 360;
      return `${colors[index]} ${start}deg ${angle}deg`;
    })
    .join(", ");
}

/**
 * Structural pie for CitationPieDisc. Run Details role rates and Product Fact
 * Checks Accuracy reuse this; citation views keep the closed id union on CitationPie.
 */
export type PieDiscInput = PieDiscData;

export function CitationPieDisc({
  pie,
  sizeClass = "citation-pie-disc",
  tip,
}: {
  pie: PieDiscData;
  sizeClass?: string;
  /** Custom tooltip. Same chrome as definition terms, without a native title. */
  tip?: string;
}) {
  const label = pie.slices.map((slice) => `${slice.count} ${slice.label}`).join(". ");
  const description = tip ?? `${pie.title}. ${label}. Total ${pie.total} ${pie.totalLabel}.`;
  return (
    <div
      className={`${sizeClass} citation-chart-tip ifai-term`}
      style={{ background: `conic-gradient(${gradient(pie.slices, pie.total)})` }}
      role="img"
      aria-label={`${pie.title}. ${description}`}
      data-citation-pie-disc={pie.id}
      data-ifai-tooltip-title={pie.title}
      data-ifai-tooltip-desc={description}
      tabIndex={0}
    />
  );
}

export function CitationPieLegend({ pie }: { pie: PieDiscData }) {
  const colors = sliceColors(pie.slices);
  return (
    <ul className="citation-pie-legend">
      {pie.slices.map((slice, index) => (
        <li
          key={slice.key}
          data-pie-count={slice.count}
          data-pie-label={slice.label}
          className="citation-chart-tip ifai-term"
          data-ifai-tooltip-title={slice.label}
          data-ifai-tooltip-desc={`${slice.label}: ${slice.count} of ${pie.total} ${pie.totalLabel}.`}
          tabIndex={0}
          aria-label={`${slice.label}: ${slice.count} of ${pie.total} ${pie.totalLabel}.`}
        >
          <span className="citation-pie-swatch" style={{ background: colors[index] }} />
          <span>
            {slice.label}: {slice.count}
          </span>
        </li>
      ))}
    </ul>
  );
}
