"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { sameTooltipContent, type TooltipContent } from "@/lib/canvas-sdk/tooltip-content";

export type NodeTooltipHandle = {
  /** `x`/`y` are in the anchor's coordinates: canvas-body pixels, or viewport pixels for definitions. */
  show: (content: TooltipContent, x: number, y: number) => void;
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

  useImperativeHandle(
    ref,
    () => ({
      show(next, x, y) {
        at.current = { x, y };
        const place = () => {
          frame.current = 0;
          const box = boxRef.current;
          if (!box) return;
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
    [],
  );

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

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
            fontSize: 10,
          }}
        >
          CLICK FOR MORE INFO →
        </div>
      ) : null}
    </div>
  );
}
