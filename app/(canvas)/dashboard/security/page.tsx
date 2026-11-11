import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { DASHBOARD_PATH } from "@/lib/auth/dashboard-path";
import { SECURITY_PAGE, type SecuritySection } from "./security-copy";
import { SecurityThemeRoot } from "./SecurityThemeRoot";
import "./security.css";

export const metadata: Metadata = {
  title: "Security · IntoFocus",
  description: "How IntoFocus handles your data",
};

function Section({ section }: { section: SecuritySection }) {
  const headingId = `security-${section.id}`;
  return (
    <section className="security-section" data-status={section.status} aria-labelledby={headingId}>
      <h2 id={headingId}>
        <span className="security-status-dot" aria-hidden />
        {section.heading}
      </h2>
      <ul className="security-list">
        {section.items.map((item) => (
          <li key={item.text}>
            <p className="security-item-text">{item.text}</p>
            {item.detail ? <p className="security-item-detail">{item.detail}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function SecurityCard() {
  return (
    <article className="security-card" aria-labelledby="security-title">
      <header className="profile-modal-header security-header">
        <h1 id="security-title">{SECURITY_PAGE.title}</h1>
        <Link href={DASHBOARD_PATH} className="security-back">
          <ArrowLeft size={14} aria-hidden />
          <span>{SECURITY_PAGE.backLabel}</span>
        </Link>
      </header>
      <div className="security-body">
        <p className="security-lead">{SECURITY_PAGE.lead}</p>
        {SECURITY_PAGE.sections.map((section) => (
          <Section key={section.id} section={section} />
        ))}
      </div>
    </article>
  );
}

export default function SecurityPage() {
  return (
    <Suspense
      fallback={
        <main className="security-page profile-modal-theme-canvas">
          <SecurityCard />
        </main>
      }
    >
      <SecurityThemeRoot>
        <SecurityCard />
      </SecurityThemeRoot>
    </Suspense>
  );
}
