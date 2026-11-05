#!/usr/bin/env node
/* Measures how the Balanced map responds to a pointer sweep across the main bubbles, or to
   opening a spoke's panel from the map.

   Usage: node scripts/measure-map-hover.mjs [baseUrl] [--throttle=4] [--runs=3] [--size=1280x720]
          [--scenario=sweep|panel]

   The page must already be served (npm run dev, or a preview URL). The sweep visits the
   hub and the six spokes three times at about 60 pointer moves per second, re-reading each
   bubble's position before each leg because a hover rest slides the map. The panel scenario
   clicks Catalog Health once the map is still and records the 2.5 s after the click.
   Reported per run: React commits, long tasks, frame gaps, Chrome's script/style/layout time,
   main-thread paint, raster, and GPU-process time from a trace, and for the sweep the delay from
   entering a bubble to the first frame after its signal slots change. */
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const baseUrl = args.find((arg) => !arg.startsWith("--")) ?? "http://localhost:3111";
const flag = (name, fallback) => args.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;
const throttle = Number(flag("throttle", "1"));
const runs = Number(flag("runs", "3"));
const scenario = flag("scenario", "sweep");
const [width, height] = flag("size", "1280x720").split("x").map(Number);
const BUBBLES = ["hub", "spoke-aeo", "spoke-retail", "spoke-competitors", "spoke-roadmap", "spoke-specs", "spoke-fixes"];
const STEPS_PER_LEG = 24;
const LAPS = 3;

/* Installed before any page script, so React registers with this hook and every commit is counted. */
function instrument() {
  const state = { commits: 0, longTasks: 0, longTaskMs: 0, frames: [], latencies: [], pending: null, armed: false };
  window.__mapHover = state;
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    renderers: new Map(),
    inject(renderer) {
      const id = this.renderers.size + 1;
      this.renderers.set(id, renderer);
      return id;
    },
    onCommitFiberRoot() {
      if (state.armed) state.commits += 1;
    },
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    checkDCE() {},
  };
  new PerformanceObserver((list) => {
    if (!state.armed) return;
    for (const entry of list.getEntries()) {
      state.longTasks += 1;
      state.longTaskMs += entry.duration;
    }
  }).observe({ type: "longtask", buffered: false });
  let last = 0;
  const tick = (now) => {
    if (state.armed && last) state.frames.push(now - last);
    last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  let lastMain = null;
  document.addEventListener(
    "pointerover",
    (event) => {
      const node = event.target instanceof Element ? event.target.closest("[data-graph-node-id]") : null;
      const id = node?.getAttribute("data-graph-node-id");
      if (!state.armed || !id || id === lastMain || !id.match(/^(hub|spoke-)/)) return;
      lastMain = id;
      state.pending = event.timeStamp;
    },
    true,
  );
  new MutationObserver((records) => {
    if (state.pending == null) return;
    const touched = records.some((record) => {
      const el = record.target instanceof Element ? record.target : record.target.parentElement;
      return Boolean(el?.closest("[data-hub-slots]")) || [...record.addedNodes].some((n) => n instanceof Element && n.matches("[data-hub-slots]"));
    });
    if (!touched) return;
    const start = state.pending;
    state.pending = null;
    requestAnimationFrame(() => state.latencies.push(performance.now() - start));
  }).observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
}

async function sweep(page) {
  const center = async (id) => {
    const box = await page.locator(`[data-graph-node-id="${id}"] > .node-inner > .node-circle`).boundingBox();
    return box ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : null;
  };
  let from = { x: 640, y: 120 };
  await page.mouse.move(from.x, from.y);
  for (let lap = 0; lap < LAPS; lap += 1) {
    for (const id of BUBBLES) {
      const to = await center(id);
      if (!to) continue;
      for (let step = 1; step <= STEPS_PER_LEG; step += 1) {
        const t = step / STEPS_PER_LEG;
        await page.mouse.move(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
        await page.waitForTimeout(16);
      }
      from = to;
    }
  }
}

async function openPanel(page) {
  const bubble = page.locator(`[data-graph-node-id="spoke-retail"]`);
  await bubble.hover({ force: true });
  await page.waitForTimeout(1500);
  await page.evaluate(() => (window.__mapHover.armed = true));
  await bubble.click({ force: true });
  await page.waitForTimeout(2500);
}

/* Busy time from a trace, merging nested events per thread: main-thread paint (paint,
   pre-paint, layerize, commit), raster tasks on any thread, and the GPU process and display
   compositor, where backdrop blur and filters are drawn. */
const PAINT_EVENTS = new Set(["Paint", "PrePaint", "Layerize", "Commit", "UpdateLayer", "CompositeLayers"]);
const GPU_THREADS = new Set(["CrGpuMain", "VizCompositorThread"]);
function busyMs(spans) {
  const byThread = new Map();
  for (const span of spans) byThread.set(span.thread, [...(byThread.get(span.thread) ?? []), span]);
  let total = 0;
  for (const list of byThread.values()) {
    list.sort((a, b) => a.ts - b.ts);
    let end = -Infinity;
    for (const { ts, dur } of list) {
      if (ts >= end) total += dur;
      else if (ts + dur > end) total += ts + dur - end;
      end = Math.max(end, ts + dur);
    }
  }
  return Math.round(total / 1000);
}
function paintTotals(trace) {
  const events = JSON.parse(trace.toString()).traceEvents ?? [];
  const names = new Map(
    events.filter((e) => e.ph === "M" && e.name === "thread_name").map((e) => [`${e.pid}:${e.tid}`, e.args?.name]),
  );
  const paint = [];
  const raster = [];
  const gpu = [];
  for (const e of events) {
    if (e.ph !== "X" || typeof e.dur !== "number") continue;
    const thread = `${e.pid}:${e.tid}`;
    const span = { thread, ts: e.ts, dur: e.dur };
    if (PAINT_EVENTS.has(e.name) && names.get(thread) === "CrRendererMain") paint.push(span);
    if (e.name === "RasterTask") raster.push(span);
    if (GPU_THREADS.has(names.get(thread))) gpu.push(span);
  }
  return { paintMs: busyMs(paint), rasterMs: busyMs(raster), gpuMs: busyMs(gpu) };
}

const metricNames = ["TaskDuration", "ScriptDuration", "RecalcStyleDuration", "LayoutDuration", "RecalcStyleCount", "LayoutCount"];
async function metrics(cdp) {
  const { metrics: list } = await cdp.send("Performance.getMetrics");
  return Object.fromEntries(list.filter((m) => metricNames.includes(m.name)).map((m) => [m.name, m.value]));
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : NaN;
};

const browser = await chromium.launch({ channel: process.env.E2E_BROWSER === "chromium" ? undefined : "chrome" });
const results = [];
for (let run = 0; run < runs; run += 1) {
  const context = await browser.newContext({ viewport: { width, height } });
  const host = new URL(baseUrl).hostname;
  await context.addCookies([{ name: "ifai_guest_fender", value: "1", domain: host, path: "/" }]);
  const page = await context.newPage();
  await page.addInitScript(instrument);
  // The live feed occasionally fails a load; a fresh load is the same page.
  for (let attempt = 1; ; attempt += 1) {
    await page.goto(`${baseUrl}/dashboard`);
    const loaded = await page
      .locator(`[data-graph-node-id="hub"]`)
      .waitFor({ timeout: 45_000 })
      .then(() => true, () => false);
    if (loaded) break;
    if (attempt === 4) throw new Error("the map did not load after 4 attempts");
  }
  // Bubbles that read a published run say "Loading run" until it lands; that render is not hover work.
  await page
    .waitForFunction(() => ![...document.querySelectorAll(".graph-node")].some((n) => /loading/i.test(n.textContent ?? "")), null, { timeout: 45_000 })
    .catch(() => {});
  await page.waitForTimeout(2500);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  if (throttle > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
  await browser.startTracing(page, { categories: ["devtools.timeline", "disabled-by-default-devtools.timeline"] });
  const before = await metrics(cdp);
  const started = Date.now();
  if (scenario === "panel") {
    await openPanel(page);
  } else {
    await page.evaluate(() => (window.__mapHover.armed = true));
    await sweep(page);
  }
  const wallMs = Date.now() - started;
  await page.evaluate(() => (window.__mapHover.armed = false));
  const after = await metrics(cdp);
  const { paintMs, rasterMs, gpuMs } = paintTotals(await browser.stopTracing());
  const state = await page.evaluate(() => window.__mapHover);
  const delta = (name) => after[name] - before[name];
  results.push({
    wallMs,
    commits: state.commits,
    longTasks: state.longTasks,
    longTaskMs: Math.round(state.longTaskMs),
    frames: state.frames.length,
    framesOver33ms: state.frames.filter((gap) => gap > 33.4).length,
    worstFrameMs: Math.round(Math.max(...state.frames)),
    scriptMs: Math.round(delta("ScriptDuration") * 1000),
    styleMs: Math.round(delta("RecalcStyleDuration") * 1000),
    layoutMs: Math.round(delta("LayoutDuration") * 1000),
    taskMs: Math.round(delta("TaskDuration") * 1000),
    paintMs,
    rasterMs,
    gpuMs,
    styleRecalcs: delta("RecalcStyleCount"),
    hoverToSlotsMedianMs: Math.round(median(state.latencies)),
    hoverToSlotsMaxMs: Math.round(Math.max(...state.latencies)),
    hoverSamples: state.latencies.length,
  });
  await context.close();
}
await browser.close();

const summary = Object.fromEntries(Object.keys(results[0]).map((key) => [key, median(results.map((r) => r[key]))]));
console.log(JSON.stringify({ baseUrl, scenario, size: `${width}x${height}`, throttle, runs, median: summary, results }, null, 2));
