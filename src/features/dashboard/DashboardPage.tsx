import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, Check, GripVertical, LayoutGrid, Plus, RotateCcw, Search, SlidersHorizontal } from "lucide-react";

import DashboardGrid from "./DashboardGrid";
import FleetMap from "./map/FleetMap";
import { useDashboardData } from "./useDashboardData";
import { useDashboardLayout } from "./useDashboardLayout";
import WidgetLibrary from "./WidgetLibrary";
import { WIDGET_BY_ID, searchWidgets } from "./widgets/registry";
import "./DashboardPage.css";

function DashboardPage() {
  const { me } = useDashboardData();
  const layout = useDashboardLayout(me?.id ?? null);

  const [editing, setEditing] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const workspaceRef = useRef<HTMLElement | null>(null);
  const highlightTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
    },
    [],
  );

  const placedIds = useMemo(() => new Set(layout.items.map((item) => item.i)), [layout.items]);

  const searching = query.trim().length > 0;

  const visibleItems = useMemo(() => {
    if (!searching) return layout.items;

    const matches = new Set(
      searchWidgets(
        query,
        layout.items.map((item) => WIDGET_BY_ID.get(item.i)).filter((widget) => widget !== undefined),
      ).map((widget) => widget.id),
    );

    return layout.items.filter((item) => matches.has(item.i));
  }, [layout.items, query, searching]);

  const scrollToWorkspace = () =>
    workspaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const closeLibrary = useCallback(() => {
    setLibraryOpen(false);

    if (highlightId) {
      window.setTimeout(() => {
        document
          .querySelector(".dash-widget--highlight")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 320);
    }
  }, [highlightId]);

  const handleAdd = (id: string) => {
    layout.add(id);
    setHighlightId(id);

    if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
    highlightTimer.current = window.setTimeout(() => setHighlightId(null), 2600);
  };

  const startEditing = () => {
    setQuery("");
    setEditing(true);
  };

  return (
    <div className="dashboard">
      <FleetMap />

      <button type="button" className="dashboard__cue" onClick={scrollToWorkspace}>
        <span>Explore your dashboard</span>
        <ArrowDown size={18} strokeWidth={2} className="dashboard__cue-arrow" />
      </button>

      <section ref={workspaceRef} className="workspace" aria-labelledby="workspace-title">
        <header className="workspace__header">
          <div>
            <p className="workspace__eyebrow">Personal workspace</p>
            <h2 id="workspace-title" className="workspace__title">Your Dashboard</h2>
            <p className="workspace__subtitle">Your fleet, at a glance. Arranged the way you work.</p>
          </div>

          <div className="workspace__actions">
            {editing ? (
              <button type="button" className="ws-btn ws-btn--secondary" onClick={() => setEditing(false)}>
                <Check size={18} strokeWidth={2} />
                Done
              </button>
            ) : (
              <button type="button" className="ws-btn ws-btn--secondary" onClick={startEditing}>
                <SlidersHorizontal size={18} strokeWidth={1.8} />
                Customize Dashboard
              </button>
            )}

            <button type="button" className="ws-btn ws-btn--primary" onClick={() => setLibraryOpen(true)}>
              <Plus size={18} strokeWidth={2.2} />
              Add Widget
            </button>
          </div>
        </header>

        <label className="workspace__search">
          <Search size={18} strokeWidth={1.8} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search widgets…"
            aria-label="Search your widgets"
            disabled={editing}
          />
        </label>

        {editing && (
          <div className="workspace__banner" role="status">
            <div className="workspace__banner-text">
              <strong>Editing your dashboard</strong>
              <span><GripVertical size={14} /> Drag to rearrange</span>
              <span>Resize · Remove</span>
            </div>

            <div className="workspace__banner-actions">
              <button type="button" className="ws-btn ws-btn--ghost" onClick={layout.reset}>
                <RotateCcw size={16} strokeWidth={1.8} />
                Reset layout
              </button>
            </div>
          </div>
        )}

        {!layout.ready ? (
          <div className="workspace__skeleton" aria-hidden="true">
            <span /><span /><span />
          </div>
        ) : layout.items.length === 0 ? (
          <div className="workspace__empty">
            <span className="workspace__empty-icon"><LayoutGrid size={28} strokeWidth={1.5} /></span>
            <h3>Your dashboard is empty</h3>
            <p>Add the widgets that matter to you — fleet health, trips, EV progress and more.</p>
            <button type="button" className="ws-btn ws-btn--primary" onClick={() => setLibraryOpen(true)}>
              <Plus size={18} strokeWidth={2.2} />
              Add your first widget
            </button>
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="workspace__empty">
            <h3>No widgets match “{query}”</h3>
            <p>Not on your dashboard yet? Find it in the widget library.</p>
            <button type="button" className="ws-btn ws-btn--secondary" onClick={() => setLibraryOpen(true)}>
              Browse widgets
            </button>
          </div>
        ) : (
          <DashboardGrid
            items={visibleItems}
            editing={editing}
            highlightId={highlightId}
            flow={searching}
            onLayoutChange={layout.replace}
            onRemove={layout.remove}
            onResize={layout.resize}
          />
        )}
      </section>

      <WidgetLibrary
        open={libraryOpen}
        placedIds={placedIds}
        onClose={closeLibrary}
        onAdd={handleAdd}
        onRemove={layout.remove}
      />
    </div>
  );
}

export default DashboardPage;
