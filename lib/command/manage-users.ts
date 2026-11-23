import "server-only";
import {
  canRemove,
  invitableRoles,
  leadOrganizationIds,
  type InviteRole,
  type MemberRow,
} from "@/lib/auth/member-permissions";
import { isStaffMembership } from "@/lib/auth/client-access";
import type { CommandOrganization, CommandSession, MembershipStatus, OrganizationRole } from "@/lib/command/types";
import type { SupabaseClient } from "@supabase/supabase-js";

/* Reads for Manage users. Every function here takes the service-role client, so callers must
   have checked the session first; the org list itself is limited to what the session may manage. */

type OrgRow = { id: string; name: string; slug: string; is_platform_org: boolean };

function mapOrg(row: OrgRow): CommandOrganization {
  return { id: row.id, name: row.name, slug: row.slug, isPlatformOrg: row.is_platform_org };
}

/** Client orgs this user may manage: every one for staff, their Lead orgs for an Org Lead. */
export async function manageableOrganizations(
  admin: SupabaseClient,
  session: CommandSession,
): Promise<CommandOrganization[]> {
  if (isStaffMembership(session.memberships)) {
    const { data, error } = await admin
      .schema("command")
      .from("organizations")
      .select("id, name, slug, is_platform_org")
      .eq("is_platform_org", false)
      .order("name");
    if (error) throw new Error(error.message);
    return ((data ?? []) as OrgRow[]).map(mapOrg);
  }
  const leadIds = new Set(leadOrganizationIds(session.memberships));
  return session.memberships
    .filter((m) => leadIds.has(m.organization.id))
    .map((m) => m.organization)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function organizationById(
  admin: SupabaseClient,
  id: string,
): Promise<CommandOrganization | null> {
  const { data, error } = await admin
    .schema("command")
    .from("organizations")
    .select("id, name, slug, is_platform_org")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return mapOrg(data as OrgRow);
}

type MembershipRow = { id: string; organization_id: string; user_id: string; role: OrganizationRole; status: MembershipStatus };

export async function membershipRows(
  admin: SupabaseClient,
  filter: { organizationId: string; userId?: string; id?: string },
): Promise<MembershipRow[]> {
  let query = admin
    .schema("command")
    .from("organization_memberships")
    .select("id, organization_id, user_id, role, status")
    .eq("organization_id", filter.organizationId);
  if (filter.userId) query = query.eq("user_id", filter.userId);
  if (filter.id) query = query.eq("id", filter.id);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as MembershipRow[];
}

export function toMemberRow(row: MembershipRow): MemberRow {
  return { id: row.id, organizationId: row.organization_id, userId: row.user_id, role: row.role };
}

/** An auth user's id by email, or null. Pages through the admin user list. */
export async function findUserIdByEmail(admin: SupabaseClient, email: string): Promise<string | null> {
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit.id;
    if (data.users.length < 1000) return null;
  }
  return null;
}

export type ManagedMember = {
  id: string;
  email: string;
  role: OrganizationRole;
  status: MembershipStatus;
  signedInYet: boolean;
  removable: boolean;
};

export type ManageUsersRead = {
  organizations: CommandOrganization[];
  selected: CommandOrganization | null;
  members: ManagedMember[];
  roles: InviteRole[];
};

const ROLE_ORDER: Record<OrganizationRole, number> = { intofocus_admin: 0, org_admin: 1, org_viewer: 2 };

export async function loadManageUsers(
  admin: SupabaseClient,
  session: CommandSession,
  orgSlug: string | undefined,
): Promise<ManageUsersRead> {
  const organizations = await manageableOrganizations(admin, session);
  const selected = organizations.find((o) => o.slug === orgSlug) ?? organizations[0] ?? null;
  if (!selected) return { organizations, selected, members: [], roles: [] };

  const rows = await membershipRows(admin, { organizationId: selected.id });
  const actor = { userId: session.userId, memberships: session.memberships };
  const members = await Promise.all(
    rows.map(async (row) => {
      const { data } = await admin.auth.admin.getUserById(row.user_id);
      return {
        id: row.id,
        email: data.user?.email ?? "(no email)",
        role: row.role,
        status: row.status,
        signedInYet: Boolean(data.user?.last_sign_in_at),
        removable: canRemove(actor, selected, toMemberRow(row)),
      };
    }),
  );
  members.sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.email.localeCompare(b.email));
  return { organizations, selected, members, roles: invitableRoles(session.memberships, selected) };
}
