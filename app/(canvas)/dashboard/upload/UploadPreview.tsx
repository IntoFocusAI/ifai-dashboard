import {
  keyColumnSentence,
  rowSummary,
} from "@/lib/upload/classify-rows";
import { DUPLICATE_REASON, ROW_STATUS_LABEL } from "@/lib/upload/labels";
import { PREVIEW_ROW_LIMIT, type Classification, type ParsedSheet } from "@/lib/upload/types";
import { UPLOAD_PAGE } from "./upload-copy";
import { UploadTerm } from "./upload-term";

type StagedCheck = "loading" | "ready" | "absent" | "error";

function otherColumns(columns: string[], keyColumn: string): string[] {
  return columns.filter((column) => column !== keyColumn).slice(0, 4);
}

export function UploadPreview({
  fileName,
  sheet,
  classification,
  stagedCheck,
  stagedError,
}: {
  fileName: string;
  sheet: ParsedSheet;
  classification: Classification;
  stagedCheck: StagedCheck;
  stagedError: string | null;
}) {
  const extras = otherColumns(sheet.columns, classification.keyColumn);
  const shown = classification.rows.slice(0, PREVIEW_ROW_LIMIT);
  const pendingShown = classification.pending.slice(0, PREVIEW_ROW_LIMIT);
  const format = sheet.format === "tsv" ? "TSV" : "CSV";

  return (
    <div className="upload-preview">
      <p className="upload-file-name">
        {fileName} · {format}
      </p>
      <p
        className="upload-summary"
        data-upload-pending-count={classification.pending.length}
        data-upload-row-count={classification.rows.length}
        data-upload-duplicate-count={classification.duplicates.length}
      >
        {rowSummary(
          classification.rows.length,
          classification.pending.length,
          classification.duplicates.length,
          classification.missingKey.length,
        )}
      </p>
      <p>{keyColumnSentence(classification.keyColumn, classification.keyFromFirstColumn)}</p>
      {sheet.truncated ? <p>Showing the first 5,000 rows.</p> : null}
      {stagedCheck === "loading" ? <p>Checking files already staged.</p> : null}
      {stagedCheck === "error" && stagedError ? <p>{stagedError}</p> : null}
      {stagedCheck === "absent" ? (
        <p data-upload-staged-check="absent">
          Already staged:{" "}
          <UploadTerm term={UPLOAD_PAGE.notAvailable} desc={UPLOAD_PAGE.notAvailableStaged}>
            {UPLOAD_PAGE.notAvailable}
          </UploadTerm>
        </p>
      ) : null}

      <section className="upload-pending" aria-labelledby="upload-pending-heading">
        <h2 id="upload-pending-heading">Pending set</h2>
        {classification.pending.length === 0 ? (
          <p>No pending rows.</p>
        ) : (
          <ul data-upload-pending-set>
            {pendingShown.map((row) => (
              <li key={row.line}>
                Row {row.line}: {row.key}
              </li>
            ))}
          </ul>
        )}
        {classification.pending.length > pendingShown.length ? (
          <p>
            Showing {pendingShown.length} of {classification.pending.length} pending rows.
          </p>
        ) : null}
      </section>

      <div className="upload-table-wrap">
        <table className="upload-table">
          <caption>Rows in this file</caption>
          <thead>
            <tr>
              <th scope="col">Row</th>
              <th scope="col">Status</th>
              <th scope="col">Key</th>
              {extras.map((column) => (
                <th key={column} scope="col">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.line} data-disposition={row.disposition} data-upload-line={row.line}>
                <td>{row.line}</td>
                <td>
                  <span className="upload-status" data-disposition={row.disposition}>
                    {ROW_STATUS_LABEL[row.disposition]}
                  </span>
                  {row.duplicateReason ? (
                    <span className="upload-reason">{DUPLICATE_REASON[row.duplicateReason]}</span>
                  ) : null}
                </td>
                <td>{row.key}</td>
                {extras.map((column) => (
                  <td key={column}>{row.cells[column] ?? ""}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {classification.rows.length > shown.length ? (
        <p>
          Showing {shown.length} of {classification.rows.length} rows.
        </p>
      ) : null}
    </div>
  );
}
