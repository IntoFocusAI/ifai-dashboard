const EM_DASH = /\u2014/g;

/** Strip em dashes from user-visible strings (brief: never show U+2014 in UI). */
export function sanitizeUiText(value: string): string {
  return value.replace(EM_DASH, " to ");
}

export function pendingLabel(): string {
  return "Pending data";
}

export function formatInt(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return pendingLabel();
  return sanitizeUiText(new Intl.NumberFormat("en-US").format(value));
}

export function formatPct(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(Number(value))) return pendingLabel();
  const n = Number(value);
  return sanitizeUiText(`${n.toFixed(digits)}%`);
}

export function formatUsd(
  value: number | null | undefined,
  opts?: { signed?: boolean },
): string {
  if (value == null || Number.isNaN(Number(value))) return pendingLabel();
  const n = Number(value);
  const abs = Math.abs(n);
  const core = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs);
  if (opts?.signed && n < 0) return `-${core}`;
  if (opts?.signed && n > 0) return `+${core}`;
  return core;
}

/** An analyst estimate wears "est." wherever the figure is shown: "+$680K est.". */
export function formatEstimate(figure: string): string {
  const text = sanitizeUiText(figure).trim().replace(/\s*est\.$/i, "");
  return text ? `${text} est.` : text;
}

export function formatRatio(numerator: number | null, denominator: number | null): string {
  if (numerator == null || denominator == null) return pendingLabel();
  return `${formatInt(numerator)} of ${formatInt(denominator)}`;
}

export function titleCaseCategory(slug: string): string {
  return sanitizeUiText(slug.charAt(0).toUpperCase() + slug.slice(1));
}
