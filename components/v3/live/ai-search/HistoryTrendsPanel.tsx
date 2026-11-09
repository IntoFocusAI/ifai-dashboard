"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useAiHistory } from "@/components/v3/live/ai-search/AiHistoryContext";
import { READ_ERROR_TITLE } from "@/components/v3/live/ai-search/AiReadGate";
import { CopyTip } from "@/components/v3/live/ai-search/CopyTip";
import { useEngineGroupWindow } from "@/components/v3/live/ai-search/EngineGroupScope";
import { HistoryPointDetail } from "@/components/v3/live/ai-search/HistoryPointDetail";
import { HistoryTrendChart } from "@/components/v3/live/ai-search/HistoryTrendChart";
import { AiTerm } from "@/components/v3/live/ai-search/AiTerm";
import { formatDay, utcDay } from "@/lib/ai-search/history-eligibility";
import { batteryGaps } from "@/lib/ai-search/prompt-battery";
import { SCORING_LABELS, scoringLabel } from "@/lib/ai-search/review-runs";
import {
  boundaryLabel,
  buildHistoryTrend,
  coverageLabel,
  ONE_RUN_TREND_MESSAGE,
  queryChoices,
  rateLabel,
  type QueryChoice,
  type TrendMetric,
} from "@/lib/ai-search/history-trends";
import { ROLE_LABELS } from "@/lib/ai-search/question-role";
import { engineLabel, cleanPrompt } from "@/lib/ai-search/run-metrics";

function choiceValue(choice: QueryChoice): string {
  if (choice.kind === "all") return "all";
  if (choice.kind === "lineage") return `lineage:${choice.promptKey}`;
  return `version:${choice.versionKey}`;
}

function choiceLabel(choice: QueryChoice): string {
  if (choice.kind === "all") return "All questions in this rate";
  if (choice.kind === "lineage") return `All wordings of ${choice.promptKey}`;
  const text = cleanPrompt(choice.promptText);
  return text.length > 72 ? `${text.slice(0, 69)}...` : text;
}

export function HistoryTrendsPanel() {
  const history = useAiHistory();
  const [metric, setMetric] = useState<TrendMetric>("unbranded_discovery");
  const [breakdown, setBreakdown] = useState<"overall" | "engine">("overall");
  const [query, setQuery] = useState<QueryChoice>({ kind: "all" });
  const [picked, setPicked] = useState<{ runId: string; seriesKey: string } | null>(null);
  const { trend, apiDays, runCount } = useEngineGroupWindow();
  const { from, to } = history.bounds;

  const model = useMemo(() => {
    if (trend.phase !== "ready") return null;
    return buildHistoryTrend({
      snapshots: trend.snapshots,
      metric,
      breakdown,
      fromDay: from,
      toDay: to,
      query,
    });
  }, [breakdown, from, trend, metric, query, to]);

  const choices = useMemo(
    () => (trend.phase === "ready" ? queryChoices(trend.snapshots, metric) : [{ kind: "all" as const }]),
    [trend, metric],
  );

  let body: ReactNode = null;
  if (history.catalog.phase === "loading" || trend.phase === "loading") {
    body = <p className="ai-history-note" data-ai-history-state="loading">Loading run history.</p>;
  } else if (history.catalog.phase === "error") {
    body = (
      <p className="ai-history-note" data-ai-history-state="error">
        Run history{" "}
        <CopyTip label={READ_ERROR_TITLE} description={history.catalog.message}>
          did not load
        </CopyTip>
        .
      </p>
    );
  } else if (trend.phase === "error") {
    body = (
      <p className="ai-history-note" data-ai-history-state="error">
        The runs in this period{" "}
        <CopyTip label={READ_ERROR_TITLE} description={trend.message}>
          did not load
        </CopyTip>
        . No trend line is drawn.
      </p>
    );
  } else if (trend.phase === "unavailable") {
    body = (
      <p className="ai-history-note" data-ai-history-state="unavailable">
        {trend.message} No trend line is drawn.
      </p>
    );
  } else if (runCount === 1 || model?.status === "one-run") {
    body = (
      <p className="ai-history-note" data-ai-history-state="one-run">
        {runCount === 1 ? ONE_RUN_TREND_MESSAGE : model?.message ?? ONE_RUN_TREND_MESSAGE}
      </p>
    );
  } else if (runCount === 0 || model?.status === "empty") {
    body = <p className="ai-history-note" data-ai-history-state="empty">No review run falls in this range.</p>;
  } else if (model?.status === "ready") {
    const active = model.series.flatMap((series) => series.points.map((point) => ({ point, series }))).find(
      (item) => item.point.runId === picked?.runId && item.series.key === picked?.seriesKey,
    );
    const snapshot = trend.phase === "ready"
      ? trend.snapshots.find((item) => item.run.audit_run_id === active?.point.runId) ?? null
      : null;
    body = (
      <>
        <HistoryTrendChart
          model={model}
          activeKey={active ? `${active.point.runId}:${active.series.key}` : null}
          onPick={(point, seriesKey) => setPicked({ runId: point.runId, seriesKey })}
        />
        {model.boundaries.map((boundary) => (
          <div
            key={`${boundary.afterRunId}-${boundary.beforeRunId}`}
            className="ai-history-boundary"
            data-ai-history-boundary={boundary.scoringMethodChanged && !boundary.promptSetChanged && !boundary.queryVersionChanged ? "scoring" : "question"}
          >
            <strong>
              {boundary.scoringMethodChanged ? "Scoring method changed. " : null}
              {boundary.promptSetChanged ? <AiTerm term="question set">Question set changed</AiTerm> : null}
              {boundary.promptSetChanged && boundary.queryVersionChanged ? ". " : null}
              {boundary.queryVersionChanged ? <AiTerm term="query version">Question wording changed</AiTerm> : null}
              {!boundary.promptSetChanged && !boundary.queryVersionChanged && !boundary.scoringMethodChanged ? boundaryLabel(boundary) : null}
            </strong>
            <p>
              {boundary.scoringMethodChanged
                ? `${formatDay(boundary.afterDay)} uses ${
                    scoringLabel(trend.phase === "ready" ? trend.snapshots.find((item) => item.run.audit_run_id === boundary.afterRunId)?.run ?? {} : {}) ?? SCORING_LABELS.original_winner
                  }. ${formatDay(boundary.beforeDay)} uses ${
                    scoringLabel(trend.phase === "ready" ? trend.snapshots.find((item) => item.run.audit_run_id === boundary.beforeRunId)?.run ?? {} : {}) ?? SCORING_LABELS.mention_share
                  }. The line can connect these runs. The rates were not scored the same way.`
                : `${formatDay(boundary.afterDay)} to ${formatDay(boundary.beforeDay)}. Open the questions on each side before comparing the rates.`}
            </p>
            <details>
              <summary>Questions before and after</summary>
              <div>
                <p>Before</p>
                <ul>
                  {boundary.beforeQuestions.map((question) => (
                    <li key={question.versionKey}>{cleanPrompt(question.promptText)}</li>
                  ))}
                </ul>
                <p>After</p>
                <ul>
                  {boundary.afterQuestions.map((question) => (
                    <li key={question.versionKey}>{cleanPrompt(question.promptText)}</li>
                  ))}
                </ul>
              </div>
            </details>
          </div>
        ))}
        <table className="table-sm ai-history-table">
          <thead>
            <tr>
              <th>Run</th>
              <th>Series</th>
              <th>Rate</th>
              <th>Outside the rate</th>
            </tr>
          </thead>
          <tbody>
            {model.series.flatMap((series) =>
              series.points.map((point) => (
                <tr key={`${point.runId}:${series.key}`} data-ai-trend-row={`${point.runId}:${series.key}`}>
                  <td>
                    {formatDay(point.day)}
                    {point.partial ? " · Partial" : ""}
                    {point.notStored > 0 ? " · Partial coverage" : ""}
                    {point.scoringMethod ? ` · ${SCORING_LABELS[point.scoringMethod]}` : ""}
                    {apiDays.get(point.runId)?.map((day) => ` · API run ${formatDay(day)}`)}
                  </td>
                  <td>{series.label}</td>
                  <td>{rateLabel(point)}</td>
                  <td>{coverageLabel(point)}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
        {trend.phase === "ready"
          ? trend.snapshots.flatMap((snapshot) => {
              const day = utcDay(snapshot.run.published_at ?? snapshot.run.completed_at);
              return batteryGaps(snapshot.calls).map((gap) => (
                <p key={`${snapshot.run.audit_run_id}:${gap.promptKey}:${gap.engine}`} data-ai-history-gap={`${gap.promptKey}:${gap.engine}`}>
                  {day ? formatDay(day) : "This run"} {engineLabel(gap.engine)} was not stored: {gap.promptText}
                </p>
              ));
            })
          : null}
        {active && snapshot ? (
          <HistoryPointDetail snapshot={snapshot} point={active.point} metric={metric} query={query} />
        ) : (
          <p className="ai-history-note">Choose a point to see the calls behind it.</p>
        )}
      </>
    );
  }

  return (
    <div data-ai-history-trends>
      <div className="ai-history-toggles">
        <div className="segmented-control" role="group" aria-label="Rate">
          {(["unbranded_discovery", "branded_consideration"] as const).map((role) => (
            <button
              key={role}
              type="button"
              className={`segmented-btn${metric === role ? " active" : ""}`}
              aria-pressed={metric === role}
              onClick={() => {
                setMetric(role);
                setQuery({ kind: "all" });
                setPicked(null);
              }}
            >
              {ROLE_LABELS[role]}
            </button>
          ))}
        </div>
        <div className="segmented-control" role="group" aria-label="Breakdown">
          <button type="button" className={`segmented-btn${breakdown === "overall" ? " active" : ""}`} aria-pressed={breakdown === "overall"} onClick={() => setBreakdown("overall")}>
            Overall
          </button>
          <button type="button" className={`segmented-btn${breakdown === "engine" ? " active" : ""}`} aria-pressed={breakdown === "engine"} onClick={() => setBreakdown("engine")}>
            By engine
          </button>
        </div>
      </div>
      <p className="ai-history-note">
        <AiTerm term="provider error">Provider errors</AiTerm> and <AiTerm term="no clear leader">unresolved answers</AiTerm> stay outside both rates.
      </p>
      <label className="ai-history-query">
        Question
        <select
          value={choiceValue(query)}
          aria-label="Question version"
          onChange={(event) => {
            const next = choices.find((choice) => choiceValue(choice) === event.target.value) ?? { kind: "all" as const };
            setQuery(next);
            setPicked(null);
          }}
        >
          {choices.map((choice) => (
            <option key={choiceValue(choice)} value={choiceValue(choice)}>
              {choiceLabel(choice)}
            </option>
          ))}
        </select>
      </label>
      {body}
    </div>
  );
}
