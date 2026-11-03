/**
 * Rebuild fender-brand-canvas-v3.html and upload it to the FenderTest
 * Toolbelt workspace, then refresh dashboard page "v3".
 *
 * Connection, in order:
 * 1. FENDERTEST_TOOLBELT_MCP_URL (cloud environment secret; the Streamable HTTP URL)
 * 2. .cursor/mcp.json server whose name contains "fendertest"
 *
 * Usage: node scripts/push-v3-toolbelt.mjs
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const mcpPkgDir = join(root, ".tmp/mcp-upload");
const sdkRoot = join(mcpPkgDir, "node_modules/@modelcontextprotocol/sdk/dist/esm");
if (!existsSync(join(sdkRoot, "client/index.js"))) {
  mkdirSync(mcpPkgDir, { recursive: true });
  if (!existsSync(join(mcpPkgDir, "package.json"))) {
    spawnSync("npm", ["init", "-y"], { cwd: mcpPkgDir, stdio: "ignore" });
  }
  spawnSync("npm", ["install", "@modelcontextprotocol/sdk@1", "--silent"], {
    cwd: mcpPkgDir,
    stdio: "inherit",
  });
}
const { Client } = await import(join(sdkRoot, "client/index.js"));
const { StreamableHTTPClientTransport } = await import(join(sdkRoot, "client/streamableHttp.js"));
const htmlPath = join(root, "fender-brand-canvas-v3.html");
const mcpConfigPath = join(root, ".cursor/mcp.json");

function fenderMcpUrl() {
  const fromEnv = process.env.FENDERTEST_TOOLBELT_MCP_URL?.trim();
  if (fromEnv) {
    // Accept a pasted client config snippet as well as a bare URL.
    const found = fromEnv.match(/https:\/\/[^\s"'<>]+/)?.[0];
    if (!found || !URL.canParse(found)) {
      console.error("FENDERTEST_TOOLBELT_MCP_URL does not contain a valid https URL.");
      process.exit(1);
    }
    return found;
  }
  if (!existsSync(mcpConfigPath)) {
    console.error(
      "Missing FenderTest Toolbelt connection. Set FENDERTEST_TOOLBELT_MCP_URL or create .cursor/mcp.json.",
    );
    process.exit(1);
  }
  const servers = JSON.parse(readFileSync(mcpConfigPath, "utf8")).mcpServers ?? {};
  const match = Object.entries(servers).find(([name]) => name.toLowerCase().includes("fendertest"));
  const url = match?.[1]?.url;
  if (!url) {
    console.error(
      "Set FENDERTEST_TOOLBELT_MCP_URL or add the FenderTest server URL to .cursor/mcp.json.",
    );
    process.exit(1);
  }
  return url;
}

const url = fenderMcpUrl();

const build = spawnSync("node", ["scripts/build-v3-html.mjs"], { cwd: root, stdio: "inherit" });
if (build.status !== 0) process.exit(build.status ?? 1);

const transport = new StreamableHTTPClientTransport(new URL(url));
const client = new Client({ name: "ifai-v3-push", version: "1.0.0" });
await client.connect(transport);

const b64 = readFileSync(htmlPath).toString("base64");
const upload = await client.callTool({
  name: "upload_file_to_storage",
  arguments: {
    fileName: "fender-brand-canvas-v3.html",
    fileContent: b64,
    contentType: "text/html",
    waitForUpload: true,
  },
});
console.log("upload:", JSON.stringify(upload));

const page = await client.callTool({
  name: "toolbelt",
  arguments: {
    action: "update_dashboard_page",
    params: JSON.stringify({
      pageSlug: "v3",
      name: "Fender Brand Intelligence Canvas v3",
      pageType: "html",
      sourceFile: "fender-brand-canvas-v3.html",
      isPublic: true,
    }),
  },
});
console.log("dashboard:", JSON.stringify(page));

await client.close();
