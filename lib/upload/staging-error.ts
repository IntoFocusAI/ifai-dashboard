export type StagingError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
};

/** True when the staging table is not in the database the page can reach. */
export function isStagingTableAbsent(error: StagingError | null | undefined): boolean {
  if (!error) return false;
  const code = (error.code ?? "").toUpperCase();
  if (code === "PGRST205" || code === "42P01") return true;
  const blob = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  if (blob.includes("could not find the table")) return true;
  if (blob.includes("schema cache") && blob.includes("staged_sheet_uploads")) return true;
  if (blob.includes("relation") && blob.includes("staged_sheet_uploads") && blob.includes("does not exist")) {
    return true;
  }
  return false;
}
