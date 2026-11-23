// Keeps docs/benchmark-register.md equal to lib/estimates/benchmarks.ts: every exported benchmark has a
// row, and each row's low / mid / high matches the code.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as B from "../lib/estimates/benchmarks.ts";

type Row = { low: number; mid: number; high: number };

function parseValue(cell: string): number | null {
  const m = cell.trim().match(/^(-?[\d.]+)\s*(%|x)$/);
  if (!m) return null;
  return m[2] === "%" ? Number(m[1]) / 100 : Number(m[1]);
}

function readRegister(): Map<string, string[]> {
  const rows = new Map<string, string[]>();
  for (const line of readFileSync("docs/benchmark-register.md", "utf8").split("\n")) {
    if (!line.startsWith("| ")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length >= 5) rows.set(cells[0], cells);
  }
  return rows;
}

function exportedBenchmarks(): Array<{ id: string } & Row> {
  const out: Array<{ id: string } & Row> = [];
  for (const v of Object.values(B)) {
    if (v && typeof v === "object" && !Array.isArray(v) && "id" in v && "low" in v && "mid" in v && "high" in v) {
      out.push(v as { id: string } & Row);
    }
  }
  for (const band of B.SPEC_LIFT_BANDS) out.push(band.benchmark);
  return out;
}

const register = readRegister();

test("every exported benchmark has a row in the benchmark register", () => {
  const all = exportedBenchmarks();
  assert.ok(all.length >= 18, `found ${all.length} benchmarks`);
  for (const b of all) assert.ok(register.has(b.id), `${b.id} is missing from docs/benchmark-register.md`);
  assert.ok(register.has("rank_curve_methods"), "rank curve method sources have a row");
  for (const key of Object.keys(B.RANK_CURVES)) assert.ok(register.has(`rank_curve:${key}`), `rank curve "${key}" has a row`);
});

test("each register row's low, mid and high equal the code", () => {
  for (const b of exportedBenchmarks()) {
    const cells = register.get(b.id);
    assert.ok(cells, `${b.id} row`);
    const names = ["low", "mid", "high"];
    [b.low, b.mid, b.high].forEach((want, i) => {
      const got = parseValue(cells[2 + i]);
      assert.ok(got !== null, `${b.id} ${names[i]} is not a number: "${cells[2 + i]}"`);
      assert.ok(Math.abs(got - want) < 1e-9, `${b.id} ${names[i]}: register ${cells[2 + i]}, code ${want}`);
    });
  }
});
