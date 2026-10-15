import { useCallback, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { CheckCircle2, X, XCircle } from "lucide-react";

import { useDashboardData } from "../dashboard/useDashboardData";
import { localToday } from "./format";
import { OperationsContext, type OpsValue } from "./operationsContext";

interface ToastItem {
  id: number;
  tone: "success" | "error";
  message: string;
}

const TOAST_MS = 4500;

export function OperationsProvider({ children }: { children: ReactNode }) {
  const { refresh: refreshDashboard } = useDashboardData();

  const [date, setDate] = useState<string>(localToday);
  const [version, setVersion] = useState(0);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const store = useRef(new Map<string, unknown>());
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastItem["tone"], message: string) => {
      nextId.current += 1;
      const id = nextId.current;
      setToasts((list) => [...list.slice(-3), { id, tone, message }]);
      window.setTimeout(() => dismiss(id), TOAST_MS);
    },
    [dismiss],
  );

  const invalidate = useCallback(() => {
    setVersion((current) => current + 1);
    /* Keep the Dashboard's shared snapshot in step with what was just saved. */
    void refreshDashboard();
  }, [refreshDashboard]);

  const value = useMemo<OpsValue>(
    () => ({
      date,
      setDate,
      version,
      invalidate,
      toast: {
        success: (message) => push("success", message),
        error: (message) => push("error", message),
      },
      loadState: (key) => store.current.get(key),
      saveState: (key, state) => {
        store.current.set(key, state);
      },
    }),
    [date, version, invalidate, push],
  );

  return (
    <OperationsContext.Provider value={value}>
      {children}

      <div className="ops-toasts" role="region" aria-label="Notifications" aria-live="polite">
        {toasts.map((item) => (
          <div key={item.id} className={`ops-toast ops-toast--${item.tone}`} role="status">
            {item.tone === "success" ? (
              <CheckCircle2 size={18} strokeWidth={2} />
            ) : (
              <XCircle size={18} strokeWidth={2} />
            )}
            <span>{item.message}</span>
            <button type="button" aria-label="Dismiss" onClick={() => dismiss(item.id)}>
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </OperationsContext.Provider>
  );
}
