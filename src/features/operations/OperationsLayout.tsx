import { useEffect, useRef, useState } from "react";
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, RefreshCw } from "lucide-react";

import GlobalSearch from "./GlobalSearch";
import { OperationsProvider } from "./OperationsProvider";
import { localToday, shiftDate } from "./format";
import { useOps } from "./useOps";
import "./operations.css";

const TABS = [
  { to: "/fleets", label: "Overview", end: true },
  { to: "/fleets/depots", label: "Depots" },
  { to: "/fleets/fleets", label: "Fleets" },
  { to: "/fleets/vehicles", label: "Vehicles" },
  { to: "/fleets/drivers", label: "Drivers" },
  { to: "/fleets/routes", label: "Routes" },
  { to: "/fleets/jobs", label: "Daily Jobs" },
  { to: "/fleets/assignments", label: "Assignments" },
];

const ADD_ACTIONS = [
  { label: "Depot", to: "/fleets/depots" },
  { label: "Fleet", to: "/fleets/fleets" },
  { label: "Vehicle", to: "/fleets/vehicles" },
  { label: "Driver", to: "/fleets/drivers" },
  { label: "Route", to: "/fleets/routes" },
  { label: "Daily job", to: "/fleets/jobs" },
];

/** Workspaces whose content depends on the selected day. */
const DATED = ["/fleets", "/fleets/jobs", "/fleets/assignments"];

/** Links written by the Dashboard before Operations existed. */
const LEGACY_PARAMS: [string, string][] = [
  ["vehicle", "/fleets/vehicles"],
  ["driver", "/fleets/drivers"],
  ["route", "/fleets/routes"],
  ["depot", "/fleets/depots"],
];

function DateControl() {
  const { date, setDate } = useOps();

  return (
    <div className="ops-date" role="group" aria-label="Operational date">
      <button
        type="button"
        className="ops-icon-btn"
        aria-label="Previous day"
        onClick={() => setDate(shiftDate(date, -1))}
      >
        <ChevronLeft size={18} />
      </button>
      <label className="ops-date__input">
        <CalendarDays size={16} aria-hidden="true" />
        <input
          type="date"
          value={date}
          aria-label="Select date"
          onChange={(event) => event.target.value && setDate(event.target.value)}
        />
      </label>
      <button
        type="button"
        className="ops-icon-btn"
        aria-label="Next day"
        onClick={() => setDate(shiftDate(date, 1))}
      >
        <ChevronRight size={18} />
      </button>
      {date !== localToday() && (
        <button type="button" className="ops-btn ops-btn--ghost ops-btn--sm" onClick={() => setDate(localToday())}>
          Today
        </button>
      )}
    </div>
  );
}

function AddMenu() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="ops-addmenu" ref={box}>
      <button
        type="button"
        className="ops-btn ops-btn--primary"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Plus size={17} strokeWidth={2.2} /> Add
      </button>
      {open && (
        <div className="ops-addmenu__panel" role="menu">
          {ADD_ACTIONS.map((action) => (
            <button
              key={action.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                navigate(`${action.to}?create=1`);
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Frame() {
  const { invalidate } = useOps();
  const { pathname, search } = useLocation();
  const [refreshing, setRefreshing] = useState(false);

  if (pathname === "/fleets") {
    const params = new URLSearchParams(search);
    for (const [param, target] of LEGACY_PARAMS) {
      const id = params.get(param);
      if (id) return <Navigate to={`${target}?open=${encodeURIComponent(id)}`} replace />;
    }
  }

  const refresh = () => {
    setRefreshing(true);
    invalidate();
    window.setTimeout(() => setRefreshing(false), 700);
  };

  return (
    <div className="ops">
      <header className="ops-head">
        <div>
          <h1 className="ops-head__title">Operations</h1>
          <p className="ops-head__desc">
            Monitor fleet activity, manage resources, and coordinate daily operations.
          </p>
        </div>

        <div className="ops-head__controls">
          <GlobalSearch />
          {DATED.includes(pathname) && <DateControl />}
          <button
            type="button"
            className="ops-btn ops-btn--secondary"
            onClick={refresh}
            aria-label="Refresh data"
          >
            <RefreshCw size={16} className={refreshing ? "ops-spin" : undefined} />
            <span className="ops-hide-sm">Refresh</span>
          </button>
          <AddMenu />
        </div>
      </header>

      <nav className="ops-tabs" aria-label="Operations workspaces">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) => `ops-tab ${isActive ? "ops-tab--active" : ""}`}
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <div className="ops-content">
        <Outlet />
      </div>
    </div>
  );
}

function OperationsLayout() {
  return (
    <OperationsProvider>
      <Frame />
    </OperationsProvider>
  );
}

export default OperationsLayout;
