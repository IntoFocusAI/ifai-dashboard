/* The client list: every settings file in data/clients/, in switcher order.

   A browser bundle cannot list a folder, so each file is imported here by name. A unit test
   (scripts/client-settings.test.ts) fails when a file in data/clients/ is missing from this list.
   The files are checked the first time any accessor runs, and a bad file throws a
   ClientSettingsError that names the file and each problem. */

import fender from "../../data/clients/fender.json" with { type: "json" };
import ledlenser from "../../data/clients/ledlenser.json" with { type: "json" };
import { ClientSettingsError, validateClientSettings, type ClientSettings } from "./settings-schema";

/** Settings files in switcher order. Add a client by adding its file here. */
const FILES: ReadonlyArray<{ source: string; raw: unknown }> = [
  { source: "data/clients/fender.json", raw: fender },
  { source: "data/clients/ledlenser.json", raw: ledlenser },
];

/** Settings files from the NEXT_PUBLIC_TEST_CLIENT_FILES build variable: a JSON list of {source, raw}. */
export function testClientFilesFrom(json: string | undefined): Array<{ source: string; raw: unknown }> {
  if (!json) return [];
  const files: unknown = JSON.parse(json);
  if (!Array.isArray(files)) throw new Error("NEXT_PUBLIC_TEST_CLIENT_FILES must be a JSON list of {source, raw}");
  return files as Array<{ source: string; raw: unknown }>;
}

/* Made-up clients for tests (parity chunk C8). Only a test build sets the variable, from
   `node scripts/test-client-files.mjs`. A normal build inlines it as undefined, so the fixture
   client is in no file a user loads and never reaches the switcher. */
const testFiles = () => testClientFilesFrom(process.env.NEXT_PUBLIC_TEST_CLIENT_FILES);

/** Checks a set of settings files together: each file, then keys unique and exactly one default. */
export function buildClientRegistry(files: ReadonlyArray<{ source: string; raw: unknown }>): ClientSettings[] {
  const clients = files.map(({ source, raw }) => {
    const settings = validateClientSettings(raw, source);
    const fileKey = source.replace(/^.*\//, "").replace(/\.json$/, "");
    if (settings.client_key !== fileKey) {
      throw new ClientSettingsError(source, [`client_key ${settings.client_key} must match the file name (${fileKey}.json)`]);
    }
    return settings;
  });
  const problems: string[] = [];
  if (clients.length === 0) problems.push("there are no client settings files");
  for (const field of ["client_key", "set_aside_key"] as const) {
    const seen = new Set<string>();
    for (const c of clients) {
      if (seen.has(c[field])) problems.push(`${field} ${c[field]} is used by more than one client`);
      seen.add(c[field]);
    }
  }
  const defaults = clients.filter((c) => c.is_default).map((c) => c.client_key);
  if (defaults.length !== 1) {
    problems.push(`exactly one client must set is_default (found ${defaults.length === 0 ? "none" : defaults.join(", ")})`);
  }
  if (problems.length > 0) throw new ClientSettingsError("data/clients/*", problems);
  return clients;
}

let registry: ClientSettings[] | null = null;

/** Every client's settings, checked once, in switcher order. */
export function clientRegistry(): readonly ClientSettings[] {
  registry ??= buildClientRegistry([...FILES, ...testFiles()]);
  return registry;
}

/** The settings files this list imports, for the test that compares it with the folder. */
export function registeredClientFiles(): string[] {
  return FILES.map((f) => f.source);
}
