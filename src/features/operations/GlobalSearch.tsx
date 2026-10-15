import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";

import {
  listDepotsPage,
  listDriversPage,
  listFleetsPage,
  listJobsPage,
  listRoutesPage,
  listVehiclesPage,
} from "../../lib/opsApi";
import { formatDateTime } from "./format";
import { useDebounced, useResource } from "./hooks";

interface Hit {
  id: string;
  title: string;
  detail: string;
  to: string;
}

interface Group {
  label: string;
  hits: Hit[];
}

const LIMIT = { page_size: 4 };

/** Searches every workspace at once; a failing source never hides the rest. */
async function searchEverything({ q }: { q: string }): Promise<{ groups: Group[]; failed: number }> {
  const params = { ...LIMIT, search: q };
  const [vehicles, drivers, depots, fleets, routes, jobs] = await Promise.allSettled([
    listVehiclesPage(params),
    listDriversPage(params),
    listDepotsPage(params),
    listFleetsPage(params),
    listRoutesPage(params),
    listJobsPage({ ...params, ordering: "-scheduled_start_at" }),
  ]);

  const groups: Group[] = [];
  let failed = 0;
  const take = <T,>(
    result: PromiseSettledResult<{ results: T[] }>,
    label: string,
    map: (row: T) => Hit,
  ) => {
    if (result.status === "rejected") {
      failed += 1;
      return;
    }
    if (result.value.results.length) groups.push({ label, hits: result.value.results.map(map) });
  };

  take(jobs, "Daily jobs", (j) => ({
    id: j.id,
    title: j.job_template_name,
    detail: formatDateTime(j.scheduled_start_at),
    to: `/fleets/jobs?open=${j.id}`,
  }));
  take(vehicles, "Vehicles", (v) => ({
    id: v.id,
    title: v.registration_number,
    detail: `${v.manufacturer} ${v.model}`,
    to: `/fleets/vehicles?open=${v.id}`,
  }));
  take(drivers, "Drivers", (d) => ({
    id: d.id,
    title: d.name,
    detail: d.driver_code,
    to: `/fleets/drivers?open=${d.id}`,
  }));
  take(routes, "Routes", (r) => ({
    id: r.id,
    title: r.name,
    detail: `${r.source_depot_name}${r.destination_depot_name ? ` → ${r.destination_depot_name}` : ""}`,
    to: `/fleets/routes?open=${r.id}`,
  }));
  take(depots, "Depots", (d) => ({
    id: d.id,
    title: d.name,
    detail: d.address,
    to: `/fleets/depots?open=${d.id}`,
  }));
  take(fleets, "Fleets", (f) => ({
    id: f.id,
    title: f.name,
    detail: `${f.vehicle_count} vehicles`,
    to: `/fleets/fleets?open=${f.id}`,
  }));

  return { groups, failed };
}

function GlobalSearch() {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);

  const debounced = useDebounced(text.trim());
  const params = useMemo(
    () => (debounced.length >= 2 ? { q: debounced } : null),
    [debounced],
  );
  const { data, loading, error } = useResource(searchEverything, params);

  useEffect(() => {
    const onPointer = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, []);

  const go = (to: string) => {
    setOpen(false);
    setText("");
    navigate(to);
  };

  const showPanel = open && text.trim().length >= 2;
  const typing = text.trim() !== debounced;

  return (
    <div className="ops-gsearch" ref={box}>
      <label className="ops-search ops-search--wide">
        <Search size={17} strokeWidth={1.8} aria-hidden="true" />
        <input
          type="search"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => event.key === "Escape" && setOpen(false)}
          placeholder="Search jobs, vehicles, drivers, routes…"
          aria-label="Search operations"
        />
      </label>

      {showPanel && (
        <div className="ops-gsearch__panel" role="listbox" aria-label="Search results">
          {error && <p className="ops-gsearch__note">Search failed: {error}</p>}
          {(loading || typing) && !data && <p className="ops-gsearch__note">Searching…</p>}
          {data && !typing && data.groups.length === 0 && (
            <p className="ops-gsearch__note">No matches for “{debounced}”.</p>
          )}
          {data?.groups.map((group) => (
            <div key={group.label} className="ops-gsearch__group">
              <p className="ops-gsearch__label">{group.label}</p>
              {group.hits.map((hit) => (
                <button
                  key={hit.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  className="ops-gsearch__hit"
                  onClick={() => go(hit.to)}
                >
                  <span>{hit.title}</span>
                  <small>{hit.detail}</small>
                </button>
              ))}
            </div>
          ))}
          {data && data.failed > 0 && (
            <p className="ops-gsearch__note">Some results couldn’t be loaded.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default GlobalSearch;
