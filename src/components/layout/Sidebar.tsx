import { NavLink } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

import { NAV_ITEMS } from "./navItems";
import "./Sidebar.css";

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
}

function Sidebar({ collapsed, mobileOpen, onToggleCollapsed, onCloseMobile }: SidebarProps) {
  return (
    <>
      <div
        className={`app-sidebar-scrim ${mobileOpen ? "app-sidebar-scrim--open" : ""}`}
        onClick={onCloseMobile}
        aria-hidden="true"
      />

      <nav
        className={[
          "app-sidebar",
          collapsed ? "app-sidebar--collapsed" : "",
          mobileOpen ? "app-sidebar--mobile-open" : "",
        ].join(" ")}
        aria-label="Main navigation"
      >
        <ul className="app-sidebar__list">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                title={collapsed ? label : undefined}
                className={({ isActive }) =>
                  `app-sidebar__link ${isActive ? "app-sidebar__link--active" : ""}`
                }
              >
                <Icon className="app-sidebar__icon" size={24} strokeWidth={1.6} />
                <span className="app-sidebar__label">{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="app-sidebar__collapse"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand menu" : "Collapse menu"}
          title={collapsed ? "Expand menu" : undefined}
        >
          <ChevronLeft className="app-sidebar__icon app-sidebar__collapse-icon" size={22} strokeWidth={1.8} />
          <span className="app-sidebar__label">Collapse menu</span>
        </button>
      </nav>
    </>
  );
}

export default Sidebar;
