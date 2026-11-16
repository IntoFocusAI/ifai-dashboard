import {
  FACTOR_LABELS,
  type StaffProgramRow,
} from "@/lib/fender-canvas/actuation-records";
import {
  ACTUATION_FACTORS,
  daysBetween,
  type ActuationFactorId,
  type ActuationScore,
} from "@/lib/fender-canvas/actuation-score";
import { formatInt } from "@/lib/fender-canvas/format";

export function formatDay(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(`${iso}T00:00:00Z`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function points(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** The basis line staff read for each factor; the client figure will show the same counts and dates. */
function basisLine(id: ActuationFactorId, score: ActuationScore): string {
  const { factors } = score;
  if (id === "P1" || id === "P2") {
    const basis = factors[id].basis;
    if (!basis) return "Not in place";
    const amount =
      id === "P1"
        ? `${formatInt(basis.cadencePer30Days ?? 0)} responses per 30 days`
        : `${formatInt(basis.targetCount ?? 0)} placements per 90 days`;
    return `Verified ${formatDay(basis.verifiedOn)}, expires ${formatDay(basis.expiresOn)} · ${formatInt(basis.targetDomainCount)} target domains · ${amount}`;
  }
  if (id === "E1") {
    const result = factors.E1;
    const answers = result.basis
      ? `${formatInt(result.basis.withOwned)} of ${formatInt(result.basis.resolved)} unbranded discovery answers cite a brand page`
      : "From Citation Ecosystem";
    return result.status === "pending" ? `Pending: the E1 target is not set yet · ${answers}` : answers;
  }
  const result = factors[id];
  const program = id === "E2" ? "P1" : "P2";
  const target = result.basis.target == null ? `no target until ${program} is in place` : `target ${formatInt(result.basis.target)}`;
  return `${formatInt(result.basis.count)} verified in the last 90 days · ${target}`;
}

type DueRow = { factor: "P1" | "P2"; expiresOn: string; daysLeft: number; reminder: number | null };

/** Due soon (decision 77): in-place programs expiring within 30 days, plus lapsed ones for staff. */
function dueRows(score: ActuationScore, programs: readonly StaffProgramRow[], today: string): DueRow[] {
  const rows: DueRow[] = score.expiries.map((due) => ({ ...due }));
  for (const program of programs) {
    if (!program.expires_on || score.factors[program.factor].status === "in_place") continue;
    const daysLeft = daysBetween(today, program.expires_on);
    if (daysLeft <= 0 && daysLeft > -30) rows.push({ factor: program.factor, expiresOn: program.expires_on, daysLeft, reminder: null });
  }
  return rows.sort((a, b) => a.daysLeft - b.daysLeft);
}

function dueText(row: DueRow): string {
  if (row.daysLeft <= 0) return `Lapsed ${formatDay(row.expiresOn)}. Points dropped; verify again to restore them.`;
  const days = row.daysLeft === 1 ? "1 day" : `${row.daysLeft} days`;
  return `Expires ${formatDay(row.expiresOn)}, in ${days} (${row.reminder}-day reminder).`;
}

export function ActuationScorePanel({
  score,
  programs,
  today,
}: {
  score: ActuationScore;
  programs: readonly StaffProgramRow[];
  today: string;
}) {
  const due = dueRows(score, programs, today);
  return (
    <div className="actuation-overview">
      <section className="actuation-section" aria-labelledby="actuation-score-title" data-actuation-score={score.score}>
        <h2 id="actuation-score-title">Score from these records</h2>
        <p className="actuation-score">
          <span className="actuation-score-value">{score.score}</span>
          <span className="actuation-score-of">of 100</span>
        </p>
        <ul className="actuation-factors">
          {ACTUATION_FACTORS.map((id) => (
            <li key={id} data-actuation-factor={id}>
              <span className="actuation-factor-name">
                {id} {FACTOR_LABELS[id]}
              </span>
              <span className="actuation-factor-points">
                {points(score.factors[id].points)} of {score.factors[id].weight}
              </span>
              <span className="actuation-factor-basis">{basisLine(id, score)}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="actuation-section" aria-labelledby="actuation-due-title" data-actuation-due={due.length}>
        <h2 id="actuation-due-title">Due soon</h2>
        {due.length === 0 ? (
          <p className="actuation-muted">No program expires in the next 30 days.</p>
        ) : (
          <ul className="actuation-due">
            {due.map((row) => (
              <li key={row.factor} data-actuation-due-row={row.factor}>
                <span className="actuation-factor-name">
                  {row.factor} {FACTOR_LABELS[row.factor]}
                </span>
                <span>{dueText(row)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
