"use client";

import { applyDefinitionTooltipAttrs } from "@/lib/canvas-sdk/useDefinitionTooltips";
import { useLocalStore } from "@/lib/canvas-sdk/local-store";
import { useCallback, useEffect, useMemo, type RefObject } from "react";

/* Authored panel HTML is injected as a string, so its interactivity is wired
   here by delegation instead of inline `window.*` handlers (which silently
   break the moment the global is missing). Supported attributes:

     data-ifai-open="<spokeId>"   [data-ifai-tab="<tab substring>"]
       Turns any element into a deep link into another spoke/tab.

     data-ifai-filter="<value>"   inside [data-ifai-filter-group="<listId>"]
       Segmented filter. Shows list children whose data-category matches,
       or all of them for the value "all". The value "starred" shows only
       starred rows.

     data-ifai-star="<stable id>"
       Adds a star toggle to the row and remembers it for this viewer.

   `.ceo-callout` blocks get a collapse toggle automatically. */

const DECORATED = "data-ifai-decorated";

type PanelState = {
  starred: string[];
  collapsed: string[];
};

const EMPTY: PanelState = { starred: [], collapsed: [] };

function revive(raw: unknown): PanelState {
  const parsed = (raw ?? {}) as Partial<PanelState>;
  return {
    starred: Array.isArray(parsed.starred) ? parsed.starred : [],
    collapsed: Array.isArray(parsed.collapsed) ? parsed.collapsed : [],
  };
}

function starIcon(filled: boolean) {
  return filled
    ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`
    : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
}

type Options = {
  bodyRef: RefObject<HTMLDivElement | null>;
  onOpen: (spokeId: string, subTab?: string) => void;
  /** Namespaced per viewer. Swap for the Supabase per-user row when it lands. */
  storageKey: string;
  /** Changes whenever the panel body is replaced, so decoration re-runs. */
  scope: string;
  /** Term -> plain-language definition, surfaced on hover in the panel copy. */
  glossary?: Record<string, string>;
};

export function usePanelInteractions({ bodyRef, onOpen, storageKey, scope, glossary }: Options) {
  const [state, setState, store] = useLocalStore<PanelState>(storageKey, EMPTY, revive);

  const toggleIn = useCallback(
    (list: keyof PanelState, id: string) => {
      const current = store.getSnapshot();
      const entries = current[list];
      setState({
        ...current,
        [list]: entries.includes(id)
          ? entries.filter((entry) => entry !== id)
          : [...entries, id],
      });
    },
    [setState, store],
  );

  const starredSet = useMemo(() => new Set(state.starred), [state.starred]);
  const collapsedSet = useMemo(() => new Set(state.collapsed), [state.collapsed]);

  // Decorate the freshly injected HTML and reflect stored state onto it.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;

    body.querySelectorAll<HTMLElement>(".ceo-callout").forEach((callout, idx) => {
      const header = callout.querySelector<HTMLElement>(".ceo-callout-header");
      if (!header) return;
      const id = callout.dataset.ifaiCallout ?? `${scope}:callout:${idx}`;
      callout.dataset.ifaiCallout = id;

      if (!header.hasAttribute(DECORATED)) {
        header.setAttribute(DECORATED, "");
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "ceo-callout-toggle";
        toggle.dataset.ifaiCollapse = id;
        header.appendChild(toggle);
      }

      const collapsed = collapsedSet.has(id);
      callout.classList.toggle("collapsed", collapsed);
      const toggle = header.querySelector<HTMLElement>(".ceo-callout-toggle");
      if (toggle) {
        toggle.textContent = collapsed ? "Show" : "Hide";
        toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
        // No native title: the button already reads Show or Hide. The longer name is for screen readers.
        toggle.setAttribute("aria-label", collapsed ? "Show this explanation" : "Hide this explanation");
      }
    });

    body.querySelectorAll<HTMLElement>("[data-ifai-star]").forEach((row) => {
      const id = row.dataset.ifaiStar;
      if (!id) return;
      const head = row.querySelector<HTMLElement>(".action-head") ?? row;
      if (!head.hasAttribute(DECORATED)) {
        head.setAttribute(DECORATED, "");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "ifai-star-btn";
        btn.dataset.ifaiStarToggle = id;
        head.appendChild(btn);
      }
      const starred = starredSet.has(id);
      row.classList.toggle("starred", starred);
      const btn = head.querySelector<HTMLElement>(".ifai-star-btn");
      if (btn) {
        btn.innerHTML = starIcon(starred);
        btn.classList.toggle("active", starred);
        btn.setAttribute("aria-pressed", starred ? "true" : "false");
        btn.title = starred ? "Remove from your watchlist" : "Add to your watchlist";
      }
    });

    // Reflect the starred count onto any filter chip that shows it.
    body.querySelectorAll<HTMLElement>('[data-ifai-filter="starred"]').forEach((chip) => {
      const count = chip.querySelector<HTMLElement>(".ifai-filter-count");
      if (count) count.textContent = String(starredSet.size);
    });

    // Re-apply the active filter so starring while filtered stays consistent.
    body
      .querySelectorAll<HTMLElement>("[data-ifai-filter-group]")
      .forEach((group) => applyFilter(group, group.dataset.ifaiActiveFilter ?? "all", starredSet));

    if (glossary && body.dataset.ifaiGlossary !== scope) {
      body.dataset.ifaiGlossary = scope;
      annotateGlossary(body, glossary);
    }
  }, [bodyRef, collapsedSet, glossary, scope, starredSet]);

  // One delegated listener for every authored control in the panel.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;

    function toggleExpand(row: HTMLElement) {
      const id = row.dataset.ifaiExpand;
      const detail = id
        ? row.parentElement?.querySelector<HTMLElement>(`[data-ifai-detail="${id}"]`)
        : null;
      if (!detail) return;
      const open = detail.hidden;
      detail.hidden = !open;
      row.setAttribute("aria-expanded", open ? "true" : "false");
    }

    function sortRows(button: HTMLElement) {
      const table = button.closest("table");
      const tbody = table?.tBodies[0];
      const key = button.dataset.ifaiSort;
      if (!table || !tbody || !key) return;
      const direction = button.dataset.sortDir === "asc" ? "desc" : "asc";
      table.querySelectorAll<HTMLElement>("[data-ifai-sort]").forEach((header) => {
        header.removeAttribute("data-sort-dir");
        header.removeAttribute("aria-sort");
      });
      button.dataset.sortDir = direction;
      button.setAttribute("aria-sort", direction === "asc" ? "ascending" : "descending");
      const rows = Array.from(tbody.rows).map((row, index) => ({ row, index }));
      rows.sort((a, b) => {
        const left = a.row.dataset[key] ?? "";
        const right = b.row.dataset[key] ?? "";
        const compared = left.localeCompare(right, undefined, { sensitivity: "base" });
        if (compared === 0) return a.index - b.index;
        return direction === "asc" ? compared : -compared;
      });
      rows.forEach(({ row }) => tbody.appendChild(row));
    }

    function onClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("a[href]")) return;

      const collapse = target.closest<HTMLElement>("[data-ifai-collapse]");
      if (collapse) {
        event.preventDefault();
        toggleIn("collapsed", collapse.dataset.ifaiCollapse as string);
        return;
      }

      const star = target.closest<HTMLElement>("[data-ifai-star-toggle]");
      if (star) {
        event.preventDefault();
        event.stopPropagation();
        toggleIn("starred", star.dataset.ifaiStarToggle as string);
        return;
      }

      const filter = target.closest<HTMLElement>("[data-ifai-filter]");
      if (filter) {
        event.preventDefault();
        const group = filter.closest<HTMLElement>("[data-ifai-filter-group]");
        if (group) {
          const value = filter.dataset.ifaiFilter ?? "all";
          group.dataset.ifaiActiveFilter = value;
          group
            .querySelectorAll<HTMLElement>("[data-ifai-filter]")
            .forEach((btn) => btn.classList.toggle("active", btn === filter));
          applyFilter(group, value, new Set(state.starred));
        }
        return;
      }

      const open = target.closest<HTMLElement>("[data-ifai-open]");
      if (open) {
        event.preventDefault();
        onOpen(open.dataset.ifaiOpen as string, open.dataset.ifaiTab || undefined);
        return;
      }

      const sort = target.closest<HTMLElement>("[data-ifai-sort]");
      if (sort) {
        event.preventDefault();
        sortRows(sort);
        return;
      }

      if (target.closest(".ifai-term")) return;
      const expand = target.closest<HTMLElement>("[data-ifai-expand]");
      if (expand) {
        event.preventDefault();
        toggleExpand(expand);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Enter" && event.key !== " ") return;
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest("a, button, input, textarea, select")) return;
      const expand = target.closest<HTMLElement>("[data-ifai-expand]");
      if (!expand) return;
      event.preventDefault();
      toggleExpand(expand);
    }

    body.addEventListener("click", onClick);
    body.addEventListener("keydown", onKeyDown);
    return () => {
      body.removeEventListener("click", onClick);
      body.removeEventListener("keydown", onKeyDown);
    };
  }, [bodyRef, onOpen, state.starred, toggleIn]);

  const clearStarred = useCallback(
    () => setState({ ...store.getSnapshot(), starred: [] }),
    [setState, store],
  );

  return { starredCount: starredSet.size, clearStarred };
}

function applyFilter(group: HTMLElement, value: string, starred: Set<string>) {
  const listId = group.dataset.ifaiFilterGroup;
  const list = listId ? group.ownerDocument.getElementById(listId) : null;
  if (!list) return;
  Array.from(list.children).forEach((child) => {
    if (!(child instanceof HTMLElement)) return;
    const matches =
      value === "all"
        ? true
        : value === "starred"
          ? starred.has(child.dataset.ifaiStar ?? "")
          : child.dataset.category === value;
    child.hidden = !matches;
  });

  let empty = group.ownerDocument.getElementById(`${listId}-empty`);
  const visible = Array.from(list.children).some(
    (child) => child instanceof HTMLElement && !child.hidden,
  );
  if (!visible && !empty) {
    empty = group.ownerDocument.createElement("p");
    empty.id = `${listId}-empty`;
    empty.className = "ifai-filter-empty";
    empty.textContent =
      value === "starred"
        ? "Nothing starred yet. Use the star on any prompt to build your watchlist."
        : "No rows match this filter.";
    list.after(empty);
  } else if (empty) {
    empty.hidden = visible;
    if (!visible) {
      empty.textContent =
        value === "starred"
          ? "Nothing starred yet. Use the star on any prompt to build your watchlist."
          : "No rows match this filter.";
    }
  }
}

const BOUNDARY = /[A-Za-z0-9]/;

/** Marks the first plain-text mention of each glossary term inside the panel.
    Walks real text nodes so tag names and attributes are never touched, and
    skips code samples, buttons and headers where an inline span would jar. */
function annotateGlossary(root: HTMLElement, glossary: Record<string, string>) {
  const terms = Object.keys(glossary).sort((a, b) => b.length - a.length);
  const pending = new Set(terms);
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      // .command-center is React-rendered; mutating it would fight reconciliation.
      if (
        parent.closest(
          "code, pre, button, th, .ifai-term, .ifai-open-hint, .tag-badge, .command-center, .retail-health, .catalog-governance, .ai-search-panel, .findability-panel",
        )
      ) {
        return NodeFilter.FILTER_REJECT;
      }
      return node.nodeValue && node.nodeValue.trim()
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });

  const hits: { node: Text; term: string; index: number; length: number }[] = [];
  let current = walker.nextNode();
  while (current && pending.size) {
    const text = current.nodeValue ?? "";
    for (const term of terms) {
      if (!pending.has(term)) continue;
      const found = findStandalone(text, term);
      if (!found) continue;
      hits.push({ node: current as Text, term, ...found });
      pending.delete(term);
      break; // one wrap per text node keeps the splitting simple
    }
    current = walker.nextNode();
  }

  for (const hit of hits) {
    const after = hit.node.splitText(hit.index);
    after.splitText(hit.length);
    const matched = after.nodeValue ?? hit.term;
    const mark = root.ownerDocument.createElement("span");
    mark.textContent = matched;
    applyDefinitionTooltipAttrs(mark, hit.term, glossary[hit.term]);
    after.replaceWith(mark);
  }
}

/** indexOf, but refuses matches inside a longer word. A simple plural ("ASINs")
    counts as a match and is highlighted together with its "s". */
function findStandalone(text: string, term: string) {
  let from = 0;
  for (;;) {
    const index = text.indexOf(term, from);
    if (index < 0) return null;
    const before = text[index - 1];
    if (!(before && BOUNDARY.test(before))) {
      const after = text[index + term.length];
      if (!after || !BOUNDARY.test(after)) return { index, length: term.length };
      if (after === "s") {
        const next = text[index + term.length + 1];
        if (!next || !BOUNDARY.test(next)) return { index, length: term.length + 1 };
      }
    }
    from = index + term.length;
  }
}
