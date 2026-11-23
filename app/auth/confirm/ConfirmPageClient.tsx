"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/auth/paths";

export function ConfirmPageClient() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    void (async () => {
      const supabase = createClient();
      const tokenHash = params.get("token_hash");
      const type = params.get("type");
      const code = params.get("code");
      const next = safeNextPath(params.get("next"), window.location.origin);

      // An invite sent with the default Supabase email template returns the session in the
      // URL hash (#access_token=…&refresh_token=…) instead of a token_hash or code.
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!error) {
          router.replace(next);
          return;
        }
      } else if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({
          type: type as "email" | "invite" | "recovery" | "magiclink" | "signup",
          token_hash: tokenHash,
        });
        if (!error) {
          router.replace(next);
          return;
        }
      } else if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          router.replace(next);
          return;
        }
      }

      router.replace("/login?error=confirm");
    })();
  }, [params, router]);

  return (
    <div style={{ padding: 24, fontFamily: "Inter, system-ui, sans-serif" }}>
      Confirming your account…
    </div>
  );
}
