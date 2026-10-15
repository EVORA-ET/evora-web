import { useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

import {
  createDriverRecord,
  deleteDriver,
  getDriver,
  listDriversPage,
  updateDriver,
  type DriverInput,
  type OpsDriver,
} from "../../lib/opsApi";
import { conflictDetail, useDebounced, useListState, useResource } from "./hooks";
import { WS } from "./filterDefaults";
import { formatWindow, humanize, JOB_STATUS_LABEL, plural } from "./format";
import { useOps } from "./useOps";
import { useDrill, useRecordParams, useSubmit } from "./workspaceHooks";
import WorkspaceHead from "./WorkspaceHead";
import ConfirmDialog from "./ui/ConfirmDialog";
import DataTable, { type Column } from "./ui/DataTable";
import { DetailList, Section } from "./ui/Detail";
import Drawer from "./ui/Drawer";
import { SelectField, TextField } from "./ui/Fields";
import { FilterBar, FilterSelect, SearchBox } from "./ui/FilterBar";
import Pagination from "./ui/Pagination";
import { Pill } from "./ui/Pill";
import { EmptyBlock, ErrorBlock, Skeleton } from "./ui/states";
import { driverTone, jobTone } from "./ui/tones";

const PAGE_SIZE = 15;

const STATUSES = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "on_leave", label: "On leave" },
  { value: "suspended", label: "Suspended" },
  { value: "terminated", label: "Terminated" },
];

type FormValues = Record<
  | "driver_code" | "name" | "date_of_birth" | "license_number" | "license_class"
  | "license_expiry" | "experience_years" | "status" | "shift" | "languages"
  | "emergency_contact_name" | "emergency_contact_phone",
  string
>;

const EMPTY: FormValues = {
  driver_code: "",
  name: "",
  date_of_birth: "",
  license_number: "",
  license_class: "",
  license_expiry: "",
  experience_years: "0",
  status: "active",
  shift: "",
  languages: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
};

function fromDriver(d: OpsDriver): FormValues {
  return {
    driver_code: d.driver_code,
    name: d.name,
    date_of_birth: d.date_of_birth ?? "",
    license_number: d.license_number,
    license_class: d.license_class,
    license_expiry: d.license_expiry ?? "",
    experience_years: d.experience_years === null ? "0" : String(d.experience_years),
    status: d.status,
    shift: d.shift ?? "",
    languages: (d.languages ?? []).join(", "),
    emergency_contact_name: d.emergency_contact_name ?? "",
    emergency_contact_phone: d.emergency_contact_phone ?? "",
  };
}

function validate(v: FormValues): Record<string, string> {
  const e: Record<string, string> = {};
  if (!v.driver_code.trim()) e.driver_code = "Driver code is required.";
  if (!v.name.trim()) e.name = "Name is required.";
  if (!v.date_of_birth) e.date_of_birth = "Date of birth is required.";
  if (!v.license_number.trim()) e.license_number = "Licence number is required.";
  if (!v.license_class.trim()) e.license_class = "Licence class is required.";
  if (!v.license_expiry) e.license_expiry = "Licence expiry is required.";
  if (!(Number(v.experience_years) >= 0)) e.experience_years = "Must be 0 or more.";
  return e;
}

function toInput(v: FormValues): DriverInput {
  return {
    driver_code: v.driver_code.trim(),
    name: v.name.trim(),
    date_of_birth: v.date_of_birth,
    license_number: v.license_number.trim(),
    license_class: v.license_class.trim(),
    license_expiry: v.license_expiry,
    experience_years: v.experience_years,
    status: v.status,
    shift: v.shift.trim(),
    languages: v.languages.split(",").map((l) => l.trim()).filter(Boolean),
    emergency_contact_name: v.emergency_contact_name.trim(),
    emergency_contact_phone: v.emergency_contact_phone.trim(),
  };
}

function DriverForm({
  driver,
  onClose,
  onSaved,
}: {
  driver: OpsDriver | null;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const { toast, invalidate } = useOps();
  const submit = useSubmit();
  const [values, setValues] = useState<FormValues>(() => (driver ? fromDriver(driver) : EMPTY));
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  const set = (key: keyof FormValues, value: string) => setValues((c) => ({ ...c, [key]: value }));
  const err = (key: string) => clientErrors[key] ?? submit.errors[key];

  const save = async () => {
    const problems = validate(values);
    setClientErrors(problems);
    if (Object.keys(problems).length) return;
    await submit.run(async () => {
      const saved = driver
        ? await updateDriver(driver.id, toInput(values))
        : await createDriverRecord(toInput(values));
      toast.success(driver ? "Driver updated." : "Driver added.");
      invalidate();
      onSaved(saved.id);
    });
  };

  return (
    <Drawer
      open
      title={driver ? "Edit driver" : "Add driver"}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ops-btn ops-btn--ghost" onClick={onClose} disabled={submit.busy}>
            Cancel
          </button>
          <button type="button" className="ops-btn ops-btn--primary" onClick={save} disabled={submit.busy}>
            {submit.busy ? "Saving…" : driver ? "Save changes" : "Add driver"}
          </button>
        </>
      }
    >
      <form className="ops-form" noValidate onSubmit={(e) => { e.preventDefault(); void save(); }}>
        {submit.formError && <p className="ops-callout ops-callout--danger" role="alert">{submit.formError}</p>}
        <div className="ops-form__row">
          <TextField label="Driver code" required value={values.driver_code} error={err("driver_code")}
            onChange={(e) => set("driver_code", e.target.value)} />
          <TextField label="Full name" required value={values.name} error={err("name")}
            onChange={(e) => set("name", e.target.value)} />
        </div>
        <div className="ops-form__row">
          <TextField label="Date of birth" type="date" required value={values.date_of_birth}
            error={err("date_of_birth")} onChange={(e) => set("date_of_birth", e.target.value)} />
          <TextField label="Experience (years)" type="number" min={0} step="0.5" value={values.experience_years}
            error={err("experience_years")} onChange={(e) => set("experience_years", e.target.value)} />
        </div>
        <div className="ops-form__row ops-form__row--3">
          <TextField label="Licence number" required value={values.license_number}
            error={err("license_number")} onChange={(e) => set("license_number", e.target.value)} />
          <TextField label="Licence class" required value={values.license_class}
            error={err("license_class")} onChange={(e) => set("license_class", e.target.value)} />
          <TextField label="Licence expiry" type="date" required value={values.license_expiry}
            error={err("license_expiry")} onChange={(e) => set("license_expiry", e.target.value)}
            hint="Expired licences block assignment." />
        </div>
        <div className="ops-form__row">
          <SelectField label="Status" options={STATUSES} value={values.status} error={err("status")}
            onChange={(e) => set("status", e.target.value)} />
          <TextField label="Shift" value={values.shift} error={err("shift")} placeholder="e.g. Day"
            onChange={(e) => set("shift", e.target.value)} />
        </div>
        <TextField label="Languages" value={values.languages} error={err("languages")}
          hint="Comma separated." onChange={(e) => set("languages", e.target.value)} />
        <div className="ops-form__row">
          <TextField label="Emergency contact" value={values.emergency_contact_name}
            error={err("emergency_contact_name")} onChange={(e) => set("emergency_contact_name", e.target.value)} />
          <TextField label="Emergency phone" value={values.emergency_contact_phone}
            error={err("emergency_contact_phone")} onChange={(e) => set("emergency_contact_phone", e.target.value)} />
        </div>
      </form>
    </Drawer>
  );
}

const fetchDriver = ({ id }: { id: string; date: string }) => getDriver(id);

function licenceState(expiry: string | null): { label: string; tone: "ok" | "warn" | "danger" } {
  if (!expiry) return { label: "Not recorded", tone: "warn" };
  const days = Math.floor((new Date(expiry).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { label: "Expired", tone: "danger" };
  if (days <= 30) return { label: `Expires in ${days}d`, tone: "warn" };
  return { label: "Valid", tone: "ok" };
}

function DriverDetail({ id, onClose, onEdit }: { id: string; onClose: () => void; onEdit: (d: OpsDriver) => void }) {
  const { toast, invalidate, date } = useOps();
  const drill = useDrill();
  const params = useMemo(() => ({ id, date }), [id, date]);
  const { data: driver, error, loading, reload } = useResource(fetchDriver, params);
  const [confirming, setConfirming] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const del = useSubmit();
  const statusChange = useSubmit();

  const remove = async () => {
    const ok = await del.run(async () => {
      try {
        await deleteDriver(id);
      } catch (e) {
        const reason = conflictDetail(e);
        if (reason) setBlocked(reason);
        throw e;
      }
    });
    if (ok) {
      toast.success("Driver deleted.");
      invalidate();
      setConfirming(false);
      onClose();
    }
  };

  const changeStatus = async (status: string) => {
    const ok = await statusChange.run(async () => {
      await updateDriver(id, { status });
    });
    if (ok) {
      toast.success(`Status set to ${humanize(status).toLowerCase()}.`);
      invalidate();
    } else {
      toast.error(statusChange.formError ?? "Couldn’t change the status.");
    }
  };

  const job = driver?.current_job;
  const licence = driver ? licenceState(driver.license_expiry) : null;

  return (
    <Drawer
      open
      title={driver?.name ?? "Driver"}
      subtitle={driver?.driver_code}
      onClose={onClose}
      footer={
        driver && (
          <>
            <button type="button" className="ops-btn ops-btn--ghost ops-btn--danger-text"
              onClick={() => { setBlocked(null); setConfirming(true); }}>
              <Trash2 size={16} /> Delete
            </button>
            <button type="button" className="ops-btn ops-btn--primary" onClick={() => onEdit(driver)}>
              <Pencil size={16} /> Edit
            </button>
          </>
        )
      }
    >
      {error && !driver ? (
        <ErrorBlock message={error} onRetry={reload} compact />
      ) : !driver ? (
        <Skeleton lines={8} />
      ) : (
        <div className={loading ? "ops-busy" : undefined}>
          <Section title="Status">
            <div className="ops-form__row">
              <div className="ops-pills">
                <Pill tone={driverTone(driver.status)}>{humanize(driver.status)}</Pill>
                {licence && <Pill tone={licence.tone}>Licence: {licence.label}</Pill>}
              </div>
              <label className="ops-filter">
                <span className="ops-filter__label">Change status</span>
                <select value={driver.status} disabled={statusChange.busy}
                  onChange={(e) => void changeStatus(e.target.value)}>
                  {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </label>
            </div>
            {driver.status !== "active" && (
              <p className="ops-callout ops-callout--warn">Only active drivers can be assigned to new jobs.</p>
            )}
          </Section>

          <Section title="Assignment on selected day">
            {job ? (
              <ul className="ops-list">
                <li>
                  <div className="ops-list__main">
                    <strong>{job.job_template_name}</strong>
                    <small>{formatWindow(job.scheduled_start_at, job.scheduled_end_at)}</small>
                  </div>
                  <Pill tone={jobTone(job.status)}>{JOB_STATUS_LABEL[job.status]}</Pill>
                </li>
              </ul>
            ) : (
              <p className="ops-muted">No open job for this driver.</p>
            )}
            <button type="button" className="ops-btn ops-btn--secondary ops-btn--sm"
              onClick={() => drill("jobs", "/fleets/jobs", {
                range: "all", driver: driver.id, driver_label: driver.name })}>
              View jobs{driver.open_job_count !== undefined ? ` (${plural(driver.open_job_count, "open job")})` : ""}
            </button>
          </Section>

          <Section title="Details">
            <DetailList items={[
              ["Shift", driver.shift || "—"],
              ["Experience", driver.experience_years === null ? "—" : `${driver.experience_years} yrs`],
              ["Licence", `${driver.license_number} (${driver.license_class})`],
              ["Licence expiry", driver.license_expiry ?? "—"],
              ["Date of birth", driver.date_of_birth || "—"],
              ["Languages", (driver.languages ?? []).join(", ") || "—"],
              ["Emergency contact", driver.emergency_contact_name
                ? `${driver.emergency_contact_name} · ${driver.emergency_contact_phone || "no phone"}`
                : "—"],
            ]} />
          </Section>
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        title="Delete this driver?"
        confirmLabel="Delete driver"
        danger
        busy={del.busy}
        blockedReason={blocked}
        error={del.formError}
        onConfirm={remove}
        onCancel={() => setConfirming(false)}
      >
        <p>
          <strong>{driver?.name}</strong> will be removed permanently. Drivers with job history can’t be
          deleted — set them to inactive instead.
        </p>
      </ConfirmDialog>
    </Drawer>
  );
}

function DriversPage() {
  const list = useListState(WS.drivers.key, { ...WS.drivers.defaults } as Record<string, string>, WS.drivers.sort);
  const { state } = list;
  const { date } = useOps();
  const { openId, creating, open, create, close } = useRecordParams();
  const [editing, setEditing] = useState<OpsDriver | null>(null);
  const shift = useDebounced(state.filters.shift.trim());

  const params = useMemo(
    () => ({
      page: state.page,
      page_size: PAGE_SIZE,
      search: list.query,
      ordering: state.sort,
      status: state.filters.status,
      shift,
      availability: state.filters.availability,
      date,
    }),
    [state.page, state.sort, state.filters.status, state.filters.availability, shift, list.query, date],
  );
  const { data, error, loading, reload } = useResource(listDriversPage, params);

  const columns: Column<OpsDriver>[] = [
    {
      key: "name",
      header: "Driver",
      sortKey: "name",
      render: (d) => (
        <div className="ops-cell">
          <strong>{d.name}</strong>
          <small>{d.driver_code}</small>
        </div>
      ),
    },
    { key: "status", header: "Status", sortKey: "status", render: (d) => <Pill tone={driverTone(d.status)}>{humanize(d.status)}</Pill> },
    { key: "shift", header: "Shift", sortKey: "shift", render: (d) => d.shift || "—" },
    {
      key: "lic",
      header: "Licence",
      sortKey: "license_expiry",
      render: (d) => {
        const s = licenceState(d.license_expiry);
        return (
          <div className="ops-cell">
            <span>{d.license_class}</span>
            <small><Pill tone={s.tone}>{s.label}</Pill></small>
          </div>
        );
      },
    },
    { key: "exp", header: "Experience", sortKey: "experience_years", className: "ops-num",
      render: (d) => (d.experience_years === null ? "—" : `${d.experience_years} yrs`) },
    {
      key: "job",
      header: "Today’s job",
      render: (d) =>
        d.current_job ? (
          <div className="ops-cell">
            <strong>{d.current_job.job_template_name}</strong>
            <small>{JOB_STATUS_LABEL[d.current_job.status]}</small>
          </div>
        ) : (
          <span className="ops-muted">—</span>
        ),
    },
  ];

  const formOpen = creating || editing !== null;

  return (
    <div className="ops-ws">
      <WorkspaceHead
        title="Drivers"
        description="Your drivers, their licence validity, shifts and assignments."
        count={data?.count}
        action={{ label: "Add Driver", onClick: create }}
      />

      <FilterBar active={list.hasActiveFilters} onClear={list.clear}>
        <SearchBox label="Search drivers" placeholder="Name, code or licence number"
          value={state.search} onChange={list.setSearch} />
        <FilterSelect label="Status" value={state.filters.status} onChange={(v) => list.setFilter("status", v)}
          options={[{ value: "", label: "All" }, ...STATUSES]} />
        <label className="ops-filter">
          <span className="ops-filter__label">Shift</span>
          <input value={state.filters.shift} placeholder="Any" aria-label="Shift"
            onChange={(e) => list.setFilter("shift", e.target.value)}
            style={{ minHeight: 40, padding: "0 10px", width: 110, border: "1px solid var(--color-outline-variant)", borderRadius: "var(--radius-default)" }} />
        </label>
        <FilterSelect label="Availability" value={state.filters.availability}
          onChange={(v) => list.setFilter("availability", v)}
          options={[
            { value: "", label: "Any" },
            { value: "available", label: "Available" },
            { value: "assigned", label: "Assigned" },
            { value: "unavailable", label: "Unavailable" },
          ]} />
      </FilterBar>

      <DataTable
        caption="Drivers"
        columns={columns}
        rows={data?.results}
        rowKey={(d) => d.id}
        onRowClick={(d) => open(d.id)}
        sort={state.sort}
        onSort={list.setSort}
        loading={loading}
        error={error}
        onRetry={reload}
        empty={
          list.hasActiveFilters ? (
            <EmptyBlock title="No drivers match" text="Try a different search or clear the filters." />
          ) : (
            <EmptyBlock title="No drivers yet" text="Add a driver so jobs can be crewed."
              action={<button type="button" className="ops-btn ops-btn--primary" onClick={create}>Add Driver</button>} />
          )
        }
      />
      {data && (
        <Pagination page={data.page} totalPages={data.total_pages} count={data.count}
          pageSize={data.page_size} onPage={list.setPage} noun="drivers" />
      )}

      {openId && !formOpen && <DriverDetail id={openId} onClose={close} onEdit={setEditing} />}
      {formOpen && (
        <DriverForm
          key={editing?.id ?? "new"}
          driver={editing}
          onClose={() => { setEditing(null); close(); }}
          onSaved={(id) => { setEditing(null); open(id); }}
        />
      )}
    </div>
  );
}

export default DriversPage;
