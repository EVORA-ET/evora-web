import { useMemo, useState } from "react";

import {
  assignJob,
  getEligibleResources,
  type EligibleDriver,
  type EligibleVehicle,
  type Job,
} from "../../lib/opsApi";
import { useDebounced, useResource } from "./hooks";
import { formatWindow, fuelLabel, humanize } from "./format";
import { useOps } from "./useOps";
import { useSubmit } from "./workspaceHooks";
import Drawer from "./ui/Drawer";
import { SearchBox } from "./ui/FilterBar";
import { Pill } from "./ui/Pill";
import { EmptyBlock, ErrorBlock, Skeleton } from "./ui/states";

type Pick = string | null;

function VehicleRow({
  vehicle,
  selected,
  onPick,
}: {
  vehicle: EligibleVehicle;
  selected: boolean;
  onPick: () => void;
}) {
  return (
    <li>
      <button type="button" className="ops-candidate" aria-pressed={selected}
        disabled={!vehicle.eligible && !selected} onClick={onPick}>
        <span className="ops-candidate__body">
          <strong>{vehicle.registration_number}</strong>
          <small>
            {vehicle.manufacturer} {vehicle.model} · {fuelLabel(vehicle.fuel_type)}
            {vehicle.depot_name ? ` · ${vehicle.depot_name}` : ""}
          </small>
          {!vehicle.eligible && vehicle.reasons.map((r) => (
            <small key={r} className="ops-candidate__why">{r}</small>
          ))}
          {vehicle.warnings.map((w) => (
            <small key={w} className="ops-candidate__warn">{w}</small>
          ))}
        </span>
        {vehicle.eligible
          ? vehicle.at_source_depot && <Pill tone="ok">At start depot</Pill>
          : <Pill tone="danger">Unavailable</Pill>}
      </button>
    </li>
  );
}

function DriverRow({
  driver,
  selected,
  onPick,
}: {
  driver: EligibleDriver;
  selected: boolean;
  onPick: () => void;
}) {
  return (
    <li>
      <button type="button" className="ops-candidate" aria-pressed={selected}
        disabled={!driver.eligible && !selected} onClick={onPick}>
        <span className="ops-candidate__body">
          <strong>{driver.name}</strong>
          <small>
            {driver.driver_code} · Class {driver.license_class}
            {driver.shift ? ` · ${driver.shift}` : ""}
          </small>
          {!driver.eligible && driver.reasons.map((r) => (
            <small key={r} className="ops-candidate__why">{r}</small>
          ))}
          {driver.warnings.map((w) => (
            <small key={w} className="ops-candidate__warn">{w}</small>
          ))}
        </span>
        {!driver.eligible && <Pill tone="danger">Unavailable</Pill>}
      </button>
    </li>
  );
}

/**
 * Assign / reassign / unassign a vehicle and driver for one job.
 * Eligibility is computed by the server; the save is re-validated there inside
 * a transaction, so a candidate that became busy since the list loaded is
 * still refused with a clear reason.
 */
function AssignDrawer({
  job,
  onClose,
  onDone,
}: {
  job: Job;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast, invalidate } = useOps();
  const submit = useSubmit();
  const [search, setSearch] = useState("");
  const query = useDebounced(search.trim());
  const [vehicleId, setVehicleId] = useState<Pick>(job.vehicle_id);
  const [driverId, setDriverId] = useState<Pick>(job.driver_id);

  const params = useMemo(() => ({ id: job.id, search: query }), [job.id, query]);
  const { data, error, loading, reload } = useResource(fetchEligible, params);

  const changed = vehicleId !== job.vehicle_id || driverId !== job.driver_id;
  const reassign = Boolean(job.vehicle_id || job.driver_id);

  const save = async () => {
    const change: { vehicle_id?: string | null; driver_id?: string | null } = {};
    if (vehicleId !== job.vehicle_id) change.vehicle_id = vehicleId;
    if (driverId !== job.driver_id) change.driver_id = driverId;

    const ok = await submit.run(async () => {
      await assignJob(job.id, change);
    });
    if (ok) {
      toast.success(
        vehicleId && driverId
          ? "Assignment saved. The job is now assigned."
          : vehicleId || driverId
            ? "Saved. The job still needs a " + (vehicleId ? "driver" : "vehicle") + "."
            : "Job unassigned.",
      );
      invalidate();
      onDone();
    } else {
      reload();
    }
  };

  return (
    <Drawer
      open
      level={2}
      wide
      title={reassign ? "Reassign job" : "Assign job"}
      subtitle={
        <>
          <strong>{job.job_template_name}</strong>
          <br />
          {formatWindow(job.scheduled_start_at, job.scheduled_end_at)}
        </>
      }
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ops-btn ops-btn--ghost" onClick={onClose} disabled={submit.busy}>
            Cancel
          </button>
          <button type="button" className="ops-btn ops-btn--primary" onClick={save}
            disabled={submit.busy || !changed}>
            {submit.busy ? "Saving…" : "Save assignment"}
          </button>
        </>
      }
    >
      {submit.formError && (
        <p className="ops-callout ops-callout--danger" role="alert" style={{ marginBottom: 12 }}>
          {submit.formError}
        </p>
      )}

      {data && !data.scheduled && (
        <p className="ops-callout ops-callout--warn" style={{ marginBottom: 12 }}>
          This job has no scheduled start, so availability can’t be checked. Set a schedule first.
        </p>
      )}

      <SearchBox label="Search candidates" placeholder="Search vehicles and drivers"
        value={search} onChange={setSearch} />

      {error && !data ? (
        <ErrorBlock message={error} onRetry={reload} compact />
      ) : !data ? (
        <Skeleton lines={8} />
      ) : (
        <div className={loading ? "ops-busy" : undefined} style={{ marginTop: 16 }}>
          <section className="ops-section">
            <div className="ops-section__head">
              <h3>Vehicle {vehicleId ? "· selected" : "· none"}</h3>
              {vehicleId && (
                <button type="button" className="ops-link" onClick={() => setVehicleId(null)}>
                  Remove vehicle
                </button>
              )}
            </div>
            {data.vehicles.length === 0 ? (
              <EmptyBlock compact title="No vehicles found" text="Add a vehicle or change the search." />
            ) : (
              <ul className="ops-candidates">
                {data.vehicles.map((v) => (
                  <VehicleRow key={v.id} vehicle={v} selected={vehicleId === v.id}
                    onPick={() => setVehicleId(vehicleId === v.id ? null : v.id)} />
                ))}
              </ul>
            )}
            {data.vehicle_total > data.vehicles.length && (
              <p className="ops-muted">Showing {data.vehicles.length} of {data.vehicle_total}. Search to narrow down.</p>
            )}
          </section>

          <section className="ops-section">
            <div className="ops-section__head">
              <h3>Driver {driverId ? "· selected" : "· none"}</h3>
              {driverId && (
                <button type="button" className="ops-link" onClick={() => setDriverId(null)}>
                  Remove driver
                </button>
              )}
            </div>
            {data.drivers.length === 0 ? (
              <EmptyBlock compact title="No drivers found" text="Add a driver or change the search." />
            ) : (
              <ul className="ops-candidates">
                {data.drivers.map((d) => (
                  <DriverRow key={d.id} driver={d} selected={driverId === d.id}
                    onPick={() => setDriverId(driverId === d.id ? null : d.id)} />
                ))}
              </ul>
            )}
            {data.driver_total > data.drivers.length && (
              <p className="ops-muted">Showing {data.drivers.length} of {data.driver_total}. Search to narrow down.</p>
            )}
          </section>

          <p className="ops-muted">
            {humanize(job.status)} job · the server re-checks availability when you save.
          </p>
        </div>
      )}
    </Drawer>
  );
}

const fetchEligible = ({ id, search }: { id: string; search: string }) =>
  getEligibleResources(id, { search });

export default AssignDrawer;
