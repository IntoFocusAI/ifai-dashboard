/**
 * Hero faces: satellites grow the circle to hold fixed readable text; main bubbles keep a
 * fixed radius and shrink the value (not to a crumb) so title, value, and label clear the ring.
 */

import { DATA_STATUS_WORD, dataStatusFromNode, type DataStatus } from "@/lib/canvas-sdk/data-status";
import type { NodeStatus } from "@/lib/canvas-sdk/types";

export const SATELLITE_HERO_TEXT = { title: 13, value: 30, label: 12.5, status: 11 } as const;

/** Width estimates per character, as a share of font size. Generous so text clears the ring. */
const WIDTH_PER_CHAR = { title: 0.62, value: 0.6, valueText: 0.62, label: 0.62, status: 0.62 } as const;

/** The status mark drawn ahead of the status word, as a share of the word's font size. */
export const STATUS_MARK_EM = 1;
export const STATUS_MARK_GAP_EM = 0.35;
const RING_PAD = 10;
const TITLE_GAP = 5;
const LABEL_GAP = 4;

/** Main-bubble ring clearance (icon + title already sit above `startY`). */
const MAIN_RING_PAD = 14;
const MAIN_MIN_VALUE = 15;
const MAIN_MIN_LABEL = 10;
const MAIN_MAX_VALUE_RATIO = 0.3;

type Row = { text: string; size: number; kind: keyof typeof WIDTH_PER_CHAR };

export type HeroRow = Row & { baseline: number };

export type HeroFaceLayout = {
  /** Smallest radius whose ring clears every row. */
  radius: number;
  rows: HeroRow[];
};

function rowWidth(row: Row): number {
  const mark = row.kind === "status" ? row.size * (STATUS_MARK_EM + STATUS_MARK_GAP_EM) : 0;
  return mark + row.text.length * row.size * WIDTH_PER_CHAR[row.kind];
}

/**
 * A bubble's figure carries its status color only with the mark and word beside it. A value
 * with no number ("Loading", "Not available*") has no status, so it draws in the plain text color.
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

function layoutRows(titleLines: string[], value: string, labelLines: string[], status: DataStatus | null): HeroFaceLayout {
  // A worded empty state ("No resolved answers") reads at label size, not as a giant number.
  const valueRows: Row[] = isCompactHeroValue(value)
    ? [{ text: value.trim(), size: SATELLITE_HERO_TEXT.value, kind: "value" as const }]
    : splitWords(value).map((text) => ({ text, size: SATELLITE_HERO_TEXT.label, kind: "valueText" as const }));
  const rows: Row[] = [
    ...titleLines.map((text) => ({ text, size: SATELLITE_HERO_TEXT.title, kind: "title" as const })),
    ...valueRows,
    ...labelLines.filter((text) => text.trim()).map((text) => ({ text, size: SATELLITE_HERO_TEXT.label, kind: "label" as const })),
    ...(status ? [{ text: DATA_STATUS_WORD[status], size: SATELLITE_HERO_TEXT.status, kind: "status" as const }] : []),
  ];
  const gaps = rows.map((row, index) => {
    if (index === 0) return 0;
    const prev = rows[index - 1];
    if (prev.kind === "title" && row.kind !== "title") return TITLE_GAP;
    if (prev.kind !== "label" && row.kind === "label") return LABEL_GAP;
    if (row.kind === "status") return LABEL_GAP;
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
export function satelliteHeroLayout(
  title: string,
  value: string,
  label: string,
  status: DataStatus | null = null,
): HeroFaceLayout {
  const titleOptions = [[title.trim()], ...twoLineSplits(title)];
  const labelOptions = label.trim() ? [[label.trim()], ...twoLineSplits(label)] : [[""]];
  let best: HeroFaceLayout | null = null;
  let bestScore = Infinity;
  for (const titleLines of titleOptions) {
    for (const labelLines of labelOptions) {
      const next = layoutRows(titleLines, value, labelLines, status);
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
  status?: NodeStatus;
  heroValue?: { value: string; label: string };
}): number {
  if (!node.heroValue) return node.r;
  const { value, label } = node.heroValue;
  return Math.max(node.r, satelliteHeroLayout(node.title, value, label, heroStatus(node.status, value)).radius);
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
  /** Baseline of the status mark and word under the label, when the figure has a status. */
  statusY: number;
  statusSize: number;
  /** True when the value is a worded state rendered at label size. */
  worded: boolean;
};

/**
 * Fit one hero value + label inside a main bubble of fixed `radius`, starting at `startY`
 * (below the icon and title). Shrinks the stack until every glyph clears the ring with
 * padding, but keeps the value at or above a readable floor whenever the circle allows.
 */
/** Horizontal room at a given y inside the circle (chord width minus padding). */
function chordWidth(radius: number, y: number): number {
  const clear = Math.max(8, radius - MAIN_RING_PAD);
  const yClamped = Math.min(Math.abs(y), clear - 1);
  return 2 * Math.sqrt(Math.max(0, clear * clear - yClamped * yClamped));
}

export function fitMainHero(
  value: string,
  label: string,
  radius: number,
  startY: number,
  status: DataStatus | null = null,
): MainHeroFit {
  const trimmed = value.trim() || "—";
  const worded = !isCompactHeroValue(trimmed);
  const bottomLimit = radius - MAIN_RING_PAD;
  const diameterWidth = Math.max(40, radius * 2 - MAIN_RING_PAD * 2);

  const widthFit = (text: string, size: number, kind: "value" | "valueText" | "label", atY: number) => {
    const maxWidth = Math.min(diameterWidth, Math.max(36, chordWidth(radius, atY)));
    const width = estimateWidth(text, size, kind);
    return width > maxWidth ? size * (maxWidth / width) : size;
  };

  let valueSize = worded
    ? Math.max(MAIN_MIN_LABEL, Math.min(14, radius * 0.16))
    : widthFit(trimmed, Math.max(MAIN_MIN_VALUE, radius * MAIN_MAX_VALUE_RATIO), "value", startY + radius * 0.2);
  let labelSize = worded ? valueSize : Math.max(MAIN_MIN_LABEL, valueSize * 0.36);

  const place = (vSize: number, lSize: number) => {
    const gap = Math.max(3, vSize * 0.16);
    const valueTop = startY;
    const valueBottom = startY + (worded ? vSize * 1.05 : vSize * 0.82);
    const labelTopGuess = valueBottom + gap;
    const labelMax = Math.min(
      diameterWidth,
      Math.max(36, chordWidth(radius, labelTopGuess + lSize)),
    );
    // Prefer a two-line wrap for long labels so the value can stay large near the center.
    const lines = label.trim() ? wrapToWidth(label, labelMax, lSize) : [];
    const lineH = lSize + 2;
    const labelTop = lines.length ? valueBottom + gap : valueBottom;
    const labelBottom = lines.length ? labelTop + lines.length * lineH : valueBottom;
    const statusTop = labelBottom + gap;
    const statusBottom = status ? statusTop + lSize * 1.12 : labelBottom;
    const statusHalf = status
      ? (lSize * (STATUS_MARK_EM + STATUS_MARK_GAP_EM) + estimateWidth(DATA_STATUS_WORD[status], lSize, "label")) / 2
      : 0;
    const valueHalf = estimateWidth(trimmed, vSize, worded ? "valueText" : "value") / 2;
    const labelHalf = lines.length
      ? Math.max(...lines.map((line) => estimateWidth(line, lSize, "label"))) / 2
      : 0;
    const ok =
      statusBottom <= bottomLimit &&
      boxClearsRing(valueHalf, valueTop, valueBottom, radius) &&
      (lines.length === 0 || boxClearsRing(labelHalf, labelTop, labelBottom, radius)) &&
      (!status || boxClearsRing(statusHalf, statusTop, statusBottom, radius));
    return {
      ok,
      labelLines: lines,
      labelLineH: lineH,
      valueY: worded ? startY + vSize * 0.86 : startY + vSize * 0.78,
      labelY: lines.length ? valueBottom + gap + lSize * 0.82 : valueBottom,
      statusY: statusTop + lSize * 0.86,
    };
  };

  const floor = worded ? MAIN_MIN_LABEL : MAIN_MIN_VALUE;
  for (let pass = 0; pass < 12; pass += 1) {
    const next = place(valueSize, labelSize);
    if (next.ok || valueSize <= floor) {
      return {
        valueSize,
        labelSize,
        labelLines: next.labelLines,
        labelLineH: next.labelLineH,
        valueY: next.valueY,
        labelY: next.labelY,
        statusY: next.statusY,
        statusSize: labelSize,
        worded,
      };
    }
    valueSize = Math.max(floor, valueSize * 0.88);
    labelSize = worded ? valueSize : Math.max(MAIN_MIN_LABEL, valueSize * 0.36);
  }

  const fallback = place(valueSize, labelSize);
  return {
    valueSize,
    labelSize,
    labelLines: fallback.labelLines,
    labelLineH: fallback.labelLineH,
    valueY: fallback.valueY,
    labelY: fallback.labelY,
    statusY: fallback.statusY,
    statusSize: labelSize,
    worded,
  };
}
