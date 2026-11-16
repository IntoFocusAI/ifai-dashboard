"use client";

import { CITATION_QUESTIONS, type CitationQuestion } from "@/lib/ai-search/citation-filters";

/**
 * The one question control (decision 86). It leads the control row; the counts it changes sit in
 * the figure tiles and the tables.
 */
export function CitationControlsStrip({
  question,
  onQuestion,
}: {
  question: CitationQuestion;
  onQuestion: (question: CitationQuestion) => void;
}) {
  return (
    <div className="citation-controls citation-controls-scopes" data-citation-controls>
      <div role="group" aria-label="Questions" className="citation-scope-group" data-citation-question={question}>
        {CITATION_QUESTIONS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`segmented-btn${question === value ? " active" : ""}`}
            aria-pressed={question === value}
            data-citation-question-choice={value}
            onClick={() => onQuestion(value)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
