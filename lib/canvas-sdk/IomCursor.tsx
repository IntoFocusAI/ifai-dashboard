"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { createPortal } from "react-dom";
import {
  CANVAS_PROFILE_MODAL,
  FINE_POINTER_QUERY,
  pointInRect,
  targetIsInteractive,
} from "@/lib/canvas-sdk/iom-cursor-targets";

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

    const state = { x: 0, y: 0, visible: false, hover: false, target: null as EventTarget | null };
    const painted = { visible: false, hover: false };
    let frame = 0;
    let clickTimer = 0;

    const paint = () => {
      frame = 0;
      if (state.visible) portal.style.transform = `translate3d(${state.x}px, ${state.y}px, 0)`;
      if (painted.visible !== state.visible) {
        painted.visible = state.visible;
        portal.dataset.visible = state.visible ? "true" : "false";
      }
      if (painted.hover !== state.hover) {
        painted.hover = state.hover;
        if (state.hover) portal.dataset.hover = "true";
        else delete portal.dataset.hover;
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(paint);
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
      state.visible = inActiveRegion(event.clientX, event.clientY);
      if (event.target !== state.target) {
        state.target = event.target;
        state.hover = targetIsInteractive(event.target);
      }
      if (!state.visible) state.hover = false;
      schedule();
    };

    const onDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || !inActiveRegion(event.clientX, event.clientY)) return;
      setClicking(true);
      setBurstKey((key) => key + 1);
      window.clearTimeout(clickTimer);
      clickTimer = window.setTimeout(() => setClicking(false), CLICK_MS);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });

    return () => {
      html.classList.remove("iom-custom-cursor-active");
      cancelAnimationFrame(frame);
      window.clearTimeout(clickTimer);
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
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
