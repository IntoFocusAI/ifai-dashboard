import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ManageUsersView } from "@/components/settings/ManageUsersView";
import { ManageUsersNotice } from "@/components/settings/ManageUsersNotice";
import { MANAGE_USERS_PATH } from "@/lib/auth/manage-users-path";
import { canManageUsers } from "@/lib/auth/member-permissions";
import { loadManageUsers } from "@/lib/command/manage-users";
import { getCommandSession } from "@/lib/command/session";
import { AdminNotConfiguredError, createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Manage users · IntoFocus",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * IntoFocus Staff pick any client org and invite Org Leads or Org Users; an Org Lead sees only
 * their own org and invites Org Users. Org Users read a short notice. Every save checks again
 * on the server (app/settings/users/actions.ts).
 */
export default async function ManageUsersPage({ searchParams }: { searchParams: SearchParams }) {
  const [session, params] = await Promise.all([getCommandSession().catch(() => null), searchParams]);
  if (!session) redirect(`/dashboard?next=${encodeURIComponent(MANAGE_USERS_PATH)}`);
  const light = params.theme === "light";
  if (!canManageUsers(session.memberships)) {
    return <ManageUsersNotice light={light} message="Only Org Leads and IntoFocus staff can manage users." />;
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    if (!(error instanceof AdminNotConfiguredError)) throw error;
    return <ManageUsersNotice light={light} message="Manage users is not set up on this site yet. Ask IntoFocus to add the server key." />;
  }

  const org = typeof params.org === "string" ? params.org : undefined;
  const read = await loadManageUsers(admin, session, org);
  return <ManageUsersView read={read} light={light} />;
}
