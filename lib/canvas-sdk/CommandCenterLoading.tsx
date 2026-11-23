import { Sparkles } from "lucide-react";
import { LoadingMark } from "@/components/v3/live/LoadingMark";

/** Priorities and TODAY'S READ while a read the ranking needs is loading: no order is shown until all have landed. */
export function CommandCenterLoading() {
  return (
    <div className="command-center" data-command-center-loading="">
      <div className="cc-summary">
        <div className="cc-summary-head">
          <Sparkles size={13} />
          <span>Today&apos;s read</span>
        </div>
        <p className="cc-summary-body">
          <LoadingMark label="Loading" />
        </p>
      </div>
      <div className="cc-list-head">
        <span>What to worry about today</span>
      </div>
      <p className="cc-empty">
        <LoadingMark label="Loading the ranked priorities" />
      </p>
    </div>
  );
}
