"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveActuationProgram } from "@/components/staff/actuation-actions";
import { formatDay } from "@/components/staff/ActuationScorePanel";
import type { ClientKey } from "@/lib/client/active-client";
import { FACTOR_LABELS, staffProgramBasis, type StaffProgramRow } from "@/lib/fender-canvas/actuation-records";
import { expiresOn, programInPlace, type ProgramFactorId } from "@/lib/fender-canvas/actuation-score";
import { targetAnswers, type SuggestedTarget } from "@/lib/fender-canvas/roadmap-actuation";

type Suggested = { sites: SuggestedTarget[]; windowLabel: string };

/** The suggested targets: the community or publication sites AI cites most in the client's shopping answers. */
function SuggestedSites({ factor, suggested }: { factor: ProgramFactorId; suggested: Suggested }) {
  const noun = factor === "P1" ? "community" : "publication or review";
  const sites = suggested.sites.map((site) => `${site.domain} (${targetAnswers(site)})`).join(", ");
  return (
    <p className="actuation-muted" data-actuation-suggested={factor}>
      {suggested.sites.length
        ? `Suggested from AI answers (${suggested.windowLabel}): ${sites}.`
        : `No ${noun} site is cited in shopping answers (${suggested.windowLabel}).`}
    </p>
  );
}

/** What is missing, in the order the acceptance rule lists it: owner, evidence, verification, expiry. */
function programStatus(row: StaffProgramRow | null, today: string): string {
  if (!row) return "Not recorded. Scores 0.";
  const basis = staffProgramBasis(row);
  if (programInPlace(basis, today)) return `In place until ${formatDay(expiresOn(basis.verifiedOn as string))}.`;
  const missing = [
    basis.hasOwner ? null : "an owner",
    basis.hasEvidence ? null : "an evidence link",
    basis.verifiedOn ? null : "a verification date",
  ].filter(Boolean);
  if (missing.length) return `Needs ${missing.join(", ")}. Scores 0.`;
  return `Lapsed ${formatDay(row.expires_on ?? expiresOn(basis.verifiedOn as string))}. Scores 0; verify again to restore.`;
}

export function ActuationProgramCard({
  client,
  factor,
  row,
  today,
  suggested = null,
}: {
  client: ClientKey;
  factor: ProgramFactorId;
  row: StaffProgramRow | null;
  today: string;
  suggested?: Suggested | null;
}) {
  const router = useRouter();
  const [ownerName, setOwnerName] = useState(row?.owner_name ?? "");
  const [targetDomains, setTargetDomains] = useState((row?.target_domains ?? []).join("\n"));
  const [amount, setAmount] = useState(String((factor === "P1" ? row?.cadence_per_30_days : row?.target_count) ?? ""));
  const [evidenceUrl, setEvidenceUrl] = useState(row?.evidence_url ?? "");
  const [verifiedOn, setVerifiedOn] = useState(row?.verified_on ?? "");
  const [note, setNote] = useState(row?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const id = `actuation-${factor}`;

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await saveActuationProgram({ client, factor, ownerName, targetDomains, amount, evidenceUrl, verifiedOn, note });
      if (result.ok) {
        setMessage({ error: false, text: "Saved." });
        router.refresh();
      } else setMessage({ error: true, text: result.message });
    } catch {
      setMessage({ error: true, text: "The program was not saved. Try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="actuation-card"
      data-actuation-program={factor}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <header className="actuation-card-header">
        <h3>
          {factor} {FACTOR_LABELS[factor]}
        </h3>
        <p className="actuation-muted" data-actuation-program-status="">
          {programStatus(row, today)}
        </p>
      </header>
      <label htmlFor={`${id}-owner`}>IntoFocus owner</label>
      <input id={`${id}-owner`} value={ownerName} maxLength={80} onChange={(e) => setOwnerName(e.target.value)} />
      <label htmlFor={`${id}-domains`}>{factor === "P1" ? "Target communities (domains)" : "Target publications and reviewers (domains)"}</label>
      <textarea
        id={`${id}-domains`}
        rows={3}
        value={targetDomains}
        placeholder="reddit.com, one per line or comma separated"
        onChange={(e) => setTargetDomains(e.target.value)}
      />
      {suggested ? <SuggestedSites factor={factor} suggested={suggested} /> : null}
      <label htmlFor={`${id}-amount`}>{factor === "P1" ? "Responses per 30 days" : "Placements per 90 days"}</label>
      <input
        id={`${id}-amount`}
        type="number"
        min={1}
        max={1000}
        inputMode="numeric"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <label htmlFor={`${id}-evidence`}>Evidence link</label>
      <input id={`${id}-evidence`} type="url" value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)} />
      <label htmlFor={`${id}-verified`}>Verified on</label>
      <input id={`${id}-verified`} type="date" max={today} value={verifiedOn} onChange={(e) => setVerifiedOn(e.target.value)} />
      <label htmlFor={`${id}-note`}>Staff note</label>
      <input id={`${id}-note`} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
      <div className="actuation-card-footer">
        <span className="actuation-muted">
          {row?.verified_by_name ? `Verified by ${row.verified_by_name}` : ""}
          {row?.updated_by_name ? `${row?.verified_by_name ? " · " : ""}Last saved by ${row.updated_by_name}` : ""}
        </span>
        <button type="submit" className="sites-review-save" disabled={busy} data-actuation-save={factor}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
      {message ? (
        <p className={message.error ? "sites-review-row-error" : "actuation-muted"} role="status">
          {message.text}
        </p>
      ) : null}
    </form>
  );
}
