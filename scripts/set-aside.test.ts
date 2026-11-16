// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/set-aside.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { resetActiveClientForTests } from "../lib/client/active-client.ts";
import { activeSetAsideClientKey, SET_ASIDE_CHECKS } from "../lib/set-aside/keys.ts";
import {
  errorText,
  outcomeLabel,
  reasonsForCheck,
  validateDone,
  UNKNOWN_CLIENT_MESSAGE,
  validateSetAside,
  type SetAsideReason,
} from "../lib/set-aside/set-aside.ts";

function reason(patch: Partial<SetAsideReason> & Pick<SetAsideReason, "reason_code">): SetAsideReason {
  return {
    label: patch.reason_code,
    description: null,
    check_keys: null,
    requires_note: false,
    sort_order: 100,
    ...patch,
  };
}

test("reasons with no check list apply everywhere; scoped reasons only to their checks", () => {
  const reasons = [
    reason({ reason_code: "other", sort_order: 90 }),
    reason({ reason_code: "discontinued", sort_order: 10 }),
    reason({ reason_code: "approved_promo", check_keys: ["map_pricing"], sort_order: 30 }),
  ];
  assert.deepEqual(
    reasonsForCheck(reasons, "amazon_specs").map((r) => r.reason_code),
    ["discontinued", "other"],
  );
  assert.deepEqual(
    reasonsForCheck(reasons, "map_pricing").map((r) => r.reason_code),
    ["discontinued", "approved_promo", "other"],
  );
});

test("a reason and a name are required", () => {
  const ok = reason({ reason_code: "discontinued" });
  assert.equal(validateSetAside({ reasonCode: "", note: "", name: "Brian" }, undefined), "Pick a reason.");
  assert.equal(validateSetAside({ reasonCode: "discontinued", note: "", name: " " }, ok), "Enter your name.");
  assert.equal(validateSetAside({ reasonCode: "discontinued", note: "", name: "Brian" }, ok), null);
});

test("reasons that require a note reject a blank one", () => {
  const other = reason({ reason_code: "other", label: "Other", requires_note: true });
  assert.match(validateSetAside({ reasonCode: "other", note: "  ", name: "Brian" }, other) ?? "", /needs a note/);
  assert.equal(validateSetAside({ reasonCode: "other", note: "Bundle SKU", name: "Brian" }, other), null);
  assert.match(
    validateSetAside({ reasonCode: "other", note: "x".repeat(501), name: "Brian" }, other) ?? "",
    /500/,
  );
});

test("done needs only a name; its label never shows a reason", () => {
  assert.equal(validateDone({ note: "", name: " " }), "Enter your name.");
  assert.equal(validateDone({ note: "", name: "Brian" }), null);
  assert.match(validateDone({ note: "x".repeat(501), name: "Brian" }) ?? "", /500/);
  assert.equal(outcomeLabel({ outcome: "done", reason_label: null }), "Done");
  assert.equal(
    outcomeLabel({ outcome: "set_aside", reason_label: "Come back to review" }),
    "Set aside · Come back to review",
  );
});

// Worker 25.15: the shared tables and views are client-keyed, so each brand runs the same checks under its own key.
for (const [client, key] of [
  ["fender", "fmic"],
  ["ledlenser", "ledlenser"],
] as const) {
  test(`${client}: set-asides are keyed by ${key}, and the same checks and reasons apply`, () => {
    try {
      resetActiveClientForTests(client);
      assert.equal(activeSetAsideClientKey(), key);
      assert.equal(SET_ASIDE_CHECKS.mapPricing, "map_pricing");
      const reasons = [
        reason({ reason_code: "other", sort_order: 90 }),
        reason({ reason_code: "approved_exception", check_keys: ["map_pricing"], sort_order: 30 }),
      ];
      assert.deepEqual(
        reasonsForCheck(reasons, SET_ASIDE_CHECKS.mapPricing).map((r) => r.reason_code),
        ["approved_exception", "other"],
      );
      assert.deepEqual(
        reasonsForCheck(reasons, SET_ASIDE_CHECKS.amazonSpecs).map((r) => r.reason_code),
        ["other"],
      );
    } finally {
      resetActiveClientForTests(null);
    }
  });
}

test("an Unknown client. error from the database reads as a plain sentence, never blank", () => {
  assert.equal(errorText({ message: "Unknown client." }), UNKNOWN_CLIENT_MESSAGE);
  assert.equal(errorText({ message: "unknown client" }), UNKNOWN_CLIENT_MESSAGE);
  assert.match(UNKNOWN_CLIENT_MESSAGE, /nothing was saved/);
  assert.equal(errorText({ message: "Unknown check." }), "Unknown check.");
  assert.equal(errorText({}), "The set-aside could not be saved. Try again.");
  assert.equal(errorText(null), "The set-aside could not be saved. Try again.");
});
