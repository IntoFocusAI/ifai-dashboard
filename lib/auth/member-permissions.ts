/* Who may invite and remove whom on Manage users (decision by Brian Watson, 23 Nov 2026).

   - IntoFocus Staff: any client org, invite as Org Lead or Org User, remove anyone but staff.
   - Org Lead: only their own org, invite as Org User only, remove only Org Users.
   - Org User: nothing (the page is not shown).

   The server actions call these before any admin call. The database policies hold the same
   rules for the Org Lead (insert, update and delete only org_viewer rows in their org). */

import { isStaffMembership } from "@/lib/auth/client-access";
import type { CommandMembership, OrganizationRole } from "@/lib/command/types";

export type InviteRole = Extract<OrganizationRole, "org_admin" | "org_viewer">;

export const INVITE_ROLES: readonly InviteRole[] = ["org_admin", "org_viewer"];

export function isInviteRole(value: unknown): value is InviteRole {
  return value === "org_admin" || value === "org_viewer";
}

/** Org ids where this user is an active Org Lead. */
export function leadOrganizationIds(memberships: readonly CommandMembership[]): string[] {
  return memberships
    .filter((m) => m.status === "active" && m.role === "org_admin" && !m.organization.isPlatformOrg)
    .map((m) => m.organization.id);
}

/** True for staff and for Org Leads: they see Manage users. */
export function canManageUsers(memberships: readonly CommandMembership[]): boolean {
  return isStaffMembership(memberships) || leadOrganizationIds(memberships).length > 0;
}

/** The roles this user may give in this org. Empty means no inviting there. */
export function invitableRoles(
  memberships: readonly CommandMembership[],
  organization: { id: string; isPlatformOrg: boolean },
): InviteRole[] {
  if (organization.isPlatformOrg) return [];
  if (isStaffMembership(memberships)) return [...INVITE_ROLES];
  return leadOrganizationIds(memberships).includes(organization.id) ? ["org_viewer"] : [];
}

export function canInvite(
  memberships: readonly CommandMembership[],
  organization: { id: string; isPlatformOrg: boolean },
  role: InviteRole,
): boolean {
  return invitableRoles(memberships, organization).includes(role);
}

/** One existing membership row, as Manage users reads it. */
export type MemberRow = {
  id: string;
  organizationId: string;
  userId: string;
  role: OrganizationRole;
};

export function canRemove(
  actor: { userId: string; memberships: readonly CommandMembership[] },
  organization: { id: string; isPlatformOrg: boolean },
  row: MemberRow,
): boolean {
  if (row.organizationId !== organization.id) return false;
  if (organization.isPlatformOrg || row.role === "intofocus_admin") return false;
  if (row.userId === actor.userId) return false;
  if (isStaffMembership(actor.memberships)) return true;
  return leadOrganizationIds(actor.memberships).includes(organization.id) && row.role === "org_viewer";
}

/**
 * Whether inviting an email that already has a row in this org may change that row. A Lead may
 * never change an Org Lead's row (no demoting a Lead to User); staff may.
 */
export function canChangeExistingRow(
  memberships: readonly CommandMembership[],
  existingRole: OrganizationRole,
): boolean {
  if (existingRole === "intofocus_admin") return false;
  if (isStaffMembership(memberships)) return true;
  return existingRole === "org_viewer";
}

export function normalizeEmail(value: unknown): string | null {
  const email = String(value ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}
