import { createContext } from "react";

import type { Me } from "../../lib/api";
import type { FleetAlert } from "./model/alerts";
import type { FleetIndex, FleetSnapshot, FleetStats } from "./model/fleetModel";

export interface DashboardDataValue {
  me: Me | null;
  snapshot: FleetSnapshot;
  index: FleetIndex;
  stats: FleetStats;
  alerts: FleetAlert[];

  /** True until the first load has finished (successfully or not). */
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  /** Sources that failed on the last refresh while older data is still shown. */
  failedSources: string[];
  lastUpdated: Date | null;

  refresh: () => Promise<void>;
}

export const DashboardDataContext = createContext<DashboardDataValue | null>(null);
