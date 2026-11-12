import type { ReactNode } from "react";
import {
  DATA_STATUS_MARK_NAME,
  DATA_STATUS_MARK_PATH,
  DATA_STATUS_WORD,
  type DataStatus,
} from "@/lib/canvas-sdk/data-status";

/** The x, dash, or check for one status, drawn in the status color. */
export function StatusGlyph({ status }: { status: DataStatus }) {
  return (
    <svg
      className="data-status-glyph"
      viewBox="0 0 12 12"
      width="12"
      height="12"
      aria-hidden="true"
      data-status-mark={DATA_STATUS_MARK_NAME[status]}
    >
      <path d={DATA_STATUS_MARK_PATH[status]} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Mark and word: "x Poor", "dash Fair", "check Good". The word defaults to the book's.
 * `className` adds a placement class (e.g. a price gap under its price) without a second span.
 */
export function StatusMark({ status, word, className }: { status: DataStatus; word?: string; className?: string }) {
  return (
    <span className={`data-status data-status-${status}${className ? ` ${className}` : ""}`} data-status={status}>
      <StatusGlyph status={status} />
      <span className="data-status-word">{word ?? DATA_STATUS_WORD[status]}</span>
    </span>
  );
}

/**
 * A figure in its status color with the mark and word under it (book p. 11). `tile` draws
 * the night card tint on dark pages and a hairline card on light pages.
 */
export function StatusFigure({
  status,
  value,
  word,
  tile = false,
}: {
  status: DataStatus | null;
  value: ReactNode;
  word?: string;
  tile?: boolean;
}) {
  if (!status) return <span className="data-status-value">{value}</span>;
  return (
    <span className={`data-status-figure data-status-${status}${tile ? " data-status-tile" : ""}`} data-status={status}>
      <span className="data-status-value">{value}</span>
      <StatusMark status={status} word={word} />
    </span>
  );
}
