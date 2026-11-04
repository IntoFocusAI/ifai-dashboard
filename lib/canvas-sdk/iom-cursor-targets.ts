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
  "summary",
  "[tabindex]:not([tabindex='-1'])",
  "[role='tab']",
  "[role='link']",
  "[role='menuitem']",
  "[role='option']",
  "[role='checkbox']",
  "[role='switch']",
  ".ifai-term",
  ".ticker-item",
  "[data-ifai-open]",
  "[data-ifai-star]",
  "[data-ifai-filter]",
].join(", ");

const DISABLED = ":disabled, [aria-disabled='true']";

export function targetIsInteractive(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  const hit = target.closest(INTERACTIVE_SELECTOR);
  return Boolean(hit && !hit.matches(DISABLED));
}

/** Controls whose picker is drawn by the browser; the page gets no pointer moves while it is open. */
const NATIVE_PICKER_INPUTS = new Set(["date", "datetime-local", "month", "week", "time", "color", "file"]);

export function opensNativePicker(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  const control = target.closest("select, input");
  if (!control || control.matches(DISABLED)) return false;
  if (control.tagName === "SELECT") {
    const select = control as HTMLSelectElement;
    return !select.multiple && select.size <= 1;
  }
  return NATIVE_PICKER_INPUTS.has((control as HTMLInputElement).type);
}

export function pointInRect(
  x: number,
  y: number,
  rect: { left: number; right: number; top: number; bottom: number },
) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}
