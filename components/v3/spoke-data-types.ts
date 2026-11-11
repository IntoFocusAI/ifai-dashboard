import type { ReactNode } from "react";

export type SpokeId =
  | "hub"
  | "aeo"
  | "ecommerce"
  | "specs"
  | "competitors"
  | "suggestions"
  | "roadmap";

export type SpokeDefinition = {
  badge: string;
  title: string;
  desc: string;
  /** Live description. Rendered instead of `desc` when the sentence follows panel data. */
  descSlot?: ReactNode;
  tabs: string[];
  /** Tab names that carry a "New" marker. */
  newTabs?: string[];
  navLabel: string;
  next: SpokeId;
  render: (tabIdx: number) => ReactNode | string;
  /** Compact control under the panel title. Used by AI Search history. */
  headerAccessory?: ReactNode;
  /** Optional stats that fill the wide header band on expanded panels. */
};
