/**
 * Map geometry for the six primary spokes.
 * Each circle grows toward the Brand Portfolio hub so its outer radial edge stays put.
 * Satellites and the hub are not resized.
 */

import type { CanvasEdge } from "@/lib/canvas-sdk/types";

export const HUB_LAYOUT = { x: 800, y: 500, r: 98 };

/**
 * About half again as large. Rounded per spoke so a circle never crosses a neighbor.
 * The visual gap wins if a spoke would otherwise overlap.
 */
export const PRIMARY_SPOKE_GROWTH = 1.49;

const SPOKE_SEEDS = [
  { id: "spoke-aeo", x: 440, y: 320, r: 86, titleSize: 20, railTitleSize: 14.5, tourMargin: 39 },
  { id: "spoke-retail", x: 1160, y: 320, r: 96, titleSize: 20, railTitleSize: 13.5, tourMargin: 29 },
  { id: "spoke-specs", x: 440, y: 680, r: 78, titleSize: 18, railTitleSize: 13.5, tourMargin: 42 },
  { id: "spoke-competitors", x: 1160, y: 680, r: 78, titleSize: 18, railTitleSize: 13, tourMargin: 42 },
  { id: "spoke-fixes", x: 800, y: 180, r: 74, titleSize: 18, railTitleSize: 14, tourMargin: 41 },
  { id: "spoke-roadmap", x: 800, y: 820, r: 74, titleSize: 18, railTitleSize: 14, tourMargin: 41 },
] as const;

export type PrimarySpokeId = (typeof SPOKE_SEEDS)[number]["id"];
type SpokeSeed = (typeof SPOKE_SEEDS)[number];

export type PrimarySpokeLayout = {
  id: PrimarySpokeId;
  x: number;
  y: number;
  r: number;
  /** Column-rail face radius. Matches the circle before it grew, so the rail does not shrink. */
  faceRadius: number;
  titleSize: number;
  railTitleSize: number;
};

/** Satellite circles. Positions and radii stay at the pre-expansion map. */
export const SATELLITE_LAYOUT = {
  "sat-prompts": { x: 240, y: 200, r: 52 },
  "sat-citations": { x: 180, y: 360, r: 52 },
  "sat-drift": { x: 260, y: 480, r: 52 },
  "sat-buybox": { x: 1360, y: 200, r: 54 },
  "sat-asin": { x: 1420, y: 360, r: 54 },
  "sat-map": { x: 1340, y: 480, r: 60 },
  "sat-findability": { x: 160,  y: 580, r: 52 },
  "sat-schema": { x: 230, y: 720, r: 50 },
  "sat-tables": { x: 320, y: 870, r: 48 },
  "sat-taylor": { x: 1370, y: 720, r: 51 },
  "sat-amps": { x: 1280, y: 870, r: 48 },
} as const;

export type SatelliteId = keyof typeof SATELLITE_LAYOUT;

const FOCUS_KEYS: Record<string, PrimarySpokeId> = {
  aeo: "spoke-aeo",
  ecommerce: "spoke-retail",
  "ecommerce:Retail Overview": "spoke-retail",
  specs: "spoke-specs",
  competitors: "spoke-competitors",
  suggestions: "spoke-fixes",
  roadmap: "spoke-roadmap",
};

const TOUR_NODES: Record<string, PrimarySpokeId> = {
  ecommerce: "spoke-retail",
  aeo: "spoke-aeo",
  specs: "spoke-specs",
  competitors: "spoke-competitors",
  suggestions: "spoke-fixes",
  roadmap: "spoke-roadmap",
};

function expandTowardHub(seed: SpokeSeed): PrimarySpokeLayout {
  const r = Math.round(seed.r * PRIMARY_SPOKE_GROWTH);
  const dx = seed.x - HUB_LAYOUT.x;
  const dy = seed.y - HUB_LAYOUT.y;
  const distance = Math.hypot(dx, dy);
  const nextDistance = distance - (r - seed.r);
  const scale = nextDistance / distance;
  return {
    id: seed.id,
    x: Math.round(HUB_LAYOUT.x + dx * scale),
    y: Math.round(HUB_LAYOUT.y + dy * scale),
    r,
    faceRadius: seed.r,
    titleSize: seed.titleSize,
    railTitleSize: seed.railTitleSize,
  };
}

const SPOKE_LAYOUTS = SPOKE_SEEDS.map(expandTowardHub);
const SPOKE_BY_ID = new Map(SPOKE_LAYOUTS.map((spoke) => [spoke.id, spoke]));
const SEED_BY_ID = new Map(SPOKE_SEEDS.map((seed) => [seed.id, seed]));

export function primarySpokeSeeds(): readonly SpokeSeed[] {
  return SPOKE_SEEDS;
}

export function primarySpokeLayouts(): readonly PrimarySpokeLayout[] {
  return SPOKE_LAYOUTS;
}

export function primarySpoke(id: PrimarySpokeId): PrimarySpokeLayout {
  const spoke = SPOKE_BY_ID.get(id);
  if (!spoke) throw new Error(`Unknown primary spoke ${id}`);
  return spoke;
}

export function satelliteNode(id: SatelliteId): { id: SatelliteId; x: number; y: number; r: number } {
  return { id, ...SATELLITE_LAYOUT[id] };
}

function point(id: PrimarySpokeId | "hub" | SatelliteId): { x: number; y: number } {
  if (id === "hub") return HUB_LAYOUT;
  if (id in SATELLITE_LAYOUT) return SATELLITE_LAYOUT[id as SatelliteId];
  return primarySpoke(id as PrimarySpokeId);
}

function link(
  from: PrimarySpokeId | "hub" | SatelliteId,
  to: PrimarySpokeId | "hub" | SatelliteId,
  kind?: CanvasEdge["kind"],
): CanvasEdge {
  const a = point(from);
  const b = point(to);
  return kind ? { x1: a.x, y1: a.y, x2: b.x, y2: b.y, kind } : { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
}

/** Hub, primary spokes, and satellites. Endpoints match the node centers exactly. */
export function fenderCanvasEdges(): CanvasEdge[] {
  return [
    link("hub", "spoke-aeo"),
    link("hub", "spoke-retail"),
    link("hub", "spoke-specs"),
    link("hub", "spoke-competitors"),
    link("hub", "spoke-fixes"),
    link("hub", "spoke-roadmap", "active"),
    link("spoke-aeo", "sat-prompts"),
    link("spoke-aeo", "sat-citations"),
    link("spoke-aeo", "sat-drift"),
    link("spoke-retail", "sat-buybox", "critical"),
    link("spoke-retail", "sat-asin", "critical"),
    link("spoke-retail", "sat-map"),
    link("spoke-specs", "sat-findability"),
    link("spoke-specs", "sat-schema"),
    link("spoke-specs", "sat-tables"),
    link("spoke-competitors", "sat-taylor"),
    link("spoke-competitors", "sat-amps"),
  ];
}

/** Point the camera at the grown spokes. Satellite targets stay as stored. */
export function withPrimaryFocusTargets<T extends Record<string, { x: number; y: number }>>(
  targets: T,
): T {
  const next: Record<string, { x: number; y: number }> = { ...targets };
  for (const [key, id] of Object.entries(FOCUS_KEYS)) {
    const spoke = primarySpoke(id);
    next[key] = { x: spoke.x, y: spoke.y };
  }
  return next as T;
}

export function tourFrame(nodeId: string): { targetX: number; targetY: number; radius: number } | null {
  const id = TOUR_NODES[nodeId];
  if (!id) return null;
  const spoke = primarySpoke(id);
  const seed = SEED_BY_ID.get(id);
  return {
    targetX: spoke.x,
    targetY: spoke.y,
    radius: spoke.r + (seed?.tourMargin ?? 28),
  };
}

export function frameTourStep<T extends { nodeId: string; targetX: number; targetY: number; radius: number }>(
  step: T,
): T {
  const frame = tourFrame(step.nodeId);
  return frame ? { ...step, ...frame } : step;
}

/** Distance from the hub center to the far side of the original circle. */
export function seedOuterExtent(id: PrimarySpokeId): number {
  const seed = SEED_BY_ID.get(id);
  if (!seed) throw new Error(`Unknown primary spoke ${id}`);
  return Math.hypot(seed.x - HUB_LAYOUT.x, seed.y - HUB_LAYOUT.y) + seed.r;
}

export function layoutOuterExtent(spoke: PrimarySpokeLayout): number {
  return Math.hypot(spoke.x - HUB_LAYOUT.x, spoke.y - HUB_LAYOUT.y) + spoke.r;
}
