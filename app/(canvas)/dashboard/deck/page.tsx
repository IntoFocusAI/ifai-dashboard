import type { Metadata } from "next";
import { Suspense } from "react";
import { DECK_LOADING, DECK_PAGE } from "@/lib/story-deck/story-deck";
import { DeckFrame } from "./DeckFrame";
import { DeckLive } from "./DeckLive";
import { DeckThemeRoot } from "./DeckThemeRoot";
import "./deck.css";

export const metadata: Metadata = {
  title: "Story pack · IntoFocus",
  description: "Summary Briefing for the dashboard window, and the published AI Search run",
};

export default function DeckPage() {
  return (
    <Suspense
      fallback={
        <main className="deck-page profile-modal-theme-canvas">
          <DeckFrame>
            <p className="deck-lead">{DECK_PAGE.lead}</p>
            <p className="deck-note">{DECK_LOADING}</p>
          </DeckFrame>
        </main>
      }
    >
      <DeckThemeRoot>
        <DeckLive />
      </DeckThemeRoot>
    </Suspense>
  );
}
