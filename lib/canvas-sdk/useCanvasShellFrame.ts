"use client";

import type { CanvasShellState } from "@/lib/canvas-sdk/useCanvasShellState";
import { useEffect } from "react";

/**
 * Window width, header height, and the scroll lock on the shell root.
 * Split from CanvasShell without behavior change.
 */
export function useCanvasShellFrame(s: Pick<CanvasShellState, "rootRef" | "headerRef" | "setWindowWidth">) {
  const { rootRef, headerRef, setWindowWidth } = s;

  useEffect(() => {
    let timer = 0;
    const onResize = () => {
      // Width eases on the expand toggle. A window resize should track the
      // viewport immediately, so the transition is suppressed until it settles.
      rootRef.current?.classList.add("is-resizing");
      setWindowWidth(window.innerWidth);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        rootRef.current?.classList.remove("is-resizing");
      }, 150);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", onResize);
      rootRef.current?.classList.remove("is-resizing");
    };
  }, [rootRef, setWindowWidth]);

  useEffect(() => {
    const header = headerRef.current;
    const root = rootRef.current;
    if (!header || !root) return;

    const syncHeaderHeight = () => {
      root.style.setProperty("--canvas-header-height", `${header.offsetHeight}px`);
    };

    syncHeaderHeight();
    const observer = new ResizeObserver(syncHeaderHeight);
    observer.observe(header);
    return () => observer.disconnect();
  }, [headerRef, rootRef]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const lockScroll = () => {
      root.scrollLeft = 0;
      root.scrollTop = 0;
      const layout = root.querySelector(".canvas-layout");
      if (layout instanceof HTMLElement) {
        layout.scrollLeft = 0;
        layout.scrollTop = 0;
      }
    };
    root.addEventListener("scroll", lockScroll, true);
    return () => root.removeEventListener("scroll", lockScroll, true);
  }, [rootRef]);
}
