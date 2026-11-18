import { isClientKey } from "@/lib/client/active-client";
import { runWithClient } from "@/lib/client/server-client";
import { csvResponse, textFailure } from "@/lib/export/http";
import { loadTableSource } from "@/lib/export/load-table";
import { loadSetAsideStatus } from "@/lib/export/set-aside-status";
import { parseShownRequest, shownCsv } from "@/lib/export/shown";
import { exportFileName, isExportTable } from "@/lib/export/tables";
import { requestMayReadClient } from "@/lib/portal/server-gate";
import { runSignedIn } from "@/lib/supabase/request-auth";

export const dynamic = "force-dynamic";

/**
 * Download CSV for one on-screen table. The body names the rows on screen in screen order,
 * the search, and the sort; the rows themselves are read again here with the table's query.
 */
export async function POST(request: Request, context: { params: Promise<{ table: string }> }) {
  const { table } = await context.params;
  if (!isExportTable(table)) return textFailure("This table has no download.");
  const url = new URL(request.url);
  const raw = url.searchParams.get("client");
  const client = isClientKey(raw) ? raw : "fender";
  // The client and account in the URL are selectors. The database decides (issue 248).
  if (!(await requestMayReadClient(url, client))) return textFailure("Sign in to download this table.");
  const shown = parseShownRequest(await request.json().catch(() => null));
  return runSignedIn(() => runWithClient(client, async () => {
    const read = await loadTableSource(table, shown.scope);
    if (!read.ok) return textFailure(read.message);
    const status = read.source.setAsideCheck ? await loadSetAsideStatus(read.source.setAsideCheck) : null;
    return csvResponse(shownCsv(read.source, shown, status), exportFileName(table));
  }));
}
