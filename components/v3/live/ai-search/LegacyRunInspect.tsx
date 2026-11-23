"use client";

import { formatInt } from "@/lib/fender-canvas/format";
import { useAiHistory } from "@/components/v3/live/ai-search/AiHistoryContext";
import { historyFixtureSnapshot } from "@/lib/ai-search/history-fixtures";
import { cleanPrompt, engineLabel } from "@/lib/ai-search/run-metrics";
import { runStateLabel } from "@/lib/ai-search/summary";

/** Legacy rows stay out of rates. Live call text is not exposed, because anon and authenticated share SELECT. */
export function LegacyRunInspect() {
  const history = useAiHistory();
  const runId = history.mode.kind === "legacy" ? history.mode.runId : "";
  const run = history.catalog.phase === "ready" ? history.catalog.runs.find((item) => item.audit_run_id === runId) : null;
  const fixture = history.source === "fixture" ? historyFixtureSnapshot(runId) : null;
  return (
    <div data-ai-history-legacy>
      <p className="ai-history-note" data-ai-history-legacy-excluded>
        This run is excluded from headline rates and trends.
      </p>
      {run ? (
        <div className="content-box">
          <div className="content-box-title">Run summary only</div>
          <table className="table-sm">
            <tbody>
              <tr><td>State</td><td>{run.run_state ? runStateLabel(run.run_state) : "Not recorded"}</td></tr>
              <tr><td>Collector</td><td>{run.collector_version ?? "Not recorded"}</td></tr>
              <tr><td>Answered of expected</td><td>{run.answered_calls == null || run.expected_calls == null ? "Not recorded" : `${formatInt(run.answered_calls)} of ${formatInt(run.expected_calls)}`}</td></tr>
              <tr><td>Provider errors</td><td>{run.error_calls == null ? "Not recorded" : run.error_calls}</td></tr>
              <tr><td>Prompt set</td><td>{run.prompt_set_hash ?? "Not recorded"}</td></tr>
            </tbody>
          </table>
        </div>
      ) : (
        <p className="ai-history-note">That run is not in the loaded history.</p>
      )}
      {history.source === "live" ? (
        <p className="ai-history-note" data-ai-history-legacy-live>
          Call-level answers for legacy runs are not available here. The published views grant the same read to anonymous and signed-in visitors, so legacy call text stays out of the client.
        </p>
      ) : null}
      {fixture ? (
        <>
          <p className="ai-history-note">Fixture inspection lists the stored calls. They are not in the trend or the headline rates.</p>
          <ul>
            {fixture.calls.map((call) => (
              <li key={call.id}>
                {engineLabel(call.engine)}: {cleanPrompt(call.prompt)}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
