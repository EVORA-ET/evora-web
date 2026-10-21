import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import { listObservationKinds, type ObservationKind } from "../../lib/intelligenceApi";
import { useResource } from "../operations/hooks";

const NO_PARAMS = {};
const loadKinds = () => listObservationKinds();

/** Observation kind registry (units in the organization's currency). */
export function useKinds() {
  return useResource(loadKinds, NO_PARAMS);
}

/**
 * The organization's currency, read from the kind registry (the backend
 * substitutes it into money units). Undefined until loaded - never guessed.
 */
export function useCurrency(): string | undefined {
  const { data } = useKinds();
  return useMemo(() => currencyFromKinds(data), [data]);
}

export function currencyFromKinds(kinds: ObservationKind[] | undefined): string | undefined {
  const price = kinds?.find((k) => k.key === "vehicle_purchase_price");
  return price?.unit || undefined;
}

/** Read/write one search parameter, keeping the others. */
export function useParam(name: string): [string | null, (value: string | null) => void] {
  const [params, setParams] = useSearchParams();
  const set = useCallback(
    (value: string | null) =>
      setParams((previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(name, value);
        else next.delete(name);
        return next;
      }),
    [name, setParams],
  );
  return [params.get(name), set];
}
