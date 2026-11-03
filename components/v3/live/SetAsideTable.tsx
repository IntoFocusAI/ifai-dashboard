"use client";

import { useState } from "react";
import type { RetailColumn } from "@/components/v3/live/ResizableTable";
import { formatInt } from "@/lib/fender-canvas/format";
import { FMIC_CLIENT_KEY } from "@/lib/set-aside/keys";
import { DoneForm, ReopenForm, SetAsideForm } from "@/lib/set-aside/SetAsideForm";
import { formatSetAsideDate, outcomeLabel, useSetAsides, type SetAsideRow } from "@/lib/set-aside/set-aside";

/* Listing-level Done and Set aside for any check table (worker 18.5).

   A table adds SET_ASIDE_COLUMN, renders <SetAsideCell> as its last cell and
   <SetAsideFormRow> after the row, and puts <SetAsideHistory> under the table.
   Done and set-aside rows stay in the table and in every count: the chip says
   what the team decided. They are not removed from the figures, because the
   data still flags them until the next refresh shows otherwise. */

/** Not sortable: a set-aside is an overlay on the check, not a field of its read. */
export const SET_ASIDE_COLUMN: RetailColumn = {
  id: "setaside",
  name: "Status",
  label: "Status",
  width: 190,
  minWidth: 150,
};

export type FormMode = "done" | "set_aside";

export type CheckSetAsides = ReturnType<typeof useSetAsides> & {
  checkKey: string;
  /** Plain name of the check for form headings, e.g. "Amazon Specs". */
  checkName: string;
  formFor: { key: string; mode: FormMode } | null;
  toggleForm: (entityKey: string, mode: FormMode) => void;
  closeForm: () => void;
};

export function useCheckSetAsides(checkKey: string, checkName: string): CheckSetAsides {
  const setAsides = useSetAsides(FMIC_CLIENT_KEY, checkKey);
  const [formFor, setFormFor] = useState<{ key: string; mode: FormMode } | null>(null);
  return {
    ...setAsides,
    checkKey,
    checkName,
    formFor,
    toggleForm: (entityKey, mode) =>
      setFormFor((current) =>
        current?.key === entityKey && current.mode === mode ? null : { key: entityKey, mode },
      ),
    closeForm: () => setFormFor(null),
  };
}

export function setAsideTitle(row: SetAsideRow): string {
  const note = row.note ? ` · ${row.note}` : "";
  const who = `${row.set_by_name}, ${formatSetAsideDate(row.set_at)}.`;
  if (row.outcome === "done") return `Done${note}. Marked done by ${who}`;
  return `${row.reason_label ?? "Set aside"}${note}. Set aside by ${who}`;
}

/** The last cell of a check row: a chip when done or set aside, otherwise the two buttons. */
export function SetAsideCell({
  ctl,
  entityKey,
  canSetAside = true,
}: {
  ctl: CheckSetAsides;
  entityKey: string;
  /** False when the row has nothing to set aside (or no valid id). */
  canSetAside?: boolean;
}) {
  const active = ctl.active.get(entityKey);
  return (
    <td>
      {active ? (
        <span
          className={`tag-badge ${active.outcome === "done" ? "tag-success" : "tag-neutral"} set-aside-chip`}
          title={setAsideTitle(active)}
          data-set-aside-chip={entityKey}
          data-outcome={active.outcome}
        >
          {outcomeLabel(active)}
        </span>
      ) : canSetAside && ctl.enabled ? (
        <span className="set-aside-buttons">
          <button
            type="button"
            className="cc-undo-btn"
            aria-expanded={ctl.formFor?.key === entityKey && ctl.formFor.mode === "done"}
            data-done-open={entityKey}
            onClick={() => ctl.toggleForm(entityKey, "done")}
          >
            Done
          </button>
          <button
            type="button"
            className="cc-undo-btn"
            aria-expanded={ctl.formFor?.key === entityKey && ctl.formFor.mode === "set_aside"}
            data-set-aside-open={entityKey}
            onClick={() => ctl.toggleForm(entityKey, "set_aside")}
          >
            Set aside
          </button>
        </span>
      ) : null}
    </td>
  );
}

/** Full-width row under a check row while its form is open. */
export function SetAsideFormRow({
  ctl,
  entityKey,
  entityLabel,
  colSpan,
}: {
  ctl: CheckSetAsides;
  entityKey: string;
  entityLabel?: string | null;
  colSpan: number;
}) {
  if (ctl.formFor?.key !== entityKey || ctl.active.has(entityKey)) return null;
  const subject = `${entityLabel || entityKey} on ${ctl.checkName}`;
  return (
    <tr className="set-aside-form-row">
      <td colSpan={colSpan}>
        {ctl.formFor.mode === "done" ? (
          <DoneForm
            subject={subject}
            onCancel={ctl.closeForm}
            onSubmit={async (input) => {
              const result = await ctl.markDone({ ...input, entityKey, entityLabel: entityLabel ?? null });
              if (result.ok) ctl.closeForm();
              return result;
            }}
          />
        ) : (
          <SetAsideForm
            checkKey={ctl.checkKey}
            subject={subject}
            onCancel={ctl.closeForm}
            onSubmit={async (input) => {
              const result = await ctl.setAside({ ...input, entityKey, entityLabel: entityLabel ?? null });
              if (result.ok) ctl.closeForm();
              return result;
            }}
          />
        )}
      </td>
    </tr>
  );
}

function entityDisplay(row: SetAsideRow) {
  if (row.entity_type === "asin") {
    return (
      <>
        <span className="asin-chip">{row.entity_key}</span> {row.entity_label ?? ""}
      </>
    );
  }
  if (row.entity_type === "url") {
    return (
      <>
        {row.entity_label ? <strong>{row.entity_label}</strong> : null}{" "}
        <a className="listing-link" href={row.entity_key} target="_blank" rel="noopener noreferrer">
          {row.entity_key.replace(/^https?:\/\/(www\.)?/, "")}
        </a>
      </>
    );
  }
  return <>{row.entity_label ?? row.entity_key}</>;
}

/** Every Done and set-aside on this check, active first, with Reopen on the active ones. */
export function SetAsideHistory({ ctl }: { ctl: CheckSetAsides }) {
  const [reopenFor, setReopenFor] = useState<string | null>(null);
  if (!ctl.rows.length && !ctl.error) return null;
  const active = ctl.rows.filter((row) => row.status === "active");
  const done = active.filter((row) => row.outcome === "done");
  const setAside = active.filter((row) => row.outcome !== "done");
  const reopened = ctl.rows.filter((row) => row.status === "reopened");

  return (
    <details
      className="content-box cc-cleared"
      style={{ marginTop: 12 }}
      data-set-aside-history={ctl.checkKey}
    >
      <summary>
        Done and set aside on {ctl.checkName}: {formatInt(done.length)} done · {formatInt(setAside.length)} set
        aside
        {reopened.length ? ` · ${formatInt(reopened.length)} reopened` : ""}
      </summary>
      {ctl.error ? <p className="set-aside-error">Statuses could not load: {ctl.error}</p> : null}
      <p className="set-aside-form-hint">
        Done and set-aside rows stay in the table and in the figures above until the data stops flagging them. They
        are marked so the team knows what was decided.
      </p>
      {[...setAside, ...done, ...reopened].map((row) => (
        <div key={row.id} className="cc-cleared-entry">
          <div className="cc-cleared-row">
            <span className="cc-cleared-text">
              <span>{entityDisplay(row)}</span>
              <span className="cc-cleared-meta">
                {row.status === "reopened"
                  ? `Reopened by ${row.reopened_by_name}, ${formatSetAsideDate(row.reopened_at)}${row.reopen_note ? ` · ${row.reopen_note}` : ""}. Was: `
                  : ""}
                {setAsideTitle(row)}
              </span>
            </span>
            {row.status === "active" ? (
              <button
                type="button"
                className="cc-undo-btn"
                data-set-aside-reopen={row.entity_key}
                onClick={() => setReopenFor((id) => (id === row.id ? null : row.id))}
              >
                Reopen
              </button>
            ) : null}
          </div>
          {reopenFor === row.id ? (
            <ReopenForm
              subject={`${row.entity_label || row.entity_key} on ${ctl.checkName}`}
              onCancel={() => setReopenFor(null)}
              onSubmit={async (name, note) => {
                const result = await ctl.reopen(row, name, note);
                if (result.ok) setReopenFor(null);
                return result;
              }}
            />
          ) : null}
        </div>
      ))}
    </details>
  );
}
