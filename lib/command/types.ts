export type OrganizationRole = "intofocus_admin" | "org_admin" | "org_viewer";

export type MembershipStatus = "active" | "invited" | "suspended" | "removed";

export type CommandOrganization = {
  id: string;
  name: string;
  slug: string;
  isPlatformOrg: boolean;
  /** command.organizations.is_active. An inactive org gives its members no access. Missing reads as active. */
  isActive?: boolean;
};

export type CommandMembership = {
  id: string;
  role: OrganizationRole;
  status: MembershipStatus;
  organization: CommandOrganization;
};

export type CommandUserProfile = {
  id: string;
  displayName: string | null;
  avatarPath: string | null;
  settings: Record<string, unknown>;
};

export type CommandSession = {
  userId: string;
  email: string;
  profile: CommandUserProfile;
  memberships: CommandMembership[];
  /** Shown org: the sole client org, or the sole membership when there is no client org. */
  primaryOrganization: CommandOrganization | null;
  /** Role on the primary org, if any. */
  primaryRole: OrganizationRole | null;
  isIntoFocusAdmin: boolean;
  avatarSignedUrl: string | null;
};

export type CommandUserMenuOrganization = {
  id: string;
  name: string;
  slug: string;
};

export type CommandUserMenu = {
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  organizationName: string | null;
  roleLabel: string | null;
  organizations: CommandUserMenuOrganization[];
  activeOrganizationId: string | null;
};
