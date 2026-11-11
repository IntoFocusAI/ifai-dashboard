"use client";

import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from "react";
import { sameTooltipContent, type TooltipContent } from "@/lib/canvas-sdk/tooltip-content";

/** The anchor element's box in viewport pixels. Definitions use it to flip and clamp. */
export type TooltipAnchorBox = { left: number; right: number; top: number; bottom: number };

/** Space kept between a definition tooltip and the viewport edge, and between it and its anchor. */
const EDGE = 8;
const GAP = 10;

export type NodeTooltipHandle = {
  /** `x`/`y` are in the anchor's coordinates: canvas-body pixels, or viewport pixels for definitions. */
  show: (content: TooltipContent, x: number, y: number, anchorBox?: TooltipAnchorBox) => void;
  hide: () => void;
};

/**
 * The shared hover box for map bubbles and definition marks. It owns its own state, so a
 * pointer moving over a bubble moves this box without re-rendering the shell or the map:
 * the position is written to the element once per frame, and React renders only when the
 * text or the visibility changes.
 */
export function NodeTooltip({ ref }: { ref: Ref<NodeTooltipHandle> }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState<TooltipContent | null>(null);
  const [visible, setVisible] = useState(false);
  const shown = useRef<{ content: TooltipContent | null; visible: boolean }>({ content: null, visible: false });
  const frame = useRef(0);
  const at = useRef({ x: 0, y: 0 });
  const anchorBox = useRef<TooltipAnchorBox | null>(null);

  /**
   * Places a definition tooltip inside the viewport: above its anchor when it fits, below when
   * it does not, clamped sideways, and height-capped (scrolling inside) as a last resort.
   */
  const layoutDefinition = useCallback(() => {
    const box = boxRef.current;
    const anchor = anchorBox.current;
    if (!box) return;
    if (!anchor || shown.current.content?.anchor !== "definition") {
      // Map bubbles keep the stylesheet placement.
      box.style.maxHeight = "";
      box.style.overflowY = "";
      box.style.transform = "";
      return;
    }
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const vh = window.innerHeight;
    box.style.maxHeight = `${Math.max(vh - 2 * EDGE, 40)}px`;
    box.style.overflowY = "auto";
    const width = box.offsetWidth;
    const height = box.offsetHeight;
    const above = anchor.top - GAP - EDGE;
    const below = vh - anchor.bottom - GAP - EDGE;
    const placeAbove = height <= above || (height > below && above >= below);
    const room = placeAbove ? above : below;
    if (height > room) box.style.maxHeight = `${Math.max(room, 40)}px`;
    const usedHeight = Math.min(box.offsetHeight, Math.max(room, 40));
    const top = placeAbove ? anchor.top - GAP - usedHeight : anchor.bottom + GAP;
    const centre = (anchor.left + anchor.right) / 2;
    const left = Math.min(Math.max(centre - width / 2, EDGE), Math.max(vw - width - EDGE, EDGE));
    box.style.left = `${left}px`;
    box.style.top = `${Math.max(top, EDGE)}px`;
    box.style.transform = `scale(${shown.current.visible ? 1 : 0.96})`;
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      show(next, x, y, box) {
        at.current = { x, y };
        anchorBox.current = next.anchor === "definition" ? (box ?? null) : null;
        const place = () => {
          frame.current = 0;
          const box = boxRef.current;
          if (!box) return;
          if (anchorBox.current) {
            layoutDefinition();
            return;
          }
          box.style.left = `${at.current.x}px`;
          box.style.top = `${at.current.y}px`;
        };
        // New text or a fresh show lands at once; a move along the same bubble waits for the frame.
        const changed = !shown.current.visible || !sameTooltipContent(shown.current.content, next);
        if (changed) {
          cancelAnimationFrame(frame.current);
          place();
        } else if (!frame.current) {
          frame.current = requestAnimationFrame(place);
        }
        if (!sameTooltipContent(shown.current.content, next)) {
          shown.current.content = next;
          setContent(next);
        }
        if (!shown.current.visible) {
          shown.current.visible = true;
          setVisible(true);
        }
      },
      hide() {
        if (!shown.current.visible) return;
        shown.current.visible = false;
        setVisible(false);
      },
    }),
    [layoutDefinition],
  );

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // The box is measured after its text renders, so the placement uses the real size.
  useLayoutEffect(() => {
    layoutDefinition();
  }, [content, visible, layoutDefinition]);

  return (
    <div
      ref={boxRef}
      className={`node-tooltip${content?.anchor === "column-right" ? " node-tooltip-column" : ""}${content?.anchor === "definition" ? " node-tooltip-definition" : ""}${content?.example ? " node-tooltip-example" : ""}${visible ? " visible" : ""}`}
    >
      {content?.title ? <div style={{ fontWeight: 600, marginBottom: 2 }}>{content.title}</div> : null}
      {content?.desc ? (
        <div className="node-tooltip-desc" style={{ color: "var(--text-muted)", fontSize: 11 }}>
          {content.desc}
        </div>
      ) : null}
      {content?.hasMoreInfo ? (
        <div
          style={{
            marginTop: 6,
            color: "var(--accent-purple)",
            fontWeight: 600,
            fontSize: 11,
          }}
        >
          CLICK FOR MORE INFO →
        </div>
      ) : null}
    </div>
  );
}
