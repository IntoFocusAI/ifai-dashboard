import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spokeData, tourSteps } from "../components/v3/spoke-data.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, ".tmp", "fender-brand-canvas-v3.html");

function transformSpecSource(source: string) {
  return source
    .replace(
      /import \{ spokeData, tourSteps \} from "@\/components\/v3\/spoke-data";/,
      'import { spokeData, tourSteps } from "../components/v3/spoke-data.ts";',
    )
    .replace(/import \{ defineCanvas \} from "@\/lib\/canvas-sdk";/, "const defineCanvas = <T,>(spec: T) => spec;")
    .replace(/label:\s*\(\s*<>\s*([\s\S]*?)\s*<\/>\s*\)/g, (_match, inner: string) => {
      const html = inner.replace(/\s+/g, " ").trim();
      return `label: ${JSON.stringify(html)}`;
    });
}

async function loadSpec() {
  const original = readFileSync(join(root, "components/v3/fender-canvas-spec.tsx"), "utf8");
  const transformed = transformSpecSource(original);
  const tmpSpec = join(root, ".tmp", "fender-canvas-spec.generated.ts");
  mkdirSync(dirname(tmpSpec), { recursive: true });
  writeFileSync(tmpSpec, transformed);
  const mod = await import(pathToFileURL(tmpSpec).href);
  return mod.fenderCanvasSpec as {
    brand: { name: string; subtitle: string; badge?: string };
    filters: { value: string; label: string; target?: string }[];
    tickers: { id: string; tone: string; icon?: string; spokeId?: string; subTab?: string; label: string }[];
    search: { placeholder: string; matchers: { keywords: string[]; spokeId: string }[] };
    legend: { status: string; label: string }[];
    edges: { x1: number; y1: number; x2: number; y2: number; kind?: string }[];
    paths: { d: string }[];
    badges: { x: number; y: number; width: number; height: number; text: string }[];
    nodes: Array<Record<string, unknown>>;
    focusTargets: Record<string, { x: number; y: number }>;
  };
}

const TOOLBELT_SDK = `class ToolbeltSDK {
  constructor() {
    this.requests = new Map();
    this.requestId = 0;
    this.listeners = new Set();
    window.addEventListener("message", (event) => {
      const { type, payload, requestId } = event.data || {};
      if (requestId && this.requests.has(requestId)) {
        const { resolve, reject } = this.requests.get(requestId);
        if (type === "TOOLBELT_RESPONSE_ERROR") reject(new Error(payload));
        else resolve(payload);
        this.requests.delete(requestId);
      } else if (type && !requestId) {
        this.listeners.forEach((cb) => cb(type, payload));
      }
    });
    this.readyPromise = this.sendRequest("TOOLBELT_INIT").then((context) => {
      this.workspaceId = context.workspaceId;
      console.log("Toolbelt Connected:", context);
      return context;
    });
  }
  async ready() { return this.readyPromise; }
  async sendRequest(type, payload = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      this.requests.set(id, { resolve, reject });
      window.parent.postMessage({ type, payload, requestId: id }, "*");
    });
  }
  async listTools() {
    const payload = await this.sendRequest("TOOLBELT_LIST_TOOLS");
    if (Array.isArray(payload)) return payload;
    const tools = Array.isArray(payload?.tools) ? payload.tools : [];
    tools.tools = tools;
    tools.count = typeof payload?.count === "number" ? payload.count : tools.length;
    tools.workspaceId = payload?.workspaceId || this.workspaceId || "";
    return tools;
  }
  async runTool(toolName, args = {}) {
    return this.sendRequest("TOOLBELT_RUN_TOOL", { tool: toolName, arguments: args });
  }
  parseToolResult(result) {
    const content = Array.isArray(result?.content) ? result.content : null;
    if (!content || content.length === 0) return result;
    const firstText = content.find((part) => part?.type === "text");
    if (firstText && typeof firstText.text === "string") {
      try { return JSON.parse(firstText.text); } catch { return firstText.text; }
    }
    return result;
  }
  parseToolImages(result) {
    const content = Array.isArray(result?.content) ? result.content : [];
    return content
      .filter((part) => part?.type === "image" && typeof part.data === "string")
      .map((part) => {
        const mimeType = part.mimeType || "image/png";
        return { mimeType, data: part.data, dataUrl: \`data:\${mimeType};base64,\${part.data}\` };
      });
  }
  async runToolParsed(toolName, args = {}) {
    return this.parseToolResult(await this.runTool(toolName, args));
  }
  async executeSql(query, params = [], database = null) {
    const payload = { query, parameters: params };
    if (database) payload.database = database;
    return this.sendRequest("TOOLBELT_EXECUTE_SQL", payload);
  }
  async chat(message) {
    return this.sendRequest("TOOLBELT_CHAT", { message });
  }
}`;

const RUNTIME = `const VIEWBOX = { w: 1600, h: 1000 };
const DRILLDOWN_WIDTH = 620;
const FOCUS_SCALE = 1.55;
const pan = { scale: 1, x: 0, y: 0, isPanning: false, startX: 0, startY: 0 };
let cameraTimer = 0;
let activeSpoke = null;
let activeTab = 0;
let tourActive = false;
let tourStep = 0;
let lightTheme = false;

const svg = document.getElementById("chart");
const viewport = document.getElementById("viewport");
const root = document.getElementById("app");
const tooltipEl = document.getElementById("tooltip");
const panel = document.getElementById("panel");
const panelBody = document.getElementById("panel-body");
const tourRoot = document.getElementById("tour");

function applyTransform() {
  svg.style.transform = \`translate(\${pan.x}px, \${pan.y}px) scale(\${pan.scale})\`;
}
function runCamera() {
  svg.classList.add("camera-animating");
  window.clearTimeout(cameraTimer);
  cameraTimer = window.setTimeout(() => svg.classList.remove("camera-animating"), 360);
  applyTransform();
}
function viewBoxToLocal(x, y) {
  const w = viewport.clientWidth || 0;
  const h = viewport.clientHeight || 0;
  const fit = Math.min(w / VIEWBOX.w, h / VIEWBOX.h);
  return { x: (w - VIEWBOX.w * fit) / 2 + x * fit, y: (h - VIEWBOX.h * fit) / 2 + y * fit };
}
function framePoint(viewX, viewY, scale, insetRight = 0) {
  const point = viewBoxToLocal(viewX, viewY);
  pan.scale = scale;
  pan.x = (viewport.clientWidth - insetRight) / 2 - point.x * scale;
  pan.y = viewport.clientHeight / 2 - point.y * scale;
  runCamera();
}
function frameOverview() {
  pan.scale = 1; pan.x = 0; pan.y = 0; runCamera();
}
function zoomBy(factor) {
  pan.scale = Math.min(Math.max(pan.scale * factor, 0.45), 3);
  applyTransform();
}
function polar(radius, deg) {
  const angle = (deg * Math.PI) / 180;
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
}
function headerArcPath(radius, fontSize, title) {
  const rim = Math.max(5.5, fontSize * 0.22 + 3);
  const r = Math.max(16, radius - rim);
  const arcLen = Math.max(title.length * fontSize * 0.5, fontSize * 4);
  const halfDeg = Math.min(78, Math.max(radius < 55 ? 55 : 48, ((arcLen / r) * 180) / Math.PI / 2 + 8));
  const start = polar(r, 270 - halfDeg);
  const end = polar(r, 270 + halfDeg);
  return \`M \${start.x.toFixed(2)} \${start.y.toFixed(2)} A \${r.toFixed(2)} \${r.toFixed(2)} 0 0 1 \${end.x.toFixed(2)} \${end.y.toFixed(2)}\`;
}
function pillSize(label, fontSize) {
  return {
    width: Math.max(fontSize * 2.6, label.length * fontSize * 0.56 + fontSize * 1.4),
    height: fontSize + 9,
  };
}
function esc(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function nodeMarkup(node) {
  const r = node.r;
  const headerSize = node.titleSize ?? (node.variant === "hub" ? 15 : r >= 70 ? 14.5 : r >= 50 ? 13 : 12);
  const statSize = node.variant === "hub" ? 12 : r >= 70 ? 12 : 10.5;
  const statusClass = node.status !== "neutral" ? \` status-\${node.status}\` : "";
  const pathId = \`node-header-arc-\${node.id}\`;
  const metaSize = Math.max(statSize * 0.82, 10);
  const pillH = statSize + 9;
  const metaH = node.meta ? metaSize + 2 : 0;
  const gap = r < 62 ? 4 : 6;
  const rows = node.stats.length + (node.meta ? 1 : 0);
  const stackH = node.stats.length * pillH + metaH + Math.max(0, rows - 1) * gap;
  const nudge = r < 62 ? 3 : 2;
  let y = -stackH / 2 + pillH / 2 + nudge;
  const pills = node.stats.map((label) => {
    const size = pillSize(label, statSize);
    const pill = \`<g class="node-stat" transform="translate(0, \${y})">
      <rect class="node-stat-pill\${statusClass}" x="\${-size.width / 2}" y="\${-size.height / 2}" width="\${size.width}" height="\${size.height}" rx="\${size.height / 2}"></rect>
      <text class="node-stat-text" y="\${statSize * 0.35}" text-anchor="middle" font-size="\${statSize}">\${esc(label)}</text>
    </g>\`;
    y += pillH + gap;
    return pill;
  }).join("");
  const meta = node.meta
    ? \`<text class="node-meta" y="\${y - pillH / 2 + metaH / 2}" text-anchor="middle" font-size="\${metaSize}">\${esc(node.meta)}</text>\`
    : "";
  const header = \`<path id="\${pathId}" d="\${headerArcPath(r, headerSize, node.title)}" fill="none"></path>
    <text class="node-title" font-size="\${headerSize}" dy="\${headerSize * 0.82}"><textPath href="#\${pathId}" startOffset="50%" text-anchor="middle">\${esc(node.title)}</textPath></text>\`;
  if (node.variant === "hub") {
    const pulseR = r * (140 / 98);
    const midR = r * (118 / 98);
    return \`<g class="graph-node" data-spoke="\${node.spokeId || ""}" data-subtab="\${node.subTab || ""}" data-title="\${esc(node.tooltip.title)}" data-desc="\${esc(node.tooltip.desc)}" transform="translate(\${node.x}, \${node.y})">
      <circle r="\${pulseR}" fill="url(#brandHubGradient)" opacity="0.45" class="node-pulse-ring"></circle>
      <circle r="\${midR}" fill="url(#brandHubGradient)" filter="url(#nodeShadow)" stroke="var(--border-dark)" stroke-width="3"></circle>
      <circle r="\${r}" class="node-circle hub-core"></circle>
      \${header}\${pills}\${meta}
    </g>\`;
  }
  return \`<g class="graph-node" data-spoke="\${node.spokeId || ""}" data-subtab="\${node.subTab || ""}" data-title="\${esc(node.tooltip.title)}" data-desc="\${esc(node.tooltip.desc)}" transform="translate(\${node.x}, \${node.y})">
    <circle r="\${r}" class="node-circle\${statusClass}" filter="url(#nodeShadow)"></circle>
    \${header}\${pills}\${meta}
  </g>\`;
}
function renderGraph() {
  const edges = SPEC.edges.map((edge) => {
    const kindClass = edge.kind === "active" ? " active-spoke" : edge.kind && edge.kind !== "default" ? \` \${edge.kind}\` : "";
    return \`<line x1="\${edge.x1}" y1="\${edge.y1}" x2="\${edge.x2}" y2="\${edge.y2}" class="conn-line\${kindClass}"></line>\`;
  }).join("");
  const paths = SPEC.paths.map((path) => \`<path d="\${path.d}" fill="none" stroke="var(--danger-red)" stroke-width="2.5" opacity="0.85"></path>\`).join("");
  const bubbles = SPEC.nodes.filter((n) => n.variant !== "hub").map(nodeMarkup).join("");
  const badges = SPEC.badges.map((badge) => \`<g transform="translate(\${badge.x}, \${badge.y})">
    <rect class="correlation-badge" x="\${-badge.width / 2}" y="\${-badge.height / 2}" width="\${badge.width}" height="\${badge.height}" rx="\${badge.height / 2}" filter="url(#nodeShadow)"></rect>
    <text class="correlation-badge-text" x="0" y="4" text-anchor="middle" font-size="10.5">\${esc(badge.text)}</text>
  </g>\`).join("");
  const hubs = SPEC.nodes.filter((n) => n.variant === "hub").map(nodeMarkup).join("");
  document.getElementById("graph-content").innerHTML = edges + paths + bubbles + badges + hubs + \`
    <g id="tour-spotlight-group" style="display:none;pointer-events:none">
      <circle id="tour-spotlight-pulse" r="170" fill="none" stroke="var(--accent-purple)" stroke-width="3" stroke-dasharray="10 5" class="node-pulse-ring" opacity="0.8"></circle>
      <circle id="tour-spotlight-ring" r="160" fill="none" stroke="var(--color-indigo)" stroke-width="2.5" filter="url(#glow-accent)"></circle>
      <g id="tour-spotlight-tag" transform="translate(0, -170)">
        <rect x="-95" y="-14" width="190" height="28" rx="14" fill="#070d18" stroke="var(--accent-purple)" stroke-width="1.8" filter="url(#nodeShadow)"></rect>
        <circle cx="-75" cy="0" r="4" fill="var(--accent-purple)"></circle>
        <text id="tour-spotlight-tag-text" x="6" y="4" text-anchor="middle" font-size="10.5" font-weight="800" fill="#ffffff" letter-spacing="0.5"></text>
      </g>
    </g>\`;
  svg.querySelectorAll(".graph-node").forEach((node) => {
    node.addEventListener("click", () => {
      const spokeId = node.getAttribute("data-spoke");
      const subTab = node.getAttribute("data-subtab");
      if (spokeId) focusNode(spokeId, subTab || undefined);
      else resetView();
    });
    node.addEventListener("mouseenter", (evt) => showTooltip(evt, node.getAttribute("data-title"), node.getAttribute("data-desc"), Boolean(node.getAttribute("data-spoke"))));
    node.addEventListener("mouseleave", hideTooltip);
  });
}
function showTooltip(evt, title, desc, hasMore) {
  if (tourActive) return;
  tooltipEl.style.left = evt.clientX + "px";
  tooltipEl.style.top = evt.clientY + "px";
  tooltipEl.innerHTML = \`<div style="font-weight:700;margin-bottom:2px">\${title}</div>
    <div style="color:var(--text-muted);font-size:11px">\${desc}</div>
    \${hasMore ? '<div style="margin-top:6px;color:var(--accent-purple);font-weight:700;font-size:10px">CLICK FOR MORE INFO →</div>' : ""}\`;
  tooltipEl.classList.add("visible");
}
function hideTooltip() { tooltipEl.classList.remove("visible"); }
function closeDrilldown() {
  activeSpoke = null;
  root.classList.remove("panel-open");
  panel.classList.remove("open");
  if (!tourActive) frameOverview();
}
function resetView() { closeDrilldown(); frameOverview(); }
function focusNode(spokeId, subTab) {
  const spoke = SPOKES[spokeId];
  if (!spoke) return;
  activeSpoke = spokeId;
  if (subTab) {
    const found = spoke.tabs.findIndex((tab) => tab.toLowerCase().includes(subTab.toLowerCase()));
    activeTab = found >= 0 ? found : 0;
  } else activeTab = 0;
  hideTooltip();
  const key = subTab ? \`\${spokeId}:\${subTab}\` : spokeId;
  const pos = SPEC.focusTargets[key] || SPEC.focusTargets[spokeId];
  if (pos) framePoint(pos.x, pos.y, FOCUS_SCALE, DRILLDOWN_WIDTH);
  renderPanel();
}
function renderPanel() {
  const spoke = activeSpoke ? SPOKES[activeSpoke] : null;
  root.classList.toggle("panel-open", Boolean(spoke));
  panel.classList.toggle("open", Boolean(spoke));
  if (!spoke) return;
  document.getElementById("panel-badge").textContent = spoke.badge;
  document.getElementById("panel-title").textContent = spoke.title;
  document.getElementById("panel-desc").textContent = spoke.desc;
  document.getElementById("panel-tabs").innerHTML = spoke.tabs.map((tab, idx) =>
    \`<button class="drilldown-tab-btn\${idx === activeTab ? " active" : ""}" data-tab="\${idx}">\${esc(tab)}</button>\`
  ).join("");
  panelBody.innerHTML = spoke.tabsHtml[activeTab] || "";
  panelBody.scrollTop = 0;
  document.querySelectorAll("#panel-tabs .drilldown-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTab = Number(btn.getAttribute("data-tab"));
      renderPanel();
    });
  });
}
function currentTour() { return TOUR[tourStep]; }
function updateSpotlight() {
  const step = currentTour();
  const group = document.getElementById("tour-spotlight-group");
  if (!step || !tourActive) { group.style.display = "none"; return; }
  group.style.display = "block";
  group.setAttribute("transform", \`translate(\${step.targetX}, \${step.targetY})\`);
  document.getElementById("tour-spotlight-pulse").setAttribute("r", String(step.radius + 10));
  document.getElementById("tour-spotlight-ring").setAttribute("r", String(step.radius));
  document.getElementById("tour-spotlight-tag").setAttribute("transform", \`translate(0, -\${step.radius + 10})\`);
  document.getElementById("tour-spotlight-tag-text").textContent = step.category;
}
function renderTour() {
  tourRoot.classList.toggle("active", tourActive);
  if (!tourActive) { updateSpotlight(); return; }
  const step = currentTour();
  document.getElementById("tour-step-pill").textContent = \`STEP \${tourStep + 1} OF \${TOUR.length}\`;
  document.getElementById("tour-category").textContent = step.category;
  document.getElementById("tour-progress").style.width = \`\${((tourStep + 1) / TOUR.length) * 100}%\`;
  document.getElementById("tour-spoke-title").textContent = step.title;
  document.getElementById("tour-spoke-subtitle").textContent = step.subtitle;
  document.getElementById("tour-displays").innerHTML = step.displays.map((item) => \`<li>\${esc(item)}</li>\`).join("");
  document.getElementById("tour-value").textContent = step.value;
  document.getElementById("tour-dots").innerHTML = TOUR.map((_, idx) => \`<div class="tour-dot\${idx === tourStep ? " active" : ""}" data-step="\${idx}"></div>\`).join("");
  document.getElementById("tour-prev").style.visibility = tourStep === 0 ? "hidden" : "visible";
  document.getElementById("tour-next").textContent = tourStep === TOUR.length - 1 ? "Finish Tour 🎯" : "Next Step →";
  document.querySelectorAll("#tour-dots .tour-dot").forEach((dot) => {
    dot.addEventListener("click", () => { tourStep = Number(dot.getAttribute("data-step")); renderTour(); framePoint(currentTour().targetX, currentTour().targetY, 1.12); });
  });
  updateSpotlight();
}
function startTour() {
  tourActive = true; tourStep = 0; hideTooltip(); closeDrilldown();
  renderTour(); framePoint(currentTour().targetX, currentTour().targetY, 1.12);
}
function closeTour() { tourActive = false; tourRoot.classList.remove("active"); updateSpotlight(); resetView(); }
function nextTour() { if (tourStep < TOUR.length - 1) { tourStep += 1; renderTour(); framePoint(currentTour().targetX, currentTour().targetY, 1.12); } else closeTour(); }
function prevTour() { if (tourStep > 0) { tourStep -= 1; renderTour(); framePoint(currentTour().targetX, currentTour().targetY, 1.12); } }
function openFromTour() {
  const step = currentTour();
  const nodeId = step?.nodeId;
  closeTour();
  if (nodeId && SPOKES[nodeId]) focusNode(nodeId);
}
window.toggleRoiMode = function (mode) {
  const active = mode === "enterprise" ? "btn-roi-enterprise" : "btn-roi-pilot";
  const inactive = mode === "enterprise" ? "btn-roi-pilot" : "btn-roi-enterprise";
  const show = mode === "enterprise" ? "roi-content-enterprise" : "roi-content-pilot";
  const hide = mode === "enterprise" ? "roi-content-pilot" : "roi-content-enterprise";
  document.getElementById(active)?.classList.add("active");
  document.getElementById(inactive)?.classList.remove("active");
  const showEl = document.getElementById(show);
  const hideEl = document.getElementById(hide);
  if (showEl) showEl.style.display = "block";
  if (hideEl) hideEl.style.display = "none";
};
window.toggleResourcingMode = function (mode) {
  const active = mode === "copilot" ? "btn-resourcing-copilot" : "btn-resourcing-managed";
  const inactive = mode === "copilot" ? "btn-resourcing-managed" : "btn-resourcing-copilot";
  const show = mode === "copilot" ? "resourcing-content-copilot" : "resourcing-content-managed";
  const hide = mode === "copilot" ? "resourcing-content-managed" : "resourcing-content-copilot";
  document.getElementById(active)?.classList.add("active");
  document.getElementById(inactive)?.classList.remove("active");
  const showEl = document.getElementById(show);
  const hideEl = document.getElementById(hide);
  if (showEl) showEl.style.display = "block";
  if (hideEl) hideEl.style.display = "none";
};

document.getElementById("filter").addEventListener("change", (e) => {
  const option = SPEC.filters.find((item) => item.value === e.target.value);
  const target = option?.target || (e.target.value === "all" ? "overview" : undefined);
  if (!target || target === "overview") resetView();
  else focusNode(target);
});
document.getElementById("search").addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase().trim();
  if (!q) return;
  const match = SPEC.search.matchers.find((item) => item.keywords.some((keyword) => q.includes(keyword.toLowerCase())));
  if (match) focusNode(match.spokeId);
});
document.getElementById("tour-btn").addEventListener("click", startTour);
document.getElementById("theme-btn").addEventListener("click", () => {
  lightTheme = !lightTheme;
  root.classList.toggle("light-theme", lightTheme);
  document.getElementById("theme-btn").innerHTML = lightTheme ? SUN : MOON;
});
document.getElementById("zoom-in").addEventListener("click", () => zoomBy(1.2));
document.getElementById("zoom-out").addEventListener("click", () => zoomBy(1 / 1.2));
document.getElementById("zoom-reset").addEventListener("click", resetView);
document.getElementById("panel-close").addEventListener("click", closeDrilldown);
document.getElementById("tour-close").addEventListener("click", closeTour);
document.getElementById("tour-dimmer").addEventListener("click", closeTour);
document.getElementById("tour-prev").addEventListener("click", prevTour);
document.getElementById("tour-next").addEventListener("click", nextTour);
document.getElementById("tour-open").addEventListener("click", openFromTour);

viewport.addEventListener("mousedown", (e) => {
  if (e.target.closest(".graph-node") || e.target.closest(".hud-btn-group")) return;
  if (activeSpoke) { closeDrilldown(); return; }
  pan.isPanning = true;
  pan.startX = e.clientX - pan.x;
  pan.startY = e.clientY - pan.y;
});
window.addEventListener("mousemove", (e) => {
  if (!pan.isPanning) return;
  pan.x = e.clientX - pan.startX;
  pan.y = e.clientY - pan.startY;
  applyTransform();
});
window.addEventListener("mouseup", () => { pan.isPanning = false; });
viewport.addEventListener("wheel", (e) => {
  e.preventDefault();
  const xs = (e.clientX - pan.x) / pan.scale;
  const ys = (e.clientY - pan.y) / pan.scale;
  pan.scale = e.deltaY < 0 ? pan.scale * 1.08 : pan.scale / 1.08;
  pan.scale = Math.min(Math.max(0.45, pan.scale), 3);
  pan.x = e.clientX - xs * pan.scale;
  pan.y = e.clientY - ys * pan.scale;
  applyTransform();
}, { passive: false });
document.addEventListener("pointerdown", (e) => {
  if (!activeSpoke) return;
  const target = e.target;
  if (!(target instanceof Element)) return;
  if (target.closest(".drilldown-panel") || target.closest(".graph-node") || target.closest(".top-header") || target.closest(".tour-overlay-container")) return;
  closeDrilldown();
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { if (tourActive) closeTour(); else closeDrilldown(); }
  else if (tourActive && e.key === "ArrowRight") nextTour();
  else if (tourActive && e.key === "ArrowLeft") prevTour();
});

const SUN = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
const MOON = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

let SPEC;
let SPOKES;
let TOUR;
const sdk = new ToolbeltSDK();

async function loadJson(fileName) {
  const raw = await sdk.runTool("read_storage_file", { fileName, raw: true });
  const parsed = sdk.parseToolResult(raw);
  if (typeof parsed === "string") {
    try { return JSON.parse(parsed); } catch { return parsed; }
  }
  return parsed;
}

function bootCanvas() {
  renderGraph();
  renderTour();
  document.querySelectorAll(".header-ticker .ticker-item").forEach((item) => {
    item.addEventListener("click", () => {
      const spokeId = item.getAttribute("data-spoke");
      const subTab = item.getAttribute("data-subtab");
      if (spokeId) focusNode(spokeId, subTab || undefined);
    });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await sdk.ready();
    SPEC = await loadJson("fender-v3-spec.json");
    SPOKES = await loadJson("fender-v3-spokes.json");
    TOUR = await loadJson("fender-v3-tour.json");
    bootCanvas();
  } catch (err) {
    console.error("Failed to initialize Toolbelt page:", err);
  }
});
`;

async function main() {
  const spec = await loadSpec();
  const css = readFileSync(join(root, "lib/canvas-sdk/canvas-sdk.css"), "utf8").replace(
    `@font-face {
      font-family: Inter;
      font-style: normal;
      font-weight: 100 900;
      font-display: swap;
      src: url("/fonts/inter-latin-wght-normal.woff2") format("woff2-variations");
    }`,
    `@import url("https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap");`,
  );
  const logo =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#0b1220"/><circle cx="16" cy="16" r="6" fill="#38bdf8"/></svg>`,
    );
  const spokes = Object.fromEntries(
    Object.entries(spokeData).map(([id, spoke]) => [
      id,
      {
        badge: spoke.badge,
        title: spoke.title,
        desc: spoke.desc,
        tabs: spoke.tabs,
        tabsHtml: spoke.tabs.map((_, idx) => spoke.render(idx)),
      },
    ]),
  );
  const payload = {
    brand: spec.brand,
    filters: spec.filters,
    tickers: spec.tickers,
    search: spec.search,
    legend: spec.legend,
    edges: spec.edges,
    paths: spec.paths,
    badges: spec.badges,
    nodes: spec.nodes,
    focusTargets: spec.focusTargets,
  };
  const filterOptions = spec.filters
    .map((filter) => `<option value="${filter.value}">${filter.label}</option>`)
    .join("");
  const tickers = spec.tickers
    .map((item) => {
      const icon =
        item.icon === "sparkles"
          ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z"/></svg>`
          : item.icon === "trending"
            ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>`
            : `<span class="pulse-dot"></span>`;
      return `<div class="ticker-item ticker-badge-${item.tone}" data-spoke="${item.spokeId || ""}" data-subtab="${item.subTab || ""}">${icon}<span>${item.label}</span></div>`;
    })
    .join("");
  const legend = spec.legend
    .map((item) => {
      const color =
        item.status === "danger"
          ? "var(--danger-red)"
          : item.status === "warning"
            ? "var(--warning-amber)"
            : "var(--success-green)";
      return `<div class="legend-item"><span class="legend-dot" style="border-color:${color}"></span><span>${item.label}</span></div>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Fender Brand Intelligence Canvas v3 — IntoFocus AI</title>
  <style>${css}
    html, body, #app { margin: 0; height: 100%; overflow: hidden; }
    .ifai-canvas { height: 100%; }
  </style>
</head>
<body>
  <div id="app" class="ifai-canvas" style="--drilldown-width: 620px">
    <div class="canvas-layout">
      <header class="top-header">
        <div class="brand-section">
          <img src="${logo}" alt="${spec.brand.name}" class="brand-logo-icon" />
          <div class="brand-title-group">
            <div class="brand-name">${spec.brand.name}<span class="tag-badge tag-danger" style="font-size:10px">${spec.brand.badge}</span></div>
            <div class="brand-sub">${spec.brand.subtitle}</div>
          </div>
          <div class="pill-divider"></div>
          <div class="filter-selector">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent-purple)" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            <select id="filter" aria-label="Canvas filter">${filterOptions}</select>
          </div>
        </div>
        <div class="header-ticker">${tickers}</div>
        <div class="header-controls">
          <div class="search-input-wrapper">
            <svg class="search-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3"/></svg>
            <input id="search" type="text" class="search-input" placeholder="${spec.search.placeholder}" />
          </div>
          <button class="hdr-btn hdr-btn-primary" id="tour-btn">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
            <span>Guided Tour</span>
          </button>
          <button class="hdr-btn" id="theme-btn" title="Toggle Light / Dark">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
          </button>
        </div>
      </header>
      <div class="viewport-container" id="viewport">
        <svg id="chart" class="canvas-svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid meet">
          <defs>
            <radialGradient id="brandHubGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.25" />
              <stop offset="70%" stop-color="#4f46e5" stop-opacity="0.12" />
              <stop offset="100%" stop-color="#38bdf8" stop-opacity="0" />
            </radialGradient>
            <filter id="glow-danger" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glow-accent" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="7" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="nodeShadow" x="-60%" y="-60%" width="220%" height="240%">
              <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#0b1220" flood-opacity="0.4" />
            </filter>
          </defs>
          <g id="graph-content"></g>
        </svg>
      </div>
      <div class="canvas-hud-legend">${legend}</div>
      <div class="canvas-hud-controls">
        <div class="hud-btn-group">
          <button class="hud-btn" id="zoom-in" title="Zoom In (+)">+</button>
          <button class="hud-btn" id="zoom-out" title="Zoom Out (-)">−</button>
          <button class="hud-btn" id="zoom-reset" title="Center & Overview">◎</button>
        </div>
      </div>
      <div class="node-tooltip" id="tooltip"></div>
      <aside class="drilldown-panel" id="panel">
        <div class="drilldown-header">
          <div class="drilldown-title-wrap">
            <span class="drilldown-badge" id="panel-badge">SPOKE</span>
            <h2 class="drilldown-title" id="panel-title"></h2>
            <p class="drilldown-desc" id="panel-desc"></p>
          </div>
          <button class="drilldown-close-btn" id="panel-close" title="Close (ESC)">×</button>
        </div>
        <div class="drilldown-tabs" id="panel-tabs"></div>
        <div class="drilldown-body" id="panel-body"></div>
      </aside>
      <div class="tour-overlay-container" id="tour">
        <div class="tour-dimmer-backdrop" id="tour-dimmer"></div>
        <div class="tour-modal-card" role="dialog" aria-modal="true" aria-labelledby="tour-spoke-title">
          <div class="tour-modal-header">
            <div class="tour-badge-group">
              <span class="tour-step-pill" id="tour-step-pill">STEP 1 OF 7</span>
              <span class="tour-category-badge" id="tour-category"></span>
            </div>
            <button class="tour-close-btn" id="tour-close" title="Close Tour (ESC)">×</button>
          </div>
          <div class="tour-progress-bar-wrap"><div class="tour-progress-bar-fill" id="tour-progress"></div></div>
          <div class="tour-modal-body">
            <div class="tour-title-area">
              <h3 class="tour-spoke-title" id="tour-spoke-title"></h3>
              <p class="tour-spoke-subtitle" id="tour-spoke-subtitle"></p>
            </div>
            <div class="tour-info-card">
              <div class="tour-card-header"><span>What This Spoke Displays</span></div>
              <ul class="tour-card-list" id="tour-displays"></ul>
            </div>
            <div class="tour-info-card primary-value">
              <div class="tour-card-header"><span style="color:var(--success-text)">Client Value & Executive Intelligence</span></div>
              <div class="tour-value-text" id="tour-value"></div>
            </div>
            <button class="tour-drilldown-link-btn" id="tour-open"><span>Explore Full Deep-Dive Panel →</span></button>
          </div>
          <div class="tour-modal-footer">
            <div class="tour-dots-indicator" id="tour-dots"></div>
            <div class="tour-nav-btns">
              <button class="tour-btn" id="tour-prev">Previous</button>
              <button class="tour-btn tour-btn-primary" id="tour-next">Next Step →</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <script>
${TOOLBELT_SDK}
${RUNTIME}
  </script>
</body>
</html>
`;

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(join(root, ".tmp", "fender-v3-spec.json"), JSON.stringify(payload));
  writeFileSync(join(root, ".tmp", "fender-v3-spokes.json"), JSON.stringify(spokes));
  writeFileSync(join(root, ".tmp", "fender-v3-tour.json"), JSON.stringify(tourSteps));
  writeFileSync(outPath, html);
  console.log(`Wrote ${outPath} (${html.length} bytes)`);
  console.log("spec", JSON.stringify(payload).length, "spokes", JSON.stringify(spokes).length, "tour", JSON.stringify(tourSteps).length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
