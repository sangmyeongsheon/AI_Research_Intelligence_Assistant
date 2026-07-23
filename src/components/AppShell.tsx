"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { PRODUCT_CONFIG } from "@/src/config/product";

export type AppScreen =
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

const primaryNav: Array<{
  screen: AppScreen;
  label: string;
}> = [
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
  children,
}: {
  screen: AppScreen;
  onNavigate: (screen: AppScreen) => void;
  unresolvedCount: number;
  demoMode: boolean;
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
          aria-label="Overview로 이동"
          className="brand"
          onClick={() => navigate("overview")}
          style={{ color: "inherit", textAlign: "left", width: "100%" }}
          type="button"
        >
          <span className="brand-copy">
            <span className="brand-title">{PRODUCT_CONFIG.name}</span>
            <span className="brand-subtitle">Evidence-linked protocols</span>
          </span>
        </button>

        <nav className="nav-section">
          {primaryNav.map((item) => {
            const selected =
              screen === item.screen ||
              (item.screen === "new" &&
                ["analysis", "source-review", "review"].includes(screen)) ||
              (item.screen === "protocols" && screen === "detail");
            return (
              <button
                aria-current={selected ? "page" : undefined}
                className="nav-button"
                key={item.screen}
                onClick={() => navigate(item.screen)}
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
          <button
            aria-current={screen === "settings" ? "page" : undefined}
            className="nav-button"
            onClick={() => navigate("settings")}
            type="button"
          >
            <span>Settings</span>
          </button>
        </nav>

        <footer className="sidebar-footer">
          <div className="lab-mini">
            <div>
              <strong>{PRODUCT_CONFIG.defaultLab.name}</strong>
              <span>{PRODUCT_CONFIG.defaultLab.shortName}</span>
            </div>
          </div>
        </footer>
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
            className="current-lab button-quiet"
            onClick={() => navigate("settings")}
            type="button"
          >
            <strong>{PRODUCT_CONFIG.defaultLab.name}</strong>
            <span>{PRODUCT_CONFIG.defaultLab.shortName}</span>
          </button>

          <div className="topbar-actions">
            <span
              className="mode-badge"
              title={
                demoMode
                  ? "Settings에서 본인의 Gemini API 키를 입력해 주세요."
                  : "현재 탭에 사용자의 Gemini API 키가 입력되어 있습니다."
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
