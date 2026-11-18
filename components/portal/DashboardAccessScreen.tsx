import "@/components/portal/dashboard-access.css";
import { pickAccount } from "@/app/(canvas)/dashboard/access-actions";
import { ACCESS_COPY, CHOOSE_ACCOUNT_COPY, STAFF_REASON_COPY } from "@/components/portal/access-copy";
import { StaffReasonForm } from "@/components/portal/StaffReasonForm";
import type { AccessState, PortalAccount } from "@/lib/portal/access";

/* The screen shown instead of the dashboard when it does not open (issue 248). No client data
   is read for any of these. */

type Props = { light: boolean; portalHref: string | null } & (
  | { view: "blocked"; state: AccessState; account: PortalAccount | null }
  | { view: "choose"; accounts: PortalAccount[] }
  | { view: "reason"; account: PortalAccount }
);

function BackToPortal({ href }: { href: string | null }) {
  if (!href) return null;
  return (
    <a className="dashboard-access-link" href={href}>
      Back to the portal
    </a>
  );
}

export function DashboardAccessScreen(props: Props) {
  const theme = props.light ? " light-theme" : "";
  return (
    <main className={`dashboard-access${theme}`} data-dashboard-access={props.view === "blocked" ? props.state : props.view}>
      <div className="dashboard-access-card">
        <p className="dashboard-access-eyebrow">IntoFocus AI Consensus Control</p>
        {props.view === "choose" ? (
          <>
            <h1>{CHOOSE_ACCOUNT_COPY.title}</h1>
            <p>{CHOOSE_ACCOUNT_COPY.body}</p>
            <ul className="dashboard-access-list" aria-label="Accounts">
              {props.accounts.map((account) => (
                <li key={account.id}>
                  <form action={pickAccount}>
                    <input type="hidden" name="account" value={account.id} />
                    <button type="submit" className="dashboard-access-option">
                      {account.name || account.slug}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </>
        ) : props.view === "reason" ? (
          <>
            <h1>{STAFF_REASON_COPY.title}</h1>
            <p>
              {props.account.name}. {STAFF_REASON_COPY.body}
            </p>
            <StaffReasonForm accountId={props.account.id} />
          </>
        ) : (
          <>
            <h1>{copyFor(props.state).title}</h1>
            <p>{copyFor(props.state).body}</p>
            <div className="dashboard-access-actions">
              <BackToPortal href={props.portalHref} />
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function copyFor(state: AccessState) {
  if (state === "open" || state === "open_staff" || state === "staff_reason_required") return ACCESS_COPY.unknown;
  return ACCESS_COPY[state];
}
