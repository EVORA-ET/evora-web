import { CircleCheck, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import { formatNumber } from "../../../lib/format";
import { SEVERITY_LABEL, type AlertSeverity } from "../model/alerts";
import { useInsights } from "./useInsights";
import { useDashboardData } from "../useDashboardData";
import { BigNumber, ListRow, Pill, WidgetEmpty } from "./primitives";
import type { Tone } from "./tones";

const SEVERITY_TONE: Record<AlertSeverity, Tone> = {
  critical: "error",
  warning: "amber",
  info: "slate",
  positive: "green",
};

/* ------------------------------------------------------------------ */
/* Today's attention                                                   */
/* ------------------------------------------------------------------ */

export function TodaysAttentionWidget() {
  const { alerts } = useDashboardData();
  const actionable = alerts.filter((alert) => alert.severity !== "positive");

  if (actionable.length === 0) {
    return (
      <WidgetEmpty
        icon={CircleCheck}
        title="Nothing needs attention"
        text="Maintenance, insurance, licence and route issues will be listed here."
      />
    );
  }

  return (
    <div className="w-list">
      {actionable.slice(0, 6).map((alert) => (
        <ListRow
          key={alert.id}
          tone={SEVERITY_TONE[alert.severity]}
          to={alert.href}
          primary={
            <>
              <strong>{alert.subject}</strong> · {alert.title}
            </>
          }
          secondary={alert.detail}
          trailing={<Pill tone={SEVERITY_TONE[alert.severity]}>{SEVERITY_LABEL[alert.severity]}</Pill>}
        />
      ))}
      {actionable.length > 6 && <p className="w-note">+{actionable.length - 6} more in notifications</p>}
    </div>
  );
}

export function AttentionCountBadge() {
  const { alerts } = useDashboardData();
  const count = alerts.filter((alert) => alert.severity !== "positive").length;

  return count > 0 ? <Pill tone="amber">{count} need review</Pill> : null;
}

/* ------------------------------------------------------------------ */
/* KPI snapshot                                                        */
/* ------------------------------------------------------------------ */

export function KpiSnapshotWidget() {
  const { stats } = useDashboardData();

  if (stats.total === 0) {
    return <WidgetEmpty icon={Sparkles} title="No vehicles added yet" actionLabel="Add vehicles" to="/fleets" />;
  }

  const kpis = [
    { label: "Vehicles", value: formatNumber(stats.total) },
    { label: "Active", value: formatNumber(stats.activeStatus) },
    { label: "Trips in progress", value: formatNumber(stats.tripsInProgress) },
    { label: "EV share", value: `${Math.round(stats.evShare ?? 0)}%` },
  ];

  return (
    <div className="w-kpis">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="w-kpis__cell">
          <BigNumber value={kpi.value} />
          <span className="w-kpis__label">{kpi.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* EVORA insight (rule-based, built only from stored data)             */
/* ------------------------------------------------------------------ */

export function EvoraInsightWidget() {
  const insights = useInsights();
  const [lead, ...rest] = insights;

  if (!lead) {
    return (
      <p className="w-insight__lead">Everything looks calm. Insights will appear here as your data changes.</p>
    );
  }

  return (
    <div className="w-insight">
      <p className="w-insight__lead">{lead.text}</p>

      {lead.to && lead.cta && (
        <Link className="w-insight__cta" to={lead.to}>
          {lead.cta}
        </Link>
      )}

      {rest.length > 0 && (
        <ul className="w-insight__more">
          {rest.slice(0, 2).map((insight) => (
            <li key={insight.id}>{insight.text}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
