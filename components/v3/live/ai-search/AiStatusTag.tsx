import type { HTMLAttributes, ReactNode } from "react";
import { StatusGlyph } from "@/components/v3/live/StatusMark";
import type { DataStatus } from "@/lib/canvas-sdk/data-status";

export type AiTagTone = "danger" | "warning" | "success" | "neutral";

const TONE_STATUS: Record<Exclude<AiTagTone, "neutral">, DataStatus> = {
  danger: "bad",
  warning: "okay",
  success: "good",
};

/** "tag-danger" and the like, for a caller that keeps a class map. */
export function tagToneOf(className: string): AiTagTone {
  if (className.includes("danger")) return "danger";
  if (className.includes("warning")) return "warning";
  if (className.includes("success")) return "success";
  return "neutral";
}

/**
 * A result badge. A status color never travels alone: the badge carries the x, dash, or check
 * beside its own word (decision 27). A neutral badge has no status color and no mark.
 */
export function AiStatusTag({
  tone,
  children,
  ...rest
}: { tone: AiTagTone; children: ReactNode } & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span {...rest} className={`tag-badge tag-${tone} ai-status-tag`} data-status-tone={tone}>
      {tone === "neutral" ? null : <StatusGlyph status={TONE_STATUS[tone]} />}
      <span>{children}</span>
    </span>
  );
}
