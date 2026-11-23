"use client";

import { useActionState } from "react";
import { removeMember, type ManageUsersState } from "@/app/settings/users/actions";

/** Remove one person from this org after a confirm. Their login stays; they lose this brand. */
export function RemoveMemberButton({
  membershipId,
  organizationId,
  email,
}: {
  membershipId: string;
  organizationId: string;
  email: string;
}) {
  const [state, action, pending] = useActionState(removeMember, null as ManageUsersState);
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(`Remove ${email}? They will lose access to this brand.`)) event.preventDefault();
      }}
    >
      <input type="hidden" name="membershipId" value={membershipId} />
      <input type="hidden" name="organizationId" value={organizationId} />
      <button type="submit" className="sites-review-save" disabled={pending}>
        {pending ? "Removing…" : "Remove"}
      </button>
      {state && "error" in state ? (
        <p className="sites-review-row-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
