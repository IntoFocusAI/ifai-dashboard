// Local portal test stack only (issue 248). Stands in for the Supabase API gateway in front of a
// local PostgREST: /rest/v1/* goes to PostgREST, and /auth/v1/user answers for a token signed
// with the stack's own random secret, which is all @supabase/ssr needs to read a session.
// The real Supabase Auth service is not used here (its image could not be pulled in the build
// environment); sign-in itself belongs to the portal.
//   node e2e/portal/local-gateway.mjs   (env: GATEWAY_PORT, POSTGREST_URL, JWT_SECRET)
import { createServer } from "node:http";
import { verifyJwt } from "./jwt.mjs";

const port = Number(process.env.GATEWAY_PORT ?? 54421);
const postgrest = process.env.POSTGREST_URL ?? "http://127.0.0.1:54423";
const secret = process.env.JWT_SECRET;
if (!secret) throw new Error("JWT_SECRET is required.");

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, accept, accept-profile, content-profile, prefer, range, x-client-info",
  "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "access-control-expose-headers": "content-range",
};

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json", ...cors });
  res.end(JSON.stringify(body));
}

createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, cors);
    return res.end();
  }
  const url = new URL(req.url ?? "/", "http://gateway");
  if (url.pathname === "/auth/v1/user") {
    const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
    const claims = verifyJwt(token, secret);
    if (!claims || claims.role !== "authenticated" || !claims.sub) {
      return json(res, 401, { code: 401, error_code: "bad_jwt", msg: "invalid JWT" });
    }
    return json(res, 200, {
      id: claims.sub,
      aud: "authenticated",
      role: "authenticated",
      email: claims.email ?? null,
      app_metadata: {},
      user_metadata: {},
      created_at: new Date(0).toISOString(),
    });
  }
  if (url.pathname.startsWith("/auth/v1/")) return json(res, 404, { msg: "not served by the local test gateway" });
  if (!url.pathname.startsWith("/rest/v1")) return json(res, 404, { msg: "not found" });

  const target = `${postgrest}${url.pathname.slice("/rest/v1".length) || "/"}${url.search}`;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const headers = { ...req.headers };
  delete headers.host;
  delete headers["content-length"];
  let upstream;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body: chunks.length && req.method !== "GET" && req.method !== "HEAD" ? Buffer.concat(chunks) : undefined,
    });
  } catch (error) {
    return json(res, 502, { msg: `PostgREST did not answer: ${error?.cause?.code ?? error}` });
  }
  const out = { ...cors };
  upstream.headers.forEach((value, key) => {
    if (!["content-encoding", "content-length", "transfer-encoding", "connection"].includes(key)) out[key] = value;
  });
  res.writeHead(upstream.status, out);
  res.end(Buffer.from(await upstream.arrayBuffer()));
}).listen(port, "127.0.0.1", () => console.log(`local gateway on http://127.0.0.1:${port}`));
