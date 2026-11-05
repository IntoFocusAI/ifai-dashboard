import { BRIEFING_EXPORT_FILENAME } from "@/lib/export/briefing-export";
import { csvResponse, textFailure } from "@/lib/export/http";
import { loadBriefingExport } from "@/lib/export/load-briefing";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await loadBriefingExport();
  if (!result.model.ok || result.csv == null) {
    return textFailure(
      result.model.ok ? "The Summary Briefing readings could not be loaded." : result.model.message,
    );
  }
  return csvResponse(result.csv, BRIEFING_EXPORT_FILENAME);
}
