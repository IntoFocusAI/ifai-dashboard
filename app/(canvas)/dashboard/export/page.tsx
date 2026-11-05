import type { Metadata } from "next";
import { Suspense } from "react";
import { ExportCard } from "./ExportCard";
import { ExportThemeRoot } from "./ExportThemeRoot";
import { loadBriefingExport } from "@/lib/export/load-briefing";
import { loadSuppressedExport } from "@/lib/export/load-suppressed";
import "./export.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Export · IntoFocus",
  description: "Download Summary Briefing findings and suppressed listings",
};

export default async function ExportPage() {
  const [briefing, suppressed] = await Promise.all([loadBriefingExport(), loadSuppressedExport()]);
  return (
    <Suspense
      fallback={
        <main className="export-page profile-modal-theme-canvas">
          <ExportCard briefing={briefing.model} suppressed={suppressed.model} />
        </main>
      }
    >
      <ExportThemeRoot>
        <ExportCard briefing={briefing.model} suppressed={suppressed.model} />
      </ExportThemeRoot>
    </Suspense>
  );
}
