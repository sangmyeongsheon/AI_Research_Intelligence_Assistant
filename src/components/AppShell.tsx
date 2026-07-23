"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { PRODUCT_CONFIG } from "@/src/config/product";
import type { WorkspaceViewMode } from "./LabDirectoryViews";

export type AppScreen =
  | "directory"
  | "department"
  | "lab-profile"
  | "overview"
  | "protocols"
  | "new"
  | "analysis"
  | "source-review"
  | "review"
  | "detail"
  | "assistant"
  | "sources"
  | "settings";

export interface AppShellContext {
  trail: string;
  title: string;
  subtitle?: string;
  activeLabTitle?: string;
}

const primaryNav: Array<{
  screen: AppScreen;
  label: string;
}> = [
  { screen: "directory", label: "Labs" },
  { screen: "overview", label: "Overview" },
  { screen: "protocols", label: "Protocols" },
  { screen: "new", label: "New protocol" },
  { screen: "sources", label: "Sources" },
  { screen: "assistant", label: "Protocol Q&A" },
];

export function AppShell({
  screen,
  onNavigate,
  unresolvedCount,
  demoMode,
  viewMode,
  onViewModeChange,
  context,
  children,
}: {
  screen: AppScreen;
  onNavigate: (screen: AppScreen) => void;
  unresolvedCount: number;
  demoMode: boolean;
  viewMode: WorkspaceViewMode;
  onViewModeChange: (mode: WorkspaceViewMode) => void;
  context: AppShellContext;
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const navigate = (next: AppScreen) => {
    setMenuOpen(false);
    onNavigate(next);
  };

  return (
    <div className="app-shell">
      {menuOpen ? (
        <div
          aria-hidden
          className="source-panel-backdrop"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}
      <aside
        aria-label="주요 메뉴"
        className={`sidebar${menuOpen ? " is-open" : ""}`}
      >
        <button
          aria-label={`${PRODUCT_CONFIG.name} 홈으로 이동`}
          className="brand"
          onClick={() => navigate("directory")}
          style={{ color: "inherit", textAlign: "left", width: "100%" }}
          type="button"
        >
          <span aria-hidden className="aria-brand-mark" />
          <span className="brand-copy">
            <span className="brand-title">{PRODUCT_CONFIG.name}</span>
            <span className="brand-subtitle">
              {PRODUCT_CONFIG.fullName}
            </span>
          </span>
        </button>

        <nav className="nav-section">
          {(screen === "directory"
            ? primaryNav.filter((item) => item.screen === "directory")
            : primaryNav
          ).map((item) => {
            const visitorLocked =
              viewMode === "visitor" &&
              !["directory"].includes(item.screen);
            const selected =
              screen === item.screen ||
              (item.screen === "directory" &&
                ["department", "lab-profile"].includes(screen)) ||
              (item.screen === "new" &&
                ["analysis", "source-review", "review"].includes(screen)) ||
              (item.screen === "protocols" && screen === "detail");
            return (
              <button
                aria-current={selected ? "page" : undefined}
                className="nav-button"
                disabled={visitorLocked}
                key={item.screen}
                onClick={() => navigate(item.screen)}
                title={
                  visitorLocked
                    ? "연구원 보기에서 내부 작업 공간을 열 수 있습니다."
                    : undefined
                }
                type="button"
              >
                <span>{item.label}</span>
                {item.screen === "protocols" && unresolvedCount > 0 ? (
                  <span
                    aria-label={`미해결 ${unresolvedCount}건`}
                    className="nav-count"
                  >
                    {unresolvedCount}
                  </span>
                ) : null}
              </button>
            );
          })}
          {screen === "directory" ? null : (
            <button
              aria-current={screen === "settings" ? "page" : undefined}
              className="nav-button"
              onClick={() => navigate("settings")}
              type="button"
            >
              <span>Settings</span>
            </button>
          )}
        </nav>

        {context.activeLabTitle ? (
          <footer className="sidebar-footer">
            <div className="lab-mini">
              <div>
                <strong>{context.activeLabTitle}</strong>
              </div>
            </div>
          </footer>
        ) : null}
      </aside>

      <main className="app-main">
        <header className="topbar">
          <button
            aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
            className="icon-button mobile-menu-button"
            onClick={() => setMenuOpen((value) => !value)}
            type="button"
          >
            {menuOpen ? (
              <X aria-hidden size={18} />
            ) : (
              <Menu aria-hidden size={18} />
            )}
          </button>

          <button
            aria-label={`${context.title} 위치에서 연구실 디렉터리로 이동`}
            className="current-lab current-context button-quiet"
            onClick={() => navigate("directory")}
            type="button"
          >
            <span className="current-context-trail">{context.trail}</span>
            <span className="current-context-main">
              <strong>{context.title}</strong>
              {context.subtitle ? <span>{context.subtitle}</span> : null}
            </span>
          </button>

          <div className="topbar-actions">
            <div
              aria-label="공개 및 내부 보기 전환"
              className="view-mode-toggle"
              role="group"
            >
              <button
                aria-pressed={viewMode === "visitor"}
                onClick={() => onViewModeChange("visitor")}
                type="button"
              >
                방문자
              </button>
              <button
                aria-pressed={viewMode === "researcher"}
                onClick={() => onViewModeChange("researcher")}
                type="button"
              >
                연구원
              </button>
            </div>
            <span
              className="mode-badge"
              title={
                demoMode
                  ? "Settings에서 본인의 Gemini API 키를 입력해 주세요."
                  : "현재 탭에서 본인의 Gemini API 키를 사용 중입니다."
              }
            >
              <span className="mode-dot" />
              <span>{demoMode ? "내 API 키 입력 필요" : "내 Gemini 키 사용 중"}</span>
            </span>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
