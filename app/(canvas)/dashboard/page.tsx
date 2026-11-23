import { redirect } from "next/navigation";
import { DashboardAuthView } from "@/components/dashboard/DashboardAuthView";
import { DashboardOrgPlaceholder } from "@/components/dashboard/DashboardOrgPlaceholder";
import { HomeCanvasDynamic } from "@/components/v3/HomeCanvasDynamic";
import { HomeCanvasStatic } from "@/components/v3/HomeCanvasStatic";
import { DASHBOARD_PATH } from "@/lib/auth/dashboard-path";
import { resolveDashboardGate } from "@/lib/auth/dashboard-gate";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Login is required (Brian Watson, 23 Nov 2026). The server decides before any canvas code runs:
 * signed out reads the Log in card, signed in with no brand reads "No access yet", and a
 * `?client=` the user may not open redirects to their own brand.
 */
export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  if (process.env.NEXT_PUBLIC_STATIC_EXPORT === "1") {
    return <HomeCanvasStatic />;
  }
  const gate = await resolveDashboardGate(await searchParams);

  if (gate.kind === "login") return <DashboardAuthView mode="login" next={gate.next} />;
  if (gate.kind === "redirect") redirect(`${DASHBOARD_PATH}${gate.search}`);
  if (gate.kind === "no-access") {
    return (
      <DashboardOrgPlaceholder
        {...gate.userMenu}
        title="No access yet"
        hint="You are signed in, but your login is not linked to a brand yet. Ask your IntoFocus contact to add you."
      />
    );
  }
  return (
    <HomeCanvasDynamic
      userMenu={gate.userMenu}
      viewerId={gate.userMenu?.email}
      switcherClients={gate.switcherClients}
    />
  );
}
