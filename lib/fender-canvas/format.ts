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

/** Largest first. */
const MONEY_UNITS = [
  { size: 1e9, suffix: "B" },
  { size: 1e6, suffix: "M" },
  { size: 1e3, suffix: "K" },
] as const;

function groupedFixed(value: number, digits: number): string {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

/** Three significant figures in a unit (1.05, 12.4, 490); past 999 the separator groups it. */
function threeFigures(scaled: number): string {
  const digits = scaled >= 99.95 ? 0 : scaled >= 9.995 ? 1 : 2;
  return groupedFixed(scaled, digits);
}

function moneyCore(abs: number): string {
  if (Math.round(abs) < 1000) return `$${groupedFixed(Math.round(abs), 0)}`;
  let index = MONEY_UNITS.findIndex((unit) => abs >= unit.size);
  if (index === -1) index = MONEY_UNITS.length - 1;
  let text = threeFigures(abs / MONEY_UNITS[index].size);
  // 999,600 rounds to "1,000K": read it as $1.00M instead.
  if (index > 0 && Number(text.replace(/,/g, "")) >= 1000) {
    index -= 1;
    text = threeFigures(abs / MONEY_UNITS[index].size);
  }
  return `$${text}${MONEY_UNITS[index].suffix}`;
}

/**
 * A dollar figure for an estimate: "$119", "$12.4K", "$1.05M", "$1,250B". Whole dollars under
 * $1K, three significant figures from $1K up, thousands separators throughout.
 */
export function formatMoneyShort(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return pendingLabel();
  const n = Number(value);
  const core = moneyCore(Math.abs(n));
  return n < 0 && core !== "$0" ? `-${core}` : core;
}

/** The low end in the high end's unit when it sits just under a million or a billion: "$0.60M". */
function rangeLow(low: number, high: number): string {
  const unit = MONEY_UNITS.find((u) => u.size >= 1e6 && Math.abs(high) >= u.size);
  if (unit && Math.abs(low) < unit.size && Math.abs(low) >= unit.size / 10) {
    return `${low < 0 ? "-" : ""}$${groupedFixed(Math.abs(low) / unit.size, 2)}${unit.suffix}`;
  }
  return formatMoneyShort(low);
}

/** A range of dollars: "$0.60M to $1.71M", "$443 to $1.54K". */
export function formatMoneySpan(low: number, high: number): string {
  return `${rangeLow(low, high)} to ${formatMoneyShort(high)}`;
}

/** An estimate's mid with its range beside it: "$1.05M, range $0.60M to $1.71M". */
export function formatMoneyRange(range: { low: number; mid: number; high: number } | null | undefined): string {
  if (!range) return pendingLabel();
  return `${formatMoneyShort(range.mid)}, range ${formatMoneySpan(range.low, range.high)}`;
}
