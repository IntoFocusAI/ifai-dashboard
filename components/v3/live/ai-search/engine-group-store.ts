"use client";

import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_ENGINE_GROUP_CHOICE, type EngineGroupChoice } from "@/lib/ai-search/engine-group";

/** One switch position for every AI Search and Competitive Radar tab. Each page load opens on All. */
let current: EngineGroupChoice = DEFAULT_ENGINE_GROUP_CHOICE;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function read(): EngineGroupChoice {
  return current;
}

function serverRead(): EngineGroupChoice {
  return DEFAULT_ENGINE_GROUP_CHOICE;
}

export function setEngineGroupChoice(choice: EngineGroupChoice) {
  if (choice === current) return;
  current = choice;
  listeners.forEach((listener) => listener());
}

export function useEngineGroupChoice(): [EngineGroupChoice, (choice: EngineGroupChoice) => void] {
  const choice = useSyncExternalStore(subscribe, read, serverRead);
  const set = useCallback((next: EngineGroupChoice) => setEngineGroupChoice(next), []);
  return [choice, set];
}
