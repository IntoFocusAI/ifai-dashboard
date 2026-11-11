"use client";

import type { AmazonSpecRowsRead } from "@/components/v3/live/FenderSpecPanel";
import {
  AMAZON_SPECS_LAST_CHECKED_FAILED_DESC,
  AMAZON_SPECS_LAST_CHECKED_UNAVAILABLE_DESC,
  LAST_CHECKED_UNAVAILABLE_LABEL,
  LAST_CHECKED_UNAVAILABLE_TITLE,
  lastCheckedSentence,
  newestAmazonSpecCheckAt,
} from "@/lib/findability/last-checked";

/** One freshness line for the Amazon spec read (FDD D-04), under the heroes like Findability's. */
export function AmazonSpecsLastChecked({ read }: { read: AmazonSpecRowsRead }) {
  if (read.phase === "loading") return null;
  const iso = read.phase === "ready" ? newestAmazonSpecCheckAt(read.rows) : null;
  const sentence = lastCheckedSentence(iso);
  const description =
    read.phase === "error" ? AMAZON_SPECS_LAST_CHECKED_FAILED_DESC : AMAZON_SPECS_LAST_CHECKED_UNAVAILABLE_DESC;
  return (
    <p className="findability-last-checked amazon-specs-last-checked" data-amazon-specs-last-checked={iso ?? ""}>
      {sentence ? (
        sentence
      ) : (
        <>
          Last checked{" "}
          <span
            className="ifai-term"
            data-ifai-tooltip-title={LAST_CHECKED_UNAVAILABLE_TITLE}
            data-ifai-tooltip-desc={description}
            tabIndex={0}
            aria-label={`${LAST_CHECKED_UNAVAILABLE_TITLE}: ${description}`}
          >
            {LAST_CHECKED_UNAVAILABLE_LABEL}
          </span>
        </>
      )}
    </p>
  );
}
