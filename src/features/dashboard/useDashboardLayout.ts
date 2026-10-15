import { useCallback, useState } from "react";

import { DEFAULT_WIDGETS, WIDGET_BY_ID } from "./widgets/registry";
import type { WidgetSize } from "./widgets/types";

/** One placed widget. `i` is the widget id; each widget can be placed once. */
export interface PlacedWidget {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const STORAGE_KEY = "evora.dashboard.layout.v1";
const COLUMNS = 12;

function defaultLayout(): PlacedWidget[] {
  return DEFAULT_WIDGETS.map(({ id, x, y, w, h }) => ({ i: id, x, y, w, h }));
}

function sanitise(raw: unknown): PlacedWidget[] | null {
  if (!Array.isArray(raw)) return null;

  const seen = new Set<string>();
  const result: PlacedWidget[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;

    const { i, x, y, w, h } = item as Record<string, unknown>;
    const definition = typeof i === "string" ? WIDGET_BY_ID.get(i) : undefined;

    if (!definition?.Component || seen.has(definition.id)) continue;
    if (![x, y, w, h].every((value) => typeof value === "number" && Number.isFinite(value))) continue;

    seen.add(definition.id);
    result.push({
      i: definition.id,
      x: Math.max(0, Math.min(COLUMNS - 1, x as number)),
      y: Math.max(0, y as number),
      w: Math.max(definition.minSize.w, Math.min(COLUMNS, w as number)),
      h: Math.max(definition.minSize.h, h as number),
    });
  }

  return result;
}

function read(userId: string): PlacedWidget[] {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY}.${userId}`);
    if (raw === null) return defaultLayout();

    return sanitise(JSON.parse(raw)) ?? defaultLayout();
  } catch {
    return defaultLayout();
  }
}

function write(userId: string, items: PlacedWidget[]) {
  try {
    window.localStorage.setItem(`${STORAGE_KEY}.${userId}`, JSON.stringify(items));
  } catch {
    /* The layout simply won't persist if storage is unavailable. */
  }
}

function bottomOf(items: PlacedWidget[]): number {
  return items.reduce((max, item) => Math.max(max, item.y + item.h), 0);
}

export function sameLayout(a: PlacedWidget[], b: PlacedWidget[]): boolean {
  if (a.length !== b.length) return false;

  const byId = new Map(b.map((item) => [item.i, item]));

  return a.every((item) => {
    const other = byId.get(item.i);
    return Boolean(
      other && other.x === item.x && other.y === item.y && other.w === item.w && other.h === item.h,
    );
  });
}

/**
 * The layout lives in this browser, keyed by user. There is no preferences
 * endpoint in the API yet; when one exists, only `read` and `write` change.
 */
export function useDashboardLayout(userId: string | null) {
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [items, setItems] = useState<PlacedWidget[]>([]);

  /* Load once the user is known (state adjusted during render, per React docs). */
  if (userId && loadedFor !== userId) {
    setLoadedFor(userId);
    setItems(read(userId));
  }

  const ready = Boolean(userId) && loadedFor === userId;

  const commit = useCallback(
    (updater: (current: PlacedWidget[]) => PlacedWidget[]) => {
      setItems((current) => {
        const next = updater(current);
        if (userId && next !== current) write(userId, next);
        return next;
      });
    },
    [userId],
  );

  const add = useCallback(
    (id: string) => {
      const definition = WIDGET_BY_ID.get(id);
      if (!definition?.Component) return;

      commit((current) => {
        if (current.some((item) => item.i === id)) return current;

        return [
          ...current,
          {
            i: id,
            x: 0,
            y: bottomOf(current),
            w: definition.defaultSize.w,
            h: definition.defaultSize.h,
          },
        ];
      });
    },
    [commit],
  );

  const remove = useCallback(
    (id: string) => commit((current) => current.filter((item) => item.i !== id)),
    [commit],
  );

  const resize = useCallback(
    (id: string, size: WidgetSize) => {
      const definition = WIDGET_BY_ID.get(id);
      if (!definition) return;

      commit((current) =>
        current.map((item) =>
          item.i === id
            ? {
                ...item,
                x: Math.min(item.x, COLUMNS - Math.max(definition.minSize.w, size.w)),
                w: Math.max(definition.minSize.w, size.w),
                h: Math.max(definition.minSize.h, size.h),
              }
            : item,
        ),
      );
    },
    [commit],
  );

  /** Called by the grid after a drag or resize. */
  const replace = useCallback(
    (next: PlacedWidget[]) =>
      commit((current) => (sameLayout(current, next) ? current : next)),
    [commit],
  );

  const reset = useCallback(() => commit(() => defaultLayout()), [commit]);

  return { ready, items, add, remove, resize, replace, reset };
}
