import type { AccessState } from "@/lib/portal/access";

/* What a signed-in person reads when the dashboard does not open (issue 248). Must match the
   portal's copy in intofocus-portal docs/dashboards.md; change both together. Clients see
   "dashboard", never "module". */

export const ACCESS_COPY: Record<Exclude<AccessState, "open" | "open_staff" | "staff_reason_required">, { title: string; body: string }> = {
  signed_out: {
    title: "Sign in to open the dashboard",
    body: "Sign in to the IntoFocus portal, then open the dashboard again.",
  },
  no_account: {
    title: "No account to show",
    body: "Your sign-in is not linked to an account with this dashboard. Ask your account admin to invite you.",
  },
  not_entitled: {
    title: "This dashboard is not part of your plan",
    body: "Your account does not include IntoFocus AI Consensus Control yet. Contact your IntoFocus team to add it.",
  },
  suspended: {
    title: "Access is paused",
    body: "Access to this account is paused. Contact your account admin.",
  },
  unknown: {
    title: "Access could not be checked",
    body: "We could not check your access to this dashboard. Reload the page to try again.",
  },
};

export const CHOOSE_ACCOUNT_COPY = {
  title: "Choose an account",
  body: "You belong to more than one account. Choose the one to open.",
};

export const STAFF_REASON_COPY = {
  title: "Give a reason to open this account",
  body: "You are not a member of this account. IntoFocus staff give a reason each time, and the reason is logged.",
  label: "Reason",
  submit: "Open dashboard",
};
