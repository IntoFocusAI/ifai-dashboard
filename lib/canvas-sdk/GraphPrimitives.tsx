"use client";

import { useId, type KeyboardEvent, type MouseEvent, type ReactElement } from "react";
import { blurredDiskStops } from "@/lib/canvas-sdk/blurred-disk";
import { fitMainHero } from "@/lib/canvas-sdk/hero-fit";
import { SatelliteHeroFace } from "@/lib/canvas-sdk/SatelliteHeroFace";
import type { CanvasEdge, NodeStatus } from "@/lib/canvas-sdk/types";

/** Stat pill label size inside IOM / v3 bubbles (SVG units before optional face scale). */
const IOM_STAT_PILL_FONT = 10;

function polar(radius: number, deg: number) {
  const angle = (deg * Math.PI) / 180;
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
}

function headerArcPath(radius: number, fontSize: number, title: string, inset?: number) {
  const rim = inset ?? Math.max(5.5, fontSize * 0.22 + 3);
  const r = Math.max(16, radius - rim);
  const arcLen = Math.max(title.length * fontSize * 0.5, fontSize * 4);
  const halfDeg = Math.min(
    78,
    Math.max(radius < 55 ? 55 : 48, ((arcLen / r) * 180) / Math.PI / 2 + 8),
  );
  const start = polar(r, 270 - halfDeg);
  const end = polar(r, 270 + halfDeg);
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

function textWidth(text: string, fontSize: number) {
  return text.length * fontSize * 0.56;
}

function wrapText(label: string, maxWidth: number, fontSize: number): string[] {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];

  const lines: string[] = [];
  let line = words[0];
  for (let i = 1; i < words.length; i += 1) {
    const candidate = `${line} ${words[i]}`;
    if (textWidth(candidate, fontSize) <= maxWidth) {
      line = candidate;
    } else {
      lines.push(line);
      line = words[i];
    }
  }
  lines.push(line);

  const broken: string[] = [];
  for (const chunk of lines) {
    if (textWidth(chunk, fontSize) <= maxWidth) {
      broken.push(chunk);
      continue;
    }
    let part = "";
    for (const ch of chunk) {
      const next = part + ch;
      if (textWidth(next, fontSize) > maxWidth && part) {
        broken.push(part);
        part = ch;
      } else {
        part = next;
      }
    }
    if (part) broken.push(part);
  }
  return broken;
}

function pillMetrics(label: string, fontSize: number, maxWidth?: number) {
  const padX = fontSize * 0.7;
  const capped =
    maxWidth !== undefined ? Math.max(fontSize * 2.4, maxWidth) : undefined;
  const innerMax =
    capped !== undefined ? Math.max(fontSize * 1.6, capped - padX * 2) : undefined;
  const lines =
    innerMax !== undefined ? wrapText(label, innerMax, fontSize) : [label];
  const contentWidth = Math.max(
    fontSize * 2.6,
    ...lines.map((entry) => textWidth(entry, fontSize) + padX * 2),
  );
  const width = capped !== undefined ? Math.min(capped, contentWidth) : contentWidth;
  const lineH = fontSize + 3;
  const height = Math.max(fontSize + 9, lines.length * lineH + 6);
  return { width, height, lines, lineH };
}

/**
 * One big status-colored number with a short label, in place of the stacked stat pills.
 * Sizing lives in `fitMainHero` so the value and label both clear the ring at this radius.
 */
function HeroValue({
  value,
  label,
  status,
  radius,
  startY,
}: {
  value: string;
  label: string;
  status: NodeStatus;
  radius: number;
  startY: number;
}) {
  const fit = fitMainHero(value, label, radius, startY);
  const statusClass = status !== "neutral" ? ` status-${status}` : "";

  return (
    <g className="node-hero">
      <text className={`node-hero-value${statusClass}`} y={fit.valueY} textAnchor="middle" fontSize={fit.valueSize}>
        {value}
      </text>
      {fit.labelLines.length ? (
        <text className="node-hero-label" y={fit.labelY} textAnchor="middle" fontSize={fit.labelSize}>
          {fit.labelLines.map((line, index) => (
            <tspan key={`${line}-${index}`} x={0} dy={index === 0 ? 0 : fit.labelLineH}>
              {line}
            </tspan>
          ))}
        </text>
      ) : null}
    </g>
  );
}

export function CurvedHeader({
  id,
  radius,
  title,
  fontSize,
  inset,
  className = "node-title",
}: {
  id: string;
  radius: number;
  title: string;
  fontSize: number;
  inset?: number;
  className?: string;
}) {
  const pathId = `node-header-arc-${id}`;
  return (
    <>
      <path id={pathId} d={headerArcPath(radius, fontSize, title, inset)} fill="none" />
      <text className={className} fontSize={fontSize} dy={fontSize * 0.82}>
        <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
          {title}
        </textPath>
      </text>
    </>
  );
}

function StatPill({
  label,
  y,
  fontSize,
  status,
  maxWidth,
}: {
  label: string;
  y: number;
  fontSize: number;
  status?: NodeStatus;
  maxWidth?: number;
}) {
  const { width, height, lines, lineH } = pillMetrics(label, fontSize, maxWidth);
  const statusClass =
    status && status !== "neutral" ? ` status-${status}` : "";
  const textStartY = -((lines.length - 1) * lineH) / 2 + fontSize * 0.35;
  return (
    <g className="node-stat" transform={`translate(0, ${y})`}>
      <rect
        className={`node-stat-pill${statusClass}`}
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        rx={Math.min(height / 2, 999)}
      />
      <text className="node-stat-text" textAnchor="middle" fontSize={fontSize}>
        {lines.map((entry, index) => (
          <tspan key={`${entry}-${index}`} x={0} dy={index === 0 ? textStartY : lineH}>
            {entry}
          </tspan>
        ))}
      </text>
    </g>
  );
}

function MetaBlock({
  meta,
  fontSize,
  y,
  maxWidth,
}: {
  meta: string;
  fontSize: number;
  y: number;
  maxWidth: number;
}) {
  const lines = wrapText(meta, maxWidth, fontSize);
  const lineH = fontSize + 2;
  const startY = y - ((lines.length - 1) * lineH) / 2;
  return (
    <text className="node-meta" textAnchor="middle" fontSize={fontSize}>
      {lines.map((entry, index) => (
        <tspan key={`${entry}-${index}`} x={0} dy={index === 0 ? startY : lineH}>
          {entry}
        </tspan>
      ))}
    </text>
  );
}

export function CenteredStack({
  radius,
  stats,
  meta,
  pillSize: fontSize,
  status,
  maxWidth,
  layout = "center",
  flowStartY = 0,
}: {
  radius: number;
  stats: string[];
  meta?: string;
  pillSize: number;
  status?: NodeStatus;
  maxWidth?: number;
  layout?: "center" | "flow";
  flowStartY?: number;
}) {
  const pillMax = maxWidth ?? Math.max(radius * 2 - 14, fontSize * 4);
  // Meta used to shrink to 82% of the pill; at the 10px floor that reads under 10px.
  const metaSize = fontSize;
  const metaMax = pillMax;
  const gap = radius < 62 ? 4 : 5;

  const pillMetricsList = stats.map((label) => pillMetrics(label, fontSize, pillMax));
  const metaLines = meta ? wrapText(meta, metaMax, metaSize) : [];
  const metaBlockH = metaLines.length ? metaLines.length * (metaSize + 2) + 2 : 0;

  const stackH =
    pillMetricsList.reduce((sum, pill) => sum + pill.height, 0) +
    Math.max(0, pillMetricsList.length - 1) * gap +
    (meta ? gap + metaBlockH : 0);

  const startY =
    layout === "flow" ? flowStartY : -stackH / 2 + (pillMetricsList[0]?.height ?? fontSize + 9) / 2 + 2;

  const placed = pillMetricsList.reduce(
    (acc, pill, index) => {
      const y = acc.cursor + pill.height / 2;
      return {
        cursor: acc.cursor + pill.height + gap,
        nodes: [
          ...acc.nodes,
          <StatPill
            key={`${stats[index]}-${index}`}
            label={stats[index]}
            y={y}
            fontSize={fontSize}
            status={status}
            maxWidth={pillMax}
          />,
        ],
      };
    },
    { cursor: startY, nodes: [] as ReactElement[] },
  );

  const metaY = meta ? placed.cursor + metaBlockH / 2 : 0;

  return (
    <>
      {placed.nodes}
      {meta ? <MetaBlock meta={meta} fontSize={metaSize} y={metaY} maxWidth={metaMax} /> : null}
    </>
  );
}

type BubbleIcon = "sparkles" | "bag" | "radar" | "clipboard" | "wrench" | "route";

const PRIMARY_SPOKES = new Set([
  "spoke-aeo",
  "spoke-retail",
  "spoke-competitors",
  "spoke-specs",
  "spoke-fixes",
  "spoke-roadmap",
]);

/** Flip on to restore the flame and red alert pill above critical bubbles. */
const SHOW_QUEST_FLAMES = false;

const SPOKE_ICONS: Record<string, BubbleIcon> = {
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

function CenteredFace({
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
  heroValue?: { value: string; label: string };
}) {
  const pillFont = statPillSize ?? IOM_STAT_PILL_FONT;

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
            status={status}
            radius={radius}
            startY={stackStartY}
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

  const lines = titleLines(title);
  const titleSize =
    titleSizeOverride ?? (prominent ? 13 : radius >= 74 ? 11.5 : 10.5);
  const lineH = titleSize + 3;
  const iconY = icon ? -radius * (prominent ? 0.44 : 0.36) : 0;
  const titleStart = icon ? (prominent ? 4 : -radius * 0.02) : -lineH * (lines.length / 2);
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
          status={status}
          radius={radius}
          startY={stackStartY}
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

type BubbleProps = {
  id: string;
  x: number;
  y: number;
  r: number;
  /** When set, face/icon layout uses this radius and scales up to `r` (column rail). */
  contentRadius?: number;
  status: NodeStatus;
  title: string;
  titleSize?: number;
  stats: string[];
  meta?: string;
  heroValue?: { value: string; label: string };
  centered?: boolean;
  logoSrc?: string;
  emphasis?: boolean;
  selected?: boolean;
  dimmed?: boolean;
  enterDelay?: number;
  onClick: () => void;
  onMouseEnter: (evt: MouseEvent) => void;
  onMouseMove?: (evt: MouseEvent) => void;
  onMouseLeave: () => void;
  onInspect?: () => void;
};

function inspectProps(label: string, onInspect: (() => void) | undefined, onActivate: () => void) {
  if (!onInspect) return {};
  return {
    tabIndex: 0,
    role: "button" as const,
    "aria-label": label || "Bubble",
    onFocus: onInspect,
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      onActivate();
    },
  };
}

export function GraphBubble({
  id,
  x,
  y,
  r,
  contentRadius,
  status,
  title,
  titleSize,
  stats,
  meta,
  heroValue,
  centered = false,
  emphasis = false,
  selected = false,
  dimmed = false,
  enterDelay = 0,
  onClick,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
  onInspect,
}: BubbleProps) {
  const faceR = contentRadius ?? r;
  const faceScale = faceR > 0 && r !== faceR ? r / faceR : 1;
  const headerSize = titleSize ?? (faceR >= 70 ? 14.5 : faceR >= 50 ? 13 : 12);
  const statPillFont = (PRIMARY_SPOKES.has(id) ? 13.5 : IOM_STAT_PILL_FONT) / faceScale;
  const statusClass = status !== "neutral" ? ` status-${status}` : "";
  const stateClass = `${selected ? " node-selected" : ""}${dimmed ? " node-dimmed" : ""}`;

  const face = centered ? (
    <CenteredFace
      title={title}
      stats={stats}
      meta={meta}
      status={status}
      icon={SPOKE_ICONS[id]}
      radius={faceR}
      prominent={PRIMARY_SPOKES.has(id)}
      plate={centered && Boolean(SPOKE_ICONS[id])}
      titleSize={titleSize}
      statPillSize={statPillFont}
      heroValue={heroValue}
    />
  ) : (
    <>
      <CurvedHeader id={id} radius={faceR} title={title} fontSize={headerSize} />
      <CenteredStack radius={faceR} stats={stats} meta={meta} pillSize={statPillFont} status={status} />
    </>
  );

  return (
    <g
      className={`graph-node${PRIMARY_SPOKES.has(id) ? " spoke-primary" : ""}${stateClass}`}
      data-graph-node-id={id}
      transform={`translate(${x}, ${y})`}
      style={enterDelay ? { transitionDelay: `${enterDelay}ms` } : undefined}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      {...inspectProps(title, onInspect, onClick)}
    >
      <circle r={emphasis ? r + 26 : r + 10} className={`node-halo${statusClass}`} />
      {emphasis && PRIMARY_SPOKES.has(id) ? <RingMotes radius={r} /> : null}
      {SHOW_QUEST_FLAMES && emphasis && PRIMARY_SPOKES.has(id) && status === "danger" && stats[0] ? (
        <QuestFlame label={stats[0]} radius={r} />
      ) : null}
      {selected && emphasis ? <SelectionBurst radius={r} /> : null}
      <g className="node-inner">
        {centered ? <BubbleLift radius={r} sigma={18} statusClass={statusClass} /> : null}
        <circle r={r} className={`node-circle${statusClass}`} filter="url(#nodeShadow)" />
        {faceScale === 1 ? face : <g transform={`scale(${faceScale})`}>{face}</g>}
      </g>
    </g>
  );
}

export function GraphHub({
  id,
  x,
  y,
  r,
  contentRadius,
  status,
  title,
  titleSize,
  stats,
  meta,
  heroValue,
  centered = false,
  logoSrc,
  emphasis = false,
  selected = false,
  dimmed = false,
  onClick,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
  onInspect,
}: BubbleProps) {
  const faceR = contentRadius ?? r;
  const faceScale = faceR > 0 && r !== faceR ? r / faceR : 1;
  const statPillFont = IOM_STAT_PILL_FONT / faceScale;
  const pulseR = r * (140 / 98);
  const midR = r * (118 / 98);
  const headerSize = titleSize ?? 15;
  const stateClass = `${selected ? " node-selected" : ""}${dimmed ? " node-dimmed" : ""}`;

  const face = centered ? (
    <CenteredFace
      title={title}
      stats={stats}
      meta={meta}
      status={status}
      radius={faceR}
      hub
      logoSrc={logoSrc}
      statPillSize={statPillFont}
      heroValue={heroValue}
    />
  ) : (
    <>
      <CurvedHeader id={id} radius={faceR} title={title} fontSize={headerSize} className="node-title hub-title" />
      {heroValue ? (
        <HeroValue value={heroValue.value} label={heroValue.label} status={status} radius={faceR} startY={12} />
      ) : (
        <CenteredStack radius={faceR} stats={stats} meta={meta} pillSize={statPillFont} status={status} />
      )}
    </>
  );

  return (
    <g
      className={`graph-node graph-hub${stateClass}`}
      data-graph-node-id={id}
      transform={`translate(${x}, ${y})`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      {...inspectProps(title, onInspect, onClick)}
    >
      <circle r={pulseR} fill="url(#brandHubGradient)" opacity="0.45" className="node-pulse-ring hub-halo-pulse" />
      {emphasis ? <RingMotes radius={r} /> : null}
      {selected && emphasis ? <SelectionBurst radius={r} /> : null}
      <g className="node-inner">
        <circle
          className="hub-mid-ring"
          r={midR}
          fill="url(#brandHubGradient)"
          filter="url(#nodeShadow)"
          stroke="var(--border-dark)"
          strokeWidth="3"
        />
        {centered ? <BubbleLift radius={r} sigma={22} /> : null}
        <circle r={r} className="node-circle hub-core" />
        {faceScale === 1 ? face : <g transform={`scale(${faceScale})`}>{face}</g>}
      </g>
    </g>
  );
}

export function ConnLine({ x1, y1, x2, y2, kind = "default", hot = false }: CanvasEdge & { hot?: boolean }) {
  const kindClass =
    kind === "active" ? " active-spoke" : kind !== "default" ? ` ${kind}` : "";
  return <line x1={x1} y1={y1} x2={x2} y2={y2} className={`conn-line${kindClass}${hot ? " conn-hot" : ""}`} />;
}

/**
 * The bubble's shadow and selection glow, drawn as gradients that look like a blurred circle.
 * A CSS drop-shadow on the circle re-ran a blur filter every time the map repainted. Offset and
 * opacity per theme and state live in iom-theme.css (`.node-drop`, `.node-glow`).
 */
function BubbleLift({ radius, sigma, statusClass = "" }: { radius: number; sigma: number; statusClass?: string }) {
  const id = useId();
  const { reach, stops } = blurredDiskStops(radius, sigma);
  const gradient = (suffix: string, color: string) => (
    <radialGradient id={`${id}${suffix}`} className={`node-${suffix}-fill`}>
      {stops.map((stop) => (
        <stop key={stop.offset} offset={stop.offset.toFixed(4)} stopColor={color} stopOpacity={stop.opacity.toFixed(4)} />
      ))}
    </radialGradient>
  );
  return (
    <g className={`node-lift${statusClass}`} aria-hidden="true" pointerEvents="none">
      <defs>
        {gradient("drop", "#000")}
        {gradient("glow", "#00f0ff")}
      </defs>
      <circle className="node-drop" r={reach} fill={`url(#${id}drop)`} />
      <circle className="node-glow" r={reach} fill={`url(#${id}glow)`} />
    </g>
  );
}

function RingMotes({ radius }: { radius: number }) {
  const motes = [8, 36, 62, 98, 128, 156, 188, 214, 248, 278, 312, 344].map((deg, index) => {
    const point = polar(radius + 16 + (index % 3) * 7, deg - 90);
    return { ...point, size: index % 4 === 0 ? 2.1 : 1.25, delay: (index % 6) * 0.28 };
  });
  return (
    <g className="ring-motes" pointerEvents="none">
      <circle className="node-outer-ring" r={radius + 18} fill="none" />
      {motes.map((mote, index) => (
        <circle
          key={index}
          className="ring-mote"
          cx={mote.x.toFixed(2)}
          cy={mote.y.toFixed(2)}
          r={mote.size}
          style={{ animationDelay: `${mote.delay}s` }}
        />
      ))}
    </g>
  );
}

function QuestFlame({ label, radius }: { label: string; radius: number }) {
  const width = Math.max(76, label.length * 7.1 + 18);
  return (
    <g className="quest-beacon" transform={`translate(0, ${-radius - 36})`} pointerEvents="none">
      <g className="quest-flame">
        <ellipse className="flame-core" cx="0" cy="-2" rx="5" ry="9" />
        <circle className="flame-ember" cx="-4" cy="2" r="1.5" />
        <circle className="flame-ember flame-ember-b" cx="4" cy="1" r="1.3" />
      </g>
      <rect className="quest-pill" x={-width / 2} y={7} width={width} height={18} rx={9} />
      <text className="quest-pill-text" y={19.5} textAnchor="middle">
        {label}
      </text>
    </g>
  );
}

function SelectionBurst({ radius }: { radius: number }) {
  const sparks = Array.from({ length: 12 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / 12;
    const dist = radius + 78;
    return {
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist,
      delay: (index % 3) * 28,
      color: index % 2 === 0 ? "#00f0ff" : "#818cf8",
    };
  });
  return (
    <g className="node-firework" pointerEvents="none">
      <circle className="node-shockwave" r={radius * 0.72} fill="none" stroke="#00f0ff" strokeWidth="2" />
      {sparks.map((spark, index) => (
        <circle
          key={index}
          className="node-spark"
          r="3.2"
          fill={spark.color}
          style={{ ["--dx" as string]: `${spark.dx.toFixed(2)}px`, ["--dy" as string]: `${spark.dy.toFixed(2)}px`, animationDelay: `${spark.delay}ms` }}
        />
      ))}
    </g>
  );
}

export function TourSpotlight({
  active,
  x,
  y,
  radius,
  category,
}: {
  active: boolean;
  x: number;
  y: number;
  radius: number;
  category: string;
}) {
  return (
    <g
      id="tour-spotlight-group"
      style={{ display: active ? "block" : "none", pointerEvents: "none" }}
      transform={`translate(${x}, ${y})`}
    >
      <circle
        id="tour-spotlight-pulse"
        r={radius + 10}
        fill="none"
        stroke="var(--accent-purple)"
        strokeWidth="3"
        strokeDasharray="10 5"
        className="node-pulse-ring"
        opacity="0.8"
      />
      <circle
        id="tour-spotlight-ring"
        r={radius}
        fill="none"
        stroke="var(--color-indigo)"
        strokeWidth="2.5"
        filter="url(#glow-accent)"
      />
      <g id="tour-spotlight-tag" transform={`translate(0, -${radius + 10})`}>
        <rect
          x="-95"
          y="-14"
          width="190"
          height="28"
          rx="14"
          fill="#070d18"
          stroke="var(--accent-purple)"
          strokeWidth="1.8"
          filter="url(#nodeShadow)"
        />
        <circle cx="-75" cy="0" r="4" fill="var(--accent-purple)" />
        <text
          x="6"
          y="4"
          textAnchor="middle"
          fontSize="10.5"
          fontWeight="800"
          fill="#ffffff"
          letterSpacing="0.5"
          id="tour-spotlight-tag-text"
        >
          {category}
        </text>
      </g>
    </g>
  );
}
