import { useContext } from "react";

import { NotificationsContext } from "./notificationsContext";

export function useNotifications() {
  const value = useContext(NotificationsContext);

  if (!value) {
    throw new Error("useNotifications must be used inside NotificationProvider");
  }

  return value;
}
