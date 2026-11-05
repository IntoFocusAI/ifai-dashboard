import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DASHBOARD_PATH } from "@/lib/auth/dashboard-path";
import type { ExportModel } from "@/lib/export/types";

function ExportSection({
  id,
  title,
  model,
}: {
  id: string;
  title: string;
  model: ExportModel;
}) {
  const headingId = `${id}-title`;
  return (
    <section className="export-section" aria-labelledby={headingId} data-export={id}>
      <h2 id={headingId}>{title}</h2>
      {model.ok ? (
        <>
          <dl className="export-facts">
            <div>
              <dt>Filter</dt>
              <dd data-export-filter="">{model.provenance.filter}</dd>
            </div>
            <div>
              <dt>Sort</dt>
              <dd data-export-sort="">{model.provenance.sort}</dd>
            </div>
            <div>
              <dt>As of</dt>
              <dd data-export-as-of="">{model.provenance.asOf}</dd>
            </div>
            <div>
              <dt>Population</dt>
              <dd data-export-population="">{model.provenance.population}</dd>
            </div>
          </dl>
          {model.failures.map((line) => (
            <p key={line} className="export-failure" data-export-failure="">
              {line}
            </p>
          ))}
          <a className="export-download" href={model.href} data-export-download="">
            Download CSV
          </a>
        </>
      ) : (
        <p className="export-failure" data-export-unavailable="">
          {model.message}
        </p>
      )}
    </section>
  );
}

export function ExportCard({
  briefing,
  suppressed,
}: {
  briefing: ExportModel;
  suppressed: ExportModel;
}) {
  return (
    <article className="export-card" aria-labelledby="export-title">
      <header className="profile-modal-header export-header">
        <h1 id="export-title">Export</h1>
        <Link href={DASHBOARD_PATH} className="export-back">
          <ArrowLeft size={14} aria-hidden />
          <span>Back to dashboard</span>
        </Link>
      </header>
      <div className="export-body">
        <p className="export-lead">
          CSV files of the five Summary Briefing findings and the Suppressed Listings table. Each
          file is built on the server from the readings the dashboard shows.
        </p>
        <ExportSection id="briefing" title="Summary Briefing findings" model={briefing} />
        <ExportSection id="suppressed" title="Suppressed listings" model={suppressed} />
      </div>
    </article>
  );
}
