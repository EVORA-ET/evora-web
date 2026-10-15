import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";

interface DrawerProps {
  open: boolean;
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Stack above another drawer. */
  level?: 1 | 2;
  wide?: boolean;
}

/** Right-hand panel for creating, editing and inspecting a record. */
function Drawer({ open, title, subtitle, onClose, children, footer, level = 1, wide }: DrawerProps) {
  const panel = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={`ops-drawer-layer ops-drawer-layer--${level}`}>
      <div className="ops-drawer-scrim" onClick={onClose} aria-hidden="true" />
      <aside
        ref={panel}
        tabIndex={-1}
        className={`ops-drawer ${wide ? "ops-drawer--wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="ops-drawer__head">
          <div className="ops-drawer__titles">
            <h2>{title}</h2>
            {subtitle && <div className="ops-drawer__sub">{subtitle}</div>}
          </div>
          <button type="button" className="ops-icon-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </header>

        <div className="ops-drawer__body">{children}</div>
        {footer && <footer className="ops-drawer__foot">{footer}</footer>}
      </aside>
    </div>
  );
}

export default Drawer;
