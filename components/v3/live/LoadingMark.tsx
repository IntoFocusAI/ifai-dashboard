import "@/components/v3/live/loading-mark.css";

/**
 * The one "Loading" indicator: a small spinner beside the words, so a pending read never looks
 * frozen. CSS-only motion; with prefers-reduced-motion the ring is shown still.
 */
export function LoadingMark({ label = "Loading" }: { label?: string }) {
  return (
    <span className="loading-mark" role="status" aria-live="polite" data-loading-mark="">
      <span className="loading-mark-spinner" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
