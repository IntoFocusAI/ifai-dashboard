import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

function fileForAlias(specifier) {
  const base = path.join(root, specifier.slice(2));
  if (existsSync(base) && statSync(base).isFile()) return pathToFileURL(base).href;
  for (const ext of [".ts", ".tsx", ".js", ".mjs"]) {
    if (existsSync(`${base}${ext}`)) return pathToFileURL(`${base}${ext}`).href;
  }
  // A folder import ("@/lib/client") resolves to its index file, as the bundler does.
  for (const ext of [".ts", ".tsx"]) {
    if (existsSync(path.join(base, `index${ext}`))) return pathToFileURL(path.join(base, `index${ext}`)).href;
  }
  return null;
}

/** Lets node run tests that import TypeScript modules, including the `@/` alias. */
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const file = fileForAlias(specifier);
    if (file) return nextResolve(file, context);
  }
  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    !/\.(?:ts|tsx|js|mjs|cjs|json)$/.test(specifier)
  ) {
    return nextResolve(`${specifier}.ts`, context);
  }
  return nextResolve(specifier, context);
}
