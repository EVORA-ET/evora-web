import { createContext } from "react";

import type { FleetAlert } from "../dashboard/model/alerts";

export interface NotificationsValue {
  alerts: FleetAlert[];
  unreadIds: Set<string>;
  unreadCount: number;

  /** Alerts currently floating in from the right. */
  toasts: FleetAlert[];
  dismissToast: (id: string) => void;

  panelOpen: boolean;
  /** Alert to expand when the panel opens from a toast. */
  focusId: string | null;
  openPanel: (focusId?: string) => void;
  closePanel: () => void;
  togglePanel: () => void;

  markRead: (id: string) => void;
  markAllRead: () => void;
}

export const NotificationsContext = createContext<NotificationsValue | null>(null);
