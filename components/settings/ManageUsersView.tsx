import "@/lib/canvas-sdk/canvas-sdk.css";
import "@/components/staff/sites-to-review.css";
import "@/components/settings/manage-users.css";
import Link from "next/link";
import { InviteMemberForm } from "@/components/settings/InviteMemberForm";
import { ManageUsersHeader } from "@/components/settings/ManageUsersHeader";
import { RemoveMemberButton } from "@/components/settings/RemoveMemberButton";
import { MANAGE_USERS_PATH } from "@/lib/auth/manage-users-path";
import { COMMAND_ROLE_LABELS } from "@/lib/command/constants";
import type { ManageUsersRead } from "@/lib/command/manage-users";

function orgHref(slug: string, light: boolean): string {
  const params = new URLSearchParams({ org: slug });
  if (light) params.set("theme", "light");
  return `${MANAGE_USERS_PATH}?${params.toString()}`;
}

export function ManageUsersView({ read, light }: { read: ManageUsersRead; light: boolean }) {
  const { organizations, selected, members, roles } = read;
  return (
    <main className={`ifai-canvas sites-review-page${light ? " light-theme" : ""}`} data-manage-users="">
      <div className="sites-review-card manage-users-card">
        <ManageUsersHeader light={light} />

        {organizations.length > 1 ? (
          <nav className="manage-users-orgs" aria-label="Organization">
            {organizations.map((org) => (
              <Link
                key={org.id}
                href={orgHref(org.slug, light)}
                className={`manage-users-org${org.id === selected?.id ? " selected" : ""}`}
                aria-current={org.id === selected?.id ? "page" : undefined}
              >
                {org.name}
              </Link>
            ))}
          </nav>
        ) : null}

        {!selected ? (
          <p className="sites-review-lead">No client organizations yet.</p>
        ) : (
          <>
            <h2 className="manage-users-org-title">{selected.name}</h2>
            {roles.length > 0 ? <InviteMemberForm organizationId={selected.id} roles={roles} /> : null}

            <table className="manage-users-table">
              <thead>
                <tr>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">Signed in yet</th>
                  <th scope="col" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {members.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="manage-users-empty">
                      Nobody in {selected.name} yet.
                    </td>
                  </tr>
                ) : (
                  members.map((m) => (
                    <tr key={m.id} data-member-row="">
                      <td>{m.email}</td>
                      <td>{COMMAND_ROLE_LABELS[m.role]}</td>
                      <td>{m.signedInYet ? "Yes" : "Not yet"}</td>
                      <td className="manage-users-actions">
                        {m.removable ? (
                          <RemoveMemberButton
                            membershipId={m.id}
                            organizationId={selected.id}
                            email={m.email}
                          />
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </>
        )}
      </div>
    </main>
  );
}
