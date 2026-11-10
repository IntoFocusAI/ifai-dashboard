// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/count-separators.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { competitorWinsCount, competitorWinsFigure } from "../lib/ai-search/competitor-wins-lead.ts";
import { answeredOfCallsLine, errorLine, formatObservedRate, resolvedPhrase, type AiRunSummary } from "../lib/ai-search/summary.ts";
import type { OutcomeTally, RunCompleteness } from "../lib/ai-search/run-metrics.ts";

const flat = (path: string) => readFileSync(path, "utf8").replace(/\s+/g, " ");

test("Competitor Wins reads 1,064 of 1,788, and the hero still splits the count out for its tooltip", () => {
  const figure = competitorWinsFigure(1064, 1788);
  assert.equal(figure, "Competitors led 1,064 of 1,788 resolved unbranded discovery answers.");
  const count = competitorWinsCount(1064, 1788);
  assert.equal(count, "1,064 of 1,788");
  assert.equal(figure.indexOf(count), "Competitors led ".length);
  assert.equal(competitorWinsFigure(175, 438), "Competitors led 175 of 438 resolved unbranded discovery answers.");

  const hero = flat("components/v3/live/ai-search/CompetitorWinsHero.tsx");
  assert.match(hero, /const count = competitorWinsCount\(competitorWins, resolved\);/);
  assert.match(hero, /<MixedScoringTip mixed=\{mixed\}>\{count\}<\/MixedScoringTip>/);
  assert.match(hero, /\$\{formatInt\(resolved - competitorWins\)\} \$\{leadBrand\(\)\} led/);
  const surfaces = flat("lib/ai-search/canvas-surfaces.ts");
  assert.match(surfaces, /figure: competitorWinsFigure\(s\.competitorWins, s\.roles\.unbranded\.resolved\)/);

  const panel = flat("components/v3/live/ai-search/CompetitorWinsPanel.tsx");
  assert.match(panel, /<td>\{competitorLeadsCell\(t\)\}<\/td>/);
  const radar = flat("lib/ai-search/radar-tables.ts");
  assert.match(radar, /return `\$\{ofResolved\(row\.wins, row\.resolved\)\} resolved`;/);
  assert.doesNotMatch(radar, /\$\{c\.wins\} of \$\{c\.resolved\}|\$\{e\.wins\} of \$\{e\.resolved\}/);
  assert.match(panel, /\{formatInt\(shown\.length\)\} answers/);
  assert.doesNotMatch(panel, /\$\{c\.wins\} of \$\{c\.resolved\}|\$\{e\.wins\} of \$\{e\.resolved\}|\{t\.wins\} of \{t\.resolved\}/);
});

test("Run Summary counts use the shared formatter", () => {
  const tally = { fenderWins: 1064, resolved: 1788 } as OutcomeTally;
  assert.equal(formatObservedRate(1064, 1788), "59.5% (1,064 of 1,788)");
  assert.equal(resolvedPhrase(tally), "1,064 of 1,788 resolved answers (59.5%)");
  assert.equal(formatObservedRate(263, 438), "60.0% (263 of 438)");
  assert.equal(
    answeredOfCallsLine({ answeredRows: 4601, rowsRead: 6628 } as RunCompleteness),
    "4,601 answered of 6,628 calls",
  );
  assert.equal(
    errorLine({ errorEngines: [{ engine: "perplexity", errors: 1250 }, { engine: "gemini", errors: 12 }] } as unknown as AiRunSummary),
    "1,262 provider errors (1,250 Perplexity, 12 Gemini)",
  );

  const summary = flat("components/v3/live/ai-search/RunSummaryPanel.tsx");
  assert.match(summary, /tip=\{`\$\{formatInt\(tally\.fenderWins\)\} \$\{leadBrand\(\)\} leads\. \$\{formatInt\(tally\.resolved - tally\.fenderWins\)\} rest/);
  assert.match(summary, /\{formatInt\(tally\.fenderWins\)\} \{leadBrand\(\)\} leads/);
  assert.match(summary, /\{formatInt\(tally\.resolved\)\} <\/EvidenceLink>/);
  assert.match(summary, /<td>\{formatInt\(aside\.unresolved\)\}<\/td> <td>\{formatInt\(aside\.errors\)\}<\/td>/);
  assert.doesNotMatch(summary, /\$\{tally\.fenderWins\} of \$\{tally\.resolved\}/);

  const roles = flat("components/v3/live/ai-search/RoleRateTable.tsx");
  assert.match(roles, /`\$\{name\}: \$\{leadBrand\(\)\} leads`, formatInt\(tally\.fenderWins\), scope\)/);
  assert.match(roles, /`\$\{name\}: resolved answers`, formatInt\(tally\.resolved\)\)\} resolved answers/);

  const card = flat("components/v3/live/ai-search/RunCompletenessCard.tsx");
  assert.match(card, /formatInt\(run\.expected_calls\)/);
  assert.match(card, /formatInt\(run\.answered_calls\)/);
  assert.match(card, /formatInt\(run\.missing_calls\)/);
});

test("the Category Battlecards hero reads 1,064 of 1,788 and Competitors led 724 of 1,788", () => {
  const heroes = flat("components/v3/live/ai-search/CategoryBattleHeroes.tsx");
  assert.match(heroes, /\{formatInt\(summary\.onTrack\)\} of \{formatInt\(summary\.measured\)\}/);
  assert.match(heroes, /label=\{`\$\{name\}: \$\{leadBrand\(\)\} leads`\}> \{formatInt\(tally\.fenderWins\)\} <\/EvidenceLink>/);
  assert.match(heroes, /label=\{`\$\{name\}: resolved answers`\}> \{formatInt\(tally\.resolved\)\} <\/EvidenceLink>/);
  assert.match(heroes, /label=\{`\$\{name\}: competitors lead`\}> \{formatInt\(tally\.competitorWins\)\} <\/EvidenceLink>/);
  assert.match(heroes, /\{` of \$\{formatInt\(tally\.resolved\)\}`\}/);
  assert.match(heroes, /tip=\{`\$\{formatInt\(summary\.onTrack\)\} on track\./);
  for (const raw of [/\{tally\.fenderWins\}/, /\{tally\.resolved\}/, /\{tally\.competitorWins\}/, /\{summary\.onTrack\} of/, /of \$\{tally\.resolved\}/]) {
    assert.doesNotMatch(heroes, raw);
  }
  const lead = flat("components/v3/live/ai-search/RunDetailsLead.tsx");
  assert.match(lead, /tip=\{`\$\{formatInt\(tally\.fenderWins\)\} \$\{leadBrand\(\)\} leads\. \$\{formatInt\(tally\.resolved - tally\.fenderWins\)\} rest of resolved answers\. Total \$\{formatInt\(tally\.resolved\)\} resolved answers\.`\}/);
});
