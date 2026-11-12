import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SitesToReviewView } from "@/components/staff/SitesToReviewView";
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
 * IntoFocus staff only. Anyone else, client users included, gets the 404 page: the check is the
 * same active intofocus_admin membership on the platform organization that the database's
 * command.is_intofocus_admin() reads.
 */
export default async function SitesToReviewPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getCommandSession();
  if (!session?.isIntoFocusAdmin) notFound();

  const params = await searchParams;
  const raw = params[CLIENT_PARAM];
  const client = isClientKey(raw) ? raw : "fender";
  const read = await loadSitesToReview(client);

  return <SitesToReviewView client={client} read={read} light={params.theme === "light"} />;
}
