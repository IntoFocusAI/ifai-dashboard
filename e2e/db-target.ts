/* Which Supabase project the Playwright dev server reads (decision 17 Nov 2026).

   Browser tests are moving off production onto a database copy. Production keeps its
   3 s statement timeout for public reads, so several full suites at once time reads out
   and fail random tests. Until a copy can run the whole suite, tests may still hit
   production, one suite at a time.

   E2E_SUPABASE_URL + E2E_SUPABASE_ANON_KEY point the spawned dev server at a copy.
   Unset, the dev server reads `.env.local` as before (production). */

export const PRODUCTION_SUPABASE_REF = "qftczrlksczfimnzfiov";
export const DEFAULT_E2E_WORKERS = 2;

type Env = Record<string, string | undefined>;

export type DbTarget = {
  /** True when tests will read the production project. */
  production: boolean;
  /** Variables to set on the spawned dev server; empty when nothing is overridden. */
  serverEnv: Record<string, string>;
  /** Host shown in the startup notice. */
  host: string;
};

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    throw new Error(`E2E_SUPABASE_URL is not a valid URL: ${url}`);
  }
}

export function resolveDbTarget(env: Env): DbTarget {
  const url = env.E2E_SUPABASE_URL?.trim();
  const key = env.E2E_SUPABASE_ANON_KEY?.trim();

  if (!url && !key) {
    return { production: true, serverEnv: {}, host: `${PRODUCTION_SUPABASE_REF}.supabase.co (.env.local)` };
  }
  if (!url || !key) {
    throw new Error(
      "Set both E2E_SUPABASE_URL and E2E_SUPABASE_ANON_KEY, or neither. One without the other would mix two databases.",
    );
  }

  const host = hostOf(url);
  return {
    production: host.split(".")[0] === PRODUCTION_SUPABASE_REF,
    host,
    serverEnv: {
      NEXT_PUBLIC_SUPABASE_URL: url,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: key,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
    },
  };
}

/** Playwright `workers`: E2E_WORKERS (a count or a percentage) or 2. */
export function resolveWorkers(env: Env): number | string {
  const raw = env.E2E_WORKERS?.trim();
  if (!raw) return DEFAULT_E2E_WORKERS;
  if (/^\d+%$/.test(raw)) return raw;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`E2E_WORKERS must be a positive integer or a percentage: ${raw}`);
  }
  return n;
}

export function productionNotice(target: DbTarget): string | null {
  return target.production
    ? `[e2e] Reading PRODUCTION Supabase (${PRODUCTION_SUPABASE_REF}): run one suite at a time. Set E2E_SUPABASE_URL and E2E_SUPABASE_ANON_KEY to use a copy.`
    : null;
}
