import type { ExportProvenance } from "@/lib/export/types";

/** Quote a CSV cell when it contains a comma, quote, or line break. */
export function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

export function csvDocument(rows: readonly (readonly string[])[]): string {
  return `${rows.map((row) => row.map((value) => csvCell(value)).join(",")).join("\n")}\n`;
}

/** The four facts each export states, as their own rows ahead of the table. */
export function provenanceRows(provenance: ExportProvenance): string[][] {
  return [
    ["Filter", provenance.filter],
    ["Sort", provenance.sort],
    ["As of", provenance.asOf],
    ["Population", provenance.population],
  ];
}
