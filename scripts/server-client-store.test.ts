// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/server-client-store.test.ts
// A production build can load lib/client/server-client.ts more than once (the CSV export route and
// the Sites to review page are separate bundles). Each copy used to make its own request store and
// overwrite the global one activeClient() reads, so once the page had loaded, the route's exports
// read Fender for every client. Every copy must share one store.
import assert from "node:assert/strict";
import { test } from "node:test";
import { activeClientKey } from "../lib/client/active-client.ts";
import { runWithClient as routeCopy } from "../lib/client/server-client.ts";

test("a second copy of the server-client module keeps the first copy's requests on their client", async () => {
  const second = (await import("../lib/client/server-client.ts?second-bundle")) as typeof import("../lib/client/server-client.ts");
  assert.notEqual(second.runWithClient, routeCopy, "the test needs two module copies");
  assert.equal(await routeCopy("ledlenser", async () => activeClientKey()), "ledlenser");
  assert.equal(await second.runWithClient("ledlenser", async () => activeClientKey()), "ledlenser");
  assert.equal(activeClientKey(), "fender");
});
