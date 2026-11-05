import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { DASHBOARD_PATH } from "@/lib/auth/dashboard-path";
import { UPLOAD_PAGE } from "./upload-copy";
import { UploadTerm } from "./upload-term";
import { UploadThemeRoot } from "./UploadThemeRoot";
import { UploadWorkspace } from "./UploadWorkspace";
import "./upload.css";

export const metadata: Metadata = {
  title: "Upload catalog or MAP · IntoFocus",
  description: "Stage a catalog or MAP file. Nothing is published until it is approved.",
};

function UploadFrame({ children }: { children: ReactNode }) {
  return (
    <article className="upload-card" aria-labelledby="upload-title">
      <header className="profile-modal-header upload-header">
        <h1 id="upload-title">
          {UPLOAD_PAGE.titleLead}{" "}
          <UploadTerm term={UPLOAD_PAGE.map} desc={UPLOAD_PAGE.mapDesc}>
            {UPLOAD_PAGE.map}
          </UploadTerm>{" "}
          {UPLOAD_PAGE.titleTail}
        </h1>
        <Link href={DASHBOARD_PATH} className="upload-back">
          <ArrowLeft size={14} aria-hidden />
          <span>{UPLOAD_PAGE.backLabel}</span>
        </Link>
      </header>
      <div className="upload-body">
        <p className="upload-lead">{UPLOAD_PAGE.lead}</p>
        <p className="upload-approve-line">{UPLOAD_PAGE.approveLine}</p>
        {children}
      </div>
    </article>
  );
}

export default function UploadPage() {
  return (
    <Suspense
      fallback={
        <main className="upload-page profile-modal-theme-canvas">
          <UploadFrame>
            <p className="upload-lead">Loading the upload page.</p>
          </UploadFrame>
        </main>
      }
    >
      <UploadThemeRoot>
        <UploadFrame>
          <UploadWorkspace />
        </UploadFrame>
      </UploadThemeRoot>
    </Suspense>
  );
}
