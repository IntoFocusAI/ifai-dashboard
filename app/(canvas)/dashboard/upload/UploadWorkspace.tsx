"use client";

import { useEffect, useState } from "react";
import { nameProblem } from "@/lib/upload/approval";
import { classifySheet, toStagedPayload } from "@/lib/upload/classify-rows";
import { formatUploadWhen } from "@/lib/upload/format-when";
import {
  approveUpload,
  loadStaging,
  savePendingUpload,
  stagedKeysFor,
  type StagingLookup,
} from "@/lib/upload/staged-store";
import { MAX_FILE_BYTES, type ParsedSheet, type StagedUpload, type UploadKind } from "@/lib/upload/types";
import { parseSheet } from "@/lib/upload/parse-sheet";
import { UPLOAD_PAGE } from "./upload-copy";
import { UploadPreview } from "./UploadPreview";
import { UploadStagedList } from "./UploadStagedList";
import { UploadTerm } from "./upload-term";

const NO_UPLOADS: StagedUpload[] = [];

type SaveState =
  | { state: "idle" }
  | { state: "saving" }
  | { state: "saved" }
  | { state: "absent" }
  | { state: "error"; message: string };

type ApproveState =
  | { state: "idle" }
  | { state: "saving" }
  | { state: "approved"; name: string }
  | { state: "absent" }
  | { state: "needs-save" }
  | { state: "error"; message: string };

export function UploadWorkspace() {
  const [kind, setKind] = useState<UploadKind>("catalog");
  const [name, setName] = useState("");
  const [fileName, setFileName] = useState("");
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [lookup, setLookup] = useState<StagingLookup | { state: "loading" }>({ state: "loading" });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ state: "idle" });
  const [approveState, setApproveState] = useState<ApproveState>({ state: "idle" });

  useEffect(() => {
    let cancelled = false;
    void loadStaging(kind).then((result) => {
      if (!cancelled) setLookup(result);
    });
    return () => {
      cancelled = true;
    };
  }, [kind]);

  const uploads = lookup.state === "ready" ? lookup.uploads : NO_UPLOADS;
  const stagedKeys = stagedKeysFor(uploads, kind, activeId);
  const classification = sheet ? classifySheet(sheet, stagedKeys) : null;
  const active = uploads.find((row) => row.id === activeId) ?? null;

  function chooseKind(next: UploadKind) {
    setKind(next);
    setLookup({ state: "loading" });
    setActiveId(null);
    setSaveState({ state: "idle" });
    setApproveState({ state: "idle" });
  }

  async function onFile(file: File | null) {
    setActiveId(null);
    setSaveState({ state: "idle" });
    setApproveState({ state: "idle" });
    if (!file) {
      setSheet(null);
      setFileName("");
      setParseError(null);
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setSheet(null);
      setFileName(file.name);
      setParseError("This file is larger than 5 MB.");
      return;
    }
    const parsed = parseSheet(await file.text(), file.name);
    setFileName(file.name);
    if (!parsed.ok) {
      setSheet(null);
      setParseError(parsed.error);
      return;
    }
    setParseError(null);
    setSheet(parsed.sheet);
  }

  async function onSave() {
    if (!sheet || !classification || classification.pending.length === 0 || saveState.state === "saving") return;
    setSaveState({ state: "saving" });
    const result = await savePendingUpload({
      kind,
      fileName,
      payload: toStagedPayload(sheet, classification),
      name,
    });
    if (result.state === "saved") {
      setActiveId(result.upload.id);
      setLookup((current) => {
        const rest = current.state === "ready" ? current.uploads.filter((row) => row.id !== result.upload.id) : [];
        return { state: "ready", uploads: [result.upload, ...rest] };
      });
      setSaveState({ state: "saved" });
      return;
    }
    if (result.state === "absent") setLookup({ state: "absent" });
    setSaveState(result);
  }

  async function onApprove(id: string | null) {
    const problem = nameProblem(name);
    if (problem) {
      setApproveState({ state: "error", message: problem });
      return;
    }
    if (!id) {
      setApproveState(
        lookup.state === "absent" || saveState.state === "absent" ? { state: "absent" } : { state: "needs-save" },
      );
      return;
    }
    setApproveState({ state: "saving" });
    const result = await approveUpload(id, name);
    if (result.state === "approved") {
      setLookup((current) => {
        if (current.state !== "ready") return current;
        return {
          state: "ready",
          uploads: current.uploads.map((row) => (row.id === result.upload.id ? result.upload : row)),
        };
      });
      setApproveState({ state: "approved", name: name.trim() });
      return;
    }
    if (result.state === "absent") setLookup({ state: "absent" });
    setApproveState(result);
  }

  const saveDisabled =
    !classification || classification.pending.length === 0 || saveState.state === "saving" || saveState.state === "saved";
  const approving = approveState.state === "saving";

  return (
    <div className="upload-workspace">
      <fieldset className="upload-kind">
        <legend>{UPLOAD_PAGE.kindLegend}</legend>
        <label>
          <input
            type="radio"
            name="upload-kind"
            value="catalog"
            checked={kind === "catalog"}
            onChange={() => chooseKind("catalog")}
          />
          {UPLOAD_PAGE.catalog}
        </label>
        <label>
          <input
            type="radio"
            name="upload-kind"
            value="map"
            checked={kind === "map"}
            onChange={() => chooseKind("map")}
          />
          {UPLOAD_PAGE.map}
        </label>
      </fieldset>

      <label className="upload-field">
        <span>{UPLOAD_PAGE.nameLabel}</span>
        <input
          value={name}
          autoComplete="name"
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
        />
      </label>

      <label className="upload-field">
        <span>{UPLOAD_PAGE.fileLabel}</span>
        <input
          type="file"
          accept=".csv,.tsv,.tab,.txt,text/csv,text/tab-separated-values"
          onChange={(event) => {
            void onFile(event.target.files?.[0] ?? null);
          }}
        />
      </label>

      {parseError ? <p role="alert">{parseError}</p> : null}

      {sheet && classification ? (
        <UploadPreview
          fileName={fileName}
          sheet={sheet}
          classification={classification}
          stagedCheck={lookup.state}
          stagedError={lookup.state === "error" ? lookup.message : null}
        />
      ) : null}

      {classification ? (
        <div className="upload-actions">
          <button type="button" className="upload-button upload-button-primary" disabled={saveDisabled} onClick={() => void onSave()}>
            {saveState.state === "saving" ? "Saving" : UPLOAD_PAGE.saveLabel}
          </button>
          {active?.status === "approved" ? (
            <p className="upload-approved">
              Approved by {active.approved_by_name}
              {active.approved_at ? ` · ${formatUploadWhen(active.approved_at)}` : ""}.
            </p>
          ) : (
            <button
              type="button"
              className="upload-button"
              data-upload-approve
              disabled={approving || saveState.state === "saving" || classification.pending.length === 0}
              onClick={() => void onApprove(activeId)}
            >
              {UPLOAD_PAGE.approveLabel}
            </button>
          )}
        </div>
      ) : null}

      {saveState.state === "saved" ? <p data-upload-saved="saved">Saved copy: pending.</p> : null}
      {saveState.state === "absent" ? (
        <p data-upload-saved="absent">
          Saved copy:{" "}
          <UploadTerm term={UPLOAD_PAGE.notAvailable} desc={UPLOAD_PAGE.notAvailableSaved}>
            {UPLOAD_PAGE.notAvailable}
          </UploadTerm>
        </p>
      ) : null}
      {saveState.state === "error" ? <p data-upload-saved="error">{saveState.message}</p> : null}

      {approveState.state === "absent" ? (
        <p data-upload-approval="absent">
          Approval record:{" "}
          <UploadTerm term={UPLOAD_PAGE.notAvailable} desc={UPLOAD_PAGE.notAvailableSaved}>
            {UPLOAD_PAGE.notAvailable}
          </UploadTerm>
        </p>
      ) : null}
      {approveState.state === "needs-save" ? <p data-upload-approval="needs-save">Save the pending rows first.</p> : null}
      {approveState.state === "approved" ? (
        <p data-upload-approval="approved">Approved by {approveState.name}.</p>
      ) : null}
      {approveState.state === "error" ? <p data-upload-approval="error">{approveState.message}</p> : null}

      <UploadStagedList uploads={uploads} activeId={activeId} approving={approving} onApprove={(id) => void onApprove(id)} />
    </div>
  );
}
