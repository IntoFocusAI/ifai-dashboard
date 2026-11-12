import { loadSitesToReview } from "@/lib/ai-search/site-review-read";
import { reviewCells, SITES_TO_REVIEW_HEADER, SITES_TO_REVIEW_TABLE } from "@/lib/ai-search/site-review";
import { activeClientKey } from "@/lib/client/active-client";
import { getCommandSession } from "@/lib/command/session";
import type { SourceRead } from "@/lib/export/types";
import { formatInt } from "@/lib/fender-canvas/format";

/** Download CSV for the staff Sites to review list. Staff only, like the page. */
export async function loadSitesToReviewSource(): Promise<SourceRead> {
  const session = await getCommandSession();
  if (!session?.isIntoFocusAdmin) return { ok: false, message: "This download is for IntoFocus staff." };
  const read = await loadSitesToReview(activeClientKey());
  if (!read.ok) return { ok: false, message: read.message };
  // The same columns the page shows: Reason with the staff read, answers when the run read worked.
  const keep = SITES_TO_REVIEW_HEADER.map((_, i) => (i === 3 ? read.writable : i === 4 ? read.hasAnswers : true));
  const pick = (cells: readonly string[]) => cells.filter((_, i) => keep[i]);
  return {
    ok: true,
    source: {
      table: SITES_TO_REVIEW_TABLE,
      header: pick(SITES_TO_REVIEW_HEADER),
      rows: read.rows.map((row) => ({ key: row.domain, cells: pick(reviewCells(row)) })),
      filter: "AI site type under the review threshold, no staff override.",
      sort: "Lowest confidence first.",
      population: `${formatInt(read.rows.length)} ${read.rows.length === 1 ? "site" : "sites"} to review`,
      asOf: new Date().toISOString().slice(0, 10),
    },
  };
}
