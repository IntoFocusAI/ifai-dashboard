import type { MouseEvent, ReactNode, RefObject } from "react";

export type NodeStatus = "danger" | "warning" | "success" | "neutral";
export type EdgeKind = "default" | "critical" | "warning" | "active";
export type TickerTone = "danger" | "warning" | "success";
export type TickerIcon = "pulse" | "sparkles" | "trending";

export type CanvasNode = {
  id: string;
  x: number;
  y: number;
  r: number;
  status: NodeStatus;
  title: string;
  /** Title size on the full map. */
  titleSize?: number;
  /** Title size in the wide-panel column rail, when it should not follow the map size. */
  railTitleSize?: number;
  /**
   * Face layout radius for the column rail. The map circle uses `r`.
   * Set when `r` grows for the map so the rail face stays the previous size.
   */
  faceRadius?: number;
  stats: string[];
  meta?: string;
  /**
   * A single big status-colored number in place of the stacked stat pills. Use when a
   * bubble has one scored headline value instead of several short facts to list.
   */
  heroValue?: { value: string; label: string };
  /** Opens this spoke on click. Omit to reset the camera. Set on the hub when it has its own drilldown. */
  spokeId?: string;
  subTab?: string;
  tooltip: {
    title: string;
    desc: string;
    hasMoreInfo?: boolean;
  };
  variant?: "bubble" | "hub";
  /** Wordmark drawn inside a centered hub. */
  logoSrc?: string;
};

export type CanvasEdge = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind?: EdgeKind;
};

export type CanvasPath = {
  d: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
};

export type CanvasBadge = {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
};

export type SpokeContent = {
  badge: string;
  title: string;
  desc: string;
  /**
   * Live description rendered in place of `desc`.
   * Use this when the sentence must follow the same client snapshot as the panel body.
   */
  descSlot?: ReactNode;
  tabs: string[];
  /** Tab names that carry a "New" marker. The marker is drawn by CSS, so the tab text stays the name. */
  newTabs?: string[];
  /** Short name for the breadcrumb and the "Next" footer. */
  navLabel?: string;
  /** Next spoke in left-to-right map order. The panel footer links here. */
  next?: string;
  render: (tabIdx: number) => ReactNode | string;
  /** Compact control under the panel title. */
  headerAccessory?: ReactNode;
  /** Optional stats that fill the wide header band on expanded panels. */
};

export type TourStep = {
  nodeId: string;
  targetX: number;
  targetY: number;
  radius: number;
  title: string;
  subtitle: string;
  category: string;
  displays: string[];
  value: string;
};

export type PriorityOwner = "intofocus" | "client" | "unassigned";
export type PrioritySeverity = "critical" | "high" | "moderate";

export type PriorityItem = {
  id: string;
  /** Plain-language headline. Keep it short enough to scan in one pass. */
  title: string;
  /** Why this sits at the top of the queue today. */
  why: string;
  /** Commercial consequence, shown as the item footer. */
  impact?: string;
  severity: PrioritySeverity;
  /** Deep-links into the drilldown when set. */
  spokeId?: string;
  subTab?: string;
  defaultOwner?: PriorityOwner;
};

export type CommandCenterSpec = {
  badge?: string;
  title: string;
  desc: string;
  /** AI-written standing summary shown above the queue. */
  summary?: string;
  items: PriorityItem[];
  /** Open the command center instead of a spoke on first paint. */
  openByDefault?: boolean;
  /** localStorage key for owner chips (and done state when `setAsideClientKey` is unset). */
  storageKey?: string;
  /**
   * Client key in public.set_aside_clients. When set, "Done" becomes a server-side
   * set-aside with a reason, a name, and an audit row; reopen updates the same row.
   */
  setAsideClientKey?: string;
};

export type CanvasTicker = {
  id: string;
  label: ReactNode;
  tone: TickerTone;
  spokeId?: string;
  subTab?: string;
  icon?: TickerIcon;
};

export type CanvasMetric = {
  id: string;
  /** The owning spoke. Its current nav label is also the widget category label. */
  spokeId: string;
  label: string;
  value: string;
  detail: string;
  tone?: NodeStatus;
  subTab?: string;
  provenance?: "live" | "estimate" | "recorded";
};

export type CanvasMetricWidgets = {
  metrics: CanvasMetric[];
  /** Exactly three slots are rendered. A null entry starts as an empty add slot. */
  defaults: [string | null, string | null, string | null];
  /** localStorage key. The host can append a viewer scope for per-user persistence. */
  storageKey: string;
};

export type HubSlotRole = "gap" | "opportunity" | "action";

/** A compact share whose two parts add up to `total`. */
export type HubSlotChart = {
  part: number;
  total: number;
  partLabel: string;
  restLabel: string;
};

export type HubSlot = {
  role: HubSlotRole;
  figure: string;
  label: string;
  detail: string;
  note: string;
  tone: NodeStatus;
  /** Text status so a red figure is never the only signal. */
  statusWord: string;
  chart: HubSlotChart | null;
  spokeId: string;
  subTab?: string;
};

export type HubSlotFeed = {
  bubbleId: string;
  title: string;
  slots: [HubSlot, HubSlot, HubSlot];
};

export type CanvasUserMenuOrganization = {
  id: string;
  name: string;
  slug: string;
};

export type CanvasUserMenu = {
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  organizationName?: string | null;
  roleLabel?: string | null;
  organizations?: CanvasUserMenuOrganization[];
  activeOrganizationId?: string | null;
};

export type CanvasFilter = {
  value: string;
  label: string;
  /** Spoke to focus, or `"overview"` to reset. */
  target?: string | "overview";
};

export type SearchMatcher = {
  keywords: string[];
  spokeId: string;
};

export type CanvasHeaderAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "default";
};

export type CanvasLegendItem = {
  status: Exclude<NodeStatus, "neutral">;
  label: string;
};

export type CanvasSpec = {
  brand: {
    name: string;
    subtitle: string;
    logoSrc?: string;
    badge?: string;
  };
  viewBox?: { w: number; h: number };
  focusScale?: number;
  drilldownWidth?: number;
  /** Width when the panel is expanded. Falls back to 68% of the viewport, capped at 1180px. */
  drilldownExpandedWidth?: number;
  /** Priority queue shown above the spokes. Omit to keep the panel spoke-only. */
  commandCenter?: CommandCenterSpec;
  /** Renders a "Prompts" header button (left of Priorities) that opens this content in a dialog. */
  promptsEditor?: (close: () => void) => ReactNode;
  /** Jargon -> plain-language definition, shown on hover in the panel copy. */
  glossary?: Record<string, string>;
  filters?: CanvasFilter[];
  tickers?: CanvasTicker[];
  /** Configurable top-left decision signals. Category names resolve from `spokes`. */
  metricWidgets?: CanvasMetricWidgets;
  /** Three slots filled by hovering or focusing a main bubble. Keyed by node id. */
  hubSlots?: Record<string, HubSlotFeed>;
  search?: {
    placeholder?: string;
    matchers?: SearchMatcher[];
  };
  headerActions?: CanvasHeaderAction[];
  /** Extra header control, e.g. a view toggle. Rendered before search. */
  headerSlot?: ReactNode;
  /** Signed-in user; renders account menu (theme + log out) in the header. */
  userEmail?: string;
  userMenu?: CanvasUserMenu;
  legend?: CanvasLegendItem[];
  /** Set false to hide the bottom-left status legend while keeping `legend` data in the spec. */
  showLegend?: boolean;
  nodes?: CanvasNode[];
  edges?: CanvasEdge[];
  paths?: CanvasPath[];
  badges?: CanvasBadge[];
  spokes: Record<string, SpokeContent>;
  /** Camera targets keyed by `spokeId` or `spokeId:subTab`. */
  focusTargets: Record<string, { x: number; y: number }>;
  tour?: TourStep[];
  showThemeToggle?: boolean;
  /** Visual system. `iom` uses the Internal Operating Maps map language. */
  appearance?: "default" | "iom";
};

export type CanvasRenderContext = {
  svgRef: RefObject<SVGSVGElement | null>;
  viewportRef: RefObject<HTMLDivElement | null>;
  transform: string;
  tourActive: boolean;
  tourX: number;
  tourY: number;
  tourRadius: number;
  tourCategory: string;
  focusNode: (spokeId: string, subTab?: string) => void;
  /** A main bubble is hovered or focused: show its signal slots. They stay up,
   *  tracking the latest hovered bubble, until a click outside dismisses them. */
  inspectBubble: (nodeId: string) => void;
  /** The inspected main bubble while its slots show; its satellites stay out with them. */
  heldGroupId: string | null;
  resetView: () => void;
  overviewNonce: number;
  focusedSpokeId: string | null;
  columnScrollKey: number;
  columnLayout: boolean;
  /** IOM map overview is playing fade/slide-out before the column rail mounts. */
  mapExiting?: boolean;
  /** IOM radial map is fading/sliding back in after the column rail closes. */
  mapEntering?: boolean;
  /** IOM column rail is sliding out before the map returns. */
  columnRailExiting?: boolean;
  showTooltip: (
    evt: MouseEvent,
    title: string,
    desc: string,
    hasMoreInfo?: boolean,
  ) => void;
  hideTooltip: () => void;
};

export function defineCanvas(spec: CanvasSpec): CanvasSpec {
  return spec;
}
