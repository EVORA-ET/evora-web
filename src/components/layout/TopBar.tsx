import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, LogOut, Menu, Settings, UserRound } from "lucide-react";

import { useDashboardData } from "../../features/dashboard/useDashboardData";
import { useNotifications } from "../../features/notifications/useNotifications";
import { initialsOf } from "../../lib/format";
import { signOutAndGoHome } from "../../lib/session";
import BrandMark from "./BrandMark";
import "./TopBar.css";

interface TopBarProps {
  onOpenMobileMenu: () => void;
}

function TopBar({ onOpenMobileMenu }: TopBarProps) {
  const { me } = useDashboardData();
  const { unreadCount, panelOpen, togglePanel } = useNotifications();
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const onPointer = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const go = (path: string) => {
    setMenuOpen(false);
    navigate(path);
  };

  const logOut = () => {
    if (signingOut) return;
    setSigningOut(true);
    void signOutAndGoHome();
  };

  return (
    <header className="app-topbar">
      <div className="app-topbar__left">
        <button
          type="button"
          className="app-topbar__menu"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation"
        >
          <Menu size={24} strokeWidth={1.8} />
        </button>

        <button type="button" className="app-topbar__brand" onClick={() => navigate("/dashboard")}>
          <BrandMark size={40} />
          <span className="app-topbar__wordmark">
            <span className="app-topbar__name">EVORA</span>
            <span className="app-topbar__tagline">Fleet Intelligence</span>
          </span>
        </button>
      </div>

      <div className="app-topbar__right">
        <button
          type="button"
          className={`app-topbar__bell ${panelOpen ? "app-topbar__bell--active" : ""}`}
          onClick={togglePanel}
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
          aria-expanded={panelOpen}
        >
          <Bell size={24} strokeWidth={1.6} />
          {unreadCount > 0 && (
            <span className="app-topbar__badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
          )}
        </button>

        <div className="app-topbar__profile" ref={menuRef}>
          <button
            type="button"
            className="app-topbar__avatar"
            onClick={() => setMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Open profile menu"
          >
            {initialsOf(me?.name)}
          </button>

          <div className={`profile-menu ${menuOpen ? "profile-menu--open" : ""}`} role="menu">
            <div className="profile-menu__header">
              <p className="profile-menu__name">{me?.name ?? "Your account"}</p>
              {me?.email && <p className="profile-menu__email">{me.email}</p>}
            </div>

            <button type="button" role="menuitem" className="profile-menu__item" onClick={() => go("/settings")}>
              <UserRound size={18} strokeWidth={1.8} />
              My Profile
            </button>
            <button type="button" role="menuitem" className="profile-menu__item" onClick={() => go("/settings")}>
              <Settings size={18} strokeWidth={1.8} />
              Account Settings
            </button>

            <div className="profile-menu__divider" />

            <button
              type="button"
              role="menuitem"
              className="profile-menu__item profile-menu__item--danger"
              onClick={logOut}
              disabled={signingOut}
            >
              <LogOut size={18} strokeWidth={1.8} />
              {signingOut ? "Signing out…" : "Log Out"}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

export default TopBar;
