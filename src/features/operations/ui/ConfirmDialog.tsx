import { useEffect } from "react";
import type { ReactNode } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  /** Why the action was refused, shown inside the dialog. */
  error?: string | null;
  /** When set, the action is blocked and only "Close" is offered. */
  blockedReason?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  danger,
  busy,
  error,
  blockedReason,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const blocked = Boolean(blockedReason);

  return (
    <div className="ops-modal-layer" role="presentation" onClick={busy ? undefined : onCancel}>
      <div
        className="ops-modal"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <h3>{title}</h3>
        <div className="ops-modal__body">{children}</div>

        {(blockedReason || error) && (
          <p className="ops-callout ops-callout--danger" role="alert">
            {blockedReason ?? error}
          </p>
        )}

        <div className="ops-modal__actions">
          <button type="button" className="ops-btn ops-btn--ghost" onClick={onCancel} disabled={busy}>
            {blocked ? "Close" : "Cancel"}
          </button>
          {!blocked && (
            <button
              type="button"
              className={`ops-btn ${danger ? "ops-btn--danger" : "ops-btn--primary"}`}
              onClick={onConfirm}
              disabled={busy}
            >
              {busy ? "Working…" : confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
