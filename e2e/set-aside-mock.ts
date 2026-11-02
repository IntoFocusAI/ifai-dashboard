import type { Page, Route } from "@playwright/test";

/**
 * In-memory stand-in for the set-aside endpoints (worker 18.5).
 *
 * Every write to the real functions lands a permanent row in public.audit_log,
 * so specs never call them. The fixture installs this before the first
 * navigation, which also keeps live set-asides from changing queue counts.
 */

type Row = Record<string, unknown> & { id: string; check_key: string; entity_key: string; status: string };

export const MOCK_REASONS = [
  { reason_code: "discontinued", label: "Discontinued", description: "The product is discontinued.", check_keys: null, requires_note: false, sort_order: 10 },
  { reason_code: "approved_exception", label: "Approved exception", description: null, check_keys: null, requires_note: true, sort_order: 30 },
  { reason_code: "other", label: "Other", description: "Say why in the note.", check_keys: null, requires_note: true, sort_order: 90 },
];

const CHECK_LABELS: Record<string, string> = {
  command_center_queue: "Command Center priority",
  amazon_specs: "Amazon Specs: missing Amazon fields",
  brand_site_specs: "Brand-Site Specs: missing page fields",
  listing_content: "Listing content gaps",
  buybox_suppression: "Buy Box suppression",
  map_pricing: "MAP pricing below floor",
};

export type SetAsideMock = { rows: Row[]; calls: { fn: string; body: Record<string, unknown> }[] };

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

export async function mockSetAsides(page: Page): Promise<SetAsideMock> {
  const state: SetAsideMock = { rows: [], calls: [] };
  let next = 1;

  await page.route("**/rest/v1/canvas_set_aside_reasons*", (route) => json(route, MOCK_REASONS));

  await page.route("**/rest/v1/canvas_issue_set_asides*", (route) => {
    const url = new URL(route.request().url());
    const check = url.searchParams.get("check_key")?.replace(/^eq\./, "");
    const rows = state.rows.filter((row) => !check || row.check_key === check);
    return json(route, [...rows].reverse());
  });

  await page.route("**/rest/v1/rpc/set_aside_issue", (route) => {
    const body = route.request().postDataJSON() as Record<string, string | null>;
    state.calls.push({ fn: "set_aside_issue", body });
    const reason = MOCK_REASONS.find((entry) => entry.reason_code === body.p_reason_code);
    if (!reason) return json(route, { message: "Pick a reason from the list." }, 400);
    const now = new Date().toISOString();
    const existing = state.rows.find(
      (row) => row.check_key === body.p_check_key && row.entity_key === body.p_entity_key,
    );
    const patch = {
      status: "active",
      reason_code: reason.reason_code,
      reason_label: reason.label,
      note: body.p_note,
      set_by_name: body.p_name,
      set_at: now,
      updated_at: now,
    };
    if (existing) {
      Object.assign(existing, patch);
      return json(route, existing);
    }
    const row: Row = {
      id: `00000000-0000-4000-8000-${String(next++).padStart(12, "0")}`,
      client_key: body.p_client_key,
      check_key: String(body.p_check_key),
      check_label: CHECK_LABELS[String(body.p_check_key)] ?? body.p_check_key,
      entity_type:
        body.p_check_key === "command_center_queue"
          ? "queue_item"
          : body.p_check_key === "brand_site_specs"
            ? "url"
            : "asin",
      entity_key: String(body.p_entity_key),
      entity_label: body.p_entity_label,
      reopened_by_name: null,
      reopened_at: null,
      reopen_note: null,
      ...patch,
    };
    state.rows.push(row);
    return json(route, row);
  });

  await page.route("**/rest/v1/rpc/reopen_set_aside", (route) => {
    const body = route.request().postDataJSON() as Record<string, string | null>;
    state.calls.push({ fn: "reopen_set_aside", body });
    const row = state.rows.find((entry) => entry.id === body.p_id && entry.status === "active");
    if (!row) return json(route, { message: "That set-aside is not active." }, 400);
    Object.assign(row, {
      status: "reopened",
      reopened_by_name: body.p_name,
      reopened_at: new Date().toISOString(),
      reopen_note: body.p_note,
      updated_at: new Date().toISOString(),
    });
    return json(route, row);
  });

  return state;
}
