/** A catalog sheet or a MAP sheet. The two kinds are staged separately. */
export type UploadKind = "catalog" | "map";

export type SheetFormat = "csv" | "tsv";

export type ParsedSheet = {
  format: SheetFormat;
  columns: string[];
  rows: Array<{ line: number; cells: Record<string, string> }>;
  /** True when the file has more data rows than this page classifies. */
  truncated: boolean;
};

export type DuplicateReason = "in_file" | "staged";

export type RowDisposition = "pending" | "duplicate" | "missing_key";

export type ClassifiedRow = {
  line: number;
  /** The key as it appears in the file, trimmed. */
  key: string;
  cells: Record<string, string>;
  disposition: RowDisposition;
  duplicateReason: DuplicateReason | null;
};

export type Classification = {
  keyColumn: string;
  /** True when the file has no recognized product-key header. */
  keyFromFirstColumn: boolean;
  rows: ClassifiedRow[];
  pending: ClassifiedRow[];
  duplicates: ClassifiedRow[];
  missingKey: ClassifiedRow[];
};

/** Pending rows are the set that can be staged. Duplicates stay in the file record only. */
export type StagedPayload = {
  keyColumn: string;
  columns: string[];
  pending: Array<{ line: number; key: string; cells: Record<string, string> }>;
  duplicates: Array<{ line: number; key: string; reason: DuplicateReason; cells: Record<string, string> }>;
};

export type StagedStatus = "pending" | "approved";

export type StagedUpload = {
  id: string;
  kind: UploadKind;
  file_name: string;
  status: StagedStatus;
  payload: StagedPayload;
  created_by_name: string | null;
  created_at: string;
  approved_by_name: string | null;
  approved_at: string | null;
};

export const STAGED_TABLE = "staged_sheet_uploads";

export const PREVIEW_ROW_LIMIT = 100;
export const MAX_DATA_ROWS = 5000;
export const MAX_FILE_BYTES = 5_000_000;
