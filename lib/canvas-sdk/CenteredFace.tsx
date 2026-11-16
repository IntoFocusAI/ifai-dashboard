"use client";

import { BUBBLE_TEXT_MIN } from "@/lib/canvas-sdk/hero-fit";
import { CenteredStack, HeroValue } from "@/lib/canvas-sdk/GraphFaceParts";
import { IOM_STAT_PILL_FONT, textWidth } from "@/lib/canvas-sdk/graph-text";
import { SatelliteHeroFace } from "@/lib/canvas-sdk/SatelliteHeroFace";
import type { NodeStatus } from "@/lib/canvas-sdk/types";

export type BubbleIcon = "sparkles" | "bag" | "radar" | "clipboard" | "wrench" | "route";

export const PRIMARY_SPOKES = new Set([
  "spoke-aeo",
  "spoke-retail",
  "spoke-competitors",
  "spoke-specs",
  "spoke-fixes",
  "spoke-roadmap",
]);


export const SPOKE_ICONS: Record<string, BubbleIcon> = {
  "spoke-aeo": "sparkles",
  "spoke-retail": "bag",
  "spoke-competitors": "radar",
  "spoke-specs": "clipboard",
  "spoke-fixes": "wrench",
  "spoke-roadmap": "route",
};

function BubbleGlyph({ icon }: { icon: BubbleIcon }) {
  return (
    <svg
      className="node-glyph"
      x={-11}
      y={-11}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {icon === "sparkles" ? (
        <path d="M9.9 15.5A2 2 0 0 0 8.5 14.1L2.4 12.5a.5.5 0 0 1 0-1L8.5 9.9A2 2 0 0 0 9.9 8.5l1.6-6.1a.5.5 0 0 1 1 0l1.6 6.1a2 2 0 0 0 1.4 1.4l6.1 1.6a.5.5 0 0 1 0 1l-6.1 1.6a2 2 0 0 0-1.4 1.4l-1.6 6.1a.5.5 0 0 1-1 0z" />
      ) : null}
      {icon === "bag" ? (
        <>
          <path d="M6 7h12l-1 13H7L6 7z" />
          <path d="M9 7a3 3 0 0 1 6 0" />
        </>
      ) : null}
      {icon === "radar" ? (
        <>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
          <path d="M12 12 17 7" />
        </>
      ) : null}
      {icon === "clipboard" ? (
        <>
          <rect x="7" y="4" width="10" height="16" rx="2" />
          <path d="M9 4.5h6v2H9z" />
          <path d="m9 13 2 2 4-4" />
        </>
      ) : null}
      {icon === "wrench" ? (
        <path d="M14.7 6.3a4.5 4.5 0 0 0-6.2 6.2L4 17a2 2 0 1 0 3 3l4.5-4.5a4.5 4.5 0 0 0 6.2-6.2L15 12l-3-3z" />
      ) : null}
      {icon === "route" ? (
        <>
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1" />
          <path d="M4 22v-7" />
          <path d="M9 22v-4" />
          <path d="M15 22v-2" />
          <path d="M20 22V9" />
        </>
      ) : null}
    </svg>
  );
}

function titleLines(title: string) {
  const words = title.trim().split(/\s+/);
  if (words.length < 2 || title.length <= 12) return [title];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
}

export function CenteredFace({
  title,
  stats,
  meta,
  status,
  icon,
  radius,
  hub,
  prominent,
  logoSrc,
  plate,
  titleSize: titleSizeOverride,
  statPillSize,
  heroValue,
  minText = BUBBLE_TEXT_MIN,
}: {
  title: string;
  stats: string[];
  meta?: string;
  status: NodeStatus;
  icon?: BubbleIcon;
  radius: number;
  hub?: boolean;
  prominent?: boolean;
  logoSrc?: string;
  plate?: boolean;
  titleSize?: number;
  statPillSize?: number;
  heroValue?: { value: string; label: string; explainer?: boolean };
  /** Smallest text in this face's units that renders at 11px at 1280x720. */
  minText?: number;
}) {
  const pillFont = Math.max(statPillSize ?? IOM_STAT_PILL_FONT, minText);

  if (hub) {
    const lines = titleLines(title);
    // With a hero figure under the logo, keep the title compact so the value stays readable.
    const compact = Boolean(heroValue && logoSrc);
    const titleY = logoSrc ? (compact ? 0 : 6) : -16;
    const titleStep = logoSrc ? (compact ? 18 : 26) : 28;
    const titleSize = logoSrc ? (compact ? 15 : 20) : 22;
    const stackStartY =
      titleY + lines.length * titleStep + (meta || stats.length || heroValue ? (compact ? 4 : 8) : 0);
    return (
      <g className="node-face">
        {logoSrc ? (
          <image
            className="hub-logo"
            href={logoSrc}
            x={-56}
            y={compact ? -78 : -72}
            width={112}
            height={compact ? 40 : 45}
            preserveAspectRatio="xMidYMid meet"
          />
        ) : null}
        {lines.map((line, index) => (
          <text
            key={line}
            className="node-title hub-title"
            y={titleY + index * titleStep}
            textAnchor="middle"
            fontSize={titleSize}
          >
            {line}
          </text>
        ))}
        {heroValue ? (
          <HeroValue
            value={heroValue.value}
            label={heroValue.label}
            explainer={heroValue.explainer}
            status={status}
            radius={radius}
            startY={stackStartY}
            minText={minText}
          />
        ) : stats.length || meta ? (
          <CenteredStack
            radius={radius}
            stats={stats}
            meta={meta}
            pillSize={pillFont}
            status={status}
            maxWidth={radius * 2 - 18}
            layout="flow"
            flowStartY={stackStartY}
          />
        ) : null}
      </g>
    );
  }

  if (heroValue && !icon) {
    return <SatelliteHeroFace title={title} value={heroValue.value} label={heroValue.label} status={status} />;
  }

  const titleSize = Math.max(minText, titleSizeOverride ?? (prominent ? 13 : radius >= 74 ? 11.5 : 11));
  // A title that fits one line with room to spare stays on one line, so the hero figure and its
  // label get the row it saves.
  const oneLine = Boolean(icon && prominent && heroValue) && textWidth(title, titleSize) / 2 + 6 <= radius - 14;
  const lines = oneLine ? [title] : titleLines(title);
  const lineH = titleSize + 3;
  // A main bubble with a hero lifts its icon and title so the figure and its label, at the 11px
  // floor, sit in the wide middle of the circle instead of its narrow bottom.
  const lifted = Boolean(icon && prominent && heroValue);
  const iconY = icon ? -radius * (lifted ? 0.56 : prominent ? 0.44 : 0.36) : 0;
  const titleStart = lifted
    ? iconY + 16 + 4 + titleSize * 0.75
    : icon
      ? (prominent ? 4 : -radius * 0.02)
      : -lineH * (lines.length / 2);
  const stackStartY = titleStart + lines.length * lineH + (stats.length || meta || heroValue ? 5 : 0);

  return (
    <g className="node-face">
      {icon ? (
        <g className="node-glyph-wrap" transform={`translate(0, ${iconY})`}>
          {plate ? <rect className="node-icon-plate" x={-16} y={-16} width={32} height={32} rx={8} /> : null}
          <BubbleGlyph icon={icon} />
        </g>
      ) : null}
      {lines.map((line, index) => (
        <text
          key={`${line}-${index}`}
          className="node-title node-face-title"
          y={titleStart + index * lineH}
          textAnchor="middle"
          fontSize={titleSize}
        >
          {line}
        </text>
      ))}
      {heroValue ? (
        <HeroValue
          value={heroValue.value}
          label={heroValue.label}
          explainer={heroValue.explainer}
          status={status}
          radius={radius}
          startY={stackStartY}
          minText={minText}
        />
      ) : stats.length || meta ? (
        <CenteredStack
          radius={radius}
          stats={stats}
          meta={meta}
          pillSize={pillFont}
          status={status}
          maxWidth={radius * 2 - 14}
          layout="flow"
          flowStartY={stackStartY}
        />
      ) : null}
    </g>
  );
}
