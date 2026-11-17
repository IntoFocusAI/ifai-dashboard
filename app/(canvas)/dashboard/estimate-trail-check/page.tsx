import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EstimateTrailCheck } from "./EstimateTrailCheck";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Estimate trail check · IntoFocus",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Test-only (chunk E2): renders the estimate trail drawer on its two fixtures for the e2e suite
 * and its screenshots, until chunks E3 and E4 put the drawer behind live dollar figures. Only
 * under the e2e auth bypass on a dev server; a production build answers 404.
 */
export default async function EstimateTrailCheckPage({ searchParams }: { searchParams: SearchParams }) {
  if (process.env.E2E_AUTH_BYPASS !== "1" || process.env.NODE_ENV === "production") notFound();
  const params = await searchParams;
  return <EstimateTrailCheck light={params.theme === "light"} />;
}
