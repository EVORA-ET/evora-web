import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { listDepotsPage, listFleetsPage, listRoutesPage } from "../../lib/opsApi";
import { errorMessage, fieldErrors, useResource } from "./hooks";
import { WS } from "./filterDefaults";
import { useOps } from "./useOps";

/** `?open=<id>` opens a record's drawer; `?create=1` opens the create form. */
export function useRecordParams() {
  const [params, setParams] = useSearchParams();

  const update = useCallback(
    (change: (next: URLSearchParams) => void) =>
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          change(next);
          return next;
        },
        { replace: false },
      ),
    [setParams],
  );

  return {
    openId: params.get("open"),
    creating: params.get("create") === "1",
    open: (id: string) =>
      update((next) => {
        next.set("open", id);
        next.delete("create");
      }),
    create: () =>
      update((next) => {
        next.set("create", "1");
        next.delete("open");
      }),
    close: () =>
      update((next) => {
        next.delete("open");
        next.delete("create");
      }),
  };
}

/** Wraps a save/delete action: busy flag, field errors, form-level error. */
export function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const run = useCallback(
    async (action: () => Promise<void>): Promise<boolean> => {
      if (busy) return false;
      setBusy(true);
      setErrors({});
      setFormError(null);

      try {
        await action();
        return true;
      } catch (error) {
        const fields = fieldErrors(error);
        if (Object.keys(fields).length > 0) {
          setErrors(fields);
          setFormError(
            fields.detail ?? fields.non_field_errors ?? "Please fix the highlighted fields.",
          );
        } else {
          setFormError(errorMessage(error));
        }
        return false;
      } finally {
        setBusy(false);
      }
    },
    [busy],
  );

  return {
    busy,
    errors,
    formError,
    run,
    reset: () => {
      setErrors({});
      setFormError(null);
    },
  };
}

const LOOKUP = { page_size: 100, ordering: "name" };

/** Depot / fleet / route choices for filters and forms (first 100 by name). */
export function useLookups() {
  const depots = useResource(listDepotsPage, LOOKUP);
  const fleets = useResource(listFleetsPage, LOOKUP);

  return {
    depots: useMemo(
      () => (depots.data?.results ?? []).map((d) => ({ value: d.id, label: d.name })),
      [depots.data],
    ),
    fleets: useMemo(
      () => (fleets.data?.results ?? []).map((f) => ({ value: f.id, label: f.name })),
      [fleets.data],
    ),
    loading: depots.loading || fleets.loading,
    error: depots.error ?? fleets.error,
  };
}

const ROUTE_LOOKUP = { page_size: 100, ordering: "name", status: "ACTIVE" };

export function useRouteLookup() {
  const routes = useResource(listRoutesPage, ROUTE_LOOKUP);
  return {
    routes: routes.data?.results ?? [],
    options: useMemo(
      () => (routes.data?.results ?? []).map((r) => ({ value: r.id, label: r.name })),
      [routes.data],
    ),
    loading: routes.loading,
    error: routes.error,
  };
}

type WorkspaceName = keyof typeof WS;

/**
 * Jump to another workspace with filters already applied, e.g. "View
 * vehicles" on a depot. The target tab picks the filters up from the store.
 */
export function useDrill() {
  const navigate = useNavigate();
  const { saveState } = useOps();

  return useCallback(
    (
      workspace: WorkspaceName,
      path: string,
      filters: Record<string, string>,
      extra: { search?: string } = {},
    ) => {
      const target = WS[workspace];
      saveState(target.key, {
        search: extra.search ?? "",
        filters: { ...target.defaults, ...filters },
        sort: target.sort,
        page: 1,
      });
      navigate(path);
    },
    [navigate, saveState],
  );
}
