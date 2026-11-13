/** Text measuring and arc paths shared by the graph bubble faces. */

/** Stat pill label size inside IOM / v3 bubbles (SVG units before optional face scale). */
export const IOM_STAT_PILL_FONT = 11;

export function polar(radius: number, deg: number) {
  const angle = (deg * Math.PI) / 180;
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
}

export function headerArcPath(radius: number, fontSize: number, title: string, inset?: number) {
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

export function textWidth(text: string, fontSize: number) {
  return text.length * fontSize * 0.56;
}

export function wrapText(label: string, maxWidth: number, fontSize: number): string[] {
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

export function pillMetrics(label: string, fontSize: number, maxWidth?: number) {
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
