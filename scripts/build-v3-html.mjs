import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, ".tmp");
const bundleBase = join(outDir, "standalone-v3");
const htmlPath = join(root, "fender-brand-canvas-v3.html");

mkdirSync(outDir, { recursive: true });

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://qftczrlksczfimnzfiov.supabase.co";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "";

const build = spawnSync(
  "npx",
  [
    "--yes",
    "esbuild",
    "scripts/standalone-v3.tsx",
    "--bundle",
    "--format=iife",
    "--jsx=automatic",
    "--minify",
    "--alias:@=.",
    "--alias:@/app/auth/actions=./scripts/standalone-shims/auth-actions.ts",
    "--alias:@/app/auth/organization-actions=./scripts/standalone-shims/organization-actions.ts",
    "--alias:@/app/settings/profile/actions=./scripts/standalone-shims/profile-actions.ts",
    "--alias:next/navigation=./scripts/standalone-shims/next-navigation.ts",
    `--outfile=${bundleBase}.js`,
    "--loader:.css=css",
    "--external:/fonts/*",
    `--define:process.env.NEXT_PUBLIC_SUPABASE_URL=${JSON.stringify(supabaseUrl)}`,
    `--define:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY=${JSON.stringify(supabaseKey)}`,
    `--define:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${JSON.stringify(supabaseKey)}`,
  ],
  { cwd: root, stdio: "inherit" },
);

if (build.status !== 0) process.exit(build.status ?? 1);

function dataUri(filePath, mime) {
  const bytes = readFileSync(filePath);
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

const assets = {
  "/icon.png": dataUri(join(root, "public/icon.png"), "image/png"),
  "/image.png": dataUri(join(root, "public/image.png"), "image/png"),
  "/intofocus-ai-logo-stacked-full-color.png": dataUri(
    join(root, "public/intofocus-ai-logo-stacked-full-color.png"),
    "image/png",
  ),
  "/fonts/inter-latin-wght-normal.woff2": dataUri(
    join(root, "public/fonts/inter-latin-wght-normal.woff2"),
    "font/woff2",
  ),
};

function inlineAssets(source) {
  let next = source;
  for (const [path, uri] of Object.entries(assets)) {
    next = next.split(path).join(uri);
  }
  return next;
}

const js = inlineAssets(readFileSync(`${bundleBase}.js`, "utf8"));
const css = inlineAssets(readFileSync(`${bundleBase}.css`, "utf8"));

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Fender Brand Intelligence Canvas v3 — IntoFocus AI</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap" rel="stylesheet" />
  <style>
    @font-face {
      font-family: Inter;
      font-style: normal;
      font-weight: 100 900;
      font-display: swap;
      src: url("/fonts/inter-latin-wght-normal.woff2") format("woff2-variations");
    }
    :root { --font-playfair: "Playfair Display", Georgia, "Times New Roman", serif; }
    html, body { margin: 0; height: 100%; background: #070d18; font-family: Inter, system-ui, sans-serif; }
    #root { height: 100%; }
    ${css}
  </style>
</head>
<body>
  <div id="root"></div>
  <script>${js}</script>
</body>
</html>
`;

const inlined = inlineAssets(html);
writeFileSync(htmlPath, inlined);
console.log(`Wrote ${htmlPath} (${inlined.length} bytes)`);
