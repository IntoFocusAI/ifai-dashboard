import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

/** Worker 17.9 / FDD X-28: rows without a whole-row action must not look clickable. */
test("division and MAP listing tables opt out of row hover without deleting the global rule", () => {
  const css = read("lib/canvas-sdk/canvas-sdk.css");
  assert.match(css, /\.table-sm tr:hover td \{/);
  assert.match(css, /\.table-sm\.table-no-row-hover > tbody > tr:hover > td \{/);
  assert.doesNotMatch(css, /\.table-sm tr:hover td \{[^}]*font-size/s);

  const light = read("lib/canvas-sdk/iom-theme.css");
  assert.match(
    light,
    /\.retail-surface \.table-sm\.table-no-row-hover > tbody > tr:hover > td \{/,
  );

  const divisions = read("components/v3/live/FenderDivisionsTable.tsx");
  assert.match(divisions, /className="table-sm table-no-row-hover"/);
  assert.doesNotMatch(divisions, /onClick/);

  const map = read("components/v3/live/MapListingsTable.tsx");
  assert.match(map, /table-no-row-hover/);
  assert.match(map, /ChannelPriceCell/);
  assert.match(map, /listing-link/);

  const resize = read("components/v3/live/ResizableTable.tsx");
  assert.match(resize, /tableClassName\?: string/);
  assert.match(resize, /ifai-sort-btn/);
});
