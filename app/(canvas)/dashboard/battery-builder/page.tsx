import type { Metadata } from "next";
import { Suspense } from "react";
import { StaffOnlyNotice } from "@/components/staff/StaffOnlyNotice";
import { BatteryBuilder } from "@/components/v3/battery-builder/BatteryBuilder";
import { CLIENT_PARAM, isClientKey } from "@/lib/client/active-client";
import { getCommandSession } from "@/lib/command/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Build prompts · IntoFocus",
  description: "Build AI battery questions from shopper details",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * IntoFocus staff only (decision 99). Anyone else, a client user opening a forwarded link included,
 * reads "This page is for IntoFocus staff" and the builder is not loaded. The same session check
 * as Sites to review.
 */
export default async function BatteryBuilderPage({ searchParams }: { searchParams: SearchParams }) {
  const [session, params] = await Promise.all([getCommandSession().catch(() => null), searchParams]);
  if (!session?.isIntoFocusAdmin) {
    const raw = params[CLIENT_PARAM];
    const client = isClientKey(raw) ? raw : "fender";
    return <StaffOnlyNotice client={client} light={params.theme === "light"} title="Build prompts" />;
  }
  return (
    <Suspense fallback={null}>
      <BatteryBuilder />
    </Suspense>
  );
}
