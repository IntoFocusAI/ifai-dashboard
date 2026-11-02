"use client";

import { useState } from "react";
import type { RetailColumn } from "@/components/v3/live/ResizableTable";
import { formatInt } from "@/lib/fender-canvas/format";
import { FMIC_CLIENT_KEY } from "@/lib/set-aside/keys";
import { ReopenForm, SetAsideForm } from "@/lib/set-aside/SetAsideForm";
import { formatSetAsideDate, useSetAsides, type SetAsideRow } from "@/lib/set-aside/set-aside";

/* Listing-level set-aside for any check table (worker 18.5).

   A table adds SET_ASIDE_COLUMN, renders <SetAsideCell> as its last cell and
   <SetAsideFormRow> after the row, and puts <SetAsideHistory> under the table.
   Set-aside rows stay in the table and in every count: the chip says they were
   reviewed. They are not removed from the figures. */

/** Not sortable: a set-aside is an overlay on the check, not a field of its read. */
export const SET_ASIDE_COLUMN: RetailColumn = {
  id: "setaside",
  name: "Set aside",
  label: "Set aside",
  width: 150,
  minWidth: 110,
};

export type CheckSetAsides = ReturnType<typeof useSetAsides> & {
  checkKey: string;
  /** Plain name of the check for form headings, e.g. "Amazon Specs". */
  checkName: string;
  formFor: string | null;
  toggleForm: (entityKey: string) => void;
  closeForm: () => void;
};

export function useCheckSetAsides(checkKey: string, checkName: string): CheckSetAsides {
  const setAsides = useSetAsides(FMIC_CLIENT_KEY, checkKey);
  const [formFor, setFormFor] = useState<string | null>(null);
  return {
    ...setAsides,
    checkKey,
    checkName,
    formFor,
    toggleForm: (entityKey) => setFormFor((current) => (current === entityKey ? null : entityKey)),
    closeForm: () => setFormFor(null),
  };
}

export function setAsideTitle(row: SetAsideRow): string {
  const note = row.note ? ` · ${row.note}` : "";
  return `${row.reason_label}${note}. Set aside by ${row.set_by_name}, ${formatSetAsideDate(row.set_at)}.`;
}

/** The last cell of a check row: a chip when set aside, otherwise the button. */
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
          className="tag-badge tag-neutral set-aside-chip"
          title={setAsideTitle(active)}
          data-set-aside-chip={entityKey}
        >
          Set aside · {active.reason_label}
        </span>
      ) : canSetAside && ctl.enabled ? (
        <button
          type="button"
          className="cc-undo-btn"
          aria-expanded={ctl.formFor === entityKey}
          data-set-aside-open={entityKey}
          onClick={() => ctl.toggleForm(entityKey)}
        >
          Set aside
        </button>
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
  if (ctl.formFor !== entityKey || ctl.active.has(entityKey)) return null;
  return (
    <tr className="set-aside-form-row">
      <td colSpan={colSpan}>
        <SetAsideForm
          checkKey={ctl.checkKey}
          subject={`${entityLabel || entityKey} on ${ctl.checkName}`}
          onCancel={ctl.closeForm}
          onSubmit={async (input) => {
            const result = await ctl.setAside({ ...input, entityKey, entityLabel: entityLabel ?? null });
            if (result.ok) ctl.closeForm();
            return result;
          }}
        />
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

/** Every set-aside on this check, active first, with Reopen on the active ones. */
export function SetAsideHistory({ ctl }: { ctl: CheckSetAsides }) {
  const [reopenFor, setReopenFor] = useState<string | null>(null);
  if (!ctl.rows.length && !ctl.error) return null;
  const active = ctl.rows.filter((row) => row.status === "active");
  const reopened = ctl.rows.filter((row) => row.status === "reopened");

  return (
    <details
      className="content-box cc-cleared"
      style={{ marginTop: 12 }}
      data-set-aside-history={ctl.checkKey}
    >
      <summary>
        Set aside on {ctl.checkName}: {formatInt(active.length)}
        {reopened.length ? ` · ${formatInt(reopened.length)} reopened` : ""}
      </summary>
      {ctl.error ? <p className="set-aside-error">Set-asides could not load: {ctl.error}</p> : null}
      <p className="set-aside-form-hint">
        Set-aside rows stay in the table and in the figures above. They are marked so the team knows they were
        reviewed.
      </p>
      {[...active, ...reopened].map((row) => (
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
