"use client";

import "@/components/auth/auth-bubble-form.css";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { DASHBOARD_PATH } from "@/lib/auth/dashboard-path";
import { createClient } from "@/lib/supabase/client";

const MIN_LENGTH = 8;

/** First visit from an invite: choose the password used to log in from now on. */
export function SetPasswordForm() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void createClient()
      .auth.getSession()
      .then(({ data }) => {
        setEmail(data.session?.user?.email ?? null);
        setChecked(true);
      });
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password.length < MIN_LENGTH) return setError(`Use at least ${MIN_LENGTH} characters.`);
    if (password !== String(form.get("confirm") ?? "")) return setError("The two passwords do not match.");
    setPending(true);
    setError(null);
    const { error: saveError } = await createClient().auth.updateUser({ password });
    setPending(false);
    if (saveError) return setError(saveError.message);
    router.replace(DASHBOARD_PATH);
    router.refresh();
  }

  return (
    <main className="auth-form-page">
      <div className="auth-form-page-inner">
        <div className="auth-form-card auth-form-card-page">
          <p className="auth-form-eyebrow">IntoFocus AI</p>
          <h1 className="auth-form-title">Set your password</h1>
          {!checked ? null : !email ? (
            <p className="auth-form-banner auth-form-banner-error">
              This link has expired or was already used. Ask your IntoFocus contact for a new invite.
            </p>
          ) : (
            <>
              <p className="auth-form-lead">You will log in as {email}.</p>
              {error ? <p className="auth-form-banner auth-form-banner-error">{error}</p> : null}
              <form onSubmit={onSubmit} className="auth-form-fields">
                <label className="auth-form-label">
                  New password
                  <input
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={MIN_LENGTH}
                    className="auth-form-input"
                  />
                </label>
                <label className="auth-form-label">
                  Type it again
                  <input
                    name="confirm"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={MIN_LENGTH}
                    className="auth-form-input"
                  />
                </label>
                <button type="submit" disabled={pending} className="auth-form-submit">
                  {pending ? "Saving…" : "Save and open the dashboard"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
