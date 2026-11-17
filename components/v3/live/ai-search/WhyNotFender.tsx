"use client";

import { mutedText } from "@/components/v3/live/ai-search/AiReadGate";
import { ExternalLink } from "@/components/v3/live/ai-search/ExternalLink";
import { answerCopy, useAnswerText } from "@/components/v3/live/ai-search/useAnswerText";
import type { CitationEvidence } from "@/lib/ai-search/citations";
import { answerLookupId, whyNotBrand } from "@/lib/ai-search/why-not-brand";
import type { AiCallRow } from "@/lib/ai-search/types";

/** One plain sentence about a competitor-led answer, then its cited pages and the stored answer on demand. */
export function WhyNotFender({ row, pages }: { row: AiCallRow; pages: CitationEvidence[] }) {
  const lookup = answerLookupId(row.id);
  const stored = lookup === null || row.answer_text !== undefined ? (row.answer_text ?? null) : undefined;
  const answer = useAnswerText(lookup ?? row.id, stored);
  const view = whyNotBrand({
    answerText: answer.status === "ready" ? answer.text : null,
    winner: row.primary_brand,
    pages: pages.map((page) => ({ href: page.rawUrl, label: page.title || page.domain })),
  });

  return (
    <div className="ai-why-not" data-ai-why-not={row.id}>
      <p className="ai-why-not-summary" data-ai-why-summary>
        {view.summary}
      </p>
      {view.pages.length ? (
        <details>
          <summary>{view.pages.length === 1 ? "1 cited page" : `${view.pages.length} cited pages`}</summary>
          <ul className="ai-why-not-pages">
            {view.pages.map((page) => (
              <li key={page.href} data-ai-why-page={page.href}>
                <ExternalLink href={page.href}>{page.label}</ExternalLink>
                <span className="ai-why-not-owner">{page.owner}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <details>
        <summary>Stored answer</summary>
        <p style={{ ...mutedText, whiteSpace: "pre-wrap", margin: "4px 0 0" }} data-ai-why-answer>
          {answer.status === "ready" && view.answer
            ? view.answer
            : answerCopy(answer, "No answer text was stored for this call.")}
        </p>
      </details>
    </div>
  );
}
