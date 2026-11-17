"use client";

export function CanvasLoadingShell() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-primary, #070b14)",
        color: "var(--text-muted, #aeb8c7)",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            border: "3px solid rgba(100, 116, 139, 0.38)",
            borderTopColor: "var(--accent, #a7d8f0)",
            animation: "ifai-spin 0.8s linear infinite",
            margin: "0 auto 12px",
          }}
        />
        <p style={{ fontSize: 14, margin: 0 }}>Loading live canvas metrics…</p>
        <style>{`@keyframes ifai-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
