import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { DashboardDataProvider } from "../../features/dashboard/DashboardDataProvider";
import AlertToasts from "../../features/notifications/AlertToasts";
import NotificationPanel from "../../features/notifications/NotificationPanel";
import { NotificationProvider } from "../../features/notifications/NotificationProvider";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import "./AppShell.css";

const COLLAPSE_KEY = "evora.sidebar.collapsed";

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function AppShell() {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  /* The mobile menu remembers the page it was opened on, so navigating closes it. */
  const [mobileOpenOn, setMobileOpenOn] = useState<string | null>(null);
  const location = useLocation();
  const mobileOpen = mobileOpenOn === location.pathname;

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;

      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* Preference simply won't persist. */
      }

      return next;
    });
  };

  return (
    <DashboardDataProvider>
      <NotificationProvider>
        <div className={`app-shell ${collapsed ? "app-shell--collapsed" : ""}`}>
          <TopBar onOpenMobileMenu={() => setMobileOpenOn(location.pathname)} />

          <Sidebar
            collapsed={collapsed}
            mobileOpen={mobileOpen}
            onToggleCollapsed={toggleCollapsed}
            onCloseMobile={() => setMobileOpenOn(null)}
          />

          <main className="app-shell__main">
            <Outlet />
          </main>

          <AlertToasts />
          <NotificationPanel />
        </div>
      </NotificationProvider>
    </DashboardDataProvider>
  );
}

export default AppShell;
