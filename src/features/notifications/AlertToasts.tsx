import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { ChevronRight } from "lucide-react";

import type { FleetAlert } from "../dashboard/model/alerts";
import { AlertIcon } from "./alertVisuals";
import { useNotifications } from "./useNotifications";
import "./notifications.css";

const TOAST_LIFETIME_MS = 5000;
const EXIT_MS = 260;
const SWIPE_OPEN_PX = 70;

function Toast({ alert }: { alert: FleetAlert }) {
  const { dismissToast, openPanel, markRead } = useNotifications();

  const [leaving, setLeaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  const dragStart = useRef<number | null>(null);
  const remaining = useRef(TOAST_LIFETIME_MS);
  const startedAt = useRef(0);

  const leave = useCallback(() => {
    setLeaving(true);
    window.setTimeout(() => dismissToast(alert.id), EXIT_MS);
  }, [alert.id, dismissToast]);

  /* Auto-dismiss after five seconds; hovering or dragging pauses the clock. */
  useEffect(() => {
    if (paused || leaving) return;

    startedAt.current = Date.now();
    const timer = window.setTimeout(leave, remaining.current);

    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
    };
  }, [paused, leaving, leave]);

  const openCentre = () => {
    if (!alert.id.startsWith("more:")) markRead(alert.id);
    openPanel(alert.id.startsWith("more:") ? undefined : alert.id);
    leave();
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;

    dragStart.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
    setPaused(true);
    setDragging(true);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStart.current === null) return;

    const delta = event.clientX - dragStart.current;
    setOffset(delta > 0 ? delta : delta * 0.15);
  };

  const onPointerUp = () => {
    if (dragStart.current === null) return;

    const shouldOpen = offset > SWIPE_OPEN_PX;
    dragStart.current = null;
    setDragging(false);
    setOffset(0);
    setPaused(false);

    if (shouldOpen) openCentre();
  };

  return (
    <div
      className={[
        "alert-toast",
        `alert-toast--${alert.severity}`,
        leaving ? "alert-toast--leaving" : "",
        dragging ? "alert-toast--dragging" : "",
      ].join(" ")}
      style={{ transform: offset ? `translateX(${offset}px)` : undefined }}
      role="status"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => !dragging && setPaused(false)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <span className="alert-toast__icon" aria-hidden="true">
        <AlertIcon category={alert.category} severity={alert.severity} />
      </span>

      <div className="alert-toast__body">
        <p className="alert-toast__category">{alert.category}</p>
        <p className="alert-toast__title">
          <strong>{alert.subject}</strong> {alert.title.toLowerCase()}
        </p>
        <p className="alert-toast__detail">{alert.detail}</p>
      </div>

      <button
        type="button"
        className="alert-toast__open"
        onClick={openCentre}
        aria-label="Open notifications"
      >
        <ChevronRight size={20} strokeWidth={2} />
      </button>

      <span
        className="alert-toast__timer"
        style={{ animationPlayState: paused ? "paused" : "running" }}
        aria-hidden="true"
      />
    </div>
  );
}

function AlertToasts() {
  const { toasts } = useNotifications();

  return (
    <div className="alert-toasts" aria-live="polite">
      {toasts.map((alert) => (
        <Toast key={alert.id} alert={alert} />
      ))}
    </div>
  );
}

export default AlertToasts;
