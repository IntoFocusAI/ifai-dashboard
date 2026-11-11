"use client";

import "@/components/auth/auth-bubble-form.css";
import { AuthFormCard } from "@/components/auth/AuthForm";
import { DashboardIomShell } from "@/components/dashboard/DashboardIomShell";
import { useIomPointerWash } from "@/lib/canvas-sdk/useIomPointerWash";
import { useRef } from "react";

type Props = {
  mode: "login" | "signup";
  next?: string;
  banner?: string;
};

export function DashboardAuthView({ mode, next, banner }: Props) {
  const bodyRef = useRef<HTMLDivElement>(null);
  useIomPointerWash(bodyRef);

  return (
    <DashboardIomShell className="dashboard-auth-shell">
      <div className="canvas-body dashboard-auth-body" ref={bodyRef}>
        <div className="canvas-pointer-wash" aria-hidden="true">
          <div className="canvas-pointer-glow" />
        </div>
        <div className="dashboard-auth-bg-logo" aria-hidden="true">
          <span className="dashboard-auth-bg-aura" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.png" alt="" width={160} height={160} />
        </div>
        <div className="dashboard-auth-scrim" role="presentation">
          <AuthFormCard mode={mode} next={next} banner={banner} presentation="modal" />
        </div>
      </div>
    </DashboardIomShell>
  );
}
