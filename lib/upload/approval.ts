import type { StagedPayload, UploadKind } from "./types";

/** The only columns an insert into the staging table sends. Status stays pending. */
export function pendingInsert(input: {
  kind: UploadKind;
  fileName: string;
  payload: StagedPayload;
  name: string;
}) {
  const name = input.name.trim();
  return {
    kind: input.kind,
    file_name: input.fileName.trim().slice(0, 300),
    status: "pending" as const,
    payload: input.payload,
    created_by_name: name.length >= 2 ? name.slice(0, 80) : null,
  };
}

/** The only columns the approve step writes. It does not copy rows anywhere else. */
export function approvalPatch(name: string, when: string) {
  return {
    status: "approved" as const,
    approved_by_name: name.trim().slice(0, 80),
    approved_at: when,
  };
}

export function nameProblem(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 80) return "Enter your name.";
  return null;
}
