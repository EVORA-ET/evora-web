import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, BellOff, CheckCheck, ChevronDown, X } from "lucide-react";

import {
  SEVERITY_LABEL,
  SEVERITY_ORDER,
  type AlertSeverity,
  type FleetAlert,
} from "../dashboard/model/alerts";
import { AlertIcon } from "./alertVisuals";
import { useNotifications } from "./useNotifications";
import "./notifications.css";

type Filter = "all" | AlertSeverity;

const GROUP_HEADING: Record<AlertSeverity, string> = {
  critical: "Critical",
  warning: "Warnings",
  info: "Informational",
  positive: "Positive updates",
};

function NotificationPanel() {
  const {
    alerts,
    unreadIds,
    unreadCount,
    panelOpen,
    focusId,
    closePanel,
    markRead,
    markAllRead,
  } = useNotifications();
  const navigate = useNavigate();

  const [filter, setFilter] = useState<Filter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  /* Expand the alert the user came from (adjusting state while rendering, not in an effect). */
  const [seenFocus, setSeenFocus] = useState<string | null>(null);
  if (focusId !== seenFocus) {
    setSeenFocus(focusId);

    if (focusId) {
      setExpandedId(focusId);
      setFilter("all");
    }
  }

  /* ...and scroll it into view once the panel is open. */
  useEffect(() => {
    if (!panelOpen || !focusId) return;

    const frame = window.requestAnimationFrame(() => {
      listRef.current
        ?.querySelector(`[data-alert-id="${CSS.escape(focusId)}"]`)
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [panelOpen, focusId]);

  useEffect(() => {
    if (!panelOpen) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePanel();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelOpen, closePanel]);

  const counts = useMemo(() => {
    const result: Record<Filter, number> = {
      all: alerts.length,
      critical: 0,
      warning: 0,
      info: 0,
      positive: 0,
    };

    alerts.forEach((alert) => {
      result[alert.severity] += 1;
    });

    return result;
  }, [alerts]);

  const groups = useMemo(() => {
    const visible = alerts.filter((alert) => filter === "all" || alert.severity === filter);
    const bySeverity = new Map<AlertSeverity, FleetAlert[]>();

    visible.forEach((alert) => {
      const list = bySeverity.get(alert.severity) ?? [];
      list.push(alert);
      bySeverity.set(alert.severity, list);
    });

    return [...bySeverity.entries()].sort((a, b) => SEVERITY_ORDER[a[0]] - SEVERITY_ORDER[b[0]]);
  }, [alerts, filter]);

  const toggle = (alert: FleetAlert) => {
    markRead(alert.id);
    setExpandedId((current) => (current === alert.id ? null : alert.id));
  };

  const openTarget = (alert: FleetAlert) => {
    markRead(alert.id);
    closePanel();
    navigate(alert.href);
  };

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "critical", label: "Critical" },
    { key: "warning", label: "Warnings" },
    { key: "info", label: "Info" },
    { key: "positive", label: "Positive" },
  ];

  return (
    <>
      <div
        className={`notif-backdrop ${panelOpen ? "notif-backdrop--open" : ""}`}
        onClick={closePanel}
        aria-hidden="true"
      />

      <aside
        className={`notif-panel ${panelOpen ? "notif-panel--open" : ""}`}
        aria-label="Notifications"
        aria-hidden={!panelOpen}
      >
        <header className="notif-panel__header">
          <div>
            <h2 className="notif-panel__title">Notifications</h2>
            <p className="notif-panel__subtitle">
              {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
            </p>
          </div>

          <button
            type="button"
            className="notif-panel__close"
            onClick={closePanel}
            aria-label="Close notifications"
          >
            <X size={20} strokeWidth={1.8} />
          </button>
        </header>

        <div className="notif-panel__filters" role="tablist">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              className={`notif-chip ${filter === key ? "notif-chip--active" : ""}`}
              onClick={() => setFilter(key)}
            >
              {label}
              <span className="notif-chip__count">{counts[key]}</span>
            </button>
          ))}
        </div>

        <div className="notif-panel__list" ref={listRef}>
          {groups.length === 0 ? (
            <div className="notif-empty">
              <span className="notif-empty__icon">
                <BellOff size={26} strokeWidth={1.6} />
              </span>
              <p className="notif-empty__title">Nothing needs your attention</p>
              <p className="notif-empty__text">
                Maintenance, insurance, driver licence and route updates from your fleet will show up here.
              </p>
            </div>
          ) : (
            groups.map(([severity, items]) => (
              <section key={severity} className="notif-group">
                <h3 className="notif-group__heading">
                  {GROUP_HEADING[severity]}
                  <span>{items.length}</span>
                </h3>

                {items.map((alert) => {
                  const expanded = expandedId === alert.id;
                  const unread = unreadIds.has(alert.id);

                  return (
                    <article
                      key={alert.id}
                      data-alert-id={alert.id}
                      className={[
                        "notif-item",
                        `notif-item--${alert.severity}`,
                        expanded ? "notif-item--expanded" : "",
                      ].join(" ")}
                    >
                      <button type="button" className="notif-item__row" onClick={() => toggle(alert)}>
                        <span className="notif-item__icon" aria-hidden="true">
                          <AlertIcon category={alert.category} severity={alert.severity} />
                        </span>

                        <span className="notif-item__text">
                          <span className="notif-item__category">
                            {alert.category} · {SEVERITY_LABEL[alert.severity]}
                          </span>
                          <span className="notif-item__title">
                            <strong>{alert.subject}</strong> — {alert.title}
                          </span>
                        </span>

                        {unread && <span className="notif-item__dot" aria-label="Unread" />}
                        <ChevronDown size={18} strokeWidth={1.8} className="notif-item__chevron" />
                      </button>

                      <div className="notif-item__more">
                        <div className="notif-item__more-inner">
                          <p>{alert.detail}</p>
                          <button
                            type="button"
                            className="notif-item__action"
                            onClick={() => openTarget(alert)}
                          >
                            {alert.actionLabel}
                            <ArrowRight size={16} strokeWidth={2} />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </section>
            ))
          )}
        </div>

        <footer className="notif-panel__footer">
          <button
            type="button"
            className="notif-panel__mark"
            onClick={markAllRead}
            disabled={unreadCount === 0}
          >
            <CheckCheck size={18} strokeWidth={1.8} />
            Mark all as read
          </button>
        </footer>
      </aside>
    </>
  );
}

export default NotificationPanel;
