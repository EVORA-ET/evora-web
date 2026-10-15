import type { ReactNode } from "react";
import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";

export function ErrorBlock({
  message,
  onRetry,
  compact,
}: {
  message: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  return (
    <div className={`ops-state ops-state--error ${compact ? "ops-state--compact" : ""}`} role="alert">
      <AlertTriangle size={compact ? 20 : 28} strokeWidth={1.6} />
      <p className="ops-state__title">Couldn’t load this</p>
      <p className="ops-state__text">{message}</p>
      {onRetry && (
        <button type="button" className="ops-btn ops-btn--secondary" onClick={onRetry}>
          <RefreshCw size={16} /> Try again
        </button>
      )}
    </div>
  );
}

export function EmptyBlock({
  title,
  text,
  action,
  compact,
}: {
  title: string;
  text?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`ops-state ${compact ? "ops-state--compact" : ""}`}>
      <Inbox size={compact ? 20 : 28} strokeWidth={1.5} />
      <p className="ops-state__title">{title}</p>
      {text && <p className="ops-state__text">{text}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ lines = 3, height = 16 }: { lines?: number; height?: number }) {
  return (
    <div className="ops-skeleton" aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <span
          key={index}
          className="ops-skeleton__line"
          style={{ height, width: `${92 - (index % 3) * 14}%` }}
        />
      ))}
    </div>
  );
}
