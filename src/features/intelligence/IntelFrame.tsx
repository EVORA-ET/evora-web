import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { RefreshCw } from "lucide-react";

import { getAssessment } from "../../lib/intelligenceApi";
import { OperationsProvider } from "../operations/OperationsProvider";
import { useResource } from "../operations/hooks";
import { useOps } from "../operations/useOps";
import Drawer from "../operations/ui/Drawer";
import { ErrorBlock, Skeleton } from "../operations/ui/states";
import { AssessmentBody } from "./AssessmentViews";
import { useParam } from "./hooks";
import "../operations/operations.css";
import "./intel.css";
import "./charts.css";

export interface FrameTab {
  to: string;
  label: string;
  end?: boolean;
}

interface FrameProps {
  title: string;
  description: string;
  tabs: FrameTab[];
  navLabel: string;
  /** Secondary destination shown beside Refresh (e.g. data & sources). */
  secondary?: FrameTab;
}

/** Opens any stored assessment from `?assessment=<id>`, on every tab. */
function AssessmentDrawer() {
  const [id, setId] = useParam("assessment");
  const { data, error, reload } = useResource(getAssessment, id);
  const current = data && data.id === id ? data : undefined;

  return (
    <Drawer open={Boolean(id)} title="Assessment" onClose={() => setId(null)} wide>
      {error && !current ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : !current ? (
        <Skeleton lines={8} />
      ) : (
        <AssessmentBody assessment={current} />
      )}
    </Drawer>
  );
}

function Frame({ title, description, tabs, navLabel, secondary }: FrameProps) {
  const { invalidate } = useOps();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = () => {
    setRefreshing(true);
    invalidate();
    window.setTimeout(() => setRefreshing(false), 700);
  };

  return (
    <div className="ops">
      <header className="ops-head">
        <div>
          <h1 className="ops-head__title">{title}</h1>
          <p className="ops-head__desc">{description}</p>
        </div>
        <div className="ops-head__controls">
          {secondary && (
            <NavLink to={secondary.to} className={({ isActive }) => `ops-btn ops-btn--ghost ${isActive ? "intel-secondary--active" : ""}`}>
              {secondary.label}
            </NavLink>
          )}
          <button type="button" className="ops-btn ops-btn--secondary" onClick={refresh} aria-label="Refresh data">
            <RefreshCw size={16} className={refreshing ? "ops-spin" : undefined} />
            <span className="ops-hide-sm">Refresh</span>
          </button>
        </div>
      </header>

      <nav className="ops-tabs" aria-label={navLabel}>
        {tabs.map((tab) => (
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

      <AssessmentDrawer />
    </div>
  );
}

/** Module layout shared by EV Migration and Health & Maintenance. */
function IntelFrame(props: FrameProps) {
  return (
    <OperationsProvider>
      <Frame {...props} />
    </OperationsProvider>
  );
}

export default IntelFrame;
