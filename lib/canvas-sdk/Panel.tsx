import type { ReactNode } from "react";
import { StatusMark } from "@/components/v3/live/StatusMark";
import type { DataStatus } from "@/lib/canvas-sdk/data-status";

/** A status tone always shows its mark and word beside the color (X-34). */
const TONE_STATUS: Record<"danger" | "warning" | "success", DataStatus> = {
  danger: "bad",
  warning: "okay",
  success: "good",
};

type Tone = "danger" | "warning" | "success" | "info" | "neutral" | "queued";

export function MetricGrid({ children }: { children: ReactNode }) {
  return <div className="metric-grid-2">{children}</div>;
}

export function MetricCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "danger" | "warning" | "success" | "accent";
}) {
  const toneClass =
    tone === "danger"
      ? "tone-danger"
      : tone === "warning"
        ? "tone-warning"
        : tone === "success"
          ? "tone-success"
          : tone === "accent"
            ? "tone-accent"
            : "";

  return (
    <div className="metric-card-sm">
      <span className="metric-card-label">{label}</span>
      <div className={`metric-card-val${toneClass ? ` ${toneClass}` : ""}`}>
        {value}
      </div>
      {tone && tone !== "accent" ? <StatusMark status={TONE_STATUS[tone]} /> : null}
      {sub ? <span className="metric-card-sub">{sub}</span> : null}
    </div>
  );
}

export function ContentBox({
  title,
  extra,
  children,
}: {
  title?: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="content-box">
      {title ? (
        <div className="content-box-title">
          <span>{title}</span>
          {extra}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function TagBadge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`tag-badge tag-${tone}`}>{children}</span>;
}

export function ActionCard({
  title,
  details,
  impact,
  extra,
  tone,
  children,
}: {
  title: ReactNode;
  details?: ReactNode;
  impact?: ReactNode;
  extra?: ReactNode;
  tone?: "critical" | "info" | "success";
  children?: ReactNode;
}) {
  const className =
    tone === "critical"
      ? "action-card critical"
      : tone === "info"
        ? "action-card info"
        : "action-card";
  const style = tone === "success" ? { borderLeftColor: "var(--success-green)" } : undefined;
  const status = tone === "critical" ? TONE_STATUS.danger : tone === "success" ? TONE_STATUS.success : null;

  return (
    <div className={className} style={style}>
      <div className="action-head">
        <span>{title}</span>
        {status ? <StatusMark status={status} /> : null}
        {extra}
      </div>
      {details ? <div className="action-details">{details}</div> : null}
      {impact ? <div className="action-impact">{impact}</div> : null}
      {children}
    </div>
  );
}
