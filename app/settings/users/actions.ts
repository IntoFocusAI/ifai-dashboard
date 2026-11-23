"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { MANAGE_USERS_PATH } from "@/lib/auth/manage-users-path";
import {
  canChangeExistingRow,
  canInvite,
  canRemove,
  isInviteRole,
  normalizeEmail,
} from "@/lib/auth/member-permissions";
import { COMMAND_ROLE_LABELS } from "@/lib/command/constants";
import {
  findUserIdByEmail,
  membershipRows,
  organizationById,
  toMemberRow,
} from "@/lib/command/manage-users";
import { e2eAuthBypass, getCommandSession } from "@/lib/command/session";
import { AdminNotConfiguredError, createAdminClient } from "@/lib/supabase/admin";

export type ManageUsersState = { error: string } | { notice: string } | null;

const NOT_ALLOWED: ManageUsersState = { error: "Your login cannot make this change." };

/** The signed-in user, checked on the server before any admin call. Null for the e2e bypass too. */
async function actor() {
  if (e2eAuthBypass()) return null;
  return getCommandSession().catch(() => null);
}

function adminOrError(): { admin: ReturnType<typeof createAdminClient> } | { error: string } {
  try {
    return { admin: createAdminClient() };
  } catch (error) {
    if (error instanceof AdminNotConfiguredError) {
      return { error: "Inviting is not set up on this site yet. Ask IntoFocus to add the server key." };
    }
    throw error;
  }
}

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Invite by email as Org Lead or Org User. New people get the Supabase invite email and set a
 * password from its link; people who already have a login are added without an email. The
 * membership row is written as active straight away (see the pull request for why).
 */
export async function inviteMember(_prev: ManageUsersState, formData: FormData): Promise<ManageUsersState> {
  const session = await actor();
  if (!session) return NOT_ALLOWED;

  const email = normalizeEmail(formData.get("email"));
  const role = formData.get("role");
  const organizationId = String(formData.get("organizationId") ?? "");
  if (!email) return { error: "Enter a valid email address." };
  if (!isInviteRole(role)) return { error: "Pick a role." };

  const made = adminOrError();
  if ("error" in made) return { error: made.error };
  const { admin } = made;

  const organization = await organizationById(admin, organizationId);
  if (!organization || !canInvite(session.memberships, organization, role)) return NOT_ALLOWED;

  let userId = await findUserIdByEmail(admin, email);
  let emailed = false;
  if (!userId) {
    const redirectTo = `${await siteOrigin()}/auth/confirm?next=${encodeURIComponent("/auth/set-password")}`;
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (error || !data.user) return { error: `The invite did not send: ${error?.message ?? "no user returned"}.` };
    userId = data.user.id;
    emailed = true;
  }

  const [existing] = await membershipRows(admin, { organizationId, userId });
  const label = COMMAND_ROLE_LABELS[role];
  if (existing) {
    if (existing.role === role && existing.status === "active") {
      return { notice: `${email} is already a ${label} of ${organization.name}.` };
    }
    if (!canChangeExistingRow(session.memberships, existing.role)) return NOT_ALLOWED;
    const { error } = await admin
      .schema("command")
      .from("organization_memberships")
      .update({ role, status: "active" })
      .eq("id", existing.id);
    if (error) return { error: `Could not update ${email}: ${error.message}` };
  } else {
    const { error } = await admin
      .schema("command")
      .from("organization_memberships")
      .insert({ organization_id: organizationId, user_id: userId, role, status: "active" });
    if (error) return { error: `Could not add ${email}: ${error.message}` };
  }

  revalidatePath(MANAGE_USERS_PATH);
  return {
    notice: emailed
      ? `Invite sent to ${email} as ${label} of ${organization.name}.`
      : `${email} already has a login and is now a ${label} of ${organization.name}. No email was sent.`,
  };
}

/** Remove one person from one org. Their login stays; they lose access to that brand. */
export async function removeMember(_prev: ManageUsersState, formData: FormData): Promise<ManageUsersState> {
  const session = await actor();
  if (!session) return NOT_ALLOWED;

  const membershipId = String(formData.get("membershipId") ?? "");
  const organizationId = String(formData.get("organizationId") ?? "");
  const made = adminOrError();
  if ("error" in made) return { error: made.error };
  const { admin } = made;

  const organization = await organizationById(admin, organizationId);
  const [row] = organization ? await membershipRows(admin, { organizationId, id: membershipId }) : [];
  if (!organization || !row) return { error: "That person is no longer in this organization." };
  if (!canRemove({ userId: session.userId, memberships: session.memberships }, organization, toMemberRow(row))) {
    return NOT_ALLOWED;
  }

  const { error } = await admin.schema("command").from("organization_memberships").delete().eq("id", row.id);
  if (error) return { error: `Could not remove: ${error.message}` };
  revalidatePath(MANAGE_USERS_PATH);
  return { notice: "Removed." };
}
