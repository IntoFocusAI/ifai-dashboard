import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DASHBOARD_PATH } from "@/lib/auth/dashboard-path";

export function ManageUsersHeader({ light }: { light: boolean }) {
  return (
    <header className="sites-review-header">
      <h1>Manage users</h1>
      <div className="sites-review-actions">
        <Link href={light ? `${DASHBOARD_PATH}?theme=light` : DASHBOARD_PATH} className="sites-review-back">
          <ArrowLeft size={14} aria-hidden />
          <span>Back to dashboard</span>
        </Link>
      </div>
    </header>
  );
}
