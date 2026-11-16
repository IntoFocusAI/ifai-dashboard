"use client";

import "@/lib/canvas-sdk/canvas-sdk.css";
import "@/components/staff/sites-to-review.css";
import "@/components/staff/actuation-records.css";
import Link from "next/link";
import { useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { ActuationItemsSection } from "@/components/staff/ActuationItemsSection";
import { ActuationProgramCard } from "@/components/staff/ActuationProgramCard";
import { ActuationScorePanel } from "@/components/staff/ActuationScorePanel";
import { DASHBOARD_PATH } from "@/lib/auth/dashboard-path";
import { CLIENT_KEYS, CLIENTS, clientHref, type ClientKey } from "@/lib/client/active-client";
import type { ActuationRecordsRead } from "@/lib/fender-canvas/actuation-read";
import {
  ACTUATION_RECORDS_PATH,
  staffItemCounts,
  staffProgramBasis,
  type StaffProgramRow,
} from "@/lib/fender-canvas/actuation-records";
import { scoreActuation, type ProgramFactorId } from "@/lib/fender-canvas/actuation-score";

export const ACTUATION_MIGRATION = "supabase/migrations/20261116220000_actuation_records.sql";

function withTheme(href: string, light: boolean): string {
  if (!light) return href;
  return `${href}${href.includes("?") ? "&" : "?"}theme=light`;
}

/** Fender and Ledlenser, as full page loads so the records are read again for the brand picked. */
function ClientSwitch({ client, light }: { client: ClientKey; light: boolean }) {
  return (
    <div className="segmented-control" role="group" aria-label="Client">
      {CLIENT_KEYS.map((key) => (
        <a
          key={key}
          href={withTheme(clientHref(key, ACTUATION_RECORDS_PATH), light)}
          className={`segmented-btn${key === client ? " active" : ""}`}
          aria-current={key === client ? "page" : undefined}
          data-actuation-client={key}
        >
          {CLIENTS[key].brandName}
        </a>
      ))}
    </div>
  );
}

function ReadyBody({
  client,
  programs,
  items,
  today,
}: {
  client: ClientKey;
  programs: StaffProgramRow[];
  items: Extract<ActuationRecordsRead, { state: "ready" }>["items"];
  today: string;
}) {
  const score = useMemo(
    () =>
      scoreActuation({
        asOf: today,
        programs: programs.map(staffProgramBasis),
        items: staffItemCounts(items, today),
        ownedAnswers: null,
      }),
    [programs, items, today],
  );
  const programOf = (factor: ProgramFactorId) => programs.find((row) => row.factor === factor) ?? null;
  return (
    <>
      <ActuationScorePanel score={score} programs={programs} today={today} />
      <section className="actuation-section" aria-labelledby="actuation-programs-title">
        <h2 id="actuation-programs-title">Planned programs</h2>
        <div className="actuation-programs">
          {(["P1", "P2"] as const).map((factor) => (
            <ActuationProgramCard
              key={`${client}-${factor}`}
              client={client}
              factor={factor}
              row={programOf(factor)}
              today={today}
            />
          ))}
        </div>
      </section>
      <ActuationItemsSection key={client} client={client} items={items} today={today} />
    </>
  );
}

export function ActuationRecordsView({
  client,
  read,
  light,
  today,
}: {
  client: ClientKey;
  read: ActuationRecordsRead;
  light: boolean;
  today: string;
}) {
  const brand = CLIENTS[client].brandName;
  return (
    <main
      className={`ifai-canvas sites-review-page actuation-page${light ? " light-theme" : ""}`}
      data-actuation-records={client}
      data-actuation-state={read.state}
    >
      <div className="sites-review-card">
        <header className="sites-review-header">
          <div>
            <p className="sites-review-eyebrow">IntoFocus staff</p>
            <h1>Actuation records</h1>
          </div>
          <div className="sites-review-actions">
            <ClientSwitch client={client} light={light} />
            <Link href={withTheme(clientHref(client, DASHBOARD_PATH), light)} className="sites-review-back">
              <ArrowLeft size={14} aria-hidden />
              <span>Back to dashboard</span>
            </Link>
          </div>
        </header>
        <p className="sites-review-lead">
          Programs and logged work behind {brand}&apos;s AI Actuation score. A program earns points only with an owner, an
          evidence link, and a verification date in the last 90 days. Clients see the score and its basis, never names or
          notes.
        </p>
        {read.state === "ready" ? (
          <ReadyBody client={client} programs={read.programs} items={read.items} today={today} />
        ) : read.state === "absent" ? (
          <p className="actuation-absent" role="status" data-actuation-absent="">
            Actuation records are not set up in the database yet. They open once {ACTUATION_MIGRATION} is applied.
          </p>
        ) : (
          <p className="sites-review-error" role="status">
            {read.message}
          </p>
        )}
      </div>
    </main>
  );
}
