import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import "./App.css";
import { HomePage } from "./HomePage.tsx";
import { SiteAccessGate } from "./SiteAccessGate.tsx";
import { SubLootPage } from "./SubLootPage.tsx";
import { hasSiteAccess } from "./siteAccess.ts";

function navTabClass(isActive: boolean) {
  return `app-top-nav-tab${isActive ? " app-top-nav-tab--active" : ""}`;
}

function AppTopNav() {
  return (
    <header className="app-top-nav">
      <div className="app-top-nav-inner">
        <div className="app-top-nav-leading">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `app-brand${isActive ? " app-brand--active" : ""}`
            }
          >
            FFXIV 工坊小幫手
          </NavLink>
          <span className="app-nav-section-label" aria-hidden="true">
            潛水艇
          </span>
          <nav className="app-top-nav-tabs" aria-label="潛水艇">
            <NavLink
              to="/SubLoot"
              className={({ isActive }) => navTabClass(isActive)}
            >
              打撈表
            </NavLink>
          </nav>
        </div>
      </div>
    </header>
  );
}

export function App() {
  const [access, setAccess] = useState<"loading" | "ok" | "need">("loading");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ok = await hasSiteAccess();
      if (!cancelled) setAccess(ok ? "ok" : "need");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (access === "loading") {
    return (
      <div className="app">
        <div className="site-access-loading">驗證狀態載入中…</div>
      </div>
    );
  }

  if (access === "need") {
    return <SiteAccessGate onSuccess={() => setAccess("ok")} />;
  }

  return (
    <div className="app">
      <AppTopNav />
      <main id="app-main" className="app-main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/SubLoot" element={<SubLootPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
