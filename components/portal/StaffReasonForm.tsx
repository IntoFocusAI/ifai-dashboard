"use client";

import { useActionState, useId } from "react";
import { submitStaffReason, type StaffReasonState } from "@/app/(canvas)/dashboard/access-actions";
import { STAFF_REASON_COPY } from "@/components/portal/access-copy";
import { STAFF_REASON_MAX_LENGTH, STAFF_REASON_MIN_LENGTH } from "@/lib/portal/contract";

export function StaffReasonForm({ accountId }: { accountId: string }) {
  const [state, action, pending] = useActionState<StaffReasonState, FormData>(submitStaffReason, null);
  const fieldId = useId();
  const hintId = useId();
  const errorId = useId();
  return (
    <form action={action}>
      <input type="hidden" name="account" value={accountId} />
      <label htmlFor={fieldId}>{STAFF_REASON_COPY.label}</label>
      <textarea
        id={fieldId}
        name="reason"
        required
        minLength={STAFF_REASON_MIN_LENGTH}
        maxLength={STAFF_REASON_MAX_LENGTH}
        aria-describedby={state?.error ? `${hintId} ${errorId}` : hintId}
        aria-invalid={state?.error ? true : undefined}
      />
      <p id={hintId} className="dashboard-access-hint">
        At least {STAFF_REASON_MIN_LENGTH} characters.
      </p>
      {state?.error ? (
        <p id={errorId} className="dashboard-access-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="dashboard-access-button" disabled={pending}>
        {STAFF_REASON_COPY.submit}
      </button>
    </form>
  );
}
