import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { DASHBOARD_PATH } from "@/lib/auth/dashboard-path";
import { DECK_PAGE } from "@/lib/story-deck/story-deck";

/** Header and back link. The live body is filled in by the client read. */
export function DeckFrame({ children }: { children: ReactNode }) {
  return (
    <article className="deck-card" aria-labelledby="deck-title">
      <header className="profile-modal-header deck-header">
        <h1 id="deck-title">{DECK_PAGE.title}</h1>
        <Link href={DASHBOARD_PATH} className="deck-back">
          <ArrowLeft size={14} aria-hidden />
          <span>{DECK_PAGE.backLabel}</span>
        </Link>
      </header>
      <div className="deck-body">{children}</div>
    </article>
  );
}
