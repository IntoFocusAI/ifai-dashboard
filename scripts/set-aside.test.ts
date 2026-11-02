// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/set-aside.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  reasonsForCheck,
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
