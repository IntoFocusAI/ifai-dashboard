import { READ_NOT_AVAILABLE, readFailureTip } from "@/lib/fender-canvas/canvas-reads";
import type { CanvasReadFailure } from "@/lib/fender-canvas/types";

/** Not available* in place of a figure whose read failed. The tooltip names that read. */
export function ReadNotAvailableMark({ failure }: { failure: CanvasReadFailure }) {
  const tip = readFailureTip(failure);
  return (
    <span
      className="ifai-term"
      data-ifai-tooltip-title={READ_NOT_AVAILABLE}
      data-ifai-tooltip-desc={tip}
      data-read-unavailable={failure.source}
      tabIndex={0}
      aria-label={`${READ_NOT_AVAILABLE}: ${tip}`}
    >
      {READ_NOT_AVAILABLE}
    </span>
  );
}

/** A content box whose whole body came from the failed read. */
export function ReadNotAvailableBox({
  title,
  failure,
}: {
  title: string;
  failure: CanvasReadFailure;
}) {
  return (
    <div className="content-box" data-read-unavailable-box={failure.source}>
      <div className="content-box-title">
        <span>{title}</span>
      </div>
      <div>
        <ReadNotAvailableMark failure={failure} />
      </div>
    </div>
  );
}
