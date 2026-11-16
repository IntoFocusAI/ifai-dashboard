import type { Metadata } from "next";
import { SitesToReviewView } from "@/components/staff/SitesToReviewView";
import { StaffOnlyNotice } from "@/components/staff/StaffOnlyNotice";
import { loadSitesToReview } from "@/lib/ai-search/site-review-read";
import { CLIENT_PARAM, isClientKey } from "@/lib/client/active-client";
import { getCommandSession } from "@/lib/command/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sites to review · IntoFocus",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * IntoFocus staff only. Anyone else, a client user opening a forwarded link included, reads
 * "This page is for IntoFocus staff" and nothing is loaded (decision 85). The check is the same
 * active intofocus_admin membership on the platform organization that the database's
 * command.is_intofocus_admin() reads.
 */
export default async function SitesToReviewPage({ searchParams }: { searchParams: SearchParams }) {
  const [session, params] = await Promise.all([getCommandSession().catch(() => null), searchParams]);
  const raw = params[CLIENT_PARAM];
  const client = isClientKey(raw) ? raw : "fender";
  const light = params.theme === "light";
  if (!session?.isIntoFocusAdmin) return <StaffOnlyNotice client={client} light={light} />;

  const read = await loadSitesToReview(client);
  return <SitesToReviewView client={client} read={read} light={light} />;
}
