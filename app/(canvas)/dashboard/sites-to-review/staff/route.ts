import { getCommandSession } from "@/lib/command/session";

export const dynamic = "force-dynamic";

/**
 * Whether the signed-in user is IntoFocus staff, for the user-menu link only. The same session
 * check as the page, so the link and the page never disagree. Always 200: a signed-out or client
 * user reads { staff: false }.
 */
export async function GET() {
  const session = await getCommandSession().catch(() => null);
  return Response.json({ staff: session?.isIntoFocusAdmin === true }, { headers: { "cache-control": "no-store" } });
}
