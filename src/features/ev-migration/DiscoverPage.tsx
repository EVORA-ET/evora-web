import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, ExternalLink, Gavel, ListPlus, Play, RefreshCw, Zap } from "lucide-react";

import {
  candidateForCatalogueModel,
  getAssessment,
  getVehicleReadinessStates,
  getVehicleUsage,
  listAssessments,
  listEvCandidates,
  listEvCatalogue,
  runReadinessAssessment,
  type AssessmentSummary,
  type EvCandidate,
  type EvCatalogueModel,
  type KnownAssessment,
  type ReadinessCheck,
  type ReadinessRequest,
  type ReadinessResult,
  type TcoResult,
  type UsageProfile,
  type VehicleReadinessState,
} from "../../lib/intelligenceApi";
import type { OpsVehicle } from "../../lib/opsApi";
import { fuelLabel, humanize } from "../operations/format";
import { errorMessage, useDebounced, useResource } from "../operations/hooks";
import { useOps } from "../operations/useOps";
import { useSubmit } from "../operations/workspaceHooks";
import { TextField } from "../operations/ui/Fields";
import { FilterSelect, SearchBox } from "../operations/ui/FilterBar";
import { Pill, type Tone } from "../operations/ui/Pill";
import { EmptyBlock, ErrorBlock, Skeleton } from "../operations/ui/states";
import { SERIES } from "../intelligence/chartColors";
import { PairedBars } from "../intelligence/charts";
import { formatDay, formatMoney, formatStamp, formatValue, num } from "../intelligence/format";
import { useParam } from "../intelligence/hooks";
import { CHECK_LABEL, inputLabel } from "../intelligence/labels";
import { CoverageBadge, Definition, Disclosure, Segmented } from "../intelligence/ui";
import { loadAllVehicles } from "../intelligence/vehicles";
import { TcoForm } from "./AssessmentForms";
import { RecordDecisionDrawer } from "./Decisions";
import { candidatesByModel, latestForAny } from "./derive";
import { AddToPlanDrawer } from "./PlanForms";
import { SupplyActions, VehicleEvidence } from "./VehicleEvidence";

const ICE = { powertrain: "ice" as const };
const ALL = {};
const STATES = "states";
const loadStates = () => getVehicleReadinessStates();
const USAGE_DAYS = 365;
const loadUsage = (id: string) => getVehicleUsage(id, USAGE_DAYS);

const STATE_LABEL: Record<VehicleReadinessState, string> = {
  meets_requirements: "Fits at least one EV model",
  needs_evidence: "Needs more information",
  not_suitable: "No assessed model fits",
  not_assessed: "Not assessed yet",
};
const STATE_TONE: Record<VehicleReadinessState, Tone> = {
  meets_requirements: "ok",
  needs_evidence: "warn",
  not_suitable: "danger",
  not_assessed: "neutral",
};

/* ------------------------------------------------------------------ */
/* Fit labels — derived only from stored readiness results              */
/* ------------------------------------------------------------------ */

interface Fit {
  label: string;
  tone: Tone;
}

function fitOf(model: EvCatalogueModel, readiness: AssessmentSummary | undefined): Fit {
  if (!model.assessable) return { label: "Cannot determine with available data", tone: "neutral" };
  if (!readiness) return { label: "Not checked yet", tone: "neutral" };
  const outcome = readiness.headline.outcome;
  if (outcome === "meets_requirements") {
    return readiness.evidence_level === "high" || readiness.evidence_level === "moderate"
      ? { label: "Fits the documented requirements", tone: "ok" }
      : { label: "Potential fit — additional information needed", tone: "warn" };
  }
  if (outcome === "not_suitable") return { label: "Does not meet a required criterion", tone: "danger" };
  const checks = Object.values(readiness.headline.checks ?? {});
  return checks.some((c) => c === "pass")
    ? { label: "Potential fit — additional information needed", tone: "warn" }
    : { label: "Cannot determine with available data", tone: "neutral" };
}

const SPEC_NAME: Record<string, string> = {
  battery_capacity_kwh: "battery capacity",
  energy_consumption_kwh_per_km: "energy use or range",
  payload_kg: "payload",
};

/* ------------------------------------------------------------------ */
/* Assessment settings — the only inputs the manager must choose       */
/* ------------------------------------------------------------------ */

type Basis = "measured_p90" | "measured_max" | "planned_max";

interface Settings {
  reservePct: string;
  connector: "ac" | "dc" | "";
}

const SETTINGS_KEY = "evora.discover.settings";

function readSettings(): Settings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const v: unknown = JSON.parse(raw);
      if (v && typeof v === "object") {
        const o = v as Record<string, unknown>;
        return {
          reservePct: typeof o.reservePct === "string" ? o.reservePct : "",
          connector: o.connector === "ac" || o.connector === "dc" ? o.connector : "",
        };
      }
    }
  } catch {
    /* storage unavailable: start empty */
  }
  return { reservePct: "", connector: "" };
}

function saveSettings(s: Settings) {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* convenience only */
  }
}

/** Picks the design-day basis from the evidence actually available, strongest first. */
function chooseBasis(u: UsageProfile | undefined): { basis: Basis | null; why: string } {
  const odo = u?.measured.odometer;
  if (odo && odo.status === "ok" && odo.daily.sample_count >= 30 && odo.daily.p90_km !== null) {
    return { basis: "measured_p90", why: `90th-percentile day from ${odo.daily.sample_count} measured days (${formatValue(odo.daily.p90_km, "km", 0)}).` };
  }
  if (odo && odo.status === "ok" && odo.daily.max_observed_km !== null) {
    return { basis: "measured_max", why: `Longest measured day (${formatValue(odo.daily.max_observed_km, "km", 0)}); fewer than 30 daily readings for a percentile.` };
  }
  if (u && u.planned.max_planned_day_km !== null) {
    return { basis: "planned_max", why: `Largest planned day from route estimates (${formatValue(u.planned.max_planned_day_km, "km", 0)}) — planned, not measured.` };
  }
  return { basis: null, why: "No odometer history or planned routes for this vehicle." };
}

/* ------------------------------------------------------------------ */
/* Left: ICE vehicles                                                   */
/* ------------------------------------------------------------------ */

function VehicleList({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (v: OpsVehicle) => void;
}) {
  const vehicles = useResource(loadAllVehicles, ICE);
  const states = useResource(loadStates, STATES);
  const [stateFilter, setStateFilter] = useParam("state");
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim().toLowerCase());

  const rows = useMemo(() => {
    const list = vehicles.data?.vehicles ?? [];
    return list.filter((v) => {
      const st = states.data?.[v.id]?.state ?? "not_assessed";
      const text = `${v.registration_number} ${v.manufacturer} ${v.model} ${v.fleet_name ?? ""} ${v.depot_name ?? ""}`.toLowerCase();
      return (!q || text.includes(q)) && (!stateFilter || st === stateFilter);
    });
  }, [vehicles.data, states.data, q, stateFilter]);

  return (
    <section className="ops-card intel-panel" aria-labelledby="dc-list">
      <h2 id="dc-list" className="intel-card-title" style={{ marginBottom: 10 }}>Your ICE vehicles</h2>
      <div className="intel-stack" style={{ gap: 8 }}>
        <SearchBox value={search} onChange={setSearch} placeholder="Registration, model, fleet or depot" label="Search ICE vehicles" />
        <FilterSelect label="Assessment" value={stateFilter ?? ""} onChange={(v) => setStateFilter(v || null)}
          options={[{ value: "", label: "All vehicles" },
            ...(Object.keys(STATE_LABEL) as VehicleReadinessState[]).map((k) => ({ value: k, label: STATE_LABEL[k] }))]} />
      </div>
      {vehicles.error && !vehicles.data ? (
        <ErrorBlock compact message={vehicles.error} onRetry={vehicles.reload} />
      ) : !vehicles.data ? (
        <Skeleton lines={6} />
      ) : vehicles.data.vehicles.length === 0 ? (
        <EmptyBlock compact title="No ICE vehicles recorded" text="Vehicles come from Operations → Vehicles." />
      ) : rows.length === 0 ? (
        <EmptyBlock compact title="No vehicles match" />
      ) : (
        <ul className="intel-picker__list" aria-label="ICE vehicles" style={{ marginTop: 10 }}>
          {rows.map((v) => {
            const st = states.data?.[v.id]?.state ?? "not_assessed";
            return (
              <li key={v.id}>
                <button type="button" className="intel-picker__item" aria-current={v.id === selectedId} onClick={() => onSelect(v)}>
                  <span>
                    <strong>{v.registration_number}</strong>
                    <small>{v.manufacturer} {v.model} · {fuelLabel(v.fuel_type)} · {humanize(v.vehicle_type)}</small>
                  </span>
                  <Pill tone={STATE_TONE[st]}>{STATE_LABEL[st]}</Pill>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {vehicles.data?.truncated && <p className="ops-muted">Showing the first 2,000 vehicles; use search to narrow.</p>}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Readiness explanation                                                */
/* ------------------------------------------------------------------ */

function gateRow(c: ReadinessCheck): { requirement: string; spec: string } {
  const v = c.values;
  if (c.check === "range") {
    return {
      requirement: v.required_range_km != null ? `${formatValue(v.required_range_km, "km", 0)} per day incl. reserve (${formatValue(v.battery_energy_needed_kwh, "kWh", 1)})` : "—",
      spec: v.usable_battery_kwh != null ? `${formatValue(v.usable_battery_kwh, "kWh", 1)} battery at ${formatValue(v.c_battery_kwh_per_km, "kWh/km", 3)}` : "—",
    };
  }
  if (c.check === "payload") {
    return {
      requirement: v.required_payload_kg != null ? formatValue(v.required_payload_kg, "kg", 0) : "—",
      spec: v.candidate_payload_kg != null ? formatValue(v.candidate_payload_kg, "kg", 0) : "—",
    };
  }
  return {
    requirement: v.daily_grid_energy_kwh != null ? `${formatValue(v.daily_grid_energy_kwh, "kWh", 1)} within ${formatValue(v.charging_window_hours, "h", 1)}` : "—",
    spec: v.effective_power_kw != null ? `${formatValue(v.effective_power_kw, "kW", 1)} → ${formatValue(v.charging_hours, "h", 2)}` : "—",
  };
}

const CHECK_TONE: Record<ReadinessCheck["status"], Tone> = { pass: "ok", fail: "danger", insufficient: "neutral" };
const CHECK_TEXT: Record<ReadinessCheck["status"], string> = { pass: "Meets", fail: "Does not meet", insufficient: "Cannot test yet" };

function ReadinessExplain({ assessment }: { assessment: KnownAssessment & { kind: "ev_readiness" } }) {
  const r: ReadinessResult = assessment.result;
  return (
    <div className="intel-stack" style={{ gap: 10 }}>
      <ul className="intel-gatelist" aria-label="Readiness checks">
        {r.checks.map((c) => {
          const g = gateRow(c);
          return (
            <li key={c.check} className="intel-gatelist__item">
              <div className="intel-gatelist__head">
                <strong>{CHECK_LABEL[c.check]}</strong>
                <Pill tone={CHECK_TONE[c.status]}>{CHECK_TEXT[c.status]}</Pill>
              </div>
              <dl className="intel-gatelist__vals">
                <div><dt>Your requirement</dt><dd>{g.requirement}</dd></div>
                <div><dt>EV model</dt><dd>{g.spec}</dd></div>
              </dl>
              <p>{c.explanation}</p>
            </li>
          );
        })}
      </ul>
      <div className="intel-row">
        <span className="ops-muted">Evidence behind this result:</span>
        <CoverageBadge level={assessment.evidence_level} />
        <span className="ops-muted">· assessed {formatStamp(assessment.created_at)}</span>
      </div>
      {r.warnings.length > 0 && (
        <ul className="intel-notes">{r.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
      )}
      <Definition>
        Suitability (the three checks) and evidence strength are shown separately: passing checks on weak
        evidence is a provisional result. No score is calculated.
      </Definition>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Financial comparison                                                 */
/* ------------------------------------------------------------------ */

function costLabel(key: string): string {
  const l = inputLabel(key);
  return l === key ? humanize(key) : l;
}

function FinancialView({ assessment }: { assessment: KnownAssessment & { kind: "tco" } }) {
  const r: TcoResult = assessment.result;
  if (r.status !== "ok") {
    return (
      <div className="intel-setup">
        <p className="intel-setup__lead">A cost comparison could not be calculated yet.</p>
        <p className="ops-muted">Missing: {r.missing.map(inputLabel).join(", ")}.</p>
      </div>
    );
  }
  const c = r.currency;
  const fmt = (n: number) => formatMoney(n, c);
  const nps = r.net_present_savings;
  const keys = [...new Set([...Object.keys(r.ice.annual_costs), ...Object.keys(r.ev.annual_costs)])];
  return (
    <div className="intel-stack" style={{ gap: 14 }}>
      <div className="intel-figures">
        <div className={nps >= 0 ? "intel-figure--good" : "intel-figure--bad"}>
          <span>{nps >= 0 ? "Estimated total cost advantage" : "EV costs more over the period"}</span>
          <strong>{fmt(Math.abs(nps))}</strong>
          <small>Net present savings over {r.common.horizon_years} years at {(r.common.discount_rate * 100).toFixed(1)}%</small>
        </div>
        <div>
          <span>Extra upfront cost</span>
          <strong>{fmt(r.extra_upfront_cost)}</strong>
          <small>EV investment minus ICE baseline investment</small>
        </div>
        <div>
          <span>Payback</span>
          <strong>{r.simple_payback_years === null ? "Not reached" : `${r.simple_payback_years.toFixed(1)} years`}</strong>
          <small>{r.simple_payback_years === null ? "The EV does not cost less to run each year under these inputs" : "Extra upfront cost ÷ annual operating saving (undiscounted)"}</small>
        </div>
      </div>
      <PairedBars label={`ICE vs EV costs (${c})`} format={fmt} missingLabel="Not part of this option"
        a={{ label: "Current ICE", color: SERIES.ice }} b={{ label: "EV option", color: SERIES.ev }}
        rows={[
          { label: "Net present cost", note: `${r.common.horizon_years}-year total, discounted`, a: r.ice.net_present_cost, b: r.ev.net_present_cost },
          { label: "Upfront investment", a: r.ice.initial_investment, b: r.ev.initial_investment },
          { label: "Annual operating cost", a: r.ice.annual_operating_total, b: r.ev.annual_operating_total },
          ...keys.map((k) => ({ label: costLabel(k), note: "per year", a: r.ice.annual_costs[k] ?? null, b: r.ev.annual_costs[k] ?? null })),
        ]} />
      <Definition>
        Net present cost = initial investment + discounted annual costs − discounted residual value. Estimated
        savings = ICE net present cost − EV net present cost; positive means the EV costs less under these
        assumptions. {r.common.annual_distance_km ? `Based on ${formatValue(r.common.annual_distance_km, "km/year", 0)}.` : ""}
        {r.excluded_categories.length > 0 && ` Not included: ${r.excluded_categories.map(costLabel).join(", ")}.`}
      </Definition>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Right: one vehicle                                                   */
/* ------------------------------------------------------------------ */

interface Ctx {
  vehicle: OpsVehicle;
  assessments: AssessmentSummary[] | undefined;
  byModel: Map<string, Set<string>>;
  candidates: EvCandidate[] | undefined;
}

function ModelCard({
  model,
  ctx,
  selected,
  onSelect,
  onCheck,
  busy,
}: {
  model: EvCatalogueModel;
  ctx: Ctx;
  selected: boolean;
  onSelect: () => void;
  onCheck: () => void;
  busy: boolean;
}) {
  const readiness = latestForAny(ctx.assessments, "ev_readiness", ctx.byModel.get(model.id));
  const tco = latestForAny(ctx.assessments, "tco", ctx.byModel.get(model.id));
  const fit = fitOf(model, readiness);
  const price = num(model.list_price);
  return (
    <article className={`intel-model ${selected ? "intel-model--on" : ""}`} aria-label={model.label}>
      <header className="intel-model__head">
        <div>
          <h3>{model.manufacturer} {model.model}</h3>
          <p>{model.variant || model.body}</p>
        </div>
        <Pill tone={fit.tone}>{fit.label}</Pill>
      </header>
      <dl className="intel-model__specs">
        <div><dt>Battery</dt><dd>{model.battery_capacity_kwh ? formatValue(model.battery_capacity_kwh, "kWh", 1) : "Not published"}</dd></div>
        <div>
          <dt>Range</dt>
          <dd>
            {model.published_range_km ? formatValue(model.published_range_km, "km", 0) : "Not published"}
            {model.published_range_km && <small>{model.range_basis === "certified" ? `certified${model.range_cycle ? ` (${model.range_cycle})` : ""}` : "manufacturer claim"}</small>}
          </dd>
        </div>
        <div><dt>Payload</dt><dd>{model.payload_kg ? formatValue(model.payload_kg, "kg", 0) : "Not published"}</dd></div>
        <div>
          <dt>Charging</dt>
          <dd>
            {[model.max_ac_charge_kw && `AC ${formatValue(model.max_ac_charge_kw, "kW", 1)}`, model.max_dc_charge_kw && `DC ${formatValue(model.max_dc_charge_kw, "kW", 0)}`].filter(Boolean).join(" · ") || "Power not published"}
          </dd>
        </div>
        <div>
          <dt>Price</dt>
          <dd>
            {price !== null ? formatMoney(price, model.price_currency) : "Not published"}
            {price !== null && <small>{model.price_basis}{model.price_as_of ? `, ${formatDay(model.price_as_of)}` : ""}</small>}
          </dd>
        </div>
        <div>
          <dt>Cost comparison</dt>
          <dd>
            {tco?.headline.result_status === "ok" && tco.headline.net_present_savings != null
              ? `${tco.headline.net_present_savings >= 0 ? "Saves" : "Costs"} ${formatMoney(Math.abs(tco.headline.net_present_savings), tco.headline.currency)}`
              : tco ? "Needs more inputs" : "Not calculated"}
          </dd>
        </div>
      </dl>
      {model.missing_specs.length > 0 && (
        <p className="intel-model__gap">
          The manufacturer document does not state {model.missing_specs.map((s) => SPEC_NAME[s]).join(" or ")}, so EVORA
          cannot check this model.
        </p>
      )}
      <footer className="intel-model__foot">
        <div className="intel-model__src">
          <a href={model.source_url} target="_blank" rel="noreferrer" className="intel-source">
            Source: {model.source_publisher} <ExternalLink size={12} aria-hidden="true" />
          </a>
          <span className="ops-muted">
            {model.verification_status === "verified" ? `Checked by EVORA ${formatDay(model.verified_at)}` : "Figures not yet checked by EVORA"}
          </span>
        </div>
        <div className="intel-model__btns">
        {model.assessable && (
          <button type="button" className="ops-btn ops-btn--secondary ops-btn--sm" onClick={onCheck} disabled={busy}>
            {readiness ? <RefreshCw size={14} /> : <Play size={14} />} {busy ? "Checking…" : readiness ? "Check again" : "Check suitability"}
          </button>
        )}
        <button type="button" className="ops-btn ops-btn--ghost ops-btn--sm" onClick={onSelect} aria-pressed={selected}>
          Details
        </button>
        </div>
      </footer>
    </article>
  );
}

function ModelDetail({ model, ctx, usage }: { model: EvCatalogueModel; ctx: Ctx; usage: UsageProfile | undefined }) {
  const [, openAssessment] = useParam("assessment");
  const ids = ctx.byModel.get(model.id);
  const readinessRow = latestForAny(ctx.assessments, "ev_readiness", ids);
  const tcoRow = latestForAny(ctx.assessments, "tco", ids);
  const readiness = useResource(getAssessment, readinessRow?.id ?? null);
  const tco = useResource(getAssessment, tcoRow?.id ?? null);
  const [showTcoForm, setShowTcoForm] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [planning, setPlanning] = useState(false);
  const r = readiness.data?.id === readinessRow?.id && readiness.data?.kind === "ev_readiness" ? readiness.data : undefined;
  const t = tco.data?.id === tcoRow?.id && tco.data?.kind === "tco" ? tco.data : undefined;
  const candidate = ctx.candidates?.find((c) => c.id === readinessRow?.ev_candidate_id);
  const connectorValue = r?.input_snapshot.context.charging_connector;
  const connector = connectorValue === "ac" || connectorValue === "dc" ? connectorValue : undefined;
  const v = ctx.vehicle;

  return (
    <section className="ops-card intel-panel" aria-labelledby="dc-detail">
      <div className="ops-card__head">
        <div>
          <h2 id="dc-detail">{model.label} for {v.registration_number}</h2>
          <p className="ops-card__sub">{model.body} · figures from “{model.source_title}”</p>
        </div>
      </div>

      <h3 className="intel-step"><span>1</span> Operational suitability</h3>
      {!readinessRow ? (
        <p className="ops-muted">Not checked yet. Use “Check suitability” on the model card.</p>
      ) : !r ? (
        readiness.error ? <ErrorBlock compact message={readiness.error} onRetry={readiness.reload} /> : <Skeleton lines={4} />
      ) : (
        <>
          <ReadinessExplain assessment={r} />
          {r.missing_inputs.length > 0 && (
            <SupplyActions missing={r.missing_inputs} vehicle={v} candidate={candidate} connector={connector} />
          )}
          <button type="button" className="ops-link" onClick={() => openAssessment(r.id)}>See every input and its source</button>
        </>
      )}

      <Disclosure title="Improve your assessment" meta="optional">
        <ul className="intel-notes">
          <li><strong>More driving history:</strong> 30+ days of odometer readings let EVORA use your 90th-percentile day instead of a single longest day.{usage?.measured.odometer.status === "ok" ? ` You have ${usage.measured.odometer.daily.sample_count} daily samples.` : ""}</li>
          <li><strong>Fuel records:</strong> two full fills 300+ km apart give measured fuel economy and a real fuel-cost baseline.</li>
          <li><strong>Required payload:</strong> the heaviest load the duty carries; otherwise the vehicle record's rated payload is used.</li>
          <li><strong>Depot charging:</strong> charger power and daily parking window make the charging check possible.</li>
        </ul>
        <p className="ops-muted" style={{ margin: 0 }}>Record these from the vehicle summary above or under Data &amp; sources, then check again.</p>
      </Disclosure>

      <h3 className="intel-step"><span>2</span> Financial comparison</h3>
      {t && !showTcoForm ? (
        <>
          <FinancialView assessment={t} />
          <div className="intel-row">
            <button type="button" className="ops-link" onClick={() => openAssessment(t.id)}>Full calculation, sensitivity and sources</button>
            <button type="button" className="ops-link" onClick={() => setShowTcoForm(true)}>Recalculate with other assumptions</button>
          </div>
          {t.missing_inputs.length > 0 && <SupplyActions missing={t.missing_inputs} vehicle={v} candidate={candidate} />}
        </>
      ) : !readinessRow || !candidate ? (
        <p className="ops-muted">Check suitability first; the cost comparison uses the same EV model record.</p>
      ) : (
        <>
          <p className="ops-muted" style={{ marginTop: 0 }}>
            Choose the period and discount rate for the comparison. EVORA uses recorded fuel prices, tariffs and
            the published list price (or a quotation, if you recorded one).
          </p>
          <TcoForm vehicleId={v.id} candidateId={candidate.id} onResult={() => setShowTcoForm(false)} />
        </>
      )}

      <h3 className="intel-step"><span>3</span> Next steps</h3>
      <div className="intel-actions">
        <button type="button" className="ops-btn ops-btn--secondary ops-btn--sm" onClick={() => setPlanning(true)} disabled={!candidate}>
          <ListPlus size={15} /> Add to a transition plan
        </button>
        <button type="button" className="ops-btn ops-btn--secondary ops-btn--sm" onClick={() => setDeciding(true)} disabled={!candidate}>
          <Gavel size={15} /> Record a decision
        </button>
      </div>
      <Definition>
        A formal approval needs this readiness result to meet every check with moderate or high evidence. A
        favourable cost result alone never approves a transition.
      </Definition>
      {deciding && candidate && (
        <RecordDecisionDrawer open onClose={() => setDeciding(false)}
          preset={{ vehicle: { id: v.id, label: v.registration_number }, candidateId: candidate.id, readinessId: readinessRow?.id, tcoId: tcoRow?.id }} />
      )}
      {planning && candidate && (
        <AddToPlanDrawer onClose={() => setPlanning(false)}
          preset={{ vehicle: { id: v.id, label: v.registration_number }, candidateId: candidate.id, readinessId: readinessRow?.id, tcoId: tcoRow?.id }} />
      )}
    </section>
  );
}

function CompareTable({ models, ctx }: { models: EvCatalogueModel[]; ctx: Ctx }) {
  const rows = models
    .map((m) => ({ m, r: latestForAny(ctx.assessments, "ev_readiness", ctx.byModel.get(m.id)), t: latestForAny(ctx.assessments, "tco", ctx.byModel.get(m.id)) }))
    .filter((x) => x.r);
  if (rows.length < 2) return null;
  return (
    <section className="ops-card intel-panel" aria-labelledby="dc-compare">
      <div className="ops-card__head"><h2 id="dc-compare">Compare checked models</h2></div>
      <div className="ops-table-scroll">
        <table className="ops-table">
          <caption className="ops-sr-only">Checked EV models side by side</caption>
          <thead>
            <tr>
              <th scope="col">Model</th>
              {(["range", "payload", "charging"] as const).map((c) => <th key={c} scope="col">{CHECK_LABEL[c]}</th>)}
              <th scope="col">Evidence</th>
              <th scope="col">Est. savings</th>
              <th scope="col">Payback</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ m, r, t }) => (
              <tr key={m.id}>
                <th scope="row">{m.label}<small className="ops-muted" style={{ display: "block", fontWeight: 400 }}>{fitOf(m, r).label}</small></th>
                {(["range", "payload", "charging"] as const).map((c) => {
                  const st = r?.headline.checks?.[c];
                  return <td key={c}>{st ? <Pill tone={CHECK_TONE[st]}>{CHECK_TEXT[st]}</Pill> : "—"}</td>;
                })}
                <td><CoverageBadge level={r?.evidence_level} /></td>
                <td className="ops-num">
                  {t?.headline.result_status === "ok" && t.headline.net_present_savings != null
                    ? formatMoney(t.headline.net_present_savings, t.headline.currency) : <span className="ops-muted">—</span>}
                </td>
                <td>{t?.headline.simple_payback_years != null ? `${t.headline.simple_payback_years.toFixed(1)} y` : <span className="ops-muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Definition>Models are listed, not ranked: suitability, evidence strength and cost are separate questions.</Definition>
    </section>
  );
}

function VehicleWorkspace({ vehicle }: { vehicle: OpsVehicle }) {
  const { invalidate, toast } = useOps();
  const [modelId, setModelId] = useParam("model");
  const [settings, setSettingsState] = useState<Settings>(readSettings);
  const [manualKm, setManualKm] = useState("");
  const [busyModel, setBusyModel] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const submit = useSubmit();

  const catalogue = useResource(listEvCatalogue, ALL);
  const candidates = useResource(listEvCandidates, ALL);
  const assessmentParams = useMemo(() => ({ vehicle_id: vehicle.id }), [vehicle.id]);
  const assessments = useResource(listAssessments, assessmentParams);
  const usage = useResource(loadUsage, vehicle.id);
  const u = usage.data?.vehicle_id === vehicle.id ? usage.data : undefined;
  const basis = chooseBasis(u);

  const setSettings = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettingsState(next);
    saveSettings(next);
  };

  const byModel = useMemo(() => candidatesByModel(candidates.data), [candidates.data]);
  const ctx: Ctx = { vehicle, assessments: assessments.data, byModel, candidates: candidates.data };
  const all = catalogue.data ?? [];
  const byAssessable = (a: EvCatalogueModel, b: EvCatalogueModel) => Number(b.assessable) - Number(a.assessable);
  const sameType = all.filter((m) => m.vehicle_type === vehicle.vehicle_type).sort(byAssessable);
  const otherType = all.filter((m) => m.vehicle_type !== vehicle.vehicle_type);
  const selected = all.find((m) => m.id === modelId);
  const assessable = sameType.filter((m) => m.assessable);

  const settingsError = (): string | null => {
    const reserve = Number(settings.reservePct);
    if (settings.reservePct === "" || !Number.isFinite(reserve) || reserve < 0 || reserve > 100) return "Enter your range reserve (0–100%).";
    if (!settings.connector) return "Choose how the vehicle will charge at its depot (AC or DC).";
    if (!basis.basis && (manualKm === "" || Number(manualKm) <= 0)) return "Enter the longest distance this vehicle drives in a day.";
    return null;
  };

  const checkOne = async (m: EvCatalogueModel) => {
    const candidate = await candidateForCatalogueModel(m.id);
    const request: ReadinessRequest = {
      vehicle_id: vehicle.id,
      ev_candidate_id: candidate.id,
      reserve_fraction: Number(settings.reservePct) / 100,
      charging_connector: settings.connector === "dc" ? "dc" : "ac",
      design_day_distance: basis.basis
        ? { basis: basis.basis }
        : { value: Number(manualKm), unit: "km", origin: "organization_provided", note: "Entered in Discover & Compare" },
      usage_window_days: USAGE_DAYS,
    };
    await runReadinessAssessment(request);
  };

  const run = (models: EvCatalogueModel[]) =>
    submit.run(async () => {
      setRunError(null);
      const err = settingsError();
      if (err) throw new Error(err);
      const failures: string[] = [];
      for (const m of models) {
        setBusyModel(m.id);
        try {
          await checkOne(m);
        } catch (e) {
          failures.push(`${m.label}: ${errorMessage(e)}`);
        }
      }
      setBusyModel(null);
      invalidate();
      if (failures.length) setRunError(failures.join(" "));
      else toast.success(models.length === 1 ? `${models[0].label} checked.` : `${models.length} models checked.`);
      if (models.length === 1) setModelId(models[0].id);
    });

  return (
    <div className="intel-stack">
      <VehicleEvidence vehicleId={vehicle.id} />

      <section className="ops-card intel-panel" aria-labelledby="dc-settings">
        <div className="ops-card__head">
          <div>
            <h2 id="dc-settings">How EVORA will check this vehicle</h2>
            <p className="ops-card__sub">Two policy choices are yours; everything else comes from your records.</p>
          </div>
        </div>
        <div className="ops-form__row">
          <TextField label="Range reserve (%)" required type="number" min={0} max={100} step="any" value={settings.reservePct}
            hint="Margin you want above the longest expected day, e.g. 20" onChange={(ev) => setSettings({ reservePct: ev.target.value })} />
          <div className="ops-field">
            <span className="ops-field__label">Depot charging <span className="ops-field__req" aria-hidden="true">*</span></span>
            <Segmented label="Depot charging" value={settings.connector}
              options={[{ value: "ac", label: "AC (slow)" }, { value: "dc", label: "DC (fast)" }]}
              onChange={(v) => setSettings({ connector: v })} />
          </div>
        </div>
        <p className="intel-basis">
          <CheckCircle2 size={15} aria-hidden="true" /> <strong>Daily distance:</strong> {basis.why}
        </p>
        {!basis.basis && (
          <TextField label="Longest daily distance (km)" required type="number" min={1} step="any" value={manualKm}
            hint="Your own figure, stored as organization-provided. Record odometer readings for a measured value."
            onChange={(ev) => setManualKm(ev.target.value)} />
        )}
        {submit.formError && <p className="ops-callout ops-callout--danger" role="alert">{submit.formError}</p>}
        {runError && <p className="ops-callout ops-callout--warn" role="alert">{runError}</p>}
      </section>

      <section className="ops-card intel-panel" aria-labelledby="dc-models">
        <div className="ops-card__head">
          <div>
            <h2 id="dc-models">EV models for this {humanize(vehicle.vehicle_type).toLowerCase()}</h2>
            <p className="ops-card__sub">From EVORA's catalogue of manufacturer-published figures, matched by vehicle category.</p>
          </div>
          {assessable.length > 1 && (
            <button type="button" className="ops-btn ops-btn--primary ops-btn--sm" disabled={submit.busy} onClick={() => void run(assessable)}>
              <Zap size={15} /> {submit.busy ? "Checking…" : `Check all ${assessable.length} models`}
            </button>
          )}
        </div>
        {catalogue.error && !catalogue.data ? (
          <ErrorBlock compact message={catalogue.error} onRetry={catalogue.reload} />
        ) : !catalogue.data ? (
          <Skeleton lines={5} />
        ) : sameType.length === 0 ? (
          <EmptyBlock compact title={`No ${humanize(vehicle.vehicle_type).toLowerCase()} models in the catalogue yet`}
            text="EVORA only lists models whose figures come from a cited manufacturer document. Models of other categories are below." />
        ) : (
          <div className="intel-models">
            {sameType.map((m) => (
              <ModelCard key={m.id} model={m} ctx={ctx} selected={m.id === modelId} busy={busyModel === m.id}
                onSelect={() => setModelId(m.id === modelId ? null : m.id)} onCheck={() => void run([m])} />
            ))}
          </div>
        )}
        {otherType.length > 0 && (
          <Disclosure title="Models of other categories" meta={`${otherType.length} in catalogue`}>
            <div className="intel-models">
              {otherType.map((m) => (
                <ModelCard key={m.id} model={m} ctx={ctx} selected={m.id === modelId} busy={busyModel === m.id}
                  onSelect={() => setModelId(m.id === modelId ? null : m.id)} onCheck={() => void run([m])} />
              ))}
            </div>
            <Definition>A different category may not do the same job; the readiness result flags the mismatch.</Definition>
          </Disclosure>
        )}
        <Definition>
          Catalogue figures are copied from the cited documents as published. Where energy use per km is not
          published, EVORA derives it from battery size ÷ published range and labels the result as modelled —
          real-world range under load is usually lower.
        </Definition>
      </section>

      {selected && <ModelDetail key={selected.id} model={selected} ctx={ctx} usage={u} />}
      <CompareTable models={all} ctx={ctx} />
    </div>
  );
}

function DiscoverPage() {
  const navigate = useNavigate();
  const [vehicleId, setVehicleId] = useParam("vehicle");
  const vehicles = useResource(loadAllVehicles, ICE);
  const vehicle = vehicles.data?.vehicles.find((v) => v.id === vehicleId);

  return (
    <div className="ops-ws">
      <div className="ops-wshead">
        <div>
          <h2 className="ops-wshead__title">Discover &amp; Compare</h2>
          <p className="ops-wshead__desc">
            Pick one of your ICE vehicles. EVORA checks it against EV models from its catalogue and shows the cost
            implications — you never have to enter EV specifications.
          </p>
        </div>
        <div className="ops-wshead__actions">
          <button type="button" className="ops-btn ops-btn--ghost" onClick={() => navigate("/ev-migration/plan")}>My transition plan</button>
        </div>
      </div>
      <div className="intel-split">
        <VehicleList selectedId={vehicleId} onSelect={(v) => setVehicleId(v.id)} />
        {!vehicleId ? (
          <section className="ops-card intel-panel">
            <EmptyBlock title="Choose a vehicle to begin"
              text="Vehicles with predictable routes and recorded odometer history give the clearest results." />
          </section>
        ) : !vehicle ? (
          vehicles.data ? (
            <section className="ops-card"><EmptyBlock title="Vehicle not found" text="It may have been retired, sold or converted." /></section>
          ) : (
            <section className="ops-card"><Skeleton lines={8} /></section>
          )
        ) : (
          <VehicleWorkspace key={vehicle.id} vehicle={vehicle} />
        )}
      </div>
    </div>
  );
}

export default DiscoverPage;
