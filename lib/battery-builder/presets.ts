import { DEFAULT_FRAME, type Attributes } from "@/lib/battery-builder/render";
import type { BuilderVariable } from "@/lib/battery-builder/generate";

/**
 * Starting points for Fender, one per battery category. The details follow the wave 2 battery
 * (p38 to p67) and Justin Hittell's Recommendation Lab study (Oct 2026).
 */
export type BuilderPreset = {
  /** Battery category the new prompts are saved under. */
  category: string;
  label: string;
  item: string;
  personaNoun: string;
  variables: BuilderVariable[];
  baseline: Attributes;
  tested: string[];
};

const questionStyle: BuilderVariable = {
  name: "question_style",
  label: "Question style",
  slot: "frame",
  template: "{value}",
  values: [DEFAULT_FRAME, "Which brand makes the best {request}?", "I'm looking for {a_request}. What is the best one to buy?"],
};

const player: BuilderVariable = {
  name: "player",
  label: "Player",
  slot: "persona",
  template: "{value}",
  values: ["beginner", "intermediate", "professional"],
};

const budget = (values: string[]): BuilderVariable => ({ name: "budget", label: "Budget", slot: "constraint", template: "{value}", values });

const priority: BuilderVariable = {
  name: "priority",
  label: "Top priority",
  slot: "clause",
  template: "cares most about {value}",
  values: ["value for money", "resale value", "quality control", "it being made in the USA"],
};

const usageDetail = (values: string[]): BuilderVariable => ({ name: "use", label: "Use", slot: "clause", template: "plans to use it for {value}", values });

export const FENDER_PRESETS: readonly BuilderPreset[] = [
  {
    category: "electrics",
    label: "Electric guitars",
    item: "electric guitar",
    personaNoun: "player",
    variables: [
      questionStyle,
      player,
      { name: "genre", label: "Genre", slot: "persona", template: "{value}", values: ["blues", "rock", "metal", "jazz", "country"] },
      budget(["under $300", "under $500", "under $1,000", "around $1,500", "with no budget limit"]),
      priority,
      {
        name: "upgrade",
        label: "Upgrade moment",
        slot: "context",
        template: "{value}",
        values: ["I'm upgrading from a Squier.", "I'm upgrading from a Yamaha Pacifica.", "I currently play a Gibson Les Paul."],
      },
    ],
    baseline: { question_style: DEFAULT_FRAME, player: "intermediate", budget: "under $1,000" },
    tested: ["player", "genre", "budget"],
  },
  {
    category: "acoustics",
    label: "Acoustic guitars",
    item: "acoustic guitar",
    personaNoun: "player",
    variables: [
      questionStyle,
      player,
      budget(["under $300", "under $500", "under $1,000", "around $1,500"]),
      { name: "feature", label: "Feature", slot: "constraint", template: "{value}", values: ["with a solid top", "with a small body", "with built-in electronics"] },
      usageDetail(["fingerstyle playing", "playing live", "songwriting", "travel"]),
    ],
    baseline: { question_style: DEFAULT_FRAME, player: "intermediate", budget: "under $1,000" },
    tested: ["budget", "use"],
  },
  {
    category: "amps",
    label: "Amps",
    item: "guitar amp",
    personaNoun: "player",
    variables: [
      questionStyle,
      player,
      budget(["under $300", "under $500", "under $1,000"]),
      { name: "tone", label: "Tone", slot: "clause", template: "wants {value}", values: ["clean tones", "high-gain distortion", "vintage tube tone"] },
      usageDetail(["home practice", "gigging", "home recording"]),
    ],
    baseline: { question_style: DEFAULT_FRAME, player: "intermediate", budget: "under $500" },
    tested: ["tone", "use"],
  },
  {
    category: "basses",
    label: "Basses",
    item: "bass guitar",
    personaNoun: "player",
    variables: [
      questionStyle,
      player,
      { name: "genre", label: "Genre", slot: "persona", template: "{value}", values: ["rock", "metal", "funk", "jazz"] },
      budget(["under $500", "under $1,000", "around $1,500"]),
      { name: "feature", label: "Feature", slot: "constraint", template: "{value}", values: ["with a short scale", "with five strings", "with active pickups"] },
    ],
    baseline: { question_style: DEFAULT_FRAME, player: "intermediate", budget: "under $1,000" },
    tested: ["genre", "feature"],
  },
];
