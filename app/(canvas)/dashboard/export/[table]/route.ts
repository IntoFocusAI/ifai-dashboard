import { chooseClient } from "@/lib/auth/client-access";
import { defaultClientKey } from "@/lib/client/active-client";
import { runWithClient } from "@/lib/client/server-client";
import { loadClientAccess } from "@/lib/command/my-clients";
import { getCommandSession } from "@/lib/command/session";
import { csvResponse, textFailure } from "@/lib/export/http";
import { loadTableSource } from "@/lib/export/load-table";
import { loadSetAsideStatus } from "@/lib/export/set-aside-status";
import { parseShownRequest, shownCsv } from "@/lib/export/shown";
import { exportFileName, isExportTable } from "@/lib/export/tables";
import { createClient } from "@/lib/supabase/server";
import { runWithViewerToken } from "@/lib/supabase/server-viewer-token";

export const dynamic = "force-dynamic";

function refused(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

/**
 * Download CSV for one on-screen table. The body names the rows on screen in screen order,
 * the search, and the sort; the rows themselves are read again here with the table's query,
 * as the signed-in viewer and only for a brand they may open.
 */
export async function POST(request: Request, context: { params: Promise<{ table: string }> }) {
  const { table } = await context.params;
  if (!isExportTable(table)) return textFailure("This table has no download.");

  const session = await getCommandSession().catch(() => null);
  if (!session) return refused("Log in to download.", 401);
  const access = await loadClientAccess(session);
  const choice = chooseClient(access, new URL(request.url).searchParams.get("client"), defaultClientKey());
  if (!choice || choice.redirect) return refused("This download is not available for your login.", 403);

  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? null;

  const shown = parseShownRequest(await request.json().catch(() => null));
  return runWithViewerToken(token, () =>
    runWithClient(choice.clientKey, async () => {
      const read = await loadTableSource(table, shown.scope);
      if (!read.ok) return textFailure(read.message);
      const status = read.source.setAsideCheck ? await loadSetAsideStatus(read.source.setAsideCheck) : null;
      return csvResponse(shownCsv(read.source, shown, status), exportFileName(table));
    }),
  );
}
