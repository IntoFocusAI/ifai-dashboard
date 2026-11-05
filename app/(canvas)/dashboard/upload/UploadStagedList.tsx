import { pendingCount } from "@/lib/upload/classify-rows";
import { formatUploadWhen } from "@/lib/upload/format-when";
import type { StagedUpload } from "@/lib/upload/types";

export function UploadStagedList({
  uploads,
  activeId,
  approving,
  onApprove,
}: {
  uploads: StagedUpload[];
  activeId: string | null;
  approving: boolean;
  onApprove: (id: string) => void;
}) {
  const others = uploads.filter((row) => row.id !== activeId);
  if (others.length === 0) return null;

  return (
    <section className="upload-staged" aria-labelledby="upload-staged-heading">
      <h2 id="upload-staged-heading">Staged files</h2>
      <ul className="upload-staged-list">
        {others.map((row) => (
          <li key={row.id}>
            <p>
              {row.file_name} · {row.status === "approved" ? "Approved" : "Pending"} · {pendingCount(row.payload)}{" "}
              pending
            </p>
            {row.status === "approved" && row.approved_by_name ? (
              <p className="upload-muted">
                Approved by {row.approved_by_name}
                {row.approved_at ? ` · ${formatUploadWhen(row.approved_at)}` : ""}
              </p>
            ) : null}
            {row.status === "pending" ? (
              <button
                type="button"
                className="upload-button"
                disabled={approving}
                onClick={() => onApprove(row.id)}
              >
                Approve {row.file_name}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
