// Worker 27.15: with no Supabase URL or key (CI), the Actuation basis read is a failed read
// (null, Not available*), never a throw, so the canvas bundle still loads from its own client.
import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCanvas } from "../lib/canvasData.ts";
import { loadActuationBasis } from "../lib/fender-canvas/actuation-basis-read.ts";

for (const name of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
]) {
  delete process.env[name];
}

/** Every view answers with an empty result. */
function emptyClient(): SupabaseClient {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "order", "eq", "range", "single"]) query[method] = () => query;
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve);
  return { from: () => query } as unknown as SupabaseClient;
}

test("the Actuation basis read without Supabase config resolves null instead of throwing", async () => {
  assert.equal(await loadActuationBasis("fender"), null);
});

test("the canvas bundle loads from its injected client with the Actuation basis unavailable", async () => {
  const bundle = await loadCanvas(emptyClient());
  assert.equal(bundle.actuation, null);
});
