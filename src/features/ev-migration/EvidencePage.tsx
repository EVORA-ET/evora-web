import { useMemo, useState } from "react";
import { Plus, Upload } from "lucide-react";

import {
  importObservations,
  listEvCandidates,
  listEvidenceSources,
  listObservationsPage,
  type EvCandidate,
  type EvidenceSource,
  type Observation,
} from "../../lib/intelligenceApi";
import { ApiError } from "../../lib/api";
import { errorMessage, useResource } from "../operations/hooks";
import { useOps } from "../operations/useOps";
import DataTable, { type Column } from "../operations/ui/DataTable";
import { FilterBar, FilterSelect } from "../operations/ui/FilterBar";
import Pagination from "../operations/ui/Pagination";
import { EmptyBlock } from "../operations/ui/states";
import { formatDay, formatStamp, formatValue } from "../intelligence/format";
import { useKinds } from "../intelligence/hooks";
import ObservationDrawer from "../intelligence/ObservationDrawer";
import { NewSourceDrawer, SourceDetailDrawer, SourceSelect, VerificationPill } from "../intelligence/SourceDrawer";
import { Definition, EvidencePill, Segmented } from "../intelligence/ui";
import CandidateDrawer from "./CandidateDrawer";

const ALL = {};
const PAGE_SIZE = 20;

interface ImportFailure {
  row: number;
  errors: unknown;
}

function isFailure(value: unknown): value is ImportFailure {
  return Boolean(value) && typeof value === "object" && typeof (value as { row?: unknown }).row === "number";
}

function ImportPanel() {
  const { invalidate, toast } = useOps();
  const [file, setFile] = useState<File | null>(null);
  const [sourceId, setSourceId] = useState("");
  const [busy, setBusy] = useState(false);
  const [failures, setFailures] = useState<ImportFailure[]>([]);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!file || !sourceId) return;
    setBusy(true);
    setError(null);
    setFailures([]);
    try {
      const res = await importObservations(file, sourceId);
      toast.success(`${res.imported} observation(s) imported.`);
      invalidate();
      setFile(null);
    } catch (e) {
      if (e instanceof ApiError && e.body && typeof e.body === "object" && "failed_rows" in e.body) {
        const rows = e.body.failed_rows;
        if (Array.isArray(rows)) setFailures(rows.filter(isFailure));
      }
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ops-form">
      <p className="ops-muted" style={{ margin: 0 }}>
        Columns: kind, value, unit, vehicle_registration, depot_name, ev_candidate_id, qualifiers (JSON),
        origin, observed_at, period_start, period_end, effective_from, effective_to, note. Every row cites the
        selected source. If any row fails, nothing is imported.
      </p>
      <div className="ops-form__row">
        <label className="ops-field">
          <span className="ops-field__label">CSV file</span>
          <input type="file" accept=".csv,text/csv" onChange={(ev) => setFile(ev.target.files?.[0] ?? null)} />
        </label>
        <SourceSelect required value={sourceId} onChange={setSourceId} />
      </div>
      {error && (
        <div className="ops-callout ops-callout--danger" role="alert">
          {error}
          {failures.length > 0 && (
            <ul className="intel-notes" style={{ marginTop: 6 }}>
              {failures.slice(0, 20).map((f) => (
                <li key={f.row}>Row {f.row}: {JSON.stringify(f.errors)}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div>
        <button type="button" className="ops-btn ops-btn--secondary" disabled={!file || !sourceId || busy} onClick={run}>
          <Upload size={15} /> {busy ? "Importing…" : "Import"}
        </button>
      </div>
    </div>
  );
}

function ObservationsSection() {
  const { data: kinds } = useKinds();
  const [kind, setKind] = useState("");
  const [page, setPage] = useState(1);
  const [recording, setRecording] = useState(false);
  const [correcting, setCorrecting] = useState<Observation | null>(null);
  const params = useMemo(
    () => ({ page, page_size: PAGE_SIZE, kind: kind || undefined, ordering: "-created_at" }),
    [page, kind],
  );
  const { data, error, loading, reload } = useResource(listObservationsPage, params);
  const kindLabel = useMemo(() => new Map((kinds ?? []).map((k) => [k.key, k.label])), [kinds]);

  const columns: Column<Observation>[] = [
    {
      key: "kind",
      header: "What",
      render: (o) => (
        <span>
          {kindLabel.get(o.kind) ?? o.kind}
          {Object.keys(o.qualifiers).length > 0 && (
            <small className="ops-muted" style={{ display: "block" }}>
              {Object.entries(o.qualifiers).map(([k, v]) => `${k}: ${String(v)}`).join(" · ")}
            </small>
          )}
        </span>
      ),
    },
    { key: "value", header: "Value", className: "ops-num", render: (o) => formatValue(o.value, o.unit, 4) },
    { key: "subject", header: "Describes", render: (o) => o.subject.replace(/_/g, " ") },
    {
      key: "evidence",
      header: "Evidence",
      render: (o) => (
        <span>
          <EvidencePill cls={o.evidence_class} />
          {o.stale && <small className="ops-muted" style={{ display: "block" }}>{o.stale_reason}</small>}
        </span>
      ),
    },
    { key: "source", header: "Source", render: (o) => o.source?.title ?? <span className="ops-muted">None cited</span> },
    {
      key: "date",
      header: "Date",
      render: (o) => (o.observed_at ? formatStamp(o.observed_at) : o.effective_from ? `From ${formatDay(o.effective_from)}` : o.period_end ? formatDay(o.period_end) : "—"),
    },
    {
      key: "act",
      header: "",
      render: (o) => (
        <button type="button" className="ops-link" onClick={(ev) => { ev.stopPropagation(); setCorrecting(o); }}>
          Correct
        </button>
      ),
    },
  ];

  return (
    <section className="ops-card" aria-labelledby="ev-obs">
      <div className="ops-card__head">
        <h2 id="ev-obs">Observations</h2>
        <button type="button" className="ops-btn ops-btn--primary ops-btn--sm" onClick={() => setRecording(true)}>
          <Plus size={15} /> Record evidence
        </button>
      </div>
      <FilterBar active={Boolean(kind)} onClear={() => { setKind(""); setPage(1); }}>
        <FilterSelect label="Kind" value={kind} onChange={(v) => { setKind(v); setPage(1); }}
          options={[{ value: "", label: "All kinds" }, ...(kinds ?? []).map((k) => ({ value: k.key, label: k.label }))]} />
      </FilterBar>
      <DataTable columns={columns} rows={data?.results} rowKey={(o) => o.id} loading={loading} error={error}
        onRetry={reload} caption="Recorded observations"
        empty={<EmptyBlock compact title="No observations recorded" text="Record evidence or import a CSV." />} />
      {data && (
        <Pagination page={data.page} totalPages={data.total_pages} count={data.count} pageSize={data.page_size}
          onPage={setPage} noun="observations" />
      )}
      <Definition>
        Corrections never overwrite: the original is kept and assessments that used it still show it.
      </Definition>
      {recording && <ObservationDrawer open onClose={() => setRecording(false)} />}
      {correcting && <ObservationDrawer open supersede={correcting} onClose={() => setCorrecting(null)} />}
    </section>
  );
}

function SourcesSection() {
  const { data, error, loading, reload } = useResource(listEvidenceSources, ALL);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<"all" | "unverified" | "verified" | "rejected">("all");
  const rows = (data ?? []).filter((s) => filter === "all" || s.verification_status === filter);

  const columns: Column<EvidenceSource>[] = [
    { key: "title", header: "Source", render: (s) => <span>{s.title}<small className="ops-muted" style={{ display: "block" }}>{s.source_type.replace(/_/g, " ")}{s.publisher && ` · ${s.publisher}`}</small></span> },
    { key: "ver", header: "Verification", render: (s) => <span><VerificationPill source={s} />{s.verified_at && <small className="ops-muted" style={{ display: "block" }}>{formatDay(s.verified_at)}</small>}</span> },
    { key: "ret", header: "Obtained", render: (s) => `${s.retrieval_method.replace(/_/g, " ")} · ${formatDay(s.retrieved_at)}` },
    { key: "eff", header: "In force", render: (s) => (s.effective_from ? `${formatDay(s.effective_from)} – ${s.effective_to ? formatDay(s.effective_to) : "open"}` : "—") },
  ];

  return (
    <section className="ops-card" aria-labelledby="ev-src">
      <div className="ops-card__head">
        <h2 id="ev-src">Sources</h2>
        <span className="intel-row">
          <Segmented label="Verification filter" value={filter} onChange={setFilter}
            options={[{ value: "all", label: "All" }, { value: "unverified", label: "Unverified" }, { value: "verified", label: "Verified" }, { value: "rejected", label: "Rejected" }]} />
          <button type="button" className="ops-btn ops-btn--secondary ops-btn--sm" onClick={() => setCreating(true)}>
            <Plus size={15} /> New source
          </button>
        </span>
      </div>
      <DataTable columns={columns} rows={data ? rows : undefined} rowKey={(s) => s.id} onRowClick={(s) => setOpenId(s.id)}
        loading={loading} error={error} onRetry={reload} caption="Evidence sources"
        empty={<EmptyBlock compact title="No sources" text="Record the documents and records your values come from." />} />
      <Definition>
        Verified means a named user in your organization checked the values against the cited document. It is
        not independent verification. No external data provider is connected: values enter by cited manual
        entry or CSV import.
      </Definition>
      <SourceDetailDrawer id={openId} onClose={() => setOpenId(null)} />
      {creating && <NewSourceDrawer open onClose={() => setCreating(false)} onCreated={(s) => { setCreating(false); setOpenId(s.id); }} />}
    </section>
  );
}

function CandidatesSection() {
  const { data, error, loading, reload } = useResource(listEvCandidates, ALL);
  const [creating, setCreating] = useState(false);
  const columns: Column<EvCandidate>[] = [
    { key: "label", header: "EV model", render: (c) => <span>{c.label}<small className="ops-muted" style={{ display: "block" }}>{c.vehicle_type} · {c.catalogue_model_id ? `EVORA catalogue figures, ${formatDay(c.created_at)}` : "entered by your organization"}</small></span> },
    { key: "bat", header: "Usable battery", className: "ops-num", render: (c) => formatValue(c.usable_battery_kwh, "kWh") },
    { key: "cons", header: "Consumption", className: "ops-num", render: (c) => `${formatValue(c.energy_consumption_kwh_per_km, "kWh/km", 4)} (${c.consumption_basis})` },
    { key: "src", header: "Figure from", render: (c) => c.consumption_source_type.replace(/_/g, " ") },
    { key: "pay", header: "Payload", className: "ops-num", render: (c) => formatValue(c.payload_kg, "kg") },
    { key: "source", header: "Source", render: (c) => <span>{c.source.title}<small className="ops-muted" style={{ display: "block" }}>{c.source.verification_status}</small></span> },
  ];
  return (
    <section className="ops-card" aria-labelledby="ev-cands">
      <div className="ops-card__head">
        <div>
          <h2 id="ev-cands">EV models used in assessments</h2>
          <p className="ops-card__sub">EVORA adds catalogue models here automatically when you check them.</p>
        </div>
        <button type="button" className="ops-btn ops-btn--ghost ops-btn--sm" onClick={() => setCreating(true)}>
          <Plus size={15} /> Add a model not in the catalogue
        </button>
      </div>
      <DataTable columns={columns} rows={data} rowKey={(c) => c.id} loading={loading} error={error} onRetry={reload}
        caption="EV models used in assessments" empty={<EmptyBlock compact title="No EV models used yet" text="Check a vehicle in Discover & Compare and the models appear here." />} />
      <Definition>
        Specifications are fixed once recorded; when the catalogue is corrected, a new copy is made and earlier
        assessments keep the figures they used. Prices, incentives, residual values and charging efficiency are
        dated observations on the model. Adding your own model is for vehicles the catalogue does not cover and
        needs a cited document.
      </Definition>
      {creating && <CandidateDrawer open onClose={() => setCreating(false)} onCreated={() => { setCreating(false); reload(); }} />}
    </section>
  );
}

function EvidencePage() {
  return (
    <div className="ops-ws">
      <div className="ops-wshead">
        <div>
          <h2 className="ops-wshead__title">Data &amp; sources</h2>
          <p className="ops-wshead__desc">
            The documents, readings and EV specifications behind every result. You rarely need to come here:
            Discover &amp; Compare asks for missing information where it matters.
          </p>
        </div>
      </div>
      <SourcesSection />
      <ObservationsSection />
      <section className="ops-card" aria-labelledby="ev-import">
        <div className="ops-card__head"><h2 id="ev-import">Import observations (CSV)</h2></div>
        <ImportPanel />
      </section>
      <CandidatesSection />
    </div>
  );
}

export default EvidencePage;
