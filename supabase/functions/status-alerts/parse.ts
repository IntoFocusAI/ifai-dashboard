// Pure parsing and formatting for the status-alerts function. No network, no database,
// so it can be tested with `deno test`.

export type FeedKind = "statuspage" | "rss_xai";

export interface ParsedUpdate {
  id: string;
  status: string; // lower-case, e.g. "investigating", "resolved"
  body: string; // plain text
  at: string; // ISO timestamp
}

export interface ParsedIncident {
  id: string;
  title: string;
  status: string; // lower-case
  resolved: boolean;
  impact: string | null;
  url: string;
  openedAt: string; // ISO
  resolvedAt: string | null; // ISO
  updates: ParsedUpdate[]; // oldest first
}

const RESOLVED = new Set(["resolved", "postmortem", "completed"]);

export function isResolvedStatus(status: string): boolean {
  return RESOLVED.has(status.toLowerCase());
}

function toIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

// deno-lint-ignore no-explicit-any
type Json = any;

/** Atlassian Statuspage `/api/v2/incidents.json` (also served by OpenAI's incident.io page). */
export function parseStatuspage(json: Json, pageBaseUrl: string): ParsedIncident[] {
  const incidents: Json[] = Array.isArray(json?.incidents) ? json.incidents : [];
  const base = pageBaseUrl.replace(/\/+$/, "");
  return incidents
    .filter((i) => i && typeof i.id === "string")
    .map((i) => {
      const status = String(i.status ?? "").toLowerCase();
      const updates: ParsedUpdate[] = (Array.isArray(i.incident_updates) ? i.incident_updates : [])
        .filter((u: Json) => u && typeof u.id === "string")
        .map((u: Json) => ({
          id: u.id,
          status: String(u.status ?? "").toLowerCase(),
          // Statuspage bodies can carry <br /> and other simple HTML.
          body: htmlToText(String(u.body ?? "")),
          at: toIso(u.display_at) ?? toIso(u.created_at) ?? new Date(0).toISOString(),
        }))
        .sort((a: ParsedUpdate, b: ParsedUpdate) => a.at.localeCompare(b.at));
      return {
        id: i.id,
        title: String(i.name ?? "(untitled incident)").trim(),
        status,
        resolved: isResolvedStatus(status),
        impact: i.impact && i.impact !== "none" ? String(i.impact) : null,
        url: (typeof i.shortlink === "string" && i.shortlink) || `${base}/incidents/${i.id}`,
        openedAt: toIso(i.started_at) ?? toIso(i.created_at) ?? new Date(0).toISOString(),
        resolvedAt: toIso(i.resolved_at),
        updates,
      };
    });
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isNaN(code) ? m : String.fromCodePoint(code);
    }
    return ENTITIES[e] ?? m;
  });
}

export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>\s*<p[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  ).replace(/[ \t]+\n/g, "\n").trim();
}

function tag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  if (!m) return null;
  const inner = m[1].trim();
  const cdata = inner.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return cdata ? cdata[1] : decodeEntities(inner);
}

/** xAI status RSS (https://status.x.ai/feed.xml). Updates live inside each item's description. */
export function parseXaiRss(xml: string): ParsedIncident[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  const out: ParsedIncident[] = [];
  for (const item of items) {
    const guid = tag(item, "guid");
    if (!guid) continue;
    const title = htmlToText(tag(item, "title") ?? "(untitled incident)");
    const link = tag(item, "link") ?? "https://status.x.ai";
    const desc = tag(item, "description") ?? "";
    const pub = toIso(tag(item, "pubDate"));
    const categories = [...item.matchAll(/<category>([\s\S]*?)<\/category>/gi)].map((m) =>
      decodeEntities(m[1].trim()).toLowerCase()
    );

    const headStatus = desc.match(/<h3>\s*Status:\s*([^<]+)<\/h3>/i)?.[1].trim().toLowerCase();
    const severity = desc.match(/<p>\s*Severity:\s*([^<]+)<\/p>/i)?.[1].trim() ??
      categories.find((c) => c !== "resolved" && c !== "active") ?? null;

    const updates: ParsedUpdate[] = [];
    for (const block of desc.match(/<div>[\s\S]*?<\/div>/gi) ?? []) {
      const when = toIso(block.match(/<strong>([^<]+)<\/strong>/i)?.[1]);
      if (!when) continue;
      const status = (block.match(/<h3>([^<]+)<\/h3>/i)?.[1] ?? "").trim().toLowerCase();
      const bodyHtml = block.replace(/^[\s\S]*?<\/h3>/i, "");
      updates.push({ id: `${guid}@${when}`, status, body: htmlToText(bodyHtml), at: when });
    }
    updates.sort((a, b) => a.at.localeCompare(b.at));

    const resolved = headStatus === "resolved" || (headStatus === undefined && categories.includes("resolved"));
    const last = updates[updates.length - 1];
    const status = resolved ? "resolved" : (last?.status || headStatus || "active");
    const resolvedAt = resolved
      ? (toIso(desc.match(/<p>\s*Resolved:\s*([^<]+)<\/p>/i)?.[1]) ??
        [...updates].reverse().find((u) => u.status === "resolved")?.at ?? null)
      : null;

    out.push({
      id: guid,
      title,
      status,
      resolved,
      impact: severity,
      url: link,
      openedAt: updates[0]?.at ?? pub ?? new Date(0).toISOString(),
      resolvedAt,
      updates,
    });
  }
  return out;
}

export function parseFeed(kind: FeedKind, body: string, pageBaseUrl: string): ParsedIncident[] {
  if (kind === "statuspage") return parseStatuspage(JSON.parse(body), pageBaseUrl);
  if (kind === "rss_xai") return parseXaiRss(body);
  throw new Error(`unknown feed kind: ${kind}`);
}

// ---------- Slack text ----------

/** Escape the three characters Slack mrkdwn treats specially. */
export function slackEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export function formatEt(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));
}

export function formatDuration(fromIso: string, toIso: string): string {
  const mins = Math.max(0, Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 60000));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 48) return `${h}h ${mins % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

const MAX_BODY = 2500;

function link(inc: ParsedIncident): string {
  return `<${inc.url}|${slackEscape(inc.title)}>`;
}

export function openText(source: string, inc: ParsedIncident): string {
  const impact = inc.impact ? ` · impact: ${slackEscape(inc.impact)}` : "";
  return `🔴 *${slackEscape(source)}* · ${link(inc)}${impact}\nStarted ${formatEt(inc.openedAt)}`;
}

export function resolvedParentText(source: string, inc: ParsedIncident, resolvedAtIso: string): string {
  return `✅ RESOLVED · *${slackEscape(source)}* · ${link(inc)} · lasted ${
    formatDuration(inc.openedAt, resolvedAtIso)
  }`;
}

export function updateText(u: ParsedUpdate): string {
  let body = u.body;
  if (body.length > MAX_BODY) body = body.slice(0, MAX_BODY) + "…";
  const status = u.status ? `_${slackEscape(capitalize(u.status))}_ · ` : "";
  return `${status}${formatEt(u.at)}${body ? ` · ${slackEscape(body)}` : ""}`;
}

export function resolvedReplyText(resolvedAtIso: string): string {
  return `✅ Resolved · ${formatEt(resolvedAtIso)}`;
}

export function reopenedReplyText(): string {
  return "🔴 Reopened: the provider marked this incident active again.";
}
