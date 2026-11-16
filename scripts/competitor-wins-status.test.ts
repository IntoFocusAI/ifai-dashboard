import assert from "node:assert/strict";
import test from "node:test";
import { competitorWinsStatus } from "@/lib/ai-search/competitor-wins-lead";

test("competitor wins status: red above 70, green below 35, amber between", () => {
  assert.equal(competitorWinsStatus(949, 1000), "bad"); // Ledlenser 94.9
  assert.equal(competitorWinsStatus(393, 1000), "okay"); // Fender 39.3
  assert.equal(competitorWinsStatus(300, 1000), "good"); // 30
  assert.equal(competitorWinsStatus(700, 1000), "okay"); // 70 is amber
  assert.equal(competitorWinsStatus(701, 1000), "bad");
  assert.equal(competitorWinsStatus(350, 1000), "okay"); // 35 is amber
  assert.equal(competitorWinsStatus(349, 1000), "good");
  assert.equal(competitorWinsStatus(0, 0), null);
});
