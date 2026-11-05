"use client";

import { AiHistoryProvider, useAiHistory, useDisplayedAiSearch } from "@/components/v3/live/ai-search/AiHistoryContext";
import { useAiSearchRead } from "@/components/v3/live/ai-search/AiSearchContext";
import { useFindabilityRead } from "@/components/v3/live/findability/FindabilityContext";
import { usePortfolioRetailSnapshot } from "@/components/v3/live/usePortfolioRetailSnapshot";
import type { AiSearchRead } from "@/lib/ai-search/types";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";
import type { FindabilityRead } from "@/lib/findability/copy";
import { storyDeck } from "@/lib/story-deck/story-deck";
import { DeckFrame } from "./DeckFrame";
import { DeckTips } from "./DeckTips";
import { DeckView } from "./DeckView";

function DeckFromHistory({
  retail,
  findability,
  published,
}: {
  retail: RetailCanvasRead;
  findability: FindabilityRead;
  published: AiSearchRead;
}) {
  const history = useAiHistory();
  const briefingAi = useDisplayedAiSearch(published);
  const deck = storyDeck({
    retail,
    findability,
    published,
    briefingAi,
    windowLabel: history.controlLabel,
  });
  return (
    <DeckFrame>
      <DeckTips>
        <DeckView deck={deck} />
      </DeckTips>
    </DeckFrame>
  );
}

/** Live reads only. The date pill stays on the dashboard. This page does not change the map's run. */
export function DeckLive() {
  const retail = usePortfolioRetailSnapshot();
  const findability = useFindabilityRead();
  const published = useAiSearchRead();
  return (
    <AiHistoryProvider current={published}>
      <DeckFromHistory retail={retail} findability={findability} published={published} />
    </AiHistoryProvider>
  );
}
