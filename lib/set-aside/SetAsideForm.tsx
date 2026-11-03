"use client";

import { useId, useState, type FormEvent } from "react";
import {
  useSetAsideReasons,
  useViewerName,
  validateDone,
  validateSetAside,
  type DoneInput,
  type SetAsideInput,
  type SetAsideResult,
} from "@/lib/set-aside/set-aside";

type SetAsideFormProps = {
  checkKey: string;
  /** What is being set aside, in plain words, for the form heading. */
  subject: string;
  onSubmit: (input: Omit<SetAsideInput, "entityKey" | "entityLabel">) => Promise<SetAsideResult>;
  onCancel: () => void;
};

/** Inline form: reason (required), note, and the person's name. */
export function SetAsideForm({ checkKey, subject, onSubmit, onCancel }: SetAsideFormProps) {
  const reasons = useSetAsideReasons(checkKey);
  const rememberedName = useViewerName();
  const [reasonCode, setReasonCode] = useState("");
  const [note, setNote] = useState("");
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const id = useId();

  const currentName = name ?? rememberedName;
  const reason = reasons.find((entry) => entry.reason_code === reasonCode);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const problem = validateSetAside({ reasonCode, note, name: currentName }, reason);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    const result = await onSubmit({ reasonCode, note, name: currentName });
    setSaving(false);
    if (!result.ok) setError(result.error);
  }

  return (
    <form className="set-aside-form" onSubmit={submit} noValidate data-set-aside-form="">
      <div className="set-aside-form-head">Set aside: {subject}</div>
      <p className="set-aside-form-hint">
        Use this to come back to it later, or to leave it on purpose for a reason. It applies to this check only.
        Anyone can reopen it, and both steps are logged.
      </p>
      <label className="set-aside-field" htmlFor={`${id}-reason`}>
        <span>Reason</span>
        <select
          id={`${id}-reason`}
          value={reasonCode}
          onChange={(event) => setReasonCode(event.target.value)}
          required
          data-set-aside-reason=""
        >
          <option value="" disabled>
            {reasons.length ? "Pick a reason" : "Loading reasons…"}
          </option>
          {reasons.map((entry) => (
            <option key={entry.reason_code} value={entry.reason_code}>
              {entry.label}
            </option>
          ))}
        </select>
      </label>
      {reason?.description ? <p className="set-aside-form-hint">{reason.description}</p> : null}
      <label className="set-aside-field" htmlFor={`${id}-note`}>
        <span>Note{reason?.requires_note ? "" : " (optional)"}</span>
        <textarea
          id={`${id}-note`}
          value={note}
          maxLength={500}
          rows={2}
          onChange={(event) => setNote(event.target.value)}
          data-set-aside-note=""
        />
      </label>
      <label className="set-aside-field" htmlFor={`${id}-name`}>
        <span>Your name</span>
        <input
          id={`${id}-name`}
          value={currentName}
          maxLength={80}
          autoComplete="name"
          onChange={(event) => setName(event.target.value)}
          data-set-aside-name=""
        />
      </label>
      {error ? (
        <p className="set-aside-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="set-aside-actions">
        <button type="submit" className="cc-open-btn" disabled={saving} data-set-aside-save="">
          {saving ? "Saving…" : "Set aside"}
        </button>
        <button type="button" className="cc-undo-btn" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  );
}

type ReopenFormProps = {
  subject: string;
  onSubmit: (name: string, note: string) => Promise<SetAsideResult>;
  onCancel: () => void;
};

/** Reopen asks only for the name (prefilled) and an optional note. */
export function ReopenForm({ subject, onSubmit, onCancel }: ReopenFormProps) {
  const rememberedName = useViewerName();
  const [name, setName] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const id = useId();
  const currentName = name ?? rememberedName;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = currentName.trim();
    if (trimmed.length < 2 || trimmed.length > 80) {
      setError("Enter your name.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await onSubmit(trimmed, note);
    setSaving(false);
    if (!result.ok) setError(result.error);
  }

  return (
    <form className="set-aside-form" onSubmit={submit} noValidate data-reopen-form="">
      <div className="set-aside-form-head">Reopen: {subject}</div>
      <label className="set-aside-field" htmlFor={`${id}-name`}>
        <span>Your name</span>
        <input
          id={`${id}-name`}
          value={currentName}
          maxLength={80}
          autoComplete="name"
          onChange={(event) => setName(event.target.value)}
          data-set-aside-name=""
        />
      </label>
      <label className="set-aside-field" htmlFor={`${id}-note`}>
        <span>Note (optional)</span>
        <textarea
          id={`${id}-note`}
          value={note}
          maxLength={500}
          rows={2}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      {error ? (
        <p className="set-aside-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="set-aside-actions">
        <button type="submit" className="cc-open-btn" disabled={saving} data-reopen-save="">
          {saving ? "Saving…" : "Reopen"}
        </button>
        <button type="button" className="cc-undo-btn" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  );
}

type DoneFormProps = {
  subject: string;
  onSubmit: (input: Omit<DoneInput, "entityKey" | "entityLabel">) => Promise<SetAsideResult>;
  onCancel: () => void;
};

/** Done asks for the name (prefilled) and an optional note on what was done. */
export function DoneForm({ subject, onSubmit, onCancel }: DoneFormProps) {
  const rememberedName = useViewerName();
  const [name, setName] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const id = useId();
  const currentName = name ?? rememberedName;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const problem = validateDone({ note, name: currentName });
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    const result = await onSubmit({ note, name: currentName });
    setSaving(false);
    if (!result.ok) setError(result.error);
  }

  return (
    <form className="set-aside-form" onSubmit={submit} noValidate data-done-form="">
      <div className="set-aside-form-head">Mark done: {subject}</div>
      <p className="set-aside-form-hint">
        Use this when the issue is fixed or handled. It applies to this check only. Anyone can reopen it, and both
        steps are logged.
      </p>
      <label className="set-aside-field" htmlFor={`${id}-note`}>
        <span>What was done (optional)</span>
        <textarea
          id={`${id}-note`}
          value={note}
          maxLength={500}
          rows={2}
          onChange={(event) => setNote(event.target.value)}
          data-set-aside-note=""
        />
      </label>
      <label className="set-aside-field" htmlFor={`${id}-name`}>
        <span>Your name</span>
        <input
          id={`${id}-name`}
          value={currentName}
          maxLength={80}
          autoComplete="name"
          onChange={(event) => setName(event.target.value)}
          data-set-aside-name=""
        />
      </label>
      {error ? (
        <p className="set-aside-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="set-aside-actions">
        <button type="submit" className="cc-open-btn" disabled={saving} data-done-save="">
          {saving ? "Saving…" : "Mark done"}
        </button>
        <button type="button" className="cc-undo-btn" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  );
}
