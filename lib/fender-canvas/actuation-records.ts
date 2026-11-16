/**
 * SC-03 Actuation records: the shapes the database functions return, the payloads the staff
 * page sends, and the client basis read. No Next.js or Supabase imports, so the unit tests load it.
 * Migration: supabase/migrations/20261116200000_actuation_records.sql.
 */

import { CLIENTS, type ClientKey } from "@/lib/client/active-client";
import {
  itemsInWindow,
  type ItemFactorId,
  type ProgramBasis,
  type ProgramFactorId,
} from "@/lib/fender-canvas/actuation-score";

export const ACTUATION_RECORDS_PATH = "/dashboard/actuation-records";
export const ACTUATION_ITEMS_TABLE = "actuation-items";

export const FACTOR_LABELS: Readonly<Record<"P1" | "P2" | "E1" | "E2" | "E3", string>> = {
  P1: "Community response program",
  P2: "Publication and reviewer outreach program",
  E1: "Owned answers",
  E2: "Community responses posted",
  E3: "Placements earned",
};

/** One row of public.actuation_programs_for_staff. */
export type StaffProgramRow = {
  factor: ProgramFactorId;
  owner_name: string | null;
  target_domains: string[] | null;
  cadence_per_30_days: number | null;
  target_count: number | null;
  evidence_url: string | null;
  verified_on: string | null;
  expires_on: string | null;
  verified_by_name: string | null;
  note: string | null;
  updated_by_name: string | null;
  updated_at: string | null;
};

/** One row of public.actuation_items_for_staff. */
export type StaffItemRow = {
  id: string;
  factor: ItemFactorId;
  url: string;
  domain: string;
  posted_on: string;
  verified_on: string;
  verified_by_name: string | null;
  note: string | null;
};

/** One row of public.actuation_basis: counts and dates only (decision 78). */
export type ClientBasisRow = {
  factor: "P1" | "P2" | "E2" | "E3";
  in_place: boolean;
  verified_on: string | null;
  expires_on: string | null;
  target_domain_count: number | null;
  cadence_per_30_days: number | null;
  target_count: number | null;
  items_in_window: number | null;
};

const nonBlank = (value: string | null | undefined) => typeof value === "string" && value.trim() !== "";

export function staffProgramBasis(row: StaffProgramRow): ProgramBasis {
  return {
    factor: row.factor,
    hasOwner: nonBlank(row.owner_name),
    hasEvidence: nonBlank(row.evidence_url),
    verifiedOn: row.verified_on,
    targetDomainCount: row.target_domains?.length ?? 0,
    cadencePer30Days: row.cadence_per_30_days,
    targetCount: row.target_count,
  };
}

export function staffItemCounts(rows: readonly StaffItemRow[], asOf: string): Record<ItemFactorId, number> {
  const of = (factor: ItemFactorId) =>
    itemsInWindow(
      rows.filter((row) => row.factor === factor).map((row) => ({ postedOn: row.posted_on, verifiedOn: row.verified_on })),
      asOf,
    );
  return { E2: of("E2"), E3: of("E3") };
}

export type ClientBasis = { programs: ProgramBasis[]; items: Record<ItemFactorId, number> };

/**
 * The client basis rows as score inputs. A row not in place maps to nothing, so a lapsed program
 * and one never recorded give the same inputs (decision 78).
 */
export function clientBasis(rows: readonly ClientBasisRow[]): ClientBasis {
  const programs: ProgramBasis[] = [];
  const items: Record<ItemFactorId, number> = { E2: 0, E3: 0 };
  for (const row of rows) {
    if (row.factor === "E2" || row.factor === "E3") {
      items[row.factor] = Math.max(0, Number(row.items_in_window ?? 0) || 0);
    } else if ((row.factor === "P1" || row.factor === "P2") && row.in_place && row.verified_on) {
      programs.push({
        factor: row.factor,
        hasOwner: true,
        hasEvidence: true,
        verifiedOn: row.verified_on,
        targetDomainCount: row.target_domain_count ?? 0,
        cadencePer30Days: row.cadence_per_30_days,
        targetCount: row.target_count,
      });
    }
  }
  return { programs, items };
}

type RpcClient = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
};

/** The set-aside client key (public.set_aside_clients): "fmic" for Fender, "ledlenser". */
export function actuationClientKey(client: ClientKey): string {
  return CLIENTS[client].setAsideKey;
}

/**
 * The client's Actuation basis, filtered to that client in the database (decision 84). Null when
 * the function is not there yet or the read fails: the caller shows no figure rather than a zero.
 */
export async function readActuationBasis(supabase: RpcClient, client: ClientKey): Promise<ClientBasis | null> {
  try {
    const { data, error } = await supabase.rpc("actuation_basis", { p_client_key: actuationClientKey(client) });
    if (error || !Array.isArray(data) || data.length === 0) return null;
    return clientBasis(data as ClientBasisRow[]);
  } catch {
    return null;
  }
}

// Staff payloads -----------------------------------------------------------------------------------

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const HTTP_URL = /^https?:\/\/[^\s/]+\S*$/i;
const DOMAIN = /^[a-z0-9.-]{1,253}$/;

/** "https://www.reddit.com/r/Guitar/" or "Reddit.com" to "reddit.com". Null when it is not a domain. */
export function normalizeDomain(value: string): string | null {
  const host = value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split(/[/?#:]/)[0]
    ?.toLowerCase();
  return host && DOMAIN.test(host) && host.includes(".") ? host : null;
}

export function parseDomains(text: string): { domains: string[]; invalid: string[] } {
  const parts = text.split(/[\s,]+/).map((part) => part.trim()).filter(Boolean);
  const domains = new Set<string>();
  const invalid: string[] = [];
  for (const part of parts) {
    const domain = normalizeDomain(part);
    if (domain) domains.add(domain);
    else invalid.push(part);
  }
  return { domains: [...domains].sort(), invalid };
}

export type ProgramInput = {
  client: ClientKey;
  factor: ProgramFactorId;
  ownerName: string;
  targetDomains: string;
  /** P1 cadence per 30 days, or P2 target count per 90 days. */
  amount: string;
  evidenceUrl: string;
  verifiedOn: string;
  note: string;
};

export type Checked<T> = { ok: true; payload: T } | { ok: false; message: string };

function positiveInt(value: string): number | null {
  const n = Number(value.trim());
  return Number.isInteger(n) && n >= 1 && n <= 1000 ? n : null;
}

export function programPayload(input: ProgramInput, today: string): Checked<Record<string, unknown>> {
  if (input.factor !== "P1" && input.factor !== "P2") return { ok: false, message: "Unknown factor." };
  if (!Object.hasOwn(CLIENTS, input.client)) return { ok: false, message: "Unknown client." };
  const amount = positiveInt(input.amount);
  if (amount == null) {
    return {
      ok: false,
      message: input.factor === "P1" ? "Enter the responses per 30 days (1 to 1000)." : "Enter the placements target (1 to 1000).",
    };
  }
  const { domains, invalid } = parseDomains(input.targetDomains);
  if (invalid.length) return { ok: false, message: `Not a domain: ${invalid.slice(0, 3).join(", ")}.` };
  if (domains.length > 50) return { ok: false, message: "List at most 50 target domains." };
  const evidence = input.evidenceUrl.trim();
  if (evidence && (!HTTP_URL.test(evidence) || evidence.length > 2000)) {
    return { ok: false, message: "The evidence link must start with http:// or https://." };
  }
  const verified = input.verifiedOn.trim();
  if (verified && (!ISO_DAY.test(verified) || verified > today)) {
    return { ok: false, message: "The verification date must be today or earlier." };
  }
  if (input.ownerName.trim().length > 80) return { ok: false, message: "The owner name is too long." };
  if (input.note.trim().length > 500) return { ok: false, message: "The note is too long (500 characters)." };
  return {
    ok: true,
    payload: {
      p_client_key: actuationClientKey(input.client),
      p_factor: input.factor,
      p_owner_name: input.ownerName.trim() || null,
      p_target_domains: domains,
      p_cadence_per_30_days: input.factor === "P1" ? amount : null,
      p_target_count: input.factor === "P2" ? amount : null,
      p_evidence_url: evidence || null,
      p_verified_on: verified || null,
      p_note: input.note.trim() || null,
    },
  };
}

export type ItemInput = {
  client: ClientKey;
  factor: ItemFactorId;
  url: string;
  postedOn: string;
  verifiedOn: string;
  note: string;
};

export function itemPayload(input: ItemInput, today: string): Checked<Record<string, unknown>> {
  if (input.factor !== "E2" && input.factor !== "E3") return { ok: false, message: "Unknown factor." };
  if (!Object.hasOwn(CLIENTS, input.client)) return { ok: false, message: "Unknown client." };
  const url = input.url.trim();
  if (!HTTP_URL.test(url) || url.length > 2000 || !normalizeDomain(url)) {
    return { ok: false, message: "The link must start with http:// or https://." };
  }
  const posted = input.postedOn.trim();
  const verified = input.verifiedOn.trim();
  if (!ISO_DAY.test(posted) || posted > today) return { ok: false, message: "The posted date must be today or earlier." };
  if (!ISO_DAY.test(verified) || verified > today) return { ok: false, message: "The verified date must be today or earlier." };
  if (verified < posted) return { ok: false, message: "The verified date cannot be before the posted date." };
  if (input.note.trim().length > 500) return { ok: false, message: "The note is too long (500 characters)." };
  return {
    ok: true,
    payload: {
      p_client_key: actuationClientKey(input.client),
      p_factor: input.factor,
      p_url: url,
      p_posted_on: posted,
      p_verified_on: verified,
      p_note: input.note.trim() || null,
    },
  };
}
