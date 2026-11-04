"use client";

import "@/lib/canvas-sdk/canvas-sdk.css";
import "@/lib/canvas-sdk/iom-theme.css";
import { IOM_CUSTOM_CURSOR, IomCursor } from "@/lib/canvas-sdk/IomCursor";
import { useRef, type ReactNode } from "react";

type Props = {
  className?: string;
  children: ReactNode;
};

/** IOM backdrop with layout height + custom cursor (matches IntelligenceCanvas chrome). */
export function DashboardIomShell({ className = "", children }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={rootRef} className={`ifai-canvas theme-iom ${className}`.trim()}>
      <div className="canvas-layout">{children}</div>
      {IOM_CUSTOM_CURSOR ? <IomCursor rootRef={rootRef} enabled /> : null}
    </div>
  );
}
