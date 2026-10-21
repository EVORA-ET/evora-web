import { useMemo, useState } from "react";

import { listVehiclesPage, type OpsVehicle } from "../../lib/opsApi";
import { fuelLabel, humanize } from "../operations/format";
import { useDebounced, useResource } from "../operations/hooks";
import { SearchBox } from "../operations/ui/FilterBar";
import { Pill } from "../operations/ui/Pill";
import { EmptyBlock, ErrorBlock, Skeleton } from "../operations/ui/states";
import { vehicleTone } from "../operations/ui/tones";

const PAGE = 30;

/**
 * Searchable list of Operations vehicles (server-side search and paging).
 * `powertrain` limits the list to combustion ("ice") or electric ("ev").
 */
function VehiclePicker({
  selectedId,
  onSelect,
  powertrain,
  label = "Vehicles",
}: {
  selectedId: string | null;
  onSelect: (vehicle: OpsVehicle) => void;
  powertrain?: "ice" | "ev";
  label?: string;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const query = useDebounced(search.trim());
  const params = useMemo(
    () => ({ page, page_size: PAGE, search: query, powertrain, ordering: "registration_number" }),
    [page, query, powertrain],
  );
  const { data, error, loading, reload } = useResource(listVehiclesPage, params);

  return (
    <div className="intel-picker">
      <SearchBox
        value={search}
        onChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        placeholder="Registration, make or model"
        label={`Search ${label.toLowerCase()}`}
      />
      {error && !data ? (
        <ErrorBlock compact message={error} onRetry={reload} />
      ) : !data ? (
        <Skeleton lines={6} />
      ) : data.results.length === 0 ? (
        <EmptyBlock
          compact
          title={query ? "No matching vehicles" : "No vehicles"}
          text={
            powertrain === "ice"
              ? "Only combustion vehicles can be assessed for migration. Add vehicles in Operations."
              : "Add vehicles in Operations."
          }
        />
      ) : (
        <>
          <ul className={`intel-picker__list ${loading ? "ops-busy" : ""}`} aria-label={label}>
            {data.results.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  className="intel-picker__item"
                  aria-current={v.id === selectedId}
                  onClick={() => onSelect(v)}
                >
                  <span>
                    <strong>{v.registration_number}</strong>
                    <small>
                      {[v.manufacturer, v.model].filter(Boolean).join(" ")} · {fuelLabel(v.fuel_type)} ·{" "}
                      {humanize(v.vehicle_type)}
                    </small>
                  </span>
                  <Pill tone={vehicleTone(v.status)}>{humanize(v.status)}</Pill>
                </button>
              </li>
            ))}
          </ul>
          {data.total_pages > 1 && (
            <div className="intel-row intel-row--between">
              <span className="ops-muted">
                Page {data.page} of {data.total_pages} · {data.count} vehicles
              </span>
              <span className="intel-row">
                <button
                  type="button"
                  className="ops-btn ops-btn--ghost ops-btn--sm"
                  disabled={data.page <= 1}
                  onClick={() => setPage(data.page - 1)}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="ops-btn ops-btn--ghost ops-btn--sm"
                  disabled={data.page >= data.total_pages}
                  onClick={() => setPage(data.page + 1)}
                >
                  Next
                </button>
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default VehiclePicker;
