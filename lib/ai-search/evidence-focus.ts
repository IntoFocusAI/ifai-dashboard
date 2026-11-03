/**
 * Which rows an AI Search drill-down should open on. Kept in the `evidence`
 * query parameter so a copied link reopens the same rows.
 * Format: `<field>:<value>`, for example `sim:1161`, `domain:fender.com`, `competitor:Yamaha`.
 * A filtered tab can narrow the same rows with trailing qualifiers, for example
 * `category:acoustics,engine:chatgpt` or `role:unbranded_discovery/resolved,category:amps,engine:gemini`.
 */

export const EVIDENCE_PARAM = "evidence";

export const EVIDENCE_FIELDS = [
  "sim",
  "engine",
  "model",
  "category",
  "outcome",
  "kind",
  "accuracy",
  "competitor",
  "domain",
  "class",
  "role",
] as const;

export type EvidenceField = (typeof EVIDENCE_FIELDS)[number];

/** Narrows a focus to one category and/or one engine. */
export type EvidenceScope = { category?: string; engine?: string };

export type EvidenceFocus = { field: EvidenceField; value: string } & EvidenceScope;

const SCOPE_KEYS = ["category", "engine"] as const;
const SCOPE_SUFFIX = /,(category|engine):([^,:]+)$/;

export function parseEvidence(raw: string | null | undefined): EvidenceFocus | null {
  if (!raw) return null;
  let rest = raw;
  const scope: EvidenceScope = {};
  for (let match = rest.match(SCOPE_SUFFIX); match; match = rest.match(SCOPE_SUFFIX)) {
    scope[match[1] as keyof EvidenceScope] ??= match[2].trim();
    rest = rest.slice(0, match.index);
  }
  const index = rest.indexOf(":");
  if (index <= 0) return null;
  const field = rest.slice(0, index) as EvidenceField;
  const value = rest.slice(index + 1).trim();
  if (!EVIDENCE_FIELDS.includes(field) || !value) return null;
  return { field, value, ...scope };
}

export function formatEvidence(focus: EvidenceFocus): string {
  const scope = SCOPE_KEYS.filter((key) => focus[key]).map((key) => `,${key}:${focus[key]}`);
  return `${focus.field}:${focus.value}${scope.join("")}`;
}

/** The same focus, narrowed by a tab's scope. An empty scope returns the focus unchanged. */
export function scopeEvidence(focus: EvidenceFocus, scope: EvidenceScope | undefined): EvidenceFocus {
  if (!scope?.category && !scope?.engine) return focus;
  return {
    ...focus,
    ...(scope.category ? { category: scope.category } : {}),
    ...(scope.engine ? { engine: scope.engine } : {}),
  };
}

type Listener = () => void;
const listeners = new Set<Listener>();
let current: EvidenceFocus | null | undefined;

function readUrl(): EvidenceFocus | null {
  if (typeof window === "undefined") return null;
  return parseEvidence(new URLSearchParams(window.location.search).get(EVIDENCE_PARAM));
}

export function getEvidenceFocus(): EvidenceFocus | null {
  if (current === undefined) current = readUrl();
  return current;
}

export function setEvidenceFocus(focus: EvidenceFocus | null) {
  current = focus;
  if (typeof window !== "undefined") {
    const url = new URL(window.location.href);
    if (focus) url.searchParams.set(EVIDENCE_PARAM, formatEvidence(focus));
    else url.searchParams.delete(EVIDENCE_PARAM);
    window.history.replaceState(window.history.state, "", url);
  }
  listeners.forEach((listener) => listener());
}

export function subscribeEvidenceFocus(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
