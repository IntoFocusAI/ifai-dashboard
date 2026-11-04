/** What the IOM reticle treats as interactive, and where it may show. See IomCursor.tsx. */

export const FINE_POINTER_QUERY = "(pointer: fine) and (hover: hover)";

/** Profile modal portals to document.body; include when opened from the IOM canvas. */
export const CANVAS_PROFILE_MODAL = ".profile-modal-root.profile-modal-theme-canvas";

export const INTERACTIVE_SELECTOR = [
  "button:not(:disabled)",
  "a[href]",
  "[role='button']:not([aria-disabled='true'])",
  "input:not(:disabled)",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  "label",
  ".graph-node",
  ".hud-btn-group button",
  ".panel-toggle",
  ".drilldown-hide-btn",
  ".brand-home-btn",
  ".filter-selector",
  ".hdr-btn",
  ".user-menu-trigger",
  ".command-center button",
  ".tour-modal button",
  ".tour-dot",
  ".strategy-roadmap-btn",
  ".panel-tab",
  ".search-input-wrap",
  ".profile-modal-root button",
  ".profile-modal-root input",
  ".profile-modal-root select",
  ".profile-modal-root textarea",
  ".profile-modal-root label",
  ".auth-form-card",
  ".auth-form-card button",
  ".auth-form-card input",
  ".auth-form-card label",
  ".auth-form-card a",
].join(", ");

export function targetIsInteractive(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(INTERACTIVE_SELECTOR));
}

export function pointInRect(
  x: number,
  y: number,
  rect: { left: number; right: number; top: number; bottom: number },
) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}
