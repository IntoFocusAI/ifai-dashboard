/* Shared pieces of the client parity check (parity chunk C8, X-35, decisions 84 and 105).
   Pure code, no browser: which clients run, how a screen's structure is written down and
   compared, and which words from other clients must never show on a client's screens. */

import { readdirSync, readFileSync } from "node:fs";

export type ParitySettings = {
  client_key: string;
  display_name: string;
  legal_name: string;
  is_default: boolean;
  lead_brand_label: string;
  lead_brand_phrase: string;
  brand_name_terms: string[];
  product_line_terms: string[];
  portfolio_brands: string[];
  amazon_brand_names: string[];
  owned_domains: string[];
  brand_site_label: string;
  product_types: string[];
  vertical: string;
  data_schema: string;
  competitors: { name: string; terms: string[]; domains: string[] }[];
  logo_src?: string | null;
  seller_type?: string;
  retailers?: { key: string; name: string }[];
  data_sources?: Record<string, boolean>;
  /** True for a made-up client from e2e/fixtures/clients/, which has no data in the database. */
  fixture?: boolean;
};

/** Where the collect run leaves one JSON file per client for the compare run to read. */
export const PARITY_DIR = process.env.PARITY_DIR ?? "e2e-parity-out";

/** One screen as the collect run saw it. `lines` is structure only; `text` is for the word scan. */
export type Surface = { id: string; lines: string[]; text: string };
export type ClientCapture = { client_key: string; surfaces: Surface[] };

const ORDER = ["fender.json", "ledlenser.json"];

/** Every client in data/clients/ (default first), then the made-up clients in e2e/fixtures/clients/. */
export function parityClients(): ParitySettings[] {
  const read = (dir: string, fixture = false) =>
    readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b))
      .map((f) => ({ ...(JSON.parse(readFileSync(`${dir}/${f}`, "utf8")) as ParitySettings), fixture }));
  const real = read("data/clients");
  real.sort((a, b) => Number(b.is_default) - Number(a.is_default));
  return [...real, ...read("e2e/fixtures/clients", true)];
}

export const clientUrl = (c: ParitySettings, query = "") => {
  const params = [c.is_default ? "" : `client=${c.client_key}`, query].filter(Boolean).join("&");
  return params ? `/dashboard?${params}` : "/dashboard";
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A client's own words: its name, brand terms, product lines, brands and domains. */
export function ownWords(c: ParitySettings): string[] {
  const words = [
    c.display_name,
    c.lead_brand_label,
    ...c.lead_brand_label.split("/"),
    c.lead_brand_phrase,
    ...c.brand_name_terms,
    ...c.portfolio_brands,
    ...c.amazon_brand_names,
    ...c.owned_domains,
    c.brand_site_label,
  ];
  return [...new Set(words.map((w) => w.trim()).filter(Boolean))].sort((a, b) => b.length - a.length);
}

/** Writes a screen line so two clients' lines match when only the brand, domain or a number differs. */
export function normalizeLine(line: string, c: ParitySettings, numbers = true): string {
  let out = line.replace(/\s+/g, " ").trim();
  for (const w of ownWords(c)) out = out.replace(new RegExp(escapeRe(w), "gi"), "{brand}");
  return numbers ? out.replace(/\d[\d,.]*/g, "#") : out;
}

/* Words that name a vertical rather than one brand, by the `vertical` a settings file sets. Short on
   purpose: the rest of each list is built from the other clients' settings files. A client's own
   vertical words are its own data (a Fender catalog row says Stratocaster), so they are skipped for it. */
export const VERTICAL_WORDS: Record<string, string[]> = {
  music_instruments: ["guitar", "guitars", "stratocaster", "telecaster", "ukulele"],
  lighting: ["flashlight", "flashlights", "headlamp", "headlamps", "lumens", "lantern", "lanterns"],
  fishing: ["fishing rod", "fishing rods", "fishing reel", "angler", "tackle box"],
};

/* Names that are also ordinary words. They count only when written with a capital letter. */
const COMMON_WORDS = new Set(["coast", "boss", "spark", "martin", "taylor", "mustang", "jaguar", "affinity", "katana"]);

export type ForeignTerm = { term: string; from: string; kind: "brand" | "domain" | "product" | "vertical"; re: RegExp };

const capitalize = (s: string) => s.replace(/\b[a-z]/g, (m) => m.toUpperCase());

function termRegex(term: string, kind: ForeignTerm["kind"]): RegExp {
  if (kind === "domain") return new RegExp(`(^|[^a-z0-9-])${escapeRe(term)}`, "i");
  const ambiguous = COMMON_WORDS.has(term.toLowerCase());
  const text = ambiguous ? capitalize(term) : term;
  return new RegExp(`(^|[^A-Za-z0-9])${escapeRe(text)}(?![A-Za-z0-9])`, ambiguous ? "" : "i");
}

/** Everything that belongs to another client (or to a vertical) and must not appear for `client`. */
export function foreignTerms(client: ParitySettings, all: ParitySettings[]): ForeignTerm[] {
  const own = new Set([...ownWords(client), ...client.product_line_terms].map((w) => w.toLowerCase()));
  const ownProducts = new Set(client.product_types.map((p) => p.toLowerCase().replace(/_/g, " ")));
  const out = new Map<string, ForeignTerm>();
  const add = (term: string, from: string, kind: ForeignTerm["kind"]) => {
    const t = term.trim();
    if (t.length < 3 || own.has(t.toLowerCase()) || ownProducts.has(t.toLowerCase())) return;
    const key = `${kind}:${t.toLowerCase()}`;
    if (!out.has(key)) out.set(key, { term: t, from, kind, re: termRegex(t, kind) });
  };
  for (const other of all) {
    if (other.client_key === client.client_key) continue;
    const from = other.client_key;
    for (const w of ownWords(other)) add(w, from, w.includes(".") ? "domain" : "brand");
    for (const c of other.competitors) {
      add(c.name, from, "brand");
      for (const d of c.domains) add(d, from, "domain");
      for (const t of c.terms) if (t.length >= 5 && !COMMON_WORDS.has(t)) add(t, from, "brand");
    }
    for (const t of other.product_line_terms) add(t, from, "product");
    for (const p of other.product_types) {
      const phrase = p.toLowerCase().replace(/_/g, " ");
      add(phrase, from, "product");
      add(phrase.replace(/s$/, ""), from, "product");
    }
  }
  for (const [vertical, words] of Object.entries(VERTICAL_WORDS)) {
    if (vertical !== client.vertical) for (const w of words) add(w, `vertical:${vertical}`, "vertical");
  }
  return [...out.values()];
}

export type Hit = { client: string; surface: string; term: string; from: string; kind: string; context: string };

/** Foreign words found in one screen's text. */
export function findForeign(client: ParitySettings, surface: Surface, terms: ForeignTerm[]): Hit[] {
  const hits: Hit[] = [];
  for (const t of terms) {
    const m = t.re.exec(surface.text);
    if (!m) continue;
    const at = m.index + m[1].length;
    const context = surface.text.slice(Math.max(0, at - 40), at + t.term.length + 40).replace(/\s+/g, " ");
    hits.push({ client: client.client_key, surface: surface.id, term: t.term, from: t.from, kind: t.kind, context });
  }
  return hits;
}

/* Declared differences (decision 113). The only allowed difference between clients is additive and
   comes from a client's settings: its seller model, its retailers, its data sources, its logo. Each
   rule below is keyed to one settings field, never to a client name. Before two clients' lines are
   compared, each rule rewrites the lines that client's OWN settings declare, so a declared difference
   compares equal and an undeclared one still reports. For example, Fender's settings list Musician's
   Friend, so its MAP table's "Musician's Friend" column is set aside; a client whose settings do not
   list it and still shows the column is reported.
   One limit: a rule sets aside what a client declares, so a declared column that is missing is not
   reported by this check. Add a rule here, with its settings field and reason, rather than a client
   name anywhere in the test. */

export type DeclaredDifference = {
  id: string;
  /** The settings field the difference is keyed to. */
  field: keyof ParitySettings;
  /** Why it is allowed, in plain words (listed in docs/client-parity-gaps.md). */
  why: string;
  /** Rewrites one line of `client`'s capture. Returns the line unchanged when the rule does not apply, "" to set it aside. */
  apply: (line: string, client: ParitySettings) => string;
};

const fold = (s: string) => s.replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();

/** Channel columns a client's settings declare: Amazon when its offers are read, each retailer whose data source is on. */
export function declaredChannelColumns(c: ParitySettings): string[] {
  const on = (key: string) => c.data_sources?.[key] !== false;
  const names = (c.retailers ?? []).filter((r) => on(r.key)).map((r) => r.name);
  if (c.data_sources?.amazon_offers) names.push("Amazon");
  return names;
}

/** Copy that belongs to one seller model (docs/client-seller-models.md), by `seller_type`. */
export const SELLER_MODEL_PHRASES: Record<string, RegExp[]> = {
  partner_led: [/\bpartner-led\b/i, /\bauthori[sz]ed (partner|seller)s?\b/i],
  brand_led: [/\bbrand-led\b/i, /\bown seller accounts?\b/i],
};

export const DECLARED_DIFFERENCES: DeclaredDifference[] = [
  {
    id: "retailer-columns",
    field: "retailers",
    why: "A channel column (Amazon, Walmart, Musician's Friend and so on) shows for a client whose `retailers` list names that retailer and whose `data_sources` has it on (Amazon: `data_sources.amazon_offers`).",
    apply(line, client) {
      const m = /^(.* > columns: )(.*)$/.exec(line);
      if (!m) return line;
      const declared = new Set(declaredChannelColumns(client).map(fold));
      const kept = m[2].split(" | ").filter((cell) => !declared.has(fold(cell)));
      return `${m[1]}${kept.join(" | ")}`;
    },
  },
  {
    id: "seller-model",
    field: "seller_type",
    why: "Brand-led and partner-led clients read different copy and sections about who sells on Amazon (`seller_type`). A line with the client's own seller-model wording is set aside; the other model's wording still reports.",
    apply(line, client) {
      const own = SELLER_MODEL_PHRASES[client.seller_type ?? ""] ?? [];
      return own.some((re) => re.test(line)) ? "" : line;
    },
  },
  {
    id: "logo",
    field: "logo_src",
    why: "The Summary bubble shows the logo when `logo_src` is set and the brand name as text when it is null.",
    apply(line, client) {
      const m = /^(map > bubble hub: )(.*)$/.exec(line);
      if (!m) return line;
      if (client.logo_src == null && m[2] !== "{brand}") return line;
      return `${m[1]}<logo, or the brand name when logo_src is null>`;
    },
  },
];

/** A client's lines with its declared differences set aside. */
export function applyDeclared(lines: string[], client: ParitySettings, rules: DeclaredDifference[] = DECLARED_DIFFERENCES): string[] {
  const out = lines.map((line) => rules.reduce((l, rule) => (l ? rule.apply(l, client) : l), line)).filter(Boolean);
  return [...new Set(out)];
}

/** Every capture with each client's declared differences set aside (clients missing from `settings` are left as they are). */
export function withDeclaredDifferences(captures: ClientCapture[], settings: ParitySettings[], rules = DECLARED_DIFFERENCES): ClientCapture[] {
  return captures.map((cap) => {
    const client = settings.find((s) => s.client_key === cap.client_key);
    if (!client) return cap;
    return { ...cap, surfaces: cap.surfaces.map((s) => ({ ...s, lines: applyDeclared(s.lines, client, rules) })) };
  });
}

export type LayoutGap = { line: string; has: string[]; lacks: string[] };

/** Lines that not every client has, with who has them. Structure only; values are normalized away. */
export function layoutGaps(captures: ClientCapture[], surfaceFilter: (id: string) => boolean): LayoutGap[] {
  const keys = captures.map((c) => c.client_key);
  const perClient = new Map<string, Set<string>>();
  for (const c of captures) {
    perClient.set(c.client_key, new Set(c.surfaces.filter((s) => surfaceFilter(s.id)).flatMap((s) => s.lines)));
  }
  const union = new Set([...perClient.values()].flatMap((s) => [...s]));
  const gaps: LayoutGap[] = [];
  for (const line of [...union].sort()) {
    const has = keys.filter((k) => perClient.get(k)!.has(line));
    if (has.length !== keys.length) gaps.push({ line, has, lacks: keys.filter((k) => !has.includes(k)) });
  }
  return gaps;
}
