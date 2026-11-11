// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/tour-card-placement.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  chooseTourCardSide,
  circleBoxClearance,
  framingInset,
  pathClearance,
  type Box,
  type Circle,
  type TourCardSide,
} from "../lib/canvas-sdk/tour-card-placement.ts";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

/* Geometry measured on the dashboard at 1280x720: a 440 x 500 card 36px in from
   the bottom corner, and spoke bubbles framed with a 202px lit area. */
const WIDTH = 1280;
const ZONE = 36 + 440 + 24;
const cardFor = (side: TourCardSide): Box =>
  side === "left"
    ? { left: 36, top: 184, right: 476, bottom: 684 }
    : { left: 804, top: 184, right: 1244, bottom: 684 };
const endFor = (side: TourCardSide): Circle => ({
  x: (WIDTH - framingInset(side, WIDTH, ZONE)) / 2,
  y: 360,
  r: 202,
});

test("clearance is the gap between the lit edge and the card, negative on overlap", () => {
  const card = cardFor("left");
  assert.equal(circleBoxClearance({ x: 676, y: 400, r: 100 }, card), 100);
  assert.equal(circleBoxClearance({ x: 476, y: 400, r: 50 }, card), -50);
  assert.ok(circleBoxClearance({ x: 200, y: 400, r: 10 }, card) < 0, "a node under the card overlaps it");
  assert.equal(circleBoxClearance({ x: 476 + 30, y: 684 + 40, r: 50 }, card), 0, "corner distance is diagonal");
});

test("the node is framed in the room beside the card", () => {
  assert.equal(framingInset("left", WIDTH, ZONE), -ZONE, "card left: centre shifts right");
  assert.equal(framingInset("right", WIDTH, ZONE), ZONE, "card right: centre shifts left");
  assert.equal(endFor("left").x, 890);
  assert.equal(endFor("right").x, 390);
  assert.equal(framingInset("left", ZONE + 240, ZONE), 0, "too narrow to offset: frame the centre");
});

test("a node sliding in from under the left card sends the card right", () => {
  // AI Search Visibility starts at the far left when the camera leaves Catalog Health.
  const plan = chooseTourCardSide({ current: "left", start: { x: 112, y: 360, r: 202 }, endFor, cardFor });
  assert.equal(plan.side, "right");
  assert.ok(plan.clearance >= 0);
});

test("a node arriving from the right keeps the card where it is", () => {
  const plan = chooseTourCardSide({ current: "left", start: { x: 1168, y: 360, r: 202 }, endFor, cardFor });
  assert.equal(plan.side, "left");
  assert.ok(plan.clearance >= 0);
});

test("a node moving straight down the left keeps the card on the right", () => {
  const plan = chooseTourCardSide({ current: "right", start: { x: 390, y: -40, r: 191 }, endFor, cardFor });
  assert.equal(plan.side, "right");
});

test("with no clear side the plan reports an overlap so the card can wait", () => {
  // Brand Overview starts mid-screen at overview zoom, wider than the gap beside either card.
  const plan = chooseTourCardSide({ current: "left", start: { x: 640, y: 360, r: 260 }, endFor, cardFor });
  assert.ok(plan.clearance < 0);
});

test("the path check catches a move that crosses the card between clear ends", () => {
  const card = cardFor("left");
  const above = { x: 250, y: -300, r: 60 };
  const below = { x: 250, y: 1100, r: 60 };
  assert.ok(circleBoxClearance(above, card) > 0 && circleBoxClearance(below, card) > 0);
  assert.ok(pathClearance(above, below, card) < 0);
});

test("the shell hands tour placement to useTourCard and the card can sit on either side", () => {
  const shell = read("lib/canvas-sdk/CanvasShell.tsx");
  assert.ok(!shell.includes("TOUR_CARD_ZONE"), "no fixed bottom-left card zone left in the shell");
  assert.ok(shell.includes("useTourCard({"));
  assert.ok(shell.includes("<TourCard"));
  const css = read("lib/canvas-sdk/canvas-sdk.css");
  assert.match(css, /\.tour-modal-card\[data-side="right"\]\s*\{[^}]*right: 36px/);
  assert.match(css, /\.tour-modal-card\[data-held="true"\]\s*\{[^}]*opacity: 0 !important/);
});
