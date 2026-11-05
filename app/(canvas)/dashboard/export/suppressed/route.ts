import { csvResponse, textFailure } from "@/lib/export/http";
import { loadSuppressedExport } from "@/lib/export/load-suppressed";
import { SUPPRESSED_EXPORT_FILENAME } from "@/lib/export/suppressed-export";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await loadSuppressedExport();
  if (!result.model.ok || result.csv == null) {
    return textFailure(
      result.model.ok ? "The withheld listings could not be loaded." : result.model.message,
    );
  }
  return csvResponse(result.csv, SUPPRESSED_EXPORT_FILENAME);
}
