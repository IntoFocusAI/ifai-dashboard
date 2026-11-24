import { assert, assertEquals, assertMatch } from "@std/assert";
import {
  formatDuration,
  openText,
  parseFeed,
  parseStatuspage,
  parseXaiRss,
  resolvedParentText,
  slackEscape,
  updateText,
} from "./parse.ts";

// Trimmed from www.githubstatus.com/api/v2/incidents.json (updates arrive newest first).
const GITHUB = {
  page: { id: "kctbh9vrtdwd" },
  incidents: [
    {
      id: "m310qbkfm3ww",
      name: "Disruption with some GitHub services",
      status: "resolved",
      impact: "minor",
      shortlink: "https://stspg.io/pvjz2g01trc7",
      created_at: "2026-11-19T17:06:26.807Z",
      started_at: "2026-11-19T17:06:26.800Z",
      resolved_at: "2026-11-19T18:17:42.581Z",
      incident_updates: [
        {
          id: "u3",
          status: "resolved",
          body: "This incident has been resolved.",
          display_at: "2026-11-19T18:17:42.581Z",
          created_at: "2026-11-19T18:17:42.581Z",
        },
        {
          id: "g3z98glr8lrq",
          status: "monitoring",
          body: "The degradation has been mitigated. We are monitoring to ensure stability.",
          display_at: "2026-11-19T18:05:21.158Z",
          created_at: "2026-11-19T18:05:21.158Z",
        },
        {
          id: "u1",
          status: "investigating",
          body: "We are investigating reports of degraded performance.",
          display_at: "2026-11-19T17:06:26.900Z",
          created_at: "2026-11-19T17:06:26.900Z",
        },
      ],
    },
    {
      id: "open1",
      name: "Actions delays",
      status: "identified",
      impact: "none",
      shortlink: null,
      created_at: "2026-11-23T10:00:00Z",
      resolved_at: null,
      incident_updates: [],
    },
  ],
};

// Trimmed from status.openai.com/api/v2/incidents.json (no shortlink, no started_at).
const OPENAI = {
  page: { id: "01JMDK9XYNY6RXSED6SDWW50WY" },
  incidents: [{
    id: "01M84HKHX73RF7HTVZQ2A9GFXP",
    name: "Elevated errors with GPT-6 conversations on paid ChatGPT plans",
    status: "resolved",
    impact: "minor",
    created_at: "2026-11-23T15:50:14Z",
    resolved_at: "2026-11-23T16:38:46Z",
    incident_updates: [{
      id: "01M84MCE1X9X0X9295GPNS97HJ",
      body: "All affected services are operating normally again. We’re sorry for the disruption.",
      created_at: "2026-11-23T16:38:46Z",
      display_at: "2026-11-23T16:38:46Z",
      status: "resolved",
    }],
  }],
};

// Trimmed from status.x.ai/feed.xml.
const XAI = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>SpaceXAI System Status</title>
    <item>
      <title>[Grok Build and Cursor: Desktop] Grok 4.5 Degraded</title>
      <link>https://status.x.ai/cursor-desktop/ps_ce2b4247388345bd</link>
      <guid isPermaLink="false">ps_ce2b4247388345bd</guid>
      <description><![CDATA[<h3>Status: RESOLVED</h3><p>Severity: disruption</p><p>Resolved: Mon, 23 Nov 2026 03:36:53 GMT</p><hr /><h4>Updates:</h4><div><p><strong>Mon, 23 Nov 2026 03:36:53 GMT</strong></p><h3>Resolved</h3><p>This incident has been resolved.</p></div><div><p><strong>Mon, 23 Nov 2026 03:05:16 GMT</strong></p><h3>Monitoring</h3><p>A fix has been implemented &amp; we are monitoring.</p></div><div><p><strong>Mon, 23 Nov 2026 03:02:19 GMT</strong></p><h3>Investigating</h3><p>We are investigating a service degradation affecting Grok 4.5.</p></div>]]></description>
      <pubDate>Mon, 23 Nov 2026 03:02:19 GMT</pubDate>
      <category>disruption</category>
      <category>resolved</category>
    </item>
    <item>
      <title>[Grok Build and Cursor: Agent SDK] Degraded Performance Agent SDK</title>
      <link>https://status.x.ai/agent-sdk/ps_9bc5a5e59f3188cf</link>
      <guid isPermaLink="false">ps_9bc5a5e59f3188cf</guid>
      <description><![CDATA[<h3>Status: ACTIVE</h3><p>Severity: disruption</p><hr /><h4>Updates:</h4><div><p><strong>Fri, 20 Nov 2026 19:26:13 GMT</strong></p><h3>Investigating</h3><p>We are investigating degraded performance affecting the Agent SDK.</p></div>]]></description>
      <pubDate>Fri, 20 Nov 2026 19:26:13 GMT</pubDate>
      <category>disruption</category>
      <category>active</category>
    </item>
  </channel>
</rss>`;

Deno.test("statuspage: incident fields and updates oldest first", () => {
  const [inc, open] = parseStatuspage(GITHUB, "https://www.githubstatus.com");
  assertEquals(inc.id, "m310qbkfm3ww");
  assertEquals(inc.resolved, true);
  assertEquals(inc.url, "https://stspg.io/pvjz2g01trc7");
  assertEquals(inc.impact, "minor");
  assertEquals(inc.openedAt, "2026-11-19T17:06:26.800Z");
  assertEquals(inc.updates.map((u) => u.id), ["u1", "g3z98glr8lrq", "u3"]);
  assertEquals(open.resolved, false);
  assertEquals(open.impact, null, "impact 'none' is dropped");
  assertEquals(open.url, "https://www.githubstatus.com/incidents/open1", "falls back to page URL");
});

Deno.test("statuspage: OpenAI shape (no shortlink) builds its own link", () => {
  const [inc] = parseFeed("statuspage", JSON.stringify(OPENAI), "https://status.openai.com/");
  assertEquals(inc.url, "https://status.openai.com/incidents/01M84HKHX73RF7HTVZQ2A9GFXP");
  assertEquals(inc.openedAt, "2026-11-23T15:50:14.000Z");
  assertEquals(inc.resolvedAt, "2026-11-23T16:38:46.000Z");
  assertEquals(inc.updates.length, 1);
});

Deno.test("statuspage: tolerates junk", () => {
  assertEquals(parseStatuspage({}, "https://x"), []);
  assertEquals(parseStatuspage({ incidents: [null, { name: "no id" }] }, "https://x"), []);
});

Deno.test("xai rss: resolved item with three updates", () => {
  const [inc, active] = parseXaiRss(XAI);
  assertEquals(inc.id, "ps_ce2b4247388345bd");
  assertEquals(inc.title, "[Grok Build and Cursor: Desktop] Grok 4.5 Degraded");
  assertEquals(inc.resolved, true);
  assertEquals(inc.status, "resolved");
  assertEquals(inc.impact, "disruption");
  assertEquals(inc.resolvedAt, "2026-11-23T03:36:53.000Z");
  assertEquals(inc.openedAt, "2026-11-23T03:02:19.000Z");
  assertEquals(inc.updates.map((u) => u.status), ["investigating", "monitoring", "resolved"]);
  assertEquals(inc.updates[1].body, "A fix has been implemented & we are monitoring.");
  assertEquals(inc.updates[0].id, "ps_ce2b4247388345bd@2026-11-23T03:02:19.000Z");

  assertEquals(active.resolved, false);
  assertEquals(active.status, "investigating");
  assertEquals(active.resolvedAt, null);
});

Deno.test("xai rss: update ids are stable across fetches", () => {
  const a = parseXaiRss(XAI).flatMap((i) => i.updates.map((u) => u.id));
  const b = parseXaiRss(XAI).flatMap((i) => i.updates.map((u) => u.id));
  assertEquals(a, b);
  assertEquals(new Set(a).size, a.length);
});

Deno.test("slack text", () => {
  const [inc] = parseStatuspage(GITHUB, "https://www.githubstatus.com");
  const open = openText("GitHub", inc);
  assert(open.startsWith("🔴 *GitHub* · <https://stspg.io/pvjz2g01trc7|Disruption with some GitHub services>"));
  assertMatch(open, /impact: minor/);
  assertMatch(open, /Started Nov 19, 12:06 PM EST/);

  assertEquals(
    resolvedParentText("GitHub", inc, inc.resolvedAt!),
    "✅ RESOLVED · *GitHub* · <https://stspg.io/pvjz2g01trc7|Disruption with some GitHub services> · lasted 1h 11m",
  );
  assertEquals(
    updateText(inc.updates[1]),
    "_Monitoring_ · Nov 19, 1:05 PM EST · The degradation has been mitigated. We are monitoring to ensure stability.",
  );
  assertEquals(slackEscape("a <b> & c"), "a &lt;b&gt; &amp; c");
  const long = updateText({ id: "x", status: "identified", body: "y".repeat(5000), at: inc.openedAt });
  assert(long.length < 2700);
});

Deno.test("durations", () => {
  assertEquals(formatDuration("2026-11-01T00:00:00Z", "2026-11-01T00:42:10Z"), "42m");
  assertEquals(formatDuration("2026-11-01T00:00:00Z", "2026-11-02T03:05:00Z"), "27h 5m");
  assertEquals(formatDuration("2026-11-01T00:00:00Z", "2026-11-04T05:00:00Z"), "3d 5h");
});
