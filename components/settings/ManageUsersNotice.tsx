import "@/lib/canvas-sdk/canvas-sdk.css";
import "@/components/staff/sites-to-review.css";
import "@/components/settings/manage-users.css";
import { ManageUsersHeader } from "@/components/settings/ManageUsersHeader";

/** What Manage users shows when there is nothing to manage: an Org User, or the server key missing. */
export function ManageUsersNotice({ light, message }: { light: boolean; message: string }) {
  return (
    <main className={`ifai-canvas sites-review-page${light ? " light-theme" : ""}`} data-manage-users-notice="">
      <div className="sites-review-card manage-users-card">
        <ManageUsersHeader light={light} />
        <p className="sites-review-staff-only" role="status">
          {message}
        </p>
      </div>
    </main>
  );
}
