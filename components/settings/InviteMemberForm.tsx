"use client";

import { useActionState } from "react";
import { inviteMember, type ManageUsersState } from "@/app/settings/users/actions";
import type { InviteRole } from "@/lib/auth/member-permissions";
import { COMMAND_ROLE_LABELS } from "@/lib/command/constants";

/** Invite by email. Staff choose Org Lead or Org User; an Org Lead can only add Org Users. */
export function InviteMemberForm({
  organizationId,
  roles,
}: {
  organizationId: string;
  roles: readonly InviteRole[];
}) {
  const [state, action, pending] = useActionState(inviteMember, null as ManageUsersState);
  return (
    <form action={action} className="manage-users-invite" data-invite-form="">
      <input type="hidden" name="organizationId" value={organizationId} />
      <label className="manage-users-field">
        <span>Email</span>
        <input name="email" type="email" required autoComplete="off" className="manage-users-input" />
      </label>
      {roles.length > 1 ? (
        <label className="manage-users-field">
          <span>Role</span>
          <select name="role" defaultValue="org_viewer" className="sites-review-select">
            {roles.map((role) => (
              <option key={role} value={role}>
                {COMMAND_ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <input type="hidden" name="role" value={roles[0]} />
      )}
      <button type="submit" className="sites-review-save" disabled={pending}>
        {pending ? "Inviting…" : roles.length > 1 ? "Invite" : `Invite as ${COMMAND_ROLE_LABELS[roles[0]]}`}
      </button>
      {state && "error" in state ? (
        <p className="sites-review-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {state && "notice" in state ? (
        <p className="manage-users-notice" role="status">
          {state.notice}
        </p>
      ) : null}
    </form>
  );
}
