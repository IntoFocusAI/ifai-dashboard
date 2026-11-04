export type TooltipAnchor = "cursor" | "column-right" | "definition";

export type TooltipContent = {
  title: string;
  desc: string;
  hasMoreInfo: boolean;
  anchor: TooltipAnchor;
  example?: boolean;
};

/** True when two tooltips would render the same box, so a pointer move need not re-render it. */
export function sameTooltipContent(a: TooltipContent | null, b: TooltipContent | null) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.title === b.title &&
    a.desc === b.desc &&
    a.hasMoreInfo === b.hasMoreInfo &&
    a.anchor === b.anchor &&
    Boolean(a.example) === Boolean(b.example)
  );
}
