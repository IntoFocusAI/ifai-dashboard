import { copyFileSync, existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const stashDir = join(root, ".tmp/static-export-stash");

/** App routes that depend on server actions or dynamic handlers (incompatible with `output: export`). */
const STASH_FILES = ["app/settings/profile/page.tsx"];

const STASH_PATHS = [
  "app/auth/confirm",
  "app/login",
  "app/signup",
  "app/portal",
  "app/sdk",
  "app/v3",
  // Server CSV route handlers. GitHub Pages static export has no request-time routes.
  "app/(canvas)/dashboard/export",
  // Staff Sites to review: reads the signed-in session on the server.
  "app/(canvas)/dashboard/sites-to-review",
];

const PAGE_SWAP = [
  ["app/(canvas)/dashboard/page.tsx", "app/(canvas)/dashboard/page.dynamic.tsx"],
  ["app/(canvas)/dashboard/page.static.tsx", "app/(canvas)/dashboard/page.tsx"],
];

const ACTION_SHIMS = [
  ["app/auth/actions.ts", "auth-actions.ts"],
  ["app/auth/guest-actions.ts", "guest-actions.ts"],
  ["app/auth/organization-actions.ts", "organization-actions.ts"],
];

const mode = process.argv[2] ?? "stash";

function stashPath(rel) {
  return join(root, rel);
}

function stashedPath(rel) {
  return join(stashDir, rel.replace(/\//g, "__"));
}

mkdirSync(stashDir, { recursive: true });

if (mode === "stash") {
  for (const [fromRel, toRel] of PAGE_SWAP) {
    const from = stashPath(fromRel);
    const to = stashPath(toRel);
    if (existsSync(from)) {
      renameSync(from, to);
      console.log(`Swapped ${fromRel} -> ${toRel}`);
    }
  }
  for (const rel of STASH_FILES) {
    const from = stashPath(rel);
    const to = stashedPath(rel);
    if (existsSync(from)) {
      mkdirSync(dirname(to), { recursive: true });
      renameSync(from, to);
      console.log(`Stashed file ${rel}`);
    }
  }
  for (const rel of STASH_PATHS) {
    const from = stashPath(rel);
    const to = stashedPath(rel);
    if (existsSync(from)) {
      mkdirSync(dirname(to), { recursive: true });
      renameSync(from, to);
      console.log(`Stashed ${rel}`);
    }
  }
  for (const [rel, shimFile] of [
    ...ACTION_SHIMS,
    ["app/settings/profile/actions.ts", "profile-actions.ts"],
  ]) {
    const target = stashPath(rel);
    const backup = stashedPath(rel);
    const shim = join(root, "scripts/standalone-shims", shimFile);
    if (existsSync(target)) {
      mkdirSync(dirname(backup), { recursive: true });
      renameSync(target, backup);
      copyFileSync(shim, target);
      console.log(`Shimmed ${rel}`);
    }
  }
} else if (mode === "restore") {
  const RESTORE_PAGE = [
    ["app/(canvas)/dashboard/page.tsx", "app/(canvas)/dashboard/page.static.tsx"],
    ["app/(canvas)/dashboard/page.dynamic.tsx", "app/(canvas)/dashboard/page.tsx"],
  ];
  // If only the static swap ran, page.dynamic.tsx may not exist.
  for (const [fromRel, toRel] of RESTORE_PAGE) {
    const from = stashPath(fromRel);
    const to = stashPath(toRel);
    if (existsSync(from)) {
      renameSync(from, to);
      console.log(`Restored page ${fromRel} -> ${toRel}`);
    }
  }
  for (const [rel] of [...ACTION_SHIMS].reverse()) {
    const backup = stashedPath(rel);
    const target = stashPath(rel);
    if (existsSync(backup)) {
      if (existsSync(target)) rmSync(target);
      renameSync(backup, target);
      console.log(`Restored ${rel}`);
    }
  }
  for (const rel of STASH_PATHS) {
    const from = stashedPath(rel);
    const to = stashPath(rel);
    if (existsSync(from)) {
      mkdirSync(dirname(to), { recursive: true });
      renameSync(from, to);
      console.log(`Restored ${rel}`);
    }
  }
  for (const rel of STASH_FILES) {
    const from = stashedPath(rel);
    const to = stashPath(rel);
    if (existsSync(from)) {
      mkdirSync(dirname(to), { recursive: true });
      renameSync(from, to);
      console.log(`Restored file ${rel}`);
    }
  }
} else if (mode === "clean") {
  if (existsSync(stashDir)) rmSync(stashDir, { recursive: true, force: true });
}
