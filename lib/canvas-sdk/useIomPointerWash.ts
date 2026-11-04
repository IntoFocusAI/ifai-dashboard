"use client";

import { useEffect, type RefObject } from "react";

/** The glow's outer stop, as a share of the distance from the pointer to the farthest corner. */
const GLOW_REACH = 0.38;
/** Where the glow rests before the pointer first moves, as a share of the canvas. */
const REST = { x: 0.58, y: 0.42 };

/**
 * Moves the `.canvas-pointer-glow` inside the IOM shell's `.canvas-pointer-wash` to the pointer.
 * The glow is painted once at its largest size (pointer in a corner) and moved and shrunk with a
 * transform once per frame, so a pointer move only recomposites it; nothing is repainted or
 * rasterized. The shrink keeps the size of the farthest-corner gradient this replaced.
 * With reduced motion the glow stays at its rest point.
 */
export function useIomPointerWash(bodyRef: RefObject<HTMLElement | null>, enabled = true) {
  useEffect(() => {
    const body = bodyRef.current;
    const wash = body?.querySelector<HTMLElement>(":scope > .canvas-pointer-wash");
    const glow = wash?.querySelector<HTMLElement>(".canvas-pointer-glow");
    if (!enabled || !body || !wash || !glow) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    let box = body.getBoundingClientRect();
    let diagonal = 0;
    let radius = 0;
    const pointer = { x: 0, y: 0 };
    const rest = () => {
      pointer.x = box.left + box.width * REST.x;
      pointer.y = box.top + box.height * REST.y;
    };
    rest();
    let frame = 0;
    const paint = () => {
      frame = 0;
      if (!box.width || !box.height) return;
      const x = pointer.x - box.left;
      const y = pointer.y - box.top;
      const scale = Math.hypot(Math.max(x, box.width - x), Math.max(y, box.height - y)) / diagonal;
      glow.style.transform = `translate3d(${x - radius}px, ${y - radius}px, 0) scale(${scale.toFixed(4)})`;
      glow.dataset.ready = "true";
    };
    const measure = () => {
      box = body.getBoundingClientRect();
      diagonal = Math.hypot(box.width, box.height);
      radius = Math.round(diagonal * GLOW_REACH);
      glow.style.width = glow.style.height = `${radius * 2}px`;
      if (still.matches) rest();
      if (!frame) frame = requestAnimationFrame(paint);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    window.addEventListener("resize", measure);

    const onPointerMove = (event: PointerEvent) => {
      if (still.matches) return;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      if (!frame) frame = requestAnimationFrame(paint);
    };

    body.addEventListener("pointermove", onPointerMove, { passive: true });
    still.addEventListener("change", measure);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", measure);
      body.removeEventListener("pointermove", onPointerMove);
      still.removeEventListener("change", measure);
    };
  }, [bodyRef, enabled]);
}
