// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/portal-access.test.ts
// Issue 248: account resolution, brand scoping and the no-token-in-URL rule for opening the
// dashboard from portal accounts. lib/portal/resolve.ts is tested with a fake Supabase client,
// so every rule runs without a database.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listClients } from "../lib/client/active-client.ts";
import {
  accessSchema,
  chooseAccount,
  chooseClient,
  clientKeysForRefs,
  dashboardHref,
  readAccounts,
  readOpenModuleState,
  staffReasonProblem,
  urlCarriesToken,
} from "../lib/portal/access.ts";
import { exportHref } from "../lib/export/tables.ts";
import { dashboardAccountsSource, portalUrl } from "../lib/portal/mode.ts";
import { resolveDashboardAccess, signedInClientAllowed } from "../lib/portal/resolve.ts";

const A = "aaaaaaaa-0000-4000-8000-000000000001";
const B = "bbbbbbbb-0000-4000-8000-000000000002";
const accountA = { id: A, name: "Account A", slug: "account-a", role: "member" };
const accountB = { id: B, name: "Account B", slug: "account-b", role: "admin" };

test("an account selector only picks from the caller's own accounts", () => {
  assert.deepEqual(chooseAccount([accountA], B, null), { kind: "one", account: accountA });
  assert.deepEqual(chooseAccount([accountA, accountB], B, A), { kind: "one", account: accountB });
  assert.deepEqual(chooseAccount([accountA, accountB], "not-a-member", A), { kind: "one", account: accountA });
  assert.deepEqual(chooseAccount([accountA, accountB], null, null), { kind: "choose", accounts: [accountA, accountB] });
  assert.deepEqual(chooseAccount([], A, A), { kind: "none" });
});

test("account rows are checked and de-duplicated", () => {
  const rows = [
    { organization_id: B, name: "Account B", slug: "account-b", role: "admin" },
    { organization_id: A, name: "Account A", slug: "account-a", role: "member" },
    { organization_id: A, name: "Account A again", slug: "a", role: "staff" },
    { organization_id: "not-a-uuid", name: "Bad", slug: "bad", role: "member" },
    null,
  ];
  assert.deepEqual(readAccounts(rows).map((a) => a.id), [A, B]);
  assert.deepEqual(readAccounts({ not: "an array" }), []);
});

test("open_module answers: only open states open; anything unexpected is unknown", () => {
  assert.equal(readOpenModuleState({ access: "open" }), "open");
  assert.equal(readOpenModuleState([{ access: "open_staff" }]), "open_staff");
  assert.equal(readOpenModuleState("not_entitled"), "not_entitled");
  assert.equal(readOpenModuleState({ state: "staff_reason_required" }), "staff_reason_required");
  assert.equal(readOpenModuleState({ access: "OPEN" }), "unknown");
  assert.equal(readOpenModuleState({ access: "granted" }), "unknown");
  assert.equal(readOpenModuleState(null), "unknown");
});

test("brands map from the isolation schemas; a brand outside the account is never chosen", () => {
  assert.equal(accessSchema({ data_schema: "public" }), "command");
  assert.equal(accessSchema({ data_schema: "ledlenser" }), "ledlenser");
  const clients = listClients();
  assert.deepEqual(clientKeysForRefs([{ source: "schema", client_ref: "command" }], clients), ["fender"]);
  assert.deepEqual(clientKeysForRefs([{ source: "schema", client_ref: "ledlenser" }, { source: "sandbox", client_ref: "x" }], clients), ["ledlenser"]);
  assert.deepEqual(clientKeysForRefs([{ source: "sandbox", client_ref: "command" }], clients), []);
  assert.equal(chooseClient(["ledlenser"], "fender"), "ledlenser");
  assert.equal(chooseClient(["fender", "ledlenser"], "ledlenser"), "ledlenser");
  assert.equal(chooseClient([], "fender"), null);
});

test("staff reasons need 10 to 500 characters", () => {
  assert.match(staffReasonProblem("short") ?? "", /at least 10/);
  assert.equal(staffReasonProblem("Checking the weekly scores"), null);
  assert.match(staffReasonProblem("x".repeat(501)) ?? "", /500/);
});

test("the no-token-in-URL rule catches tokens in the query, the fragment and the path", () => {
  const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.c2lnbmF0dXJl";
  assert.equal(urlCarriesToken("/dashboard?account=" + A), false);
  assert.equal(urlCarriesToken("/dashboard?client=ledlenser&account=" + A + "&theme=light"), false);
  assert.equal(urlCarriesToken("/dashboard?access_token=abc"), true);
  assert.equal(urlCarriesToken("/dashboard#access_token=abc&refresh_token=def"), true);
  assert.equal(urlCarriesToken("/dashboard?x=" + jwt), true);
  assert.equal(urlCarriesToken("/dashboard/" + jwt), true);
  assert.equal(urlCarriesToken("https://app.intofocus.ai/app/dashboards/consensus-control/?refresh_token=r"), true);
});

test("every link the dashboard builds carries selectors only, never a token", () => {
  for (const href of [
    dashboardHref("/dashboard", A, "ledlenser", "fender"),
    dashboardHref("/dashboard", A, "fender", "fender"),
    dashboardHref("/dashboard", null, null, "fender"),
    exportHref("map-listings", "ledlenser", A),
    exportHref("map-listings", "fender", null),
  ]) {
    assert.equal(urlCarriesToken(href), false, href);
  }
  assert.equal(dashboardHref("/dashboard", A, "ledlenser", "fender"), `/dashboard?account=${A}&client=ledlenser`);
  assert.equal(exportHref("map-listings", "ledlenser", A), `/dashboard/export/map-listings?client=ledlenser&account=${A}`);
});

test("no source file puts a session token into a URL", () => {
  // Scans app, components and lib for code that writes a token into a link or a redirect.
  const bad = /(searchParams\.(set|append)\(\s*["'](access_token|refresh_token)["'])|([?&#](access_token|refresh_token)=\$\{)/;
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(ts|tsx)$/.test(name) && bad.test(readFileSync(path, "utf8"))) offenders.push(path);
    }
  };
  for (const dir of ["app", "components", "lib"]) walk(dir);
  assert.deepEqual(offenders, []);
});

test("portal mode is the default; command is opt-in; the portal URL must be https", () => {
  assert.equal(dashboardAccountsSource({}), "portal");
  assert.equal(dashboardAccountsSource({ DASHBOARD_ACCOUNTS: "command" }), "command");
  assert.equal(dashboardAccountsSource({ DASHBOARD_ACCOUNTS: "anything" }), "portal");
  assert.equal(portalUrl({ NEXT_PUBLIC_PORTAL_URL: "https://app.intofocus.ai/" }), "https://app.intofocus.ai");
  assert.equal(portalUrl({ NEXT_PUBLIC_PORTAL_URL: "http://evil.example" }), null);
  assert.equal(portalUrl({}), null);
});

/* A fake Supabase client: claims plus canned RPC answers, recording every call. */
type Answers = Record<string, (args: Record<string, unknown>) => { data: unknown; error: unknown }>;
function fakeSupabase(sub: string | null, answers: Answers) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const client = {
    auth: {
      getClaims: async () =>
        sub ? { data: { claims: { sub, email: "a.user@example.test" } }, error: null } : { data: null, error: null },
    },
    rpc: async (fn: string, args: Record<string, unknown> = {}) => {
      calls.push({ fn, args });
      const answer = answers[fn];
      return answer ? answer(args) : { data: null, error: { message: `no ${fn}` } };
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

const memberOfA: Answers = {
  my_dashboard_accounts: () => ({ data: [{ organization_id: A, name: "Account A", slug: "account-a", role: "member" }], error: null }),
  dashboard_viewer_is_staff: () => ({ data: false, error: null }),
  open_module: (args) => ({ data: { access: args.p_org === A ? "open" : "no_account" }, error: null }),
  my_dashboard_clients: (args) => ({
    data: args.p_organization_id === A ? [{ source: "schema", client_ref: "command" }] : [],
    error: null,
  }),
};

const request = (over: Partial<Parameters<typeof resolveDashboardAccess>[1]> = {}) => ({
  accountParam: null,
  clientParam: null,
  rememberedAccount: null,
  staffReason: () => null,
  ...over,
});

test("signed out: no reads at all", async () => {
  const { client, calls } = fakeSupabase(null, memberOfA);
  assert.deepEqual(await resolveDashboardAccess(client, request()), { kind: "signed_out" });
  assert.equal(calls.length, 0);
});

test("A member asking for account B and brand ledlenser still gets account A and Fender", async () => {
  const { client, calls } = fakeSupabase("user-a", memberOfA);
  const access = await resolveDashboardAccess(client, request({ accountParam: B, clientParam: "ledlenser" }));
  assert.equal(access.kind, "open");
  if (access.kind !== "open") return;
  assert.equal(access.account.id, A);
  assert.deepEqual(access.clients, ["fender"]);
  assert.equal(access.client, "fender");
  assert.deepEqual(calls.find((c) => c.fn === "open_module")?.args, { p_org: A, p_product: "consensus_control", p_reason: null });
  assert.deepEqual(calls.find((c) => c.fn === "my_dashboard_clients")?.args, { p_organization_id: A });
});

test("blocked states load no brands", async () => {
  const { client, calls } = fakeSupabase("user-n", {
    ...memberOfA,
    open_module: () => ({ data: { access: "not_entitled" }, error: null }),
  });
  const access = await resolveDashboardAccess(client, request());
  assert.equal(access.kind, "blocked");
  assert.equal(access.kind === "blocked" && access.state, "not_entitled");
  assert.equal(calls.some((c) => c.fn === "my_dashboard_clients"), false);
});

test("an error from open_module never opens the dashboard", async () => {
  const { client } = fakeSupabase("user-a", { ...memberOfA, open_module: () => ({ data: null, error: { message: "down" } }) });
  const access = await resolveDashboardAccess(client, request());
  assert.equal(access.kind === "blocked" && access.state, "unknown");
});

test("no accounts: blocked as no_account; two accounts and no selector: choose", async () => {
  const none = fakeSupabase("user-x", { ...memberOfA, my_dashboard_accounts: () => ({ data: [], error: null }) });
  const noAccess = await resolveDashboardAccess(none.client, request());
  assert.equal(noAccess.kind === "blocked" && noAccess.state, "no_account");
  const two = fakeSupabase("user-ab", {
    ...memberOfA,
    my_dashboard_accounts: () => ({
      data: [
        { organization_id: A, name: "Account A", slug: "account-a", role: "member" },
        { organization_id: B, name: "Account B", slug: "account-b", role: "member" },
      ],
      error: null,
    }),
  });
  assert.equal((await resolveDashboardAccess(two.client, request())).kind, "choose_account");
});

test("staff: asked for a reason, then the saved reason for that account is passed to open_module", async () => {
  const staffAnswers: Answers = {
    ...memberOfA,
    my_dashboard_accounts: (args) => ({
      data: args.p_selected === A ? [{ organization_id: A, name: "Account A", slug: "account-a", role: "staff" }] : [],
      error: null,
    }),
    dashboard_viewer_is_staff: () => ({ data: true, error: null }),
    open_module: (args) => ({ data: { access: args.p_reason ? "open_staff" : "staff_reason_required" }, error: null }),
  };
  const first = fakeSupabase("staff", staffAnswers);
  assert.equal((await resolveDashboardAccess(first.client, request({ accountParam: A }))).kind, "reason_required");
  const second = fakeSupabase("staff", staffAnswers);
  const opened = await resolveDashboardAccess(
    second.client,
    request({ accountParam: A, staffReason: (id) => (id === A ? "Checking the weekly scores" : null) }),
  );
  assert.equal(opened.kind, "open");
  assert.equal(opened.kind === "open" && opened.staff, true);
  assert.equal(second.calls.find((c) => c.fn === "open_module")?.args.p_reason, "Checking the weekly scores");
});

test("downloads: the brand must be one the selected account may read", async () => {
  const { client } = fakeSupabase("user-a", memberOfA);
  assert.equal(await signedInClientAllowed(client, { accountParam: A, rememberedAccount: null }, "fender"), true);
  assert.equal(await signedInClientAllowed(client, { accountParam: A, rememberedAccount: null }, "ledlenser"), false);
  const signedOut = fakeSupabase(null, memberOfA);
  assert.equal(await signedInClientAllowed(signedOut.client, { accountParam: A, rememberedAccount: null }, "fender"), false);
});

test("the shared session cookie domain is a parent domain or nothing", async () => {
  const { sharedCookieDomain, supabaseCookieOptions } = await import("../lib/supabase/cookie-options.ts");
  assert.equal(sharedCookieDomain(".intofocus.ai"), ".intofocus.ai");
  assert.equal(sharedCookieDomain(""), undefined);
  assert.equal(sharedCookieDomain("localhost"), undefined);
  assert.equal(sharedCookieDomain("bad domain; path=/"), undefined);
  assert.deepEqual(supabaseCookieOptions(".intofocus.ai"), {
    cookieOptions: { domain: ".intofocus.ai", path: "/", sameSite: "lax", secure: true },
  });
});
