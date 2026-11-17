#!/usr/bin/env node
/* Prints the made-up test clients (e2e/fixtures/clients/*.json) as the JSON list that
   lib/client/registry.ts reads from NEXT_PUBLIC_TEST_CLIENT_FILES. Used only to build the app
   for the client-parity e2e run:

     NEXT_PUBLIC_TEST_CLIENT_FILES="$(node scripts/test-client-files.mjs)" npm run build

   A normal build never sets the variable, so the fixture clients ship to no one. */

import { readdirSync, readFileSync } from "node:fs";

const DIR = new URL("../e2e/fixtures/clients/", import.meta.url).pathname;
const files = readdirSync(DIR)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => ({ source: `e2e/fixtures/clients/${f}`, raw: JSON.parse(readFileSync(DIR + f, "utf8")) }));

process.stdout.write(JSON.stringify(files));
