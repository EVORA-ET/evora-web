import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import {
  getMe,
  listDepots,
  listDrivers,
  listInstanceStops,
  listJobInstances,
  listJobTemplates,
  listVehicles,
  type Me,
} from "../../lib/api";
import { DashboardDataContext } from "./dashboardDataContext";
import { buildAlerts } from "./model/alerts";
import {
  EMPTY_SNAPSHOT,
  buildIndex,
  computeStats,
  type FleetSnapshot,
} from "./model/fleetModel";

/** How often live data (vehicles, trips, stops) is refreshed. */
const POLL_INTERVAL_MS = 20_000;

type SourceKey = keyof FleetSnapshot;

const SOURCES: { key: SourceKey; label: string; load: () => Promise<unknown> }[] = [
  { key: "vehicles", label: "vehicles", load: listVehicles },
  { key: "drivers", label: "drivers", load: listDrivers },
  { key: "depots", label: "depots", load: listDepots },
  { key: "routes", label: "routes", load: listJobTemplates },
  { key: "trips", label: "trips", load: listJobInstances },
  { key: "stops", label: "stops", load: listInstanceStops },
];

export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [snapshot, setSnapshot] = useState<FleetSnapshot>(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const inFlight = useRef(false);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);

    try {
      const results = await Promise.allSettled(SOURCES.map((source) => source.load()));

      if (!mounted.current) return;

      const failed: string[] = [];
      const next: Partial<FleetSnapshot> = {};

      results.forEach((result, position) => {
        const source = SOURCES[position];

        if (result.status === "fulfilled") {
          (next as Record<string, unknown>)[source.key] = result.value;
        } else {
          failed.push(source.label);
        }
      });

      /* Keep older data for any source that failed this round. */
      setSnapshot((previous) => ({ ...previous, ...next }));
      setFailedSources(failed);

      if (failed.length === SOURCES.length) {
        const reason = results.find((result) => result.status === "rejected") as
          | PromiseRejectedResult
          | undefined;

        setError(
          reason?.reason instanceof Error
            ? reason.reason.message
            : "We couldn't load your fleet data.",
        );
      } else {
        setError(null);
        setLastUpdated(new Date());
      }
    } finally {
      inFlight.current = false;

      if (mounted.current) {
        setRefreshing(false);
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;

    getMe()
      .then((profile) => {
        if (mounted.current) setMe(profile);
      })
      .catch(() => {
        /* The shell still works without a profile. */
      });

    void refresh();

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_INTERVAL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      mounted.current = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const index = useMemo(() => buildIndex(snapshot), [snapshot]);

  const derived = useMemo(() => {
    const now = new Date();
    const stats = computeStats(snapshot, index, now);
    const alerts = buildAlerts(snapshot, index, now);

    return { stats, alerts };
  }, [snapshot, index]);

  const value = useMemo(
    () => ({
      me,
      snapshot,
      index,
      stats: derived.stats,
      alerts: derived.alerts,
      loading,
      refreshing,
      error,
      failedSources,
      lastUpdated,
      refresh,
    }),
    [me, snapshot, index, derived, loading, refreshing, error, failedSources, lastUpdated, refresh],
  );

  return (
    <DashboardDataContext.Provider value={value}>{children}</DashboardDataContext.Provider>
  );
}
