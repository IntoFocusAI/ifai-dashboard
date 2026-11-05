import { MAX_DATA_ROWS, type ParsedSheet, type SheetFormat } from "./types";

export type ParseResult = { ok: true; sheet: ParsedSheet } | { ok: false; error: string };

type RawRecord = { line: number; cells: string[] };

function delimiterFor(text: string, fileName: string): "\t" | "," {
  const name = fileName.toLowerCase();
  if (name.endsWith(".tsv") || name.endsWith(".tab")) return "\t";
  const sample = text.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? "";
  if (name.endsWith(".csv")) {
    if (!sample.includes(",") && sample.includes("\t")) return "\t";
    return ",";
  }
  const tabs = sample.split("\t").length;
  const commas = sample.split(",").length;
  return tabs > commas ? "\t" : ",";
}

function uniqueHeaders(raw: string[]): string[] {
  const seen = new Map<string, number>();
  return raw.map((cell, index) => {
    const base = cell.trim() || `Column ${index + 1}`;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base} (${count})`;
  });
}

/** RFC-style CSV/TSV: quotes, escaped quotes, and newlines inside quotes. */
function parseRecords(text: string, delimiter: string): RawRecord[] {
  const src = text.replace(/^\uFEFF/, "");
  const records: RawRecord[] = [];
  let cells: string[] = [];
  let field = "";
  let inQuotes = false;
  let line = 1;
  let recordLine = 1;
  let atFieldStart = true;

  const pushRecord = () => {
    cells.push(field);
    field = "";
    atFieldStart = true;
    if (cells.some((cell) => cell.trim() !== "")) records.push({ line: recordLine, cells });
    cells = [];
  };

  for (let i = 0; i < src.length; i++) {
    const char = src[i];
    if (inQuotes) {
      if (char === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        if (char === "\n") line += 1;
        field += char;
      }
      continue;
    }
    if (char === '"' && atFieldStart) {
      inQuotes = true;
      atFieldStart = false;
      continue;
    }
    if (char === delimiter) {
      cells.push(field);
      field = "";
      atFieldStart = true;
      continue;
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && src[i + 1] === "\n") i += 1;
      pushRecord();
      line += 1;
      recordLine = line;
      continue;
    }
    field += char;
    atFieldStart = false;
  }
  if (field.length > 0 || cells.length > 0) pushRecord();
  return records;
}

export function parseSheet(text: string, fileName: string): ParseResult {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    return { ok: false, error: "This page reads CSV and TSV files." };
  }
  if (text.includes("\u0000")) return { ok: false, error: "This page reads CSV and TSV files." };
  if (text.trim() === "") return { ok: false, error: "This file is empty." };

  const delimiter = delimiterFor(text, fileName);
  const format: SheetFormat = delimiter === "\t" ? "tsv" : "csv";
  const records = parseRecords(text, delimiter);
  if (records.length === 0) return { ok: false, error: "This file is empty." };

  const columns = uniqueHeaders(records[0].cells);
  const data = records.slice(1);
  if (data.length === 0) return { ok: false, error: "This file has a header and no data rows." };

  const truncated = data.length > MAX_DATA_ROWS;
  const kept = truncated ? data.slice(0, MAX_DATA_ROWS) : data;
  const rows = kept.map((record) => {
    const cells: Record<string, string> = {};
    columns.forEach((column, index) => {
      cells[column] = (record.cells[index] ?? "").trim();
    });
    return { line: record.line, cells };
  });

  return { ok: true, sheet: { format, columns, rows, truncated } };
}
