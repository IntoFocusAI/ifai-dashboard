import type { DuplicateReason, RowDisposition } from "./types";

export const ROW_STATUS_LABEL: Record<RowDisposition, string> = {
  pending: "Pending",
  duplicate: "Duplicate",
  missing_key: "Missing key",
};

export const DUPLICATE_REASON: Record<DuplicateReason, string> = {
  in_file: "Repeats a key earlier in this file",
  staged: "Repeats a key already staged",
};
