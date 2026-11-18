import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ActuationRecordsView } from "@/components/staff/ActuationRecordsView";
import { StaffOnlyNotice } from "@/components/staff/StaffOnlyNotice";
import { CLIENT_PARAM, isClientKey } from "@/lib/client/active-client";
import { getCommandSession } from "@/lib/command/session";
import { loadActuationRecords } from "@/lib/fender-canvas/actuation-read";
import { loadActuationTargets } from "@/lib/fender-canvas/actuation-targets-read";
import { isoDay } from "@/lib/fender-canvas/actuation-score";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Actuation records · IntoFocus",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * The e2e suite's staff layout check. Only under the e2e auth bypass on a dev server, never in a
 * production build. It shows the page as staff would; the reads still run as the e2e browser
 * session, which the staff functions answer with no rows, and every save still checks the session.
 */
async function e2eStaffPreview(): Promise<boolean> {
  if (process.env.E2E_AUTH_BYPASS !== "1" || process.env.NODE_ENV === "production") return false;
  const jar = await cookies();
  return jar.get("ifai-e2e-staff")?.value === "1";
}

/**
 * IntoFocus staff only (SC-03 record controls). Anyone else, a client user opening a forwarded
 * link included, reads "This page is for IntoFocus staff" and nothing is loaded (decision 85).
 */
export default async function ActuationRecordsPage({ searchParams }: { searchParams: SearchParams }) {
  const [session, params, preview] = await Promise.all([
    getCommandSession().catch(() => null),
    searchParams,
    e2eStaffPreview(),
  ]);
  const raw = params[CLIENT_PARAM];
  const client = isClientKey(raw) ? raw : "fender";
  const light = params.theme === "light";
  if (!session?.isIntoFocusAdmin && !preview) {
    return <StaffOnlyNotice client={client} light={light} title="Actuation records" />;
  }

  const [read, targets] = await Promise.all([loadActuationRecords(client), loadActuationTargets(client)]);
  return <ActuationRecordsView client={client} read={read} targets={targets} light={light} today={isoDay(new Date())} />;
}
