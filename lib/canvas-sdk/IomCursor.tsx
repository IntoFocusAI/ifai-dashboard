"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { createPortal } from "react-dom";
import {
  CANVAS_PROFILE_MODAL,
  FINE_POINTER_QUERY,
  opensNativePicker,
  pointInRect,
  targetIsInteractive,
} from "@/lib/canvas-sdk/iom-cursor-targets";

/** Off: the dashboard uses the operating system's cursor. The reticle felt laggy on client laptops. */
export const IOM_CUSTOM_CURSOR = false;

const CLICK_MS = 420;

function subscribeFinePointer(onChange: () => void) {
  const query = window.matchMedia(FINE_POINTER_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

type Props = {
  rootRef: RefObject<HTMLElement | null>;
  enabled: boolean;
};

/**
 * The reticle that replaces the system cursor on IOM canvases. It stays mounted while the
 * canvas is up; each pointer move is coalesced into one write per frame of its transform and
 * its `data-visible` / `data-hover` attributes, so moving the mouse renders nothing in React.
 */
export function IomCursor({ rootRef, enabled }: Props) {
  const finePointer = useSyncExternalStore(
    subscribeFinePointer,
    () => window.matchMedia(FINE_POINTER_QUERY).matches,
    () => false,
  );
  const active = enabled && finePointer;
  const portalRef = useRef<HTMLDivElement>(null);
  const [clicking, setClicking] = useState(false);
  const [burstKey, setBurstKey] = useState(0);

  useEffect(() => {
    const portal = portalRef.current;
    if (!active || !portal) return;

    const html = document.documentElement;
    html.classList.add("iom-custom-cursor-active");

    const root = rootRef.current;
    let rootBox = root?.getBoundingClientRect() ?? null;
    const measure = () => {
      rootBox = root?.getBoundingClientRect() ?? null;
    };
    const observer = new ResizeObserver(measure);
    if (root) observer.observe(root);
    window.addEventListener("resize", measure);

    /* `inside`: the last pointer event was over the canvas. `away`: the pointer left the window,
       the window lost focus, or a native picker took the pointer; the next move inside clears it. */
    const state = { x: 0, y: 0, inside: false, away: false, targetHover: false, target: null as EventTarget | null };
    const painted = { visible: false, hover: false };
    let frame = 0;
    let rescan = false;
    let clickTimer = 0;

    const paint = () => {
      frame = 0;
      if (rescan) {
        rescan = false;
        // The page can change under a still pointer (the map slides, a click opens the panel).
        const under = state.inside && !state.away ? document.elementFromPoint(state.x, state.y) : null;
        if (under) {
          state.target = under;
          state.targetHover = targetIsInteractive(under);
        }
      }
      const visible = state.inside && !state.away;
      const hover = visible && state.targetHover;
      if (visible) portal.style.transform = `translate3d(${state.x}px, ${state.y}px, 0)`;
      if (painted.visible !== visible) {
        painted.visible = visible;
        portal.dataset.visible = visible ? "true" : "false";
      }
      if (painted.hover !== hover) {
        painted.hover = hover;
        if (hover) portal.dataset.hover = "true";
        else delete portal.dataset.hover;
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const scheduleRescan = () => {
      rescan = true;
      schedule();
    };
    const hide = () => {
      state.away = true;
      schedule();
    };

    const inActiveRegion = (x: number, y: number) => {
      if (rootBox && pointInRect(x, y, rootBox)) return true;
      const modal = document.querySelector(CANVAS_PROFILE_MODAL);
      return modal instanceof HTMLElement && pointInRect(x, y, modal.getBoundingClientRect());
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      state.x = event.clientX;
      state.y = event.clientY;
      state.inside = inActiveRegion(event.clientX, event.clientY);
      state.away = false;
      rescan = false;
      if (event.target !== state.target) {
        state.target = event.target;
        state.targetHover = targetIsInteractive(event.target);
      }
      schedule();
    };

    const onDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || !inActiveRegion(event.clientX, event.clientY)) return;
      if (opensNativePicker(event.target)) {
        hide();
        return;
      }
      setClicking(true);
      setBurstKey((key) => key + 1);
      window.clearTimeout(clickTimer);
      clickTimer = window.setTimeout(() => setClicking(false), CLICK_MS);
    };

    const onOut = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && !event.relatedTarget) hide();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") hide();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", scheduleRescan, { passive: true });
    window.addEventListener("wheel", scheduleRescan, { passive: true });
    document.addEventListener("transitionend", scheduleRescan, { passive: true });
    document.addEventListener("pointerout", onOut, { passive: true });
    window.addEventListener("blur", hide);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      html.classList.remove("iom-custom-cursor-active");
      cancelAnimationFrame(frame);
      window.clearTimeout(clickTimer);
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", scheduleRescan);
      window.removeEventListener("wheel", scheduleRescan);
      document.removeEventListener("transitionend", scheduleRescan);
      document.removeEventListener("pointerout", onOut);
      window.removeEventListener("blur", hide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [active, rootRef]);

  if (!active) return null;

  return createPortal(
    <div
      ref={portalRef}
      className="iom-cursor-portal"
      aria-hidden
      data-visible="false"
      data-click={clicking ? "true" : undefined}
    >
      <span className="iom-cursor-burst" key={burstKey} />
      <span className="iom-cursor-reticle">
        <span className="iom-cursor-ring" />
        <span className="iom-cursor-core" />
        <span className="iom-cursor-tick iom-cursor-tick-n" />
        <span className="iom-cursor-tick iom-cursor-tick-e" />
        <span className="iom-cursor-tick iom-cursor-tick-s" />
        <span className="iom-cursor-tick iom-cursor-tick-w" />
      </span>
    </div>,
    document.body,
  );
}
