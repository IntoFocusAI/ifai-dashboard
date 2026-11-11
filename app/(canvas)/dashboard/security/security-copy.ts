/**
 * Every claim here was checked against the code, the built bundle, or the live
 * database grants before it shipped. Add a claim only after the same check, and
 * leave off anything that is not true today.
 */

export const SECURITY_PATH = "/dashboard/security";

export type SecuritySectionStatus = "live" | "planned" | "undecided";

export type SecurityItem = {
  text: string;
  detail?: string;
};

export type SecuritySection = {
  id: string;
  heading: string;
  status: SecuritySectionStatus;
  items: SecurityItem[];
};

export const SECURITY_PAGE = {
  title: "Security",
  lead: "The data-handling rules IntoFocus follows today, what's planned, and what isn't decided yet.",
  backLabel: "Back to dashboard",
  sections: [
    {
      id: "in-place",
      heading: "In place now",
      status: "live",
      items: [
        {
          text: "No secret keys ship in the browser bundle.",
          detail: "The browser uses only the public key.",
        },
        { text: "IntoFocus's internal notes never appear in your evidence views." },
      ],
    },
    {
      id: "planned",
      heading: "Planned",
      status: "planned",
      items: [
        {
          text: "Separating client data by brand",
          detail: "Planned before a second client joins.",
        },
      ],
    },
    {
      id: "undecided",
      heading: "Not decided yet",
      status: "undecided",
      items: [
        { text: "Single sign-on (SSO)" },
        { text: "Audit export" },
        { text: "Data-processing agreement wording" },
      ],
    },
  ] satisfies SecuritySection[],
};

/** Every string the page shows, in reading order. */
export function securityPageStrings(): string[] {
  const out = [SECURITY_PAGE.title, SECURITY_PAGE.lead];
  for (const section of SECURITY_PAGE.sections) {
    out.push(section.heading);
    for (const item of section.items) {
      out.push(item.text);
      if ("detail" in item && item.detail) out.push(item.detail);
    }
  }
  out.push(SECURITY_PAGE.backLabel);
  return out;
}
