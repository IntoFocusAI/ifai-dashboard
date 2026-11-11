import type { CanvasNode } from "@/lib/canvas-sdk/types";
import { FENDER_METRICS } from "@/components/v3/fender-metrics";
import { aiNodeFaces } from "@/lib/ai-search/canvas-surfaces";
import { retailBubbleFaces } from "@/lib/fender-canvas/portfolio-retail-display";
import { primarySpoke, satelliteNode } from "@/lib/fender-canvas/primary-spoke-layout";

const retailFaces = retailBubbleFaces({ phase: "loading" });
const aiFaces = aiNodeFaces({ phase: "loading" });

export const fenderStaticNodes: CanvasNode[] = [
    {
      ...aiFaces.satPrompts,
      spokeId: "aeo",
      ...satelliteNode("sat-prompts"),
    },
    {
      ...aiFaces.satCitations,
      spokeId: "aeo",
      ...satelliteNode("sat-citations"),
    },
    {
      ...aiFaces.satDrift,
      spokeId: "aeo",
      ...satelliteNode("sat-drift"),
    },
    {
      ...retailFaces.suppressed,
      spokeId: "ecommerce",
      ...satelliteNode("sat-buybox"),
    },
    {
      ...retailFaces.catalog,
      spokeId: "ecommerce",
      ...satelliteNode("sat-asin"),
    },
    {
      ...retailFaces.map,
      spokeId: "ecommerce",
      ...satelliteNode("sat-map"),
    },
    {
      ...satelliteNode("sat-findability"),
      status: "neutral",
      title: "Findability",
      stats: ["Loading"],
      heroValue: { value: "Loading", label: "Exact page" },
      spokeId: "specs",
      subTab: "Findability",
      tooltip: { title: "", desc: "" },
    },
    {
      ...satelliteNode("sat-schema"),
      status: "neutral",
      title: "Brand-Site Specs",
      stats: ["Loading"],
      heroValue: { value: "Loading", label: "Specs missing" },
      spokeId: "specs",
      subTab: "Brand-Site Specs",
      tooltip: { title: "", desc: "" },
    },
    {
      ...satelliteNode("sat-tables"),
      status: "neutral",
      title: "Amazon A+ Matrix",
      stats: ["Loading"],
      heroValue: { value: "Loading", label: "Five bullets" },
      spokeId: "specs",
      subTab: "Amazon A+ Matrix",
      tooltip: { title: "", desc: "" },
    },
    {
      ...aiFaces.satGap,
      spokeId: "competitors",
      ...satelliteNode("sat-taylor"),
    },
    {
      ...aiFaces.satLead,
      spokeId: "competitors",
      ...satelliteNode("sat-amps"),
    },
    {
      ...aiFaces.spokeAeo,
      spokeId: "aeo",
      ...primarySpoke("spoke-aeo"),
    },
    {
      ...retailFaces.main,
      spokeId: "ecommerce",
      ...primarySpoke("spoke-retail"),
    },
    {
      ...primarySpoke("spoke-specs"),
      status: "warning",
      title: "AI Readiness",
      stats: [],
      heroValue: { value: "Pending data", label: "Page found" },
      spokeId: "specs",
      subTab: "Brand-Site Specs",
      tooltip: { title: "", desc: "" },
    },
    {
      ...aiFaces.spokeCompetitors,
      spokeId: "competitors",
      ...primarySpoke("spoke-competitors"),
    },
    {
      ...primarySpoke("spoke-fixes"),
      status: "neutral",
      title: "Action Items",
      stats: [],
      heroValue: { value: FENDER_METRICS.phaseOneLift.value, label: "Phase 1 lift" },
      spokeId: "suggestions",
      tooltip: { title: "", desc: "" },
    },
    {
      ...primarySpoke("spoke-roadmap"),
      status: "neutral",
      title: "Roadmap",
      stats: [],
      // Static for every client: a click opens the next 90 days of strategy.
      heroValue: { value: "30-60-90", label: "" },
      subTab: "30-60-90 Days",
      spokeId: "roadmap",
      tooltip: { title: "", desc: "" },
    },
    {
      id: "hub",
      x: 800,
      y: 500,
      r: 98,
      status: "danger",
      variant: "hub",
      title: "Summary",
      stats: [],
      logoSrc: "/image.png",
      spokeId: "hub",
      tooltip: { title: "", desc: "" },
    },
];
