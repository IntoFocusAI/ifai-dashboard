// HS256 tokens for the local portal test stack only (issue 248). Never used against a hosted project.
import { createHmac, timingSafeEqual } from "node:crypto";

const b64url = (input) => Buffer.from(input).toString("base64url");

export function signJwt(payload, secret) {
  const head = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

export function verifyJwt(token, secret) {
  const parts = String(token ?? "").split(".");
  if (parts.length !== 3) return null;
  const expected = createHmac("sha256", secret).update(`${parts[0]}.${parts[1]}`).digest();
  const given = Buffer.from(parts[2], "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  if (typeof claims.exp === "number" && claims.exp < Date.now() / 1000) return null;
  return claims;
}
