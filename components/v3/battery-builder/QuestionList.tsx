"use client";

import { ROLE_LABELS } from "@/lib/ai-search/question-role";
import type { ReviewedQuestion } from "@/lib/battery-builder/generate";

/** Roles the AI Search headline counts. Other roles run but aren't in the headline, so they get a label. */
const HEADLINE = new Set(["unbranded_discovery", "branded_consideration"]);

type Props = {
  questions: readonly ReviewedQuestion[];
  notes: readonly string[];
  selected: ReadonlySet<string>;
  onToggle: (text: string) => void;
  onSelect: (texts: string[]) => void;
};

export function QuestionList({ questions, notes, selected, onToggle, onSelect }: Props) {
  const fresh = questions.filter((q) => !q.duplicateOf);
  const already = questions.filter((q) => q.duplicateOf);

  return (
    <>
      <div className="bb-step-head">
        <h2>
          <span className="bb-step-num">3</span> Pick the questions to add
        </h2>
        {fresh.length ? (
          <div className="bb-row-actions">
            <button type="button" className="bb-link" onClick={() => onSelect(fresh.map((q) => q.text))}>
              Select all
            </button>
            <button type="button" className="bb-link" onClick={() => onSelect([])}>
              Clear
            </button>
          </div>
        ) : null}
      </div>
      {notes.map((note) => (
        <p key={note} className="bb-note">
          {note}
        </p>
      ))}
      {fresh.length === 0 && notes.length === 0 ? <p className="bb-empty">Every question here is already in the battery. Try another detail.</p> : null}
      <ul className="bb-questions">
        {fresh.map((q) => (
          <li key={q.text} className="bb-q">
            <label className="bb-q-label">
              <input type="checkbox" checked={selected.has(q.text)} onChange={() => onToggle(q.text)} />
              <span>
                <span className="bb-q-text">{q.text}</span>
                <span className="bb-q-meta">
                  <span>{q.kind === "start" ? "Starting question" : q.change}</span>
                  {HEADLINE.has(q.role) ? null : (
                    <span
                      className={`bb-tag${q.role === "other" ? " bb-tag-warn" : ""}`}
                      title={
                        q.role === "other"
                          ? "The dashboard can't tell what kind of question this is, so it won't count anywhere. Reword it."
                          : "Runs and shows on the dashboard, but isn't in the AI Search headline."
                      }
                    >
                      {ROLE_LABELS[q.role]}
                    </span>
                  )}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {already.length ? (
        <details className="bb-already">
          <summary>
            {already.length} already in the battery
          </summary>
          <ul>
            {already.map((q) => (
              <li key={q.text}>
                <span className="bb-already-key">{q.duplicateOf}</span> {q.text}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}
