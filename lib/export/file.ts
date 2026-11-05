import { csvDocument, provenanceRows } from "@/lib/export/csv";
import type { BuiltExport, ExportProvenance } from "@/lib/export/types";

export function exportFile(table: string, provenance: ExportProvenance, header: string[], rows: string[][]): BuiltExport {
  return {
    model: { ok: true, href: `/dashboard/export/${table}`, provenance, failures: [] },
    csv: csvDocument([...provenanceRows(provenance), header, ...rows]),
  };
}

export function exportFailed(message: string): BuiltExport {
  return { model: { ok: false, message }, csv: null };
}
