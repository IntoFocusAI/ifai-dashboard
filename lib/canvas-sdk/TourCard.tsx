"use client";

import type { TourStep } from "@/lib/canvas-sdk/types";
import { ExternalLink, Layout, Sparkles, X } from "lucide-react";
import type { Ref } from "react";

type Props = {
  ref: Ref<HTMLDivElement>;
  steps: TourStep[];
  stepIndex: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSelectStep: (index: number) => void;
  onOpenDrilldown: () => void;
};

/** Guided-tour step card. `useTourCard` picks its side and holds it while the lit area clears. */
export function TourCard({
  ref,
  steps,
  stepIndex,
  onClose,
  onPrev,
  onNext,
  onSelectStep,
  onOpenDrilldown,
}: Props) {
  const step = steps[stepIndex];
  if (!step) return null;
  return (
    <div
      ref={ref}
      className="tour-modal-card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-spoke-title"
    >
      <div className="tour-modal-header">
        <div className="tour-badge-group">
          <span className="tour-step-pill">
            STEP {stepIndex + 1} OF {steps.length}
          </span>
          <span className="tour-category-badge">{step.category}</span>
        </div>
        <button className="tour-close-btn" onClick={onClose} aria-label="Close tour">
          <X size={15} />
        </button>
      </div>

      <div className="tour-progress-bar-wrap">
        <div
          className="tour-progress-bar-fill"
          style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
        />
      </div>

      <div className="tour-modal-body">
        <div className="tour-title-area">
          <h3 className="tour-spoke-title" id="tour-spoke-title">
            {step.title}
          </h3>
          <p className="tour-spoke-subtitle">{step.subtitle}</p>
        </div>

        <div className="tour-info-card">
          <div className="tour-card-header">
            <Layout size={13} color="var(--accent-purple)" />
            <span>What&apos;s Inside</span>
          </div>
          <ul className="tour-card-list">
            {step.displays.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </div>

        <div className="tour-info-card primary-value">
          <div className="tour-card-header">
            <Sparkles size={13} color="var(--success-green)" />
            <span style={{ color: "var(--success-text)" }}>
              Client Value & Executive Intelligence
            </span>
          </div>
          <div className="tour-value-text">{step.value}</div>
        </div>

        <button className="tour-drilldown-link-btn" onClick={onOpenDrilldown}>
          <ExternalLink size={12} />
          <span>Explore Full Deep-Dive Panel →</span>
          <em className="tour-drilldown-hint">Tour pauses here. You&apos;ll come back to it.</em>
        </button>
      </div>

      <div className="tour-modal-footer">
        <div className="tour-dots-indicator">
          {steps.map((item, idx) => (
            <div
              key={`${item.nodeId}-${idx}`}
              className={`tour-dot${idx === stepIndex ? " active" : ""}`}
              onClick={() => onSelectStep(idx)}
            />
          ))}
        </div>
        <div className="tour-nav-btns">
          <button
            className="tour-btn"
            onClick={onPrev}
            style={{ visibility: stepIndex === 0 ? "hidden" : "visible" }}
          >
            Previous
          </button>
          <button className="tour-btn tour-btn-primary" onClick={onNext}>
            {stepIndex === steps.length - 1 ? "Finish Tour 🎯" : "Next Step →"}
          </button>
        </div>
      </div>
    </div>
  );
}
