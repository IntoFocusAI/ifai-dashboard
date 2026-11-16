import "@/lib/canvas-sdk/canvas-sdk.css";
import "@/components/staff/sites-to-review.css";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DASHBOARD_PATH } from "@/lib/auth/dashboard-path";
import { clientHref, type ClientKey } from "@/lib/client/active-client";

/**
 * What anyone but IntoFocus staff sees on a staff page, for example a client user who opens a
 * forwarded link (decision 85). No list, no count, no client data.
 */
export function StaffOnlyNotice({ client, light }: { client: ClientKey; light: boolean }) {
  const href = clientHref(client, DASHBOARD_PATH);
  return (
    <main className={`ifai-canvas sites-review-page${light ? " light-theme" : ""}`} data-staff-only="">
      <div className="sites-review-card">
        <header className="sites-review-header">
          <h1>Sites to review</h1>
          <div className="sites-review-actions">
            <Link
              href={light ? `${href}${href.includes("?") ? "&" : "?"}theme=light` : href}
              className="sites-review-back"
            >
              <ArrowLeft size={14} aria-hidden />
              <span>Back to dashboard</span>
            </Link>
          </div>
        </header>
        <p className="sites-review-staff-only" role="status">
          This page is for IntoFocus staff.
        </p>
      </div>
    </main>
  );
}
