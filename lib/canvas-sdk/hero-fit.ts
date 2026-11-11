/**
 * Hero faces: satellites grow the circle to hold fixed readable text; main bubbles keep a
 * fixed radius and shrink the value (not to a crumb) so title, value, and label clear the ring.
 * A bubble shows its title, its hero figure in the status color, and a short label. The status
 * word lives on the tab; on the map the figure's color carries it (decision, 11 Nov 2026).
 */

import { dataStatusFromNode, type DataStatus } from "@/lib/canvas-sdk/data-status";
import type { NodeStatus } from "@/lib/canvas-sdk/types";

/** X-31: no text on screen under 11px, bubbles included. */
export const SCREEN_TEXT_FLOOR_PX = 11;

/**
 * How large the map and rail draw at 1280x720: the 1600x1000 map fits at 0.72 and the 240px
 * rail draws its 330-unit view at 0.727. A little under both, so the floor holds with rounding.
 */
export const LAPTOP_DRAW_SCALE = 0.715;

/** The smallest bubble text, in drawing units at face scale 1, that renders at 11px at 1280x720. */
export const BUBBLE_TEXT_MIN = Math.ceil((SCREEN_TEXT_FLOOR_PX / LAPTOP_DRAW_SCALE) * 10) / 10;

/** The text floor for a face drawn at `faceScale` (the rail scales a face up to its bubble). */
export function bubbleTextMin(faceScale = 1): number {
  return Math.ceil((BUBBLE_TEXT_MIN / Math.max(faceScale, 0.01)) * 10) / 10;
}

export const SATELLITE_HERO_TEXT = { title: BUBBLE_TEXT_MIN, value: 30, label: BUBBLE_TEXT_MIN } as const;

/** Width estimates per character, as a share of font size. Generous so text clears the ring. */
const WIDTH_PER_CHAR = { title: 0.62, value: 0.6, valueText: 0.62, label: 0.62 } as const;

const RING_PAD = 10;
const TITLE_GAP = 5;
const LABEL_GAP = 4;

/** Main-bubble ring clearance (icon + title already sit above `startY`). */
const MAIN_RING_PAD = 14;
const MAIN_MIN_VALUE = 15;
const MAIN_MAX_VALUE_RATIO = 0.3;

type Row = { text: string; size: number; kind: keyof typeof WIDTH_PER_CHAR };

export type HeroRow = Row & { baseline: number };

export type HeroFaceLayout = {
  /** Smallest radius whose ring clears every row. */
  radius: number;
  rows: HeroRow[];
};

function rowWidth(row: Row): number {
  return row.text.length * row.size * WIDTH_PER_CHAR[row.kind];
}

/**
 * The status color a bubble's figure (and its ring) takes. A value with no number ("Loading",
 * "Not available*") has no status, so it draws in the plain text color.
 */
export function heroStatus(status: NodeStatus | undefined, value: string): DataStatus | null {
  return /\d/.test(value) && isCompactHeroValue(value) ? dataStatusFromNode(status) : null;
}

function rowHeight(row: Row): number {
  return row.kind === "value" ? row.size * 0.82 : row.size * 1.12;
}

function twoLineSplits(text: string): string[][] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return [];
  const splits: string[][] = [];
  for (let i = 1; i < words.length; i += 1) {
    splits.push([words.slice(0, i).join(" "), words.slice(i).join(" ")]);
  }
  return splits;
}

/** The most even two-line split of a worded value, or the text itself when it is one word. */
function splitWords(text: string): string[] {
  const [best] = twoLineSplits(text).sort(
    (a, b) => Math.max(a[0].length, a[1].length) - Math.max(b[0].length, b[1].length),
  );
  return best ?? [text.trim()];
}

/**
 * Compact heroes stay large ("61.2%", "+$680K", "90 Days"). Worded loading/empty states
 * ("Loading run", "No competitor wins") read at label size so they never look like fake zeros.
 */
export function isCompactHeroValue(value: string): boolean {
  const text = value.trim();
  if (!text) return false;
  if (!/\s/.test(text)) return true;
  // Digit-led two-token figures such as "90 Days" still lead the bubble.
  if (/^[\d$+]/.test(text) && text.split(/\s+/).length <= 2 && text.length <= 14) return true;
  return false;
}

function layoutRows(titleLines: string[], value: string, labelLines: string[]): HeroFaceLayout {
  // A worded empty state ("No resolved answers") reads at label size, not as a giant number.
  const valueRows: Row[] = isCompactHeroValue(value)
    ? [{ text: value.trim(), size: SATELLITE_HERO_TEXT.value, kind: "value" as const }]
    : splitWords(value).map((text) => ({ text, size: SATELLITE_HERO_TEXT.label, kind: "valueText" as const }));
  const rows: Row[] = [
    ...titleLines.map((text) => ({ text, size: SATELLITE_HERO_TEXT.title, kind: "title" as const })),
    ...valueRows,
    ...labelLines.filter((text) => text.trim()).map((text) => ({ text, size: SATELLITE_HERO_TEXT.label, kind: "label" as const })),
  ];
  const gaps = rows.map((row, index) => {
    if (index === 0) return 0;
    const prev = rows[index - 1];
    if (prev.kind === "title" && row.kind !== "title") return TITLE_GAP;
    if (prev.kind !== "label" && row.kind === "label") return LABEL_GAP;
    return 1;
  });
  const total = rows.reduce((sum, row, index) => sum + gaps[index] + rowHeight(row), 0);
  let top = -total / 2;
  let radius = 0;
  const placed: HeroRow[] = rows.map((row, index) => {
    top += gaps[index];
    const height = rowHeight(row);
    const bottom = top + height;
    const halfWidth = rowWidth(row) / 2 + RING_PAD;
    const edge = Math.max(Math.abs(top), Math.abs(bottom));
    radius = Math.max(radius, Math.hypot(halfWidth, edge));
    const baseline = row.kind === "value" ? bottom : top + row.size * 0.86;
    top = bottom;
    return { ...row, baseline };
  });
  return { radius: Math.ceil(radius), rows: placed };
}

/**
 * Lay out a satellite hero face around the circle's center. The title and the label may
 * each take one or two lines; whichever arrangement needs the smallest circle wins.
 */
export function satelliteHeroLayout(title: string, value: string, label: string): HeroFaceLayout {
  const titleOptions = [[title.trim()], ...twoLineSplits(title)];
  const labelOptions = label.trim() ? [[label.trim()], ...twoLineSplits(label)] : [[""]];
  let best: HeroFaceLayout | null = null;
  let bestScore = Infinity;
  for (const titleLines of titleOptions) {
    for (const labelLines of labelOptions) {
      const next = layoutRows(titleLines, value, labelLines);
      // A one-line title and label read best; a wrap has to save real room to win.
      const score = next.radius * (1 + 0.12 * (titleLines.length - 1) + 0.12 * (Math.max(0, labelLines.filter(Boolean).length - 1)));
      if (score < bestScore) {
        best = next;
        bestScore = score;
      }
    }
  }
  return best!;
}

/** The radius a satellite needs: its stored radius, or larger when its hero text needs it. */
export function satelliteFitRadius(node: {
  r: number;
  title: string;
  heroValue?: { value: string; label: string };
}): number {
  if (!node.heroValue) return node.r;
  const { value, label } = node.heroValue;
  return Math.max(node.r, satelliteHeroLayout(node.title, value, label).radius);
}

function estimateWidth(text: string, size: number, kind: "value" | "valueText" | "label"): number {
  return text.length * size * WIDTH_PER_CHAR[kind];
}

function wrapToWidth(label: string, maxWidth: number, fontSize: number): string[] {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let line = words[0];
  for (let i = 1; i < words.length; i += 1) {
    const candidate = `${line} ${words[i]}`;
    if (estimateWidth(candidate, fontSize, "label") <= maxWidth) {
      line = candidate;
    } else {
      lines.push(line);
      line = words[i];
    }
  }
  lines.push(line);
  return lines;
}

/** The two-row split of a label whose longer row is shortest. Null for a one-word label. */
function balancedTwoLines(label: string, fontSize: number): string[] | null {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return null;
  let best: string[] | null = null;
  let bestWidth = Infinity;
  for (let cut = 1; cut < words.length; cut += 1) {
    const rows = [words.slice(0, cut).join(" "), words.slice(cut).join(" ")];
    const width = Math.max(...rows.map((row) => estimateWidth(row, fontSize, "label")));
    if (width < bestWidth) {
      best = rows;
      bestWidth = width;
    }
  }
  return best;
}

/** How far the label rows reach past the ring's clear radius, in px. Zero or less clears it. */
function labelSpill(lines: readonly string[], top: number, lineH: number, fontSize: number, radius: number): number {
  const clear = radius - MAIN_RING_PAD;
  let spill = -Infinity;
  lines.forEach((line, index) => {
    const half = estimateWidth(line, fontSize, "label") / 2;
    const bottom = top + (index + 1) * lineH;
    spill = Math.max(spill, Math.hypot(half, bottom) - clear);
  });
  return spill;
}

function boxClearsRing(halfWidth: number, top: number, bottom: number, radius: number): boolean {
  const clear = radius - MAIN_RING_PAD;
  if (clear <= 0) return false;
  return Math.hypot(halfWidth, Math.abs(top)) <= clear && Math.hypot(halfWidth, Math.abs(bottom)) <= clear;
}

export type MainHeroFit = {
  valueSize: number;
  labelSize: number;
  labelLines: string[];
  labelLineH: number;
  valueY: number;
  labelY: number;
  /** True when the value is a worded state rendered at label size. */
  worded: boolean;
};

/** Horizontal room at a given y inside the circle (chord width minus padding). */
function chordWidth(radius: number, y: number): number {
  const clear = Math.max(8, radius - MAIN_RING_PAD);
  const yClamped = Math.min(Math.abs(y), clear - 1);
  return 2 * Math.sqrt(Math.max(0, clear * clear - yClamped * yClamped));
}

/**
 * Fit one hero value + label inside a main bubble of fixed `radius`, starting at `startY`
 * (below the icon and title). Shrinks the value until every glyph clears the ring with
 * padding. The value, the label, and a worded value never go under `minText`, the size that
 * renders at 11px on screen at 1280x720 (see bubbleTextMin).
 */
export function fitMainHero(
  value: string,
  label: string,
  radius: number,
  startY: number,
  minText: number = BUBBLE_TEXT_MIN,
  explainer = false,
): MainHeroFit {
  const trimmed = value.trim() || "Not available";
  const worded = explainer || !isCompactHeroValue(trimmed);
  const bottomLimit = radius - MAIN_RING_PAD;
  const diameterWidth = Math.max(40, radius * 2 - MAIN_RING_PAD * 2);

  const widthFit = (text: string, size: number, kind: "value" | "valueText" | "label", atY: number) => {
    const maxWidth = Math.min(diameterWidth, Math.max(36, chordWidth(radius, atY)));
    const width = estimateWidth(text, size, kind);
    return width > maxWidth ? size * (maxWidth / width) : size;
  };

  const valueFloor = Math.max(MAIN_MIN_VALUE, minText);
  const valueSize = worded
    ? Math.max(minText, Math.min(14, radius * 0.16))
    : Math.max(valueFloor, widthFit(trimmed, Math.max(valueFloor, radius * MAIN_MAX_VALUE_RATIO), "value", startY + radius * 0.2));

  const place = (vSize: number, lSize: number, lastResort = false) => {
    const gap = Math.max(3, vSize * 0.16);
    const valueTop = startY;
    const valueBottom = startY + (worded ? vSize * 1.05 : vSize * 0.82);
    const labelTopGuess = valueBottom + gap;
    const labelMax = Math.min(diameterWidth, Math.max(36, chordWidth(radius, labelTopGuess + lSize)));
    // Prefer a two-line wrap for long labels so the value can stay large near the center.
    let lines = label.trim() ? wrapToWidth(label, labelMax, lSize) : [];
    const lineH = lSize + 2;
    if (lastResort && lines.length > 2) {
      // Nothing clears the ring at the floor size. Three narrow rows run out of the bubble's
      // bottom; two balanced rows usually stay inside it, so take whichever spills less.
      const two = balancedTwoLines(label, lSize);
      const top = valueBottom + gap;
      if (two && labelSpill(two, top, lineH, lSize, radius) < labelSpill(lines, top, lineH, lSize, radius)) lines = two;
    }
    const labelTop = lines.length ? valueBottom + gap : valueBottom;
    const labelBottom = lines.length ? labelTop + lines.length * lineH : valueBottom;
    const valueHalf = estimateWidth(trimmed, vSize, worded ? "valueText" : "value") / 2;
    const labelHalf = lines.length ? Math.max(...lines.map((line) => estimateWidth(line, lSize, "label"))) / 2 : 0;
    const labelOk = lines.length === 0 || boxClearsRing(labelHalf, labelTop, labelBottom, radius);
    const ok = labelBottom <= bottomLimit && boxClearsRing(valueHalf, valueTop, valueBottom, radius) && labelOk;
    return {
      ok,
      labelLines: lines,
      labelLineH: lineH,
      valueY: worded ? startY + vSize * 0.86 : startY + vSize * 0.78,
      labelY: lines.length ? valueBottom + gap + lSize * 0.82 : valueBottom,
    };
  };

  const floor = worded ? minText : valueFloor;
  const labelFor = (vSize: number) => (worded ? vSize : Math.max(minText, vSize * 0.36));
  const result = (vSize: number, placed: ReturnType<typeof place>): MainHeroFit => ({
    valueSize: vSize,
    labelSize: labelFor(vSize),
    labelLines: placed.labelLines,
    labelLineH: placed.labelLineH,
    valueY: placed.valueY,
    labelY: placed.labelY,
    worded,
  });
  let size = valueSize;
  for (let pass = 0; pass < 12; pass += 1) {
    const next = place(size, labelFor(size));
    if (next.ok) return result(size, next);
    if (size <= floor) break;
    size = Math.max(floor, size * 0.88);
  }
  const smallest = Math.min(valueSize, floor);
  return result(smallest, place(smallest, labelFor(smallest), true));
}
