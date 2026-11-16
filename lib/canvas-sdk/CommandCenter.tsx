"use client";

import type {
  CommandCenterSpec,
  PriorityItem,
  PriorityOwner,
} from "@/lib/canvas-sdk/types";
import type { DataStatus } from "@/lib/canvas-sdk/data-status";
import { useLocalStore } from "@/lib/canvas-sdk/local-store";
import { SET_ASIDE_CHECKS } from "@/lib/set-aside/keys";
import { DoneForm, ReopenForm, SetAsideForm } from "@/lib/set-aside/SetAsideForm";
import {
  formatSetAsideDate,
  useSetAsides,
  type SetAsideRow,
} from "@/lib/set-aside/set-aside";
import { ArrowRight, Building2, Check, PauseCircle, Sparkles, Undo2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { StatusGlyph, StatusMark } from "@/components/v3/live/StatusMark";

/** Severity in the brand status colors, each with its mark and word (X-34). Moderate stays plain. */
const SEVERITY_STATUS: Record<PriorityItem["severity"], DataStatus | null> = {
  critical: "bad",
  high: "okay",
  moderate: null,
};

type ItemState = {
  owner: PriorityOwner;
  done: boolean;
};

type StoredState = Record<string, ItemState>;

const OWNER_LABEL: Record<Exclude<PriorityOwner, "unassigned">, string> = {
  intofocus: "IntoFocus AI",
  client: "Client team",
};

const EMPTY_STATE: StoredState = {};
const QUEUE_CHECK = SET_ASIDE_CHECKS.commandCenterQueue;

/** Owner chips stay per-viewer. Done is per-viewer only when no set-aside client is configured;
    with one, Done and Set aside are both stored on the server. */
function revive(raw: unknown): StoredState {
  return raw && typeof raw === "object" ? (raw as StoredState) : EMPTY_STATE;
}

type Props = {
  spec: CommandCenterSpec;
  onOpenItem: (spokeId: string, subTab?: string) => void;
};

function setAsideLine(row: SetAsideRow): string {
  const parts = [row.outcome === "done" ? "Done" : `Set aside · ${row.reason_label ?? ""}`];
  if (row.note) parts.push(row.note);
  return `${parts.join(" · ")} — ${row.set_by_name}, ${formatSetAsideDate(row.set_at)}`;
}

type FormMode = "done" | "set_aside";

export function CommandCenter({ spec, onOpenItem }: Props) {
  const storageKey = spec.storageKey ?? "ifai:command-center";
  const [state, setState, store] = useLocalStore<StoredState>(
    storageKey,
    EMPTY_STATE,
    revive,
  );
  const setAsides = useSetAsides(spec.setAsideClientKey, QUEUE_CHECK);
  const serverSetAside = setAsides.enabled;
  const [formFor, setFormFor] = useState<{ id: string; mode: FormMode } | null>(null);
  const toggleForm = (id: string, mode: FormMode) =>
    setFormFor((current) => (current?.id === id && current.mode === mode ? null : { id, mode }));
  const [reopenFor, setReopenFor] = useState<string | null>(null);

  const itemState = useCallback(
    (item: PriorityItem): ItemState => {
      const local = state[item.id] ?? { owner: item.defaultOwner ?? "unassigned", done: false };
      return serverSetAside ? { ...local, done: setAsides.active.has(item.id) } : local;
    },
    [state, serverSetAside, setAsides.active],
  );

  const update = useCallback(
    (item: PriorityItem, patch: Partial<ItemState>) => {
      const current = store.getSnapshot()[item.id] ?? {
        owner: item.defaultOwner ?? "unassigned",
        done: false,
      };
      setState({
        ...store.getSnapshot(),
        [item.id]: { ...current, ...patch },
      });
    },
    [setState, store],
  );

  const { open, done, doneCount, setAsideCount, counts } = useMemo(() => {
    const openItems: PriorityItem[] = [];
    const doneItems: PriorityItem[] = [];
    let critical = 0;
    let ours = 0;
    let theirs = 0;
    for (const item of spec.items) {
      const current = itemState(item);
      if (current.done) {
        doneItems.push(item);
        continue;
      }
      openItems.push(item);
      if (item.severity === "critical") critical += 1;
      if (current.owner === "intofocus") ours += 1;
      if (current.owner === "client") theirs += 1;
    }
    const doneOnly = serverSetAside
      ? doneItems.filter((item) => setAsides.active.get(item.id)?.outcome === "done").length
      : doneItems.length;
    return {
      open: openItems,
      done: doneItems,
      doneCount: doneOnly,
      setAsideCount: doneItems.length - doneOnly,
      counts: { critical, ours, theirs, cleared: doneItems.length },
    };
  }, [itemState, spec.items, serverSetAside, setAsides.active]);

  /* Reopened entries for items still in today's queue, newest first. */
  const reopened = useMemo(() => {
    if (!serverSetAside) return [];
    const ids = new Set(spec.items.map((item) => item.id));
    return setAsides.rows.filter((row) => row.status === "reopened" && ids.has(row.entity_key));
  }, [serverSetAside, setAsides.rows, spec.items]);

  const statusSummary = serverSetAside
    ? `${doneCount} done · ${setAsideCount} set aside`
    : `${counts.cleared} cleared`;

  return (
    <div className="command-center">
      {spec.summary ? (
        <div className="cc-summary">
          <div className="cc-summary-head">
            <Sparkles size={13} />
            <span>Today&apos;s read</span>
          </div>
          <p className="cc-summary-body">{spec.summary}</p>
        </div>
      ) : null}

      <div className="cc-quadrants">
        <div className="cc-quadrant cc-quadrant-critical">
          <span className="cc-quadrant-val">{counts.critical}</span>
          <span className="cc-quadrant-label">
            <StatusGlyph status="bad" /> Critical open
          </span>
        </div>
        <div className="cc-quadrant">
          <span className="cc-quadrant-val">{open.length}</span>
          <span className="cc-quadrant-label">Total in queue</span>
        </div>
        <div className="cc-quadrant">
          <span className="cc-quadrant-val">{counts.ours}</span>
          <span className="cc-quadrant-label">On IntoFocus AI</span>
        </div>
        <div className="cc-quadrant">
          <span className="cc-quadrant-val">{counts.theirs}</span>
          <span className="cc-quadrant-label">On client team</span>
        </div>
      </div>

      <div className="cc-list-head">
        <span>What to worry about today</span>
        <span className="cc-list-count">
          {statusSummary} · {open.length} open
        </span>
      </div>

      {setAsides.error ? (
        <p className="set-aside-error" role="status">
          Set-asides could not load: {setAsides.error}
        </p>
      ) : null}

      {open.length === 0 ? (
        <p className="cc-empty">
          Queue is clear. New priorities appear here as each scan lands.
        </p>
      ) : null}

      {open.map((item, idx) => {
        const current = itemState(item);
        return (
          <article key={item.id} className={`cc-item cc-sev-${item.severity}`}>
            <header className="cc-item-head">
              <span className="cc-rank">{idx + 1}</span>
              <div className="cc-item-title-wrap">
                <h4 className="cc-item-title">{item.title}</h4>
                <span className={`cc-sev-badge cc-sev-badge-${item.severity}`}>
                  {SEVERITY_STATUS[item.severity] ? (
                    <StatusMark status={SEVERITY_STATUS[item.severity]!} word={item.severity} />
                  ) : (
                    item.severity
                  )}
                </span>
              </div>
            </header>

            <div className="cc-why">
              <span className="cc-why-label">Why it is at the top of the list</span>
              <p>{item.why}</p>
            </div>

            {item.impact ? <div className="cc-impact">{item.impact}</div> : null}

            <footer className="cc-item-foot">
              <div className="cc-owner-group" role="group" aria-label="Assign owner">
                <button
                  type="button"
                  className={`cc-owner-btn${current.owner === "intofocus" ? " active" : ""}`}
                  onClick={() =>
                    update(item, {
                      owner: current.owner === "intofocus" ? "unassigned" : "intofocus",
                    })
                  }
                >
                  <Sparkles size={11} />
                  {OWNER_LABEL.intofocus}
                </button>
                <button
                  type="button"
                  className={`cc-owner-btn${current.owner === "client" ? " active" : ""}`}
                  onClick={() =>
                    update(item, {
                      owner: current.owner === "client" ? "unassigned" : "client",
                    })
                  }
                >
                  <Building2 size={11} />
                  {OWNER_LABEL.client}
                </button>
                {serverSetAside ? (
                  <>
                    <button
                      type="button"
                      className="cc-owner-btn cc-done-btn"
                      aria-expanded={formFor?.id === item.id && formFor.mode === "done"}
                      data-cc-done={item.id}
                      onClick={() => toggleForm(item.id, "done")}
                    >
                      <Check size={11} />
                      Done
                    </button>
                    <button
                      type="button"
                      className="cc-owner-btn cc-done-btn"
                      aria-expanded={formFor?.id === item.id && formFor.mode === "set_aside"}
                      data-cc-set-aside={item.id}
                      onClick={() => toggleForm(item.id, "set_aside")}
                    >
                      <PauseCircle size={11} />
                      Set aside
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="cc-owner-btn cc-done-btn"
                    onClick={() => update(item, { done: true })}
                  >
                    <Check size={11} />
                    Done
                  </button>
                )}
              </div>

              {item.spokeId ? (
                <button
                  type="button"
                  className="cc-open-btn"
                  onClick={() => onOpenItem(item.spokeId as string, item.subTab)}
                >
                  Open details
                  <ArrowRight size={12} />
                </button>
              ) : null}
            </footer>

            {serverSetAside && formFor?.id === item.id && formFor.mode === "done" ? (
              <DoneForm
                subject={item.title}
                onCancel={() => setFormFor(null)}
                onSubmit={async (input) => {
                  const result = await setAsides.markDone({
                    ...input,
                    entityKey: item.id,
                    entityLabel: item.title,
                  });
                  if (result.ok) setFormFor(null);
                  return result;
                }}
              />
            ) : null}

            {serverSetAside && formFor?.id === item.id && formFor.mode === "set_aside" ? (
              <SetAsideForm
                checkKey={QUEUE_CHECK}
                subject={item.title}
                onCancel={() => setFormFor(null)}
                onSubmit={async (input) => {
                  const result = await setAsides.setAside({
                    ...input,
                    entityKey: item.id,
                    entityLabel: item.title,
                  });
                  if (result.ok) setFormFor(null);
                  return result;
                }}
              />
            ) : null}
          </article>
        );
      })}

      {done.length || reopened.length ? (
        <details className="cc-cleared" data-cc-set-aside-history="">
          <summary>
            {serverSetAside
              ? `${statusSummary}${reopened.length ? ` · ${reopened.length} reopened` : ""}`
              : `${done.length} cleared this session`}
          </summary>
          {done.map((item) => {
            const row = setAsides.active.get(item.id);
            return (
              <div key={item.id} className="cc-cleared-entry">
                <div className="cc-cleared-row">
                  <span className="cc-cleared-text">
                    <span>{item.title}</span>
                    {row ? <span className="cc-cleared-meta">{setAsideLine(row)}</span> : null}
                  </span>
                  <button
                    type="button"
                    className="cc-undo-btn"
                    data-cc-reopen={item.id}
                    onClick={() =>
                      row
                        ? setReopenFor((id) => (id === item.id ? null : item.id))
                        : update(item, { done: false })
                    }
                  >
                    <Undo2 size={11} />
                    Reopen
                  </button>
                </div>
                {row && reopenFor === item.id ? (
                  <ReopenForm
                    subject={item.title}
                    onCancel={() => setReopenFor(null)}
                    onSubmit={async (name, note) => {
                      const result = await setAsides.reopen(row, name, note);
                      if (result.ok) setReopenFor(null);
                      return result;
                    }}
                  />
                ) : null}
              </div>
            );
          })}
          {reopened.map((row) => (
            <div key={row.id} className="cc-cleared-row">
              <span className="cc-cleared-text">
                <span>{row.entity_label ?? row.entity_key}</span>
                <span className="cc-cleared-meta">
                  Reopened by {row.reopened_by_name}, {formatSetAsideDate(row.reopened_at)}
                  {row.reopen_note ? ` · ${row.reopen_note}` : ""}. Was: {setAsideLine(row)}
                </span>
              </span>
            </div>
          ))}
        </details>
      ) : null}
    </div>
  );
}
