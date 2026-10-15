import { useMemo } from "react";
import ReactGridLayout, { useContainerWidth, verticalCompactor } from "react-grid-layout";
import type { Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";

import type { PlacedWidget } from "./useDashboardLayout";
import WidgetFrame from "./widgets/WidgetFrame";
import { WIDGET_BY_ID } from "./widgets/registry";
import type { WidgetSize } from "./widgets/types";
import "./DashboardGrid.css";

const COLUMNS = 12;
const ROW_HEIGHT = 24;
const GAP = 24;
/** Below this width the grid becomes a simple single-column flow. */
const STACK_BREAKPOINT = 720;

interface DashboardGridProps {
  items: PlacedWidget[];
  editing: boolean;
  highlightId: string | null;
  /** When true (searching) the grid is a read-only flow so search never rewrites the saved layout. */
  flow: boolean;
  onLayoutChange: (next: PlacedWidget[]) => void;
  onRemove: (id: string) => void;
  onResize: (id: string, size: WidgetSize) => void;
}

function DashboardGrid({
  items,
  editing,
  highlightId,
  flow,
  onLayoutChange,
  onRemove,
  onResize,
}: DashboardGridProps) {
  const { width, containerRef, mounted } = useContainerWidth();

  const layout = useMemo(
    () =>
      items.map((item) => {
        const definition = WIDGET_BY_ID.get(item.i);

        return {
          ...item,
          minW: definition?.minSize.w,
          minH: definition?.minSize.h,
        };
      }),
    [items],
  );

  const stacked = flow || (mounted && width < STACK_BREAKPOINT);

  if (stacked) {
    /* Reading order follows the saved layout: top to bottom, left to right. */
    const ordered = [...items].sort((a, b) => a.y - b.y || a.x - b.x);

    return (
      <div ref={containerRef} className="dash-flow">
        {ordered.map((item) => {
          const definition = WIDGET_BY_ID.get(item.i);
          if (!definition) return null;

          return (
            <div
              key={item.i}
              className="dash-flow__item"
              style={{
                ["--span" as string]: Math.min(COLUMNS, item.w),
                minHeight: item.h * (ROW_HEIGHT + GAP) - GAP,
              }}
            >
              <WidgetFrame definition={definition} editing={false} highlighted={highlightId === item.i} />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`dash-grid ${editing ? "dash-grid--editing" : ""}`}>
      {mounted && (
        <ReactGridLayout
          layout={layout}
          width={width}
          gridConfig={{
            cols: COLUMNS,
            rowHeight: ROW_HEIGHT,
            margin: [GAP, GAP],
            containerPadding: [0, 0],
          }}
          dragConfig={{ enabled: editing, cancel: ".dash-widget__sizes, .dash-widget__remove" }}
          resizeConfig={{ enabled: editing, handles: ["se"] }}
          compactor={verticalCompactor}
          onLayoutChange={(next: Layout) => {
            onLayoutChange(
              next.map(({ i, x, y, w, h }) => ({ i, x, y, w, h })),
            );
          }}
        >
          {items.map((item) => {
            const definition = WIDGET_BY_ID.get(item.i);
            if (!definition) return <div key={item.i} />;

            return (
              <div key={item.i}>
                <WidgetFrame
                  definition={definition}
                  editing={editing}
                  highlighted={highlightId === item.i}
                  currentSize={{ w: item.w, h: item.h }}
                  onRemove={() => onRemove(item.i)}
                  onResize={(size) => onResize(item.i, size)}
                />
              </div>
            );
          })}
        </ReactGridLayout>
      )}
    </div>
  );
}

export default DashboardGrid;
