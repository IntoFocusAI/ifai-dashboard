export type TourCardSide = "left" | "right";

export type Circle = { x: number; y: number; r: number };

export type Box = { left: number; top: number; right: number; bottom: number };

/** Space kept between the card's inner edge and the framed node. */
export const TOUR_CARD_GUTTER = 24;

/** Below this much clear space beside the card, offsetting the frame would push the node off-screen. */
export const TOUR_CARD_MIN_ROOM = 240;

/** The dimmer hole is this much wider than the spotlight ring. */
export const TOUR_HOLE_SCALE = 1.5;

/** Zoom the tour frames each step at. */
export const TOUR_FRAME_SCALE = 1.12;

export function otherSide(side: TourCardSide): TourCardSide {
  return side === "left" ? "right" : "left";
}

/** Gap between a circle's edge and a box; negative when they overlap. */
export function circleBoxClearance(circle: Circle, box: Box): number {
  const nearestX = Math.max(box.left, Math.min(circle.x, box.right));
  const nearestY = Math.max(box.top, Math.min(circle.y, box.bottom));
  return Math.hypot(nearestX - circle.x, nearestY - circle.y) - circle.r;
}

/**
 * Horizontal offset for `framePoint` so the node is centred in the room beside the card.
 * Negative shifts the centre right (card on the left), positive shifts it left.
 */
export function framingInset(side: TourCardSide, viewportWidth: number, cardZone: number): number {
  if (viewportWidth <= cardZone + TOUR_CARD_MIN_ROOM) return 0;
  return side === "left" ? -cardZone : cardZone;
}

/** Smallest clearance while the lit area travels from `start` to `end`. */
export function pathClearance(start: Circle, end: Circle, box: Box, samples = 24): number {
  let min = Infinity;
  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    const at = {
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t,
      r: start.r + (end.r - start.r) * t,
    };
    min = Math.min(min, circleBoxClearance(at, box));
  }
  return min;
}

export type SidePlan = { side: TourCardSide; clearance: number };

/**
 * Keep the card where it is when the lit area's whole move stays clear of it,
 * otherwise flip to the side that does; with neither clear, take the roomier one.
 */
export function chooseTourCardSide({
  current,
  start,
  endFor,
  cardFor,
}: {
  current: TourCardSide;
  start: Circle;
  endFor: (side: TourCardSide) => Circle;
  cardFor: (side: TourCardSide) => Box;
}): SidePlan {
  const stay = { side: current, clearance: pathClearance(start, endFor(current), cardFor(current)) };
  if (stay.clearance >= 0) return stay;
  const flip = otherSide(current);
  const move = { side: flip, clearance: pathClearance(start, endFor(flip), cardFor(flip)) };
  return move.clearance > stay.clearance ? move : stay;
}
