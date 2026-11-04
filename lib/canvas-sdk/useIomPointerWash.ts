"use client";

import { useEffect, type RefObject } from "react";

/**
 * Keeps --pointer-x / --pointer-y in sync for the `.canvas-pointer-wash` child of an IOM shell body.
 * The variables are written on the wash itself, at most once per frame, so a pointer move restyles
 * one element instead of every node under the body.
 */
export function useIomPointerWash(bodyRef: RefObject<HTMLElement | null>, enabled = true) {
  useEffect(() => {
    const body = bodyRef.current;
    const wash = body?.querySelector<HTMLElement>(":scope > .canvas-pointer-wash");
    if (!enabled || !body || !wash) return;

    let box = body.getBoundingClientRect();
    const measure = () => {
      box = body.getBoundingClientRect();
    };
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    window.addEventListener("resize", measure);

    let frame = 0;
    const pointer = { x: 0, y: 0 };
    const paint = () => {
      frame = 0;
      if (!box.width || !box.height) return;
      wash.style.setProperty("--pointer-x", `${((pointer.x - box.left) / box.width) * 100}%`);
      wash.style.setProperty("--pointer-y", `${((pointer.y - box.top) / box.height) * 100}%`);
    };
    const onPointerMove = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      if (!frame) frame = requestAnimationFrame(paint);
    };

    body.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", measure);
      body.removeEventListener("pointermove", onPointerMove);
    };
  }, [bodyRef, enabled]);
}
