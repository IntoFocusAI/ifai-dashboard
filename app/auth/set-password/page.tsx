import type { Metadata } from "next";
import { SetPasswordForm } from "@/app/auth/set-password/SetPasswordForm";

export const metadata: Metadata = {
  title: "Set your password · IntoFocus",
  robots: { index: false, follow: false },
};

/** Where an invite link lands after /auth/confirm signs the person in. */
export default function SetPasswordPage() {
  return <SetPasswordForm />;
}
