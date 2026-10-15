import { useEffect, useState } from "react";

import { ApiError } from "../../lib/api";
import { useOps } from "./useOps";

export function errorMessage(error: unknown, fallback = "Something went wrong."): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** Field -> message map from a DRF validation response ({} when not one). */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || error.status !== 400) return {};
  const body = error.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) return {};

  const result: Record<string, string> = {};
  for (const [field, value] of Object.entries(body as Record<string, unknown>)) {
    result[field] = Array.isArray(value) ? value.map(String).join(" ") : String(value);
  }
  return result;
}

/** Server-side "blocked" explanation (HTTP 409) or null. */
export function conflictDetail(error: unknown): string | null {
  return error instanceof ApiError && error.status === 409 ? error.message : null;
}

export function useDebounced<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

interface ResourceState<P, T> {
  params: P | null | undefined;
  version: number;
  token: number;
  data?: T;
  error?: string;
}

export interface Resource<T> {
  /** Latest successful result; kept while a refresh is in flight. */
  data: T | undefined;
  error: string | undefined;
  /** True while the current request has not answered yet. */
  loading: boolean;
  reload: () => void;
}

/**
 * Loads `fetcher(params)` whenever `params` changes (pass a memoised object),
 * after any write elsewhere (`version`), or on `reload()`. Late answers to an
 * outdated request are dropped. Pass `null` params to skip loading.
 *
 * State is only set in promise callbacks, never synchronously in the effect.
 */
export function useResource<P, T>(
  fetcher: (params: P) => Promise<T>,
  params: P | null,
): Resource<T> {
  const { version } = useOps();
  const [token, setToken] = useState(0);
  const [state, setState] = useState<ResourceState<P, T>>({
    params: undefined,
    version: -1,
    token: -1,
  });

  useEffect(() => {
    if (params === null) return;
    let cancelled = false;

    fetcher(params).then(
      (data) => {
        if (!cancelled) setState({ params, version, token, data });
      },
      (error: unknown) => {
        if (!cancelled) {
          setState((previous) => ({
            params,
            version,
            token,
            data: previous.data,
            error: errorMessage(error, "Couldn't load this data."),
          }));
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [fetcher, params, version, token]);

  const current =
    params !== null &&
    state.params === params &&
    state.version === version &&
    state.token === token;

  return {
    data: state.data,
    error: current ? state.error : undefined,
    loading: params !== null && !current,
    reload: () => setToken((value) => value + 1),
  };
}

/* ------------------------------------------------------------------ */
/* List workspace state                                                */
/* ------------------------------------------------------------------ */

export interface ListState<F extends Record<string, string>> {
  search: string;
  filters: F;
  sort: string;
  page: number;
}

export interface ListControls<F extends Record<string, string>> {
  state: ListState<F>;
  /** Debounced search term to send to the server. */
  query: string;
  setSearch: (value: string) => void;
  setFilter: (name: keyof F & string, value: string) => void;
  setSort: (sort: string) => void;
  setPage: (page: number) => void;
  clear: () => void;
  hasActiveFilters: boolean;
}

/**
 * Search / filter / sort / page state for one workspace. It is remembered in
 * the Operations provider, so leaving a tab and coming back keeps your filters.
 */
export function useListState<F extends Record<string, string>>(
  key: string,
  defaults: F,
  defaultSort: string,
): ListControls<F> {
  const { loadState, saveState } = useOps();

  const [state, setState] = useState<ListState<F>>(
    () =>
      (loadState(key) as ListState<F> | undefined) ?? {
        search: "",
        filters: defaults,
        sort: defaultSort,
        page: 1,
      },
  );

  useEffect(() => {
    saveState(key, state);
  }, [key, state, saveState]);

  const query = useDebounced(state.search.trim());

  const hasActiveFilters =
    state.search.trim() !== "" ||
    Object.entries(state.filters).some(([name, value]) => value !== defaults[name]);

  return {
    state,
    query,
    hasActiveFilters,
    setSearch: (search) => setState((s) => ({ ...s, search, page: 1 })),
    setFilter: (name, value) =>
      setState((s) => ({ ...s, filters: { ...s.filters, [name]: value }, page: 1 })),
    setSort: (sort) => setState((s) => ({ ...s, sort, page: 1 })),
    setPage: (page) => setState((s) => ({ ...s, page })),
    clear: () => setState({ search: "", filters: defaults, sort: defaultSort, page: 1 }),
  };
}
