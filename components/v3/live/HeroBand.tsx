import type { ReactNode } from "react";

/** Data attributes passed through to the band or its hero column ({"data-amazon-specs-band": ""}). */
type DataAttrs = { [key: `data-${string}`]: string };

/**
 * The hero band every panel tab uses (X-36, decision 110): hero cards line up from the top left at
 * their own width, and the notes fill the space beside them. When the space left is narrower than
 * the notes' floor (280px), the notes wrap below at full width. A band with no notes lets its hero
 * cards grow to fill the row. The rule lives in `.hero-band` (lib/canvas-sdk/canvas-sdk.css), the
 * same for every client.
 */
export function HeroBand({
  heroes,
  notes,
  bandAttrs,
  heroesAttrs,
  notesAttrs,
}: {
  heroes: ReactNode;
  notes?: ReactNode;
  bandAttrs?: DataAttrs;
  heroesAttrs?: DataAttrs;
  notesAttrs?: DataAttrs;
}) {
  return (
    <div className={notes ? "hero-band" : "hero-band hero-band-no-notes"} data-hero-band="" {...bandAttrs}>
      <div className="hero-band-heroes" data-hero-band-heroes="" {...heroesAttrs}>
        {heroes}
      </div>
      {notes ? (
        <div className="hero-band-notes" data-hero-band-notes="" {...notesAttrs}>
          {notes}
        </div>
      ) : null}
    </div>
  );
}
