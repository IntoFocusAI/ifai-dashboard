"use client";

import { CommandCenter } from "@/lib/canvas-sdk/CommandCenter";
import type { CanvasSpecWithViews } from "@/lib/canvas-sdk/canvas-views";
import type { CanvasShellState } from "@/lib/canvas-sdk/useCanvasShellState";
import { ChevronLeft, Compass, Maximize2, Minimize2, X } from "lucide-react";

type Spoke = CanvasSpecWithViews["spokes"][string];

type Props = {
  spec: CanvasSpecWithViews;
  iom: boolean;
  s: CanvasShellState;
  spoke: Spoke | null;
  spokeBody: ReturnType<Spoke["render"]> | null;
  showingCommand: boolean;
  panelOpen: boolean;
  tourOverlayVisible: boolean;
  tourStepCount: number;
  showPanel: () => void;
  hidePanel: () => void;
  closeDrilldown: () => void;
  openCommandCenter: () => void;
  resetCanvasView: () => void;
  frameOverview: () => void;
  focusNode: (spokeId: string, subTab?: string, fromBubble?: string) => void;
};

/** The side panel: show-panel toggle, header, crumb, tabs, and the tab body. */
export function CanvasDrilldownPanel({
  spec,
  iom,
  s,
  spoke,
  spokeBody,
  showingCommand,
  panelOpen,
  tourOverlayVisible,
  tourStepCount,
  showPanel,
  hidePanel,
  closeDrilldown,
  openCommandCenter,
  resetCanvasView,
  frameOverview,
  focusNode,
}: Props) {
  const { drilldownBodyRef, panelLayout, setPanelLayout, tourSuspended, tourStep, activeTab, setActiveTab } = s;
  const commandCenter = spec.commandCenter;

  return (
    <>
        {panelOpen && panelLayout === "hidden" && !tourOverlayVisible ? (
          <button
            type="button"
            className="drilldown-panel-toggle panel-toggle"
            onClick={showPanel}
            aria-label="Show sidebar"
          >
            <ChevronLeft size={18} strokeWidth={2} />
          </button>
        ) : null}

        <aside className={`drilldown-panel${panelOpen && !tourOverlayVisible ? " open" : ""}`}>
          <div className="drilldown-header">
            <div className="drilldown-title-wrap">
              <div className="drilldown-title-main">
                {commandCenter && !showingCommand ? (
                  <button className="drilldown-back-btn" onClick={openCommandCenter}>
                    <ChevronLeft size={12} />
                    Priorities
                  </button>
                ) : null}
                {showingCommand ? (
                  <>
                    <span className="drilldown-badge">{commandCenter?.badge ?? "COMMAND CENTER"}</span>
                    <h2 className="drilldown-title">{commandCenter?.title}</h2>
                  </>
                ) : null}
                {showingCommand ? (
                  commandCenter?.desc?.trim() ? (
                    <p className="drilldown-desc">{commandCenter.desc}</p>
                  ) : null
                ) : spoke?.descSlot ? (
                  <p className="drilldown-desc">{spoke.descSlot}</p>
                ) : spoke?.desc?.trim() ? (
                  <p className="drilldown-desc">{spoke.desc}</p>
                ) : null}
                {!showingCommand && spoke?.headerAccessory ? spoke.headerAccessory : null}
              </div>
            </div>

            <div className="drilldown-header-actions">
              {tourSuspended ? (
                <button
                  className="drilldown-resume-btn"
                  onClick={closeDrilldown}
                >
                  <Compass size={13} />
                  Resume tour · {tourStep + 1}/{tourStepCount}
                </button>
              ) : null}
              {iom ? null : (
                <button
                  className="drilldown-expand-btn"
                  onClick={() =>
                    setPanelLayout((value) => (value === "wide" ? "narrow" : "wide"))
                  }
                  aria-label={panelLayout === "wide" ? "Use narrow sidebar" : "Use wide sidebar"}
                  aria-pressed={panelLayout === "wide"}
                >
                  {panelLayout === "wide" ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
              )}
              <button
                className="drilldown-hide-btn"
                onClick={hidePanel}
                aria-label={iom ? "Show full map" : "Hide sidebar"}
              >
                <X size={15} strokeWidth={3} aria-hidden="true" />
                <span>Close panel</span>
              </button>
              {iom ? null : (
                <button
                  className="drilldown-close-btn"
                  onClick={closeDrilldown}
                  aria-label="Close panel"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>

          {showingCommand || !spoke ? null : (
            <>
              <nav className="drilldown-crumb" aria-label="Location">
                <button
                  type="button"
                  onClick={() => {
                    if (commandCenter) openCommandCenter();
                    else resetCanvasView();
                    frameOverview();
                  }}
                >
                  Map
                </button>
                <span aria-hidden="true">›</span>
                <span>{spoke.navLabel ?? spoke.title}</span>
                <span aria-hidden="true">›</span>
                <span className="drilldown-crumb-here">{spoke.tabs[activeTab]}</span>
              </nav>
              <div className="drilldown-tabs" role="tablist">
                {spoke.tabs.map((tabName, idx) => (
                  <button
                    key={tabName}
                    role="tab"
                    aria-selected={idx === activeTab}
                    className={`drilldown-tab-btn${idx === activeTab ? " active" : ""}`}
                    data-new-tab={spoke.newTabs?.includes(tabName) ? "" : undefined}
                    aria-description={spoke.newTabs?.includes(tabName) ? "New" : undefined}
                    onClick={() => {
                      setActiveTab(idx);
                      if (spoke.tabs[idx] === "Citation Ecosystem") {
                        setPanelLayout((current) => (current === "narrow" ? "wide" : current));
                      }
                    }}
                  >
                    {tabName}
                  </button>
                ))}
              </div>
            </>
          )}

          {showingCommand && commandCenter ? (
            <div ref={drilldownBodyRef} className="drilldown-body">
              <CommandCenter spec={commandCenter} onOpenItem={focusNode} />
            </div>
          ) : typeof spokeBody === "string" ? (
            <div
              ref={drilldownBodyRef}
              className="drilldown-body"
              dangerouslySetInnerHTML={{ __html: spokeBody }}
            />
          ) : (
            <div ref={drilldownBodyRef} className="drilldown-body">
              {spokeBody}
            </div>
          )}

        </aside>
    </>
  );
}
