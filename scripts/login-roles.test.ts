// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/login-roles.test.ts
/* Login with IntoFocus Staff / Org Lead / Org User (Brian Watson, 23 Nov 2026): which brands a
   login may open, which brand a URL shows, and who may invite or remove whom. */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  accessFromMemberships,
  accessFromRpcRows,
  chooseClient,
  dashboardSearchFor,
  type ClientAccess,
} from "@/lib/auth/client-access";
import {
  canChangeExistingRow,
  canInvite,
  canManageUsers,
  canRemove,
  invitableRoles,
  normalizeEmail,
} from "@/lib/auth/member-permissions";
import { COMMAND_ROLE_LABELS } from "@/lib/command/constants";
import type { CommandMembership, OrganizationRole } from "@/lib/command/types";

const KNOWN = [
  { clientKey: "fender", displayName: "Fender" },
  { clientKey: "ledlenser", displayName: "Ledlenser" },
];

const ORGS = {
  platform: { id: "org-ifai", name: "IntoFocus AI", slug: "intofocus-ai", isPlatformOrg: true },
  fender: { id: "org-fender", name: "Fender", slug: "fender", isPlatformOrg: false },
  ledlenser: { id: "org-ledlenser", name: "Ledlenser", slug: "ledlenser", isPlatformOrg: false },
  other: { id: "org-other", name: "Not a client yet", slug: "acme", isPlatformOrg: false },
};

function member(
  org: keyof typeof ORGS,
  role: OrganizationRole,
  status: CommandMembership["status"] = "active",
): CommandMembership {
  return { id: `m-${org}-${role}`, role, status, organization: ORGS[org] };
}

const staff = [member("platform", "intofocus_admin")];
const fenderLead = [member("fender", "org_admin")];
const fenderUser = [member("fender", "org_viewer")];
const ledlenserUser = [member("ledlenser", "org_viewer")];

const keys = (access: ClientAccess) => (access.kind === "none" ? [] : access.clients.map((c) => c.clientKey));

test("role labels read IntoFocus Staff, Org Lead, Org User", () => {
  assert.deepEqual(COMMAND_ROLE_LABELS, {
    intofocus_admin: "IntoFocus Staff",
    org_admin: "Org Lead",
    org_viewer: "Org User",
  });
});

test("staff open every client; an Org Lead or User only their org's brand", () => {
  const s = accessFromMemberships(staff, KNOWN);
  assert.equal(s.kind, "staff");
  assert.deepEqual(keys(s), ["fender", "ledlenser"]);

  assert.deepEqual(keys(accessFromMemberships(fenderLead, KNOWN)), ["fender"]);
  assert.equal(accessFromMemberships(fenderLead, KNOWN).kind, "member");
  assert.deepEqual(keys(accessFromMemberships(ledlenserUser, KNOWN)), ["ledlenser"]);
});

test("no membership, an org with no client file, or a suspended row means no access", () => {
  assert.equal(accessFromMemberships([], KNOWN).kind, "none");
  assert.equal(accessFromMemberships([member("other", "org_admin")], KNOWN).kind, "none");
  assert.equal(accessFromMemberships([member("fender", "org_viewer", "invited")], KNOWN).kind, "none");
  assert.equal(accessFromMemberships([member("fender", "org_viewer", "removed")], KNOWN).kind, "none");
  // Suspended staff are not staff; intofocus_admin on a client org (the old e2e shape) is not staff either.
  assert.equal(accessFromMemberships([member("platform", "intofocus_admin", "suspended")], KNOWN).kind, "none");
  assert.equal(accessFromMemberships([member("fender", "intofocus_admin")], KNOWN).kind, "none");
});

test("someone in two client orgs gets both, in switcher order", () => {
  const both = accessFromMemberships([member("ledlenser", "org_viewer"), member("fender", "org_admin")], KNOWN);
  assert.equal(both.kind, "member");
  assert.deepEqual(keys(both), ["fender", "ledlenser"]);
});

test("command.my_clients() rows: staff from the session, unknown brands dropped", () => {
  const rows = [
    { client_key: "ledlenser", organization_id: "org-ledlenser", organization_name: "Ledlenser", role: "org_viewer" as const },
    { client_key: "acme", organization_id: "org-other", organization_name: "Acme", role: "org_viewer" as const },
  ];
  const m = accessFromRpcRows(rows, false, KNOWN);
  assert.equal(m.kind, "member");
  assert.deepEqual(keys(m), ["ledlenser"]);

  // A row claiming intofocus_admin does not make a non-staff session staff.
  const forged = accessFromRpcRows(
    [{ client_key: "fender", organization_id: null, organization_name: null, role: "intofocus_admin" }],
    false,
    KNOWN,
  );
  assert.equal(forged.kind, "none");

  const s = accessFromRpcRows(
    KNOWN.map((c) => ({ client_key: c.clientKey, organization_id: null, organization_name: null, role: "intofocus_admin" as const })),
    true,
    KNOWN,
  );
  assert.equal(s.kind, "staff");
  assert.deepEqual(keys(s), ["fender", "ledlenser"]);
  assert.equal(accessFromRpcRows([], false, KNOWN).kind, "none");
});

test("the URL never picks a brand the login cannot open", () => {
  const ledlenser = accessFromMemberships(ledlenserUser, KNOWN);
  // No parameter would show Fender (the default), so a Ledlenser user is redirected.
  assert.deepEqual(chooseClient(ledlenser, null, "fender"), { clientKey: "ledlenser", redirect: true });
  assert.deepEqual(chooseClient(ledlenser, "fender", "fender"), { clientKey: "ledlenser", redirect: true });
  assert.deepEqual(chooseClient(ledlenser, "ledlenser", "fender"), { clientKey: "ledlenser", redirect: false });
  assert.deepEqual(chooseClient(ledlenser, "nonsense", "fender"), { clientKey: "ledlenser", redirect: true });

  const fender = accessFromMemberships(fenderUser, KNOWN);
  assert.deepEqual(chooseClient(fender, null, "fender"), { clientKey: "fender", redirect: false });
  assert.deepEqual(chooseClient(fender, "ledlenser", "fender"), { clientKey: "fender", redirect: true });

  const s = accessFromMemberships(staff, KNOWN);
  assert.deepEqual(chooseClient(s, "ledlenser", "fender"), { clientKey: "ledlenser", redirect: false });
  assert.deepEqual(chooseClient(s, null, "fender"), { clientKey: "fender", redirect: false });
  assert.deepEqual(chooseClient(s, "nonsense", "fender"), { clientKey: "fender", redirect: true });

  assert.equal(chooseClient({ kind: "none" }, "fender", "fender"), null);
});

test("the redirect keeps the open panel and drops the client parameter for the default brand", () => {
  assert.equal(
    dashboardSearchFor({ client: "fender", spoke: "aeo", tab: "x" }, "ledlenser", "fender"),
    "?spoke=aeo&tab=x&client=ledlenser",
  );
  assert.equal(dashboardSearchFor({ client: "ledlenser" }, "fender", "fender"), "");
});

test("Manage users: staff any client org as Lead or User; a Lead only their org as User", () => {
  assert.deepEqual(invitableRoles(staff, ORGS.fender), ["org_admin", "org_viewer"]);
  assert.deepEqual(invitableRoles(staff, ORGS.platform), []);
  assert.deepEqual(invitableRoles(fenderLead, ORGS.fender), ["org_viewer"]);
  assert.deepEqual(invitableRoles(fenderLead, ORGS.ledlenser), []);
  assert.deepEqual(invitableRoles(fenderUser, ORGS.fender), []);

  assert.equal(canInvite(fenderLead, ORGS.fender, "org_admin"), false);
  assert.equal(canInvite(fenderLead, ORGS.fender, "org_viewer"), true);
  assert.equal(canInvite(staff, ORGS.ledlenser, "org_admin"), true);

  assert.equal(canManageUsers(staff), true);
  assert.equal(canManageUsers(fenderLead), true);
  assert.equal(canManageUsers(fenderUser), false);
  assert.equal(canManageUsers([member("fender", "org_admin", "invited")]), false);
});

test("Manage users: a Lead removes only Users in their org; nobody removes staff or themselves", () => {
  const row = (role: OrganizationRole, userId = "u-other", organizationId = ORGS.fender.id) => ({
    id: "row",
    organizationId,
    userId,
    role,
  });
  const lead = { userId: "u-lead", memberships: fenderLead };
  const admin = { userId: "u-staff", memberships: staff };

  assert.equal(canRemove(lead, ORGS.fender, row("org_viewer")), true);
  assert.equal(canRemove(lead, ORGS.fender, row("org_admin")), false);
  assert.equal(canRemove(lead, ORGS.fender, row("org_viewer", "u-lead")), false);
  assert.equal(canRemove(lead, ORGS.ledlenser, row("org_viewer", "u-other", ORGS.ledlenser.id)), false);
  // A row from another org passed with this org is refused.
  assert.equal(canRemove(lead, ORGS.fender, row("org_viewer", "u-other", ORGS.ledlenser.id)), false);

  assert.equal(canRemove(admin, ORGS.fender, row("org_admin")), true);
  assert.equal(canRemove(admin, ORGS.platform, row("intofocus_admin", "u-x", ORGS.platform.id)), false);
  assert.equal(canRemove({ userId: "u-user", memberships: fenderUser }, ORGS.fender, row("org_viewer")), false);
});

test("re-inviting: a Lead cannot change an Org Lead's row; staff can", () => {
  assert.equal(canChangeExistingRow(fenderLead, "org_admin"), false);
  assert.equal(canChangeExistingRow(fenderLead, "org_viewer"), true);
  assert.equal(canChangeExistingRow(staff, "org_admin"), true);
  assert.equal(canChangeExistingRow(staff, "intofocus_admin"), false);
});

test("emails are trimmed, lowercased and checked", () => {
  assert.equal(normalizeEmail("  Jane@Fender.com "), "jane@fender.com");
  assert.equal(normalizeEmail("not an email"), null);
  assert.equal(normalizeEmail(null), null);
});
