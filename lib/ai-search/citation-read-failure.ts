import type { AiSearchRead } from "@/lib/ai-search/types";

/** Which Citation Ecosystem read failed: the selected history period, or the published run. */
export type CitationFailedRead = "period" | "published";

export const CITATION_READ_ERROR_TITLE = "Database error";

export type CitationFailureCopy = {
  /** Names what did not load, for example "The selected period". */
  subject: string;
  /** What the person can do next, or null when there is nothing else to pick. */
  next: string | null;
  offerPublished: boolean;
};

/**
 * What Citation Ecosystem says when its read fails. The database error is never part of this
 * copy; it sits in the tooltip on "did not load".
 */
export function citationFailureCopy(
  failed: CitationFailedRead,
  published: AiSearchRead["phase"] | null,
): CitationFailureCopy {
  if (failed === "published") {
    return {
      subject: "The published run",
      next: published == null ? null : "Pick a stored run from the date menu above.",
      offerPublished: false,
    };
  }
  const next = {
    ready: "The published run loaded. Show it here, or pick another period from the date menu above.",
    loading: "The published run is still loading.",
    error: "The published run did not load either.",
    "no-run": "No AI run has been published yet.",
  }[published ?? "loading"];
  return { subject: "The selected period", next, offerPublished: published === "ready" };
}

/** The tooltip text. A failure with no message still opens to something. */
export function citationErrorDetail(message: string): string {
  return message.trim() || "The database returned no error detail.";
}
