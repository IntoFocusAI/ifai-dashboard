"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { login, signUp, type AuthState } from "@/app/auth/actions";

/** Set true to show “New here? Sign up” on the login form. `/signup` and `signUp` stay wired. */
const SHOW_LOGIN_SIGNUP_LINK = false;

type Props = {
  mode: "login" | "signup";
  next?: string;
  banner?: string;
  presentation?: "page" | "modal";
};

function AuthFormFields({
  mode,
  next,
  banner,
  formAction,
  pending,
  email,
  setEmail,
  error,
  notice,
  title,
}: {
  mode: "login" | "signup";
  next?: string;
  banner?: string;
  formAction: (payload: FormData) => void;
  pending: boolean;
  email: string;
  setEmail: (value: string) => void;
  error: string | undefined;
  notice: string | undefined;
  title: string;
}) {
  return (
    <>
      <p className="auth-form-eyebrow">IntoFocus AI</p>
      <h1 className="auth-form-title" id="auth-form-title">
        {title}
      </h1>
      {mode === "signup" ? (
        <p className="auth-form-lead">Create an account with your IntoFocus email.</p>
      ) : null}

      {banner ? <p className="auth-form-banner auth-form-banner-error">{banner}</p> : null}
      {error ? <p className="auth-form-banner auth-form-banner-error">{error}</p> : null}
      {notice ? <p className="auth-form-banner auth-form-banner-notice">{notice}</p> : null}

      <form action={formAction} className="auth-form-fields">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <label className="auth-form-label">
          Email
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="auth-form-input"
          />
        </label>
        <label className="auth-form-label">
          Password
          <input
            name="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={6}
            className="auth-form-input"
          />
        </label>
        <button type="submit" disabled={pending} className="auth-form-submit">
          {pending ? "Please wait…" : title}
        </button>
      </form>

      {mode === "login" && SHOW_LOGIN_SIGNUP_LINK ? (
        <p className="auth-form-footer">
          New here?{" "}
          <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}>
            Sign up
          </Link>
        </p>
      ) : null}
      {mode === "signup" ? (
        <p className="auth-form-footer">
          Already have an account?{" "}
          <Link href={next ? `/dashboard?next=${encodeURIComponent(next)}` : "/dashboard"}>
            Log in
          </Link>
        </p>
      ) : null}
    </>
  );
}

export function AuthFormCard({
  mode,
  next,
  banner,
  presentation = "page",
}: Props) {
  const action = mode === "login" ? login : signUp;
  const [state, formAction, pending] = useActionState(action, null as AuthState);
  const [email, setEmail] = useState("");
  const error = state && "error" in state ? state.error : undefined;
  const notice = state && "notice" in state ? state.notice : undefined;
  const title = mode === "login" ? "Log in" : "Sign up";

  const fields = (
    <AuthFormFields
      mode={mode}
      next={next}
      banner={banner}
      formAction={formAction}
      pending={pending}
      email={email}
      setEmail={setEmail}
      error={error}
      notice={notice}
      title={title}
    />
  );

  if (presentation === "modal") {
    return (
      <div
        className="auth-bubble-dialog auth-form-card-modal"
        role="dialog"
        aria-modal
        aria-labelledby="auth-form-title"
      >
        <div className="auth-bubble-logo-stage" aria-hidden="true">
          <span className="auth-bubble-aura" />
          <span className="auth-bubble-orbit" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.png" alt="" className="auth-bubble-logo" width={46} height={46} />
        </div>
        <div className="auth-bubble-panel">{fields}</div>
      </div>
    );
  }

  return (
    <div className="auth-form-card auth-form-card-page">
      {fields}
    </div>
  );
}

/** Standalone /login and /signup routes (legacy; home uses the modal). */
export function AuthForm(props: Props) {
  return (
    <main className="auth-form-page">
      <div className="auth-form-page-inner">
        <AuthFormCard {...props} presentation="page" />
      </div>
    </main>
  );
}
