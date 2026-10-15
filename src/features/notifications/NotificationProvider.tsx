import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { useDashboardData } from "../dashboard/useDashboardData";
import { SEVERITY_ORDER, type FleetAlert } from "../dashboard/model/alerts";
import { NotificationsContext } from "./notificationsContext";

/** Most pop-ups shown at the same time. Anything beyond is summarised. */
const MAX_TOASTS = 3;

const READ_KEY = "evora.notifications.read";
const SHOWN_KEY = "evora.notifications.shown";

function load(key: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return new Set();

    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? new Set(parsed.filter((item): item is string => typeof item === "string"))
      : new Set();
  } catch {
    return new Set();
  }
}

function save(key: string, ids: Set<string>) {
  try {
    window.localStorage.setItem(key, JSON.stringify([...ids]));
  } catch {
    /* Storage can be unavailable (private mode); notifications still work. */
  }
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { alerts, me, loading } = useDashboardData();

  const storageSuffix = me?.id ?? null;
  const readKey = storageSuffix ? `${READ_KEY}.${storageSuffix}` : null;
  const shownKey = storageSuffix ? `${SHOWN_KEY}.${storageSuffix}` : null;

  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<FleetAlert[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);

  const shownIds = useRef<Set<string> | null>(null);
  const loadedFor = useRef<string | null>(null);

  /* Load persisted read-state once we know who the user is. */
  useEffect(() => {
    if (!readKey || loadedFor.current === readKey) return;

    loadedFor.current = readKey;
    setReadIds(load(readKey));
    shownIds.current = shownKey ? load(shownKey) : new Set();
  }, [readKey, shownKey]);

  /* Pop up anything that has not been shown before. */
  useEffect(() => {
    if (loading || !shownKey || !shownIds.current) return;

    const shown = shownIds.current;
    const fresh = alerts.filter((alert) => !shown.has(alert.id));

    /* Forget resolved alerts so a recurring issue pops up again. */
    const currentIds = new Set(alerts.map((alert) => alert.id));
    const kept = new Set([...shown].filter((id) => currentIds.has(id)));

    if (fresh.length === 0) {
      if (kept.size !== shown.size) {
        shownIds.current = kept;
        save(shownKey, kept);
      }
      return;
    }

    fresh.forEach((alert) => kept.add(alert.id));
    shownIds.current = kept;
    save(shownKey, kept);

    const sorted = [...fresh].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
    const visible = sorted.slice(0, MAX_TOASTS);
    const overflow = sorted.length - visible.length;

    if (overflow > 0) {
      visible[MAX_TOASTS - 1] = {
        id: `more:${Date.now()}`,
        severity: "info",
        category: "Notifications",
        subject: "Notifications",
        title: `${overflow + 1} more updates`,
        detail: "Open the notification centre to see everything that needs a look.",
        href: "",
        actionLabel: "Open",
      };
    }

    setToasts((current) => [...visible, ...current].slice(0, MAX_TOASTS));
  }, [alerts, loading, shownKey]);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const markRead = useCallback(
    (id: string) => {
      setReadIds((current) => {
        if (current.has(id)) return current;

        /* Forget alerts that no longer exist so the stored list can't grow forever. */
        const live = new Set(alerts.map((alert) => alert.id));
        const next = new Set([...current].filter((known) => live.has(known))).add(id);
        if (readKey) save(readKey, next);
        return next;
      });
    },
    [alerts, readKey],
  );

  const markAllRead = useCallback(() => {
    setReadIds(() => {
      const next = new Set(alerts.map((alert) => alert.id));
      if (readKey) save(readKey, next);
      return next;
    });
  }, [alerts, readKey]);

  const openPanel = useCallback((id?: string) => {
    setFocusId(id ?? null);
    setPanelOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setPanelOpen(false);
    setFocusId(null);
  }, []);

  const togglePanel = useCallback(() => {
    setPanelOpen((open) => !open);
    setFocusId(null);
  }, []);

  const unreadIds = useMemo(
    () => new Set(alerts.filter((alert) => !readIds.has(alert.id)).map((alert) => alert.id)),
    [alerts, readIds],
  );

  const value = useMemo(
    () => ({
      alerts,
      unreadIds,
      unreadCount: unreadIds.size,
      toasts,
      dismissToast,
      panelOpen,
      focusId,
      openPanel,
      closePanel,
      togglePanel,
      markRead,
      markAllRead,
    }),
    [
      alerts,
      unreadIds,
      toasts,
      dismissToast,
      panelOpen,
      focusId,
      openPanel,
      closePanel,
      togglePanel,
      markRead,
      markAllRead,
    ],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}
