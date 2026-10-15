import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Lock, Plus, Search, X } from "lucide-react";

import { WIDGETS, searchWidgets } from "./widgets/registry";
import { WIDGET_CATEGORIES, type WidgetDefinition } from "./widgets/types";
import "./WidgetLibrary.css";

interface WidgetLibraryProps {
  open: boolean;
  placedIds: Set<string>;
  onClose: () => void;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}

function LibraryCard({
  widget,
  added,
  onAdd,
  onRemove,
}: {
  widget: WidgetDefinition;
  added: boolean;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const Icon = widget.icon;
  const upcoming = !widget.Component;

  return (
    <li className={`lib-card ${upcoming ? "lib-card--soon" : ""} ${added ? "lib-card--added" : ""}`}>
      <span className="lib-card__icon" aria-hidden="true">
        <Icon size={20} strokeWidth={1.7} />
      </span>

      <div className="lib-card__text">
        <div className="lib-card__title-row">
          <h4 className="lib-card__title">{widget.title}</h4>
          {!upcoming && <span className="lib-card__tag">{widget.style}</span>}
        </div>
        <p className="lib-card__desc">{widget.description}</p>
        {upcoming && (
          <p className="lib-card__needs">
            <Lock size={12} strokeWidth={2} /> Needs {widget.needs?.toLowerCase()}
          </p>
        )}
      </div>

      {upcoming ? (
        <span className="lib-card__soon">Coming soon</span>
      ) : added ? (
        <button
          type="button"
          className="lib-card__btn lib-card__btn--added"
          onClick={onRemove}
          aria-label={`Remove ${widget.title} from your dashboard`}
        >
          <Check size={16} strokeWidth={2.4} />
          <span className="lib-card__btn-added">Added</span>
          <span className="lib-card__btn-remove">Remove</span>
        </button>
      ) : (
        <button
          type="button"
          className="lib-card__btn"
          onClick={onAdd}
          aria-label={`Add ${widget.title} to your dashboard`}
        >
          <Plus size={16} strokeWidth={2.4} />
          Add
        </button>
      )}
    </li>
  );
}

function WidgetLibrary({ open, placedIds, onClose, onAdd, onRemove }: WidgetLibraryProps) {
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;

    const focus = window.setTimeout(() => searchRef.current?.focus(), 280);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(focus);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  const results = useMemo(() => searchWidgets(query, WIDGETS), [query]);

  const grouped = useMemo(
    () =>
      WIDGET_CATEGORIES.map((category) => ({
        category,
        widgets: results
          .filter((widget) => widget.category === category)
          /* Live widgets first, upcoming ones after. */
          .sort((a, b) => Number(Boolean(b.Component)) - Number(Boolean(a.Component))),
      })).filter((group) => group.widgets.length > 0),
    [results],
  );

  const handleAdd = (widget: WidgetDefinition) => {
    onAdd(widget.id);
    setToast(`${widget.title} added to your dashboard`);

    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  };

  const liveCount = WIDGETS.filter((widget) => widget.Component).length;

  return (
    <>
      <div
        className={`lib-backdrop ${open ? "lib-backdrop--open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`lib-drawer ${open ? "lib-drawer--open" : ""}`}
        aria-label="Add widget"
        aria-hidden={!open}
      >
        <header className="lib-drawer__header">
          <div>
            <h2 className="lib-drawer__title">Add Widget</h2>
            <p className="lib-drawer__sub">
              {liveCount} widgets to choose from. Mix styles to build the view you need.
            </p>
          </div>

          <button type="button" className="lib-drawer__close" onClick={onClose} aria-label="Close">
            <X size={20} strokeWidth={1.8} />
          </button>
        </header>

        <label className="lib-drawer__search">
          <Search size={18} strokeWidth={1.8} aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search widgets…"
            aria-label="Search widgets"
          />
        </label>

        <div className="lib-drawer__scroll">
          {grouped.length === 0 ? (
            <div className="lib-empty">
              <p className="lib-empty__title">No widgets match “{query}”</p>
              <p className="lib-empty__text">Try a broader word like “battery”, “trip” or “cost”.</p>
            </div>
          ) : (
            grouped.map(({ category, widgets }) => (
              <section key={category} className="lib-section">
                <h3 className="lib-section__title">{category}</h3>
                <ul className="lib-section__list">
                  {widgets.map((widget) => (
                    <LibraryCard
                      key={widget.id}
                      widget={widget}
                      added={placedIds.has(widget.id)}
                      onAdd={() => handleAdd(widget)}
                      onRemove={() => onRemove(widget.id)}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>

        <footer className="lib-drawer__footer">
          <span className={`lib-drawer__toast ${toast ? "lib-drawer__toast--show" : ""}`} role="status">
            <Check size={16} strokeWidth={2.4} /> {toast}
          </span>
          <button type="button" className="lib-drawer__done" onClick={onClose}>
            Done
          </button>
        </footer>
      </aside>
    </>
  );
}

export default WidgetLibrary;
