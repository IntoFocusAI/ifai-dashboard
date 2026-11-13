"use client";

import { UserMenuDropdown } from "@/components/auth/UserMenuDropdown";
import { SHOW_HEADER_TICKERS } from "@/lib/canvas-sdk/canvas-chrome-flags";
import { ViewModeSwitch, type CanvasSpecWithViews, type useCanvasViewMode } from "@/lib/canvas-sdk/canvas-views";
import type { TickerIcon } from "@/lib/canvas-sdk/types";
import type { CanvasShellState } from "@/lib/canvas-sdk/useCanvasShellState";
import {
  ExternalLink,
  Layers,
  ListChecks,
  MessageSquareText,
  Moon,
  Search,
  Sparkles,
  Sun,
  TrendingUp,
} from "lucide-react";

function tickerIcon(kind?: TickerIcon) {
  if (kind === "sparkles") return <Sparkles size={12} />;
  if (kind === "trending") return <TrendingUp size={12} />;
  if (kind === "pulse") return <span className="pulse-dot" />;
  return null;
}

type Props = {
  spec: CanvasSpecWithViews;
  iom: boolean;
  s: CanvasShellState;
  views: ReturnType<typeof useCanvasViewMode>;
  showingCommand: boolean;
  showThemeToggle: boolean;
  focusNode: (spokeId: string, subTab?: string) => void;
  resetMainView: () => void;
  resetCanvasView: () => void;
  hidePanel: () => void;
  openCommandCenter: () => void;
};

/** The top header: brand, filters, view switch, search, Prompts, Priorities, and the user menu. */
export function CanvasShellHeader({
  spec,
  iom,
  s,
  views,
  showingCommand,
  showThemeToggle,
  focusNode,
  resetMainView,
  resetCanvasView,
  hidePanel,
  openCommandCenter,
}: Props) {
  const { headerRef, lightTheme, setLightTheme, promptsOpen, setPromptsOpen } = s;
  const { userMenuOpen, setUserMenuOpen, profileOpen, setProfileOpen } = s;
  const commandCenter = spec.commandCenter;

  function handleFilterChange(value: string) {
    const option = spec.filters?.find((item) => item.value === value);
    const target = option?.target ?? (value === "all" ? "overview" : undefined);
    if (!target || target === "overview") {
      if (iom) hidePanel();
      else resetCanvasView();
    } else focusNode(target);
  }

  function handleSearch(query: string) {
    if (!query.trim()) return;
    const q = query.toLowerCase();
    const match = spec.search?.matchers?.find((item) =>
      item.keywords.some((keyword) => q.includes(keyword.toLowerCase())),
    );
    if (match) focusNode(match.spokeId);
  }

  return (
        <header className="top-header" ref={headerRef}>
          <div className="brand-section">
            <button
              type="button"
              className="brand-home-btn"
              onClick={resetMainView}
              aria-label="Back to map overview"
            >
              <img
                src={spec.brand.logoSrc ?? "/icon.png"}
                alt=""
                className="brand-logo-icon"
                aria-hidden
              />
              <div className="brand-title-group">
                <div className="brand-name">
                  {spec.brand.name}
                  {spec.brand.badge ? (
                    <span className="tag-badge tag-version">
                      {spec.brand.badge}
                    </span>
                  ) : null}
                </div>
                {spec.brand.subtitle ? (
                  <div className="brand-sub">{spec.brand.subtitle}</div>
                ) : null}
              </div>
            </button>

            {spec.filters?.length ? (
              <>
                <div className="pill-divider" />
                <div className="filter-selector">
                  <Layers size={13} color="var(--accent-purple)" />
                  <select
                    aria-label="Canvas filter"
                    onChange={(e) => handleFilterChange(e.target.value)}
                  >
                    {spec.filters.map((filter) => (
                      <option key={filter.value} value={filter.value}>
                        {filter.label}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : null}
          </div>

          {SHOW_HEADER_TICKERS && spec.tickers?.length ? (
            <div className="header-ticker">
              {spec.tickers.map((item) => (
                <div
                  key={item.id}
                  className={`ticker-item ticker-badge-${item.tone}`}
                  onClick={() => {
                    if (item.spokeId) focusNode(item.spokeId, item.subTab);
                  }}
                >
                  {tickerIcon(item.icon)}
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="header-controls">
            <ViewModeSwitch views={views} />
            {spec.headerSlot}

            {spec.search ? (
              <div className="search-input-wrapper">
                <Search className="search-icon" size={12} />
                <input
                  type="text"
                  className="search-input"
                  placeholder={spec.search.placeholder ?? "Search..."}
                  onInput={(e) => handleSearch(e.currentTarget.value)}
                />
              </div>
            ) : null}

            {spec.promptsEditor ? (
              <button
                className={`hdr-btn${promptsOpen ? " hdr-btn-active" : ""}`}
                onClick={() => setPromptsOpen(true)}
              >
                <MessageSquareText size={12} />
                <span>Prompts</span>
              </button>
            ) : null}

            {commandCenter ? (
              <button
                className={`hdr-btn hdr-btn-priorities${showingCommand ? " hdr-btn-active" : ""}`}
                onClick={openCommandCenter}
              >
                <ListChecks size={12} />
                <span>Priorities</span>
                {commandCenter.items.length ? (
                  <span className="hdr-btn-count">{commandCenter.items.length}</span>
                ) : null}
              </button>
            ) : null}

            {spec.headerActions?.map((action) => {
              const className = `hdr-btn${action.variant === "primary" ? " hdr-btn-primary" : ""}`;
              const inner = (
                <>
                  <ExternalLink size={12} />
                  <span>{action.label}</span>
                </>
              );
              if (action.href) {
                return (
                  <a key={action.label} className={className} href={action.href}>
                    {inner}
                  </a>
                );
              }
              return (
                <button key={action.label} className={className} onClick={action.onClick}>
                  {inner}
                </button>
              );
            })}

            {spec.userMenu ?? spec.userEmail ? (
              <UserMenuDropdown
                email={spec.userMenu?.email ?? spec.userEmail!}
                displayName={spec.userMenu?.displayName}
                avatarUrl={spec.userMenu?.avatarUrl}
                organizationName={spec.userMenu?.organizationName}
                roleLabel={spec.userMenu?.roleLabel}
                organizations={spec.userMenu?.organizations}
                activeOrganizationId={spec.userMenu?.activeOrganizationId}
                variant="canvas"
                lightTheme={lightTheme}
                showThemeToggle={showThemeToggle}
                onThemeToggle={() => setLightTheme((value) => !value)}
                menuOpen={userMenuOpen}
                onMenuOpenChange={setUserMenuOpen}
                profileOpen={profileOpen}
                onProfileOpenChange={setProfileOpen}
              />
            ) : showThemeToggle ? (
              <button
                className="hdr-btn"
                onClick={() => setLightTheme((value) => !value)}
                aria-label="Toggle Light / Dark"
              >
                {lightTheme ? <Sun size={13} /> : <Moon size={13} />}
              </button>
            ) : null}
          </div>
        </header>
  );
}
