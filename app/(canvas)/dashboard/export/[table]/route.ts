import { isClientKey } from "@/lib/client/active-client";
import { runWithClient } from "@/lib/client/server-client";
import { csvResponse, textFailure } from "@/lib/export/http";
import { loadTableExport } from "@/lib/export/load-table";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ table: string }> }) {
  const { table } = await context.params;
  const url = new URL(request.url);
  const raw = url.searchParams.get("client");
  const client = isClientKey(raw) ? raw : "fender";
  const result = await runWithClient(client, () => loadTableExport(table, url.searchParams));
  if (!result) return textFailure("This table is not exported.");
  if (!result.model.ok || result.csv == null) {
    return textFailure(result.model.ok ? "This table could not be exported." : result.model.message);
  }
  return csvResponse(result.csv, `${table}.csv`);
}
