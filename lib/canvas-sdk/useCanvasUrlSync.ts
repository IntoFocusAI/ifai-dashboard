"use client";

import { isDashboardPath } from "@/lib/auth/dashboard-path";
import {
  buildCanvasSearchParams,
  canvasUrlQueryEquals,
  parseCanvasSearchParams,
  tabSlug,
  type CanvasUrlState,
} from "@/lib/canvas-sdk/canvas-url-state";
import type { CanvasUrlSyncSnapshot } from "@/lib/canvas-sdk/canvas-url-sync-types";
import { createUrlEchoes } from "@/lib/canvas-sdk/url-echo";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type { CanvasUrlSyncSnapshot } from "@/lib/canvas-sdk/canvas-url-sync-types";

type Options = {
  spokeIds: readonly string[];
  snapshot: CanvasUrlSyncSnapshot;
  onApplyFromUrl: (parsed: CanvasUrlState) => void;
  enabled?: boolean;
};

function snapshotToUrlState(snapshot: CanvasUrlSyncSnapshot): CanvasUrlState {
  const tabLabel = snapshot.tabLabels[snapshot.activeTab];
  const atOverview =
    !snapshot.spokeId &&
    snapshot.panelView === "spoke" &&
    !snapshot.tourActive &&
    !snapshot.tourSuspended;

  return {
    spokeId: snapshot.spokeId,
    tabSlug: snapshot.spokeId && tabLabel ? tabSlug(tabLabel) : null,
    priorities: snapshot.panelView === "command",
    panelLayout: atOverview ? null : snapshot.panelLayout,
    tourStep:
      snapshot.tourActive || snapshot.tourSuspended ? snapshot.tourStep + 1 : null,
    tourPaused: snapshot.tourSuspended,
    menuOpen: snapshot.menuOpen,
    profileOpen: snapshot.profileOpen,
  };
}

export function useCanvasUrlSync({
  spokeIds,
  snapshot,
  onApplyFromUrl,
  enabled = true,
}: Options) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const onDashboard = isDashboardPath(pathname);

  const echoes = useRef(createUrlEchoes());
  /* Live data rebuilds the spoke list on every read, so the URL is applied when the
     query or the set of spokes changes, not whenever the array is new. */
  const appliedKey = useRef<string | null>(null);
  const spokeKey = spokeIds.join("|");
  const onApplyRef = useRef(onApplyFromUrl);
  const lastSpokeTab = useRef<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    onApplyRef.current = onApplyFromUrl;
  }, [onApplyFromUrl]);

  useEffect(() => {
    if (!onDashboard || !enabled) return;
    const key = `${spokeKey}?${searchKey}`;
    if (appliedKey.current === key) return;
    appliedKey.current = key;
    if (echoes.current.take(searchKey)) return;
    onApplyRef.current(parseCanvasSearchParams(searchParams, spokeIds));
    setHydrated(true);
  }, [enabled, onDashboard, searchKey, searchParams, spokeIds, spokeKey]);

  useEffect(() => {
    if (!onDashboard || !enabled || !hydrated) return;
    const state = snapshotToUrlState(snapshot);
    // window.location also carries keys a panel wrote with history.replaceState this tick.
    const built = buildCanvasSearchParams(state, new URLSearchParams(window.location.search));
    const current = new URLSearchParams(searchParams.toString());
    const spokeTab = `${state.spokeId ?? ""}|${state.tabSlug ?? ""}`;
    const spokeTabChanged = lastSpokeTab.current !== null && lastSpokeTab.current !== spokeTab;
    lastSpokeTab.current = spokeTab;
    // While a write is in flight the router still reports the old query, so compare
    // against the newest write instead.
    const inFlight = echoes.current.latest();
    if (canvasUrlQueryEquals(built, inFlight === null ? current : new URLSearchParams(inFlight))) return;
    const query = built.toString();
    echoes.current.wrote(query);
    const href = query ? `${pathname}?${query}` : pathname;
    // Tab and spoke changes stay in history so Back and Forward reopen them.
    // Other canvas chrome updates replace the current entry.
    if (spokeTabChanged) router.push(href, { scroll: false });
    else router.replace(href, { scroll: false });
  }, [
    enabled,
    onDashboard,
    pathname,
    router,
    // searchParams is read inside the effect. It is not a dependency: a Back or
    // Forward navigation must update state from the URL, not be overwritten by it.
    snapshot.spokeId,
    snapshot.activeTab,
    snapshot.panelView,
    snapshot.panelLayout,
    snapshot.tourActive,
    snapshot.tourStep,
    snapshot.tourSuspended,
    snapshot.menuOpen,
    snapshot.profileOpen,
    hydrated,
  ]);
}
