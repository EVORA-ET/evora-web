import { useState } from "react";
import { RotateCcw } from "lucide-react";

import {
  reproduceAssessment,
  type Assessment,
  type EmissionsResult,
  type KnownAssessment,
  type MaintenanceResult,
  type ReadinessResult,
  type ReproduceResult,
  type ResolvedInput,
  type TcoResult,
} from "../../lib/intelligenceApi";
import { errorMessage } from "../operations/hooks";
import { Pill } from "../operations/ui/Pill";
import { formatDay, formatKg, formatMoney, formatPct, formatStamp, formatValue, shortId } from "./format";
import {
  CHECK_LABEL,
  COVERAGE_DEFINITION,
  COVERAGE_NOTE,
  EVENT_TYPE_LABEL,
  SUPPLY_HINT,
  inputLabel,
} from "./labels";
import ProvenanceTable from "./ProvenanceTable";
import { CheckPill, CoverageBadge, Definition, Disclosure, OutcomePill, ServicePill } from "./ui";

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */

const KIND_TITLE: Record<Assessment["kind"], string> = {
  ev_readiness: "EV readiness screening",
  tco: "Total cost of ownership",
  emissions: "Operational emissions",
  maintenance_status: "Maintenance status",
};

export function MissingInputs({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  return (
    <div className="ops-callout ops-callout--warn" role="note">
      <strong>Missing critical inputs:</strong>
      <ul className="intel-notes" style={{ marginTop: 6 }}>
        {names.map((name) => (
          <li key={name}>
            <strong>{inputLabel(name)}</strong>
            {SUPPLY_HINT[name] ? ` — ${SUPPLY_HINT[name].text}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReproduceButton({ id }: { id: string }) {
  const [state, setState] = useState<
    { busy: boolean; result?: ReproduceResult; error?: string }
  >({ busy: false });

  const run = async () => {
    setState({ busy: true });
    try {
      setState({ busy: false, result: await reproduceAssessment(id) });
    } catch (error) {
      setState({ busy: false, error: errorMessage(error) });
    }
  };

  return (
    <span className="intel-row">
      <button type="button" className="ops-btn ops-btn--ghost ops-btn--sm" onClick={run} disabled={state.busy}>
        <RotateCcw size={14} /> {state.busy ? "Checking…" : "Recompute from snapshot"}
      </button>
      {state.result &&
        (state.result.result_matches && state.result.fingerprint_matches ? (
          <Pill tone="ok">Reproduced exactly</Pill>
        ) : (
          <Pill tone="danger">Does not match stored result</Pill>
        ))}
      {state.error && <span className="ops-muted">{state.error}</span>}
    </span>
  );
}

export function AssessmentHeader({ assessment }: { assessment: KnownAssessment }) {
  const vehicle = assessment.subject_snapshot.vehicle;
  const candidate = assessment.subject_snapshot.ev_candidate;
  return (
    <div className="intel-stack" style={{ gap: 10 }}>
      <div className="intel-result-head">
        <div>
          <h3>{KIND_TITLE[assessment.kind]}</h3>
          <p className="intel-sub">
            {[vehicle?.registration_number, candidate?.label].filter(Boolean).join(" → ") || "—"}
          </p>
        </div>
        <div className="intel-row">
          {assessment.kind === "ev_readiness" && <OutcomePill outcome={assessment.result.outcome} />}
          <CoverageBadge level={assessment.evidence_level} />
        </div>
      </div>
      <p className="intel-meta">
        <span>Assessed {formatStamp(assessment.created_at)}</span>
        <span>
          Method <span className="intel-mono">{assessment.method_version}</span>
        </span>
        <span>
          Fingerprint <span className="intel-mono">{shortId(assessment.fingerprint)}</span>
        </span>
        <span>Stored record; recalculation uses the frozen inputs below.</span>
      </p>
      <ReproduceButton id={assessment.id} />
    </div>
  );
}

export function CoverageExplain({
  assessment,
}: {
  assessment: Pick<KnownAssessment, "evidence_level" | "evidence_reasons">;
}) {
  return (
    <div>
      <div className="intel-row">
        <CoverageBadge level={assessment.evidence_level} />
        <span className="ops-muted">{COVERAGE_DEFINITION[assessment.evidence_level]}</span>
      </div>
      {assessment.evidence_reasons.length > 0 && (
        <ul className="intel-notes" style={{ marginTop: 6 }}>
          {assessment.evidence_reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
      <Definition>{COVERAGE_NOTE}</Definition>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Readiness                                                           */
/* ------------------------------------------------------------------ */

const GATE_VALUE_LABEL: Record<string, [string, string]> = {
  required_range_km: ["Required range", "km"],
  battery_energy_needed_kwh: ["Battery energy needed", "kWh"],
  usable_battery_kwh: ["Usable battery", "kWh"],
  margin_kwh: ["Margin", "kWh"],
  c_battery_kwh_per_km: ["Battery-side consumption", "kWh/km"],
  required_payload_kg: ["Required payload", "kg"],
  candidate_payload_kg: ["Candidate payload", "kg"],
  margin_kg: ["Margin", "kg"],
  daily_grid_energy_kwh: ["Daily grid energy", "kWh"],
  effective_power_kw: ["Effective power", "kW"],
  charging_hours: ["Charging time", "h"],
  charging_window_hours: ["Window", "h"],
  spare_hours: ["Spare", "h"],
  c_grid_kwh_per_km: ["Grid-side consumption", "kWh/km"],
};

export function ReadinessView({ result }: { result: ReadinessResult }) {
  return (
    <div className="intel-stack">
      <div className="intel-gates">
        {result.checks.map((check) => (
          <div key={check.check} className={`intel-gate intel-gate--${check.status}`}>
            <div className="intel-row intel-row--between">
              <h4>{CHECK_LABEL[check.check]} check</h4>
              <CheckPill status={check.status} />
            </div>
            <p>{check.explanation}</p>
            {Object.keys(check.values).length > 0 && (
              <dl>
                {Object.entries(check.values).map(([key, value]) => {
                  const [label, unit] = GATE_VALUE_LABEL[key] ?? [key, ""];
                  return (
                    <div key={key} style={{ display: "contents" }}>
                      <dt>{label}</dt>
                      <dd>{formatValue(value, unit, 3)}</dd>
                    </div>
                  );
                })}
              </dl>
            )}
          </div>
        ))}
      </div>
      <Definition>
        All three checks are mandatory. Any failed check makes the candidate not suitable,
        whatever its cost; any check that cannot be tested means no recommendation can be made.
        There is no weighted readiness score.
      </Definition>
      {result.warnings.length > 0 && (
        <div className="ops-callout ops-callout--warn">
          <ul className="intel-notes">
            {result.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      {result.rated_range_km !== null && (
        <p className="ops-muted" style={{ margin: 0 }}>
          Manufacturer-certified range: {formatValue(result.rated_range_km, "km")}. {result.rated_range_note}
        </p>
      )}
      <Disclosure title="Limitations of this screening">
        <ul className="intel-notes">
          {result.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </Disclosure>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* TCO                                                                 */
/* ------------------------------------------------------------------ */

const COST_LABEL: Record<string, string> = {
  energy: "Energy",
  maintenance: "Maintenance",
  insurance: "Insurance",
  fees: "Taxes & fees",
  downtime: "Downtime",
};

const SENS_LABEL: Record<string, string> = {
  annual_distance_km: "Annual distance",
  fuel_price_per_l: "Fuel price",
  fuel_economy_km_per_l: "Fuel economy",
  electricity_tariff_per_kwh: "Electricity tariff",
  ev_grid_kwh_per_km: "EV consumption",
  ev_purchase_price: "EV purchase price",
  discount_rate: "Discount rate",
};

function Money({ value, currency }: { value: number | null | undefined; currency: string }) {
  return <>{formatMoney(value, currency)}</>;
}

export function TcoView({
  result,
  parameters,
}: {
  result: TcoResult;
  parameters: Record<string, unknown>;
}) {
  if (result.status !== "ok") {
    return (
      <p className="ops-muted">
        No cost comparison could be calculated; the inputs listed as missing are required. Missing
        costs are never treated as zero.
      </p>
    );
  }
  const c = result.currency;
  const nps = result.net_present_savings;
  const categories = Array.from(
    new Set([...Object.keys(result.ice.annual_costs), ...Object.keys(result.ev.annual_costs)]),
  );
  const basis = String(parameters.discount_rate_basis ?? "real");

  return (
    <div className="intel-stack">
      <div className="intel-headline">
        <div>
          <span>Net present savings</span>
          <strong className={nps >= 0 ? "intel-pos" : "intel-neg"}>
            <Money value={nps} currency={c} />
          </strong>
          <small>{nps >= 0 ? "EV has the lower net present cost" : "ICE baseline has the lower net present cost"}</small>
        </div>
        <div>
          <span>NPC — ICE baseline</span>
          <strong><Money value={result.ice.net_present_cost} currency={c} /></strong>
        </div>
        <div>
          <span>NPC — EV</span>
          <strong><Money value={result.ev.net_present_cost} currency={c} /></strong>
        </div>
        <div>
          <span>Simple payback</span>
          <strong>
            {result.simple_payback_years === null ? "Not applicable" : `${result.simple_payback_years} yr`}
          </strong>
          <small>Undiscounted</small>
        </div>
        <div>
          <span>Discounted payback</span>
          <strong>
            {result.discounted_payback_years === null
              ? "Not reached"
              : `${result.discounted_payback_years} yr`}
          </strong>
          <small>Within {result.common.horizon_years} yr horizon</small>
        </div>
      </div>
      <Definition>
        Positive net present savings means the EV scenario has a lower net present cost than the ICE
        baseline over {result.common.horizon_years} years at a {formatPct(result.common.discount_rate)}{" "}
        {basis} discount rate and {formatValue(result.common.annual_distance_km, "km/yr")}.
        {result.simple_payback_years === null && ` Simple payback: ${result.simple_payback_note}`}
        {result.discounted_payback_years === null && ` Discounted payback: ${result.discounted_payback_note}`}
      </Definition>

      <div className="ops-table-scroll">
        <table className="intel-compare">
          <caption className="ops-sr-only">Scenario comparison</caption>
          <thead>
            <tr>
              <th scope="col">Per scenario</th>
              <th scope="col">ICE baseline</th>
              <th scope="col">EV</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Initial investment (year 0)</td>
              <td><Money value={result.ice.initial_investment} currency={c} /></td>
              <td><Money value={result.ev.initial_investment} currency={c} /></td>
            </tr>
            {result.ev.investment_breakdown && (
              <>
                <tr>
                  <td className="ops-muted">  EV purchase price</td>
                  <td />
                  <td><Money value={result.ev.investment_breakdown.purchase_price} currency={c} /></td>
                </tr>
                <tr>
                  <td className="ops-muted">  Charging infrastructure</td>
                  <td />
                  <td><Money value={result.ev.investment_breakdown.charging_infrastructure} currency={c} /></td>
                </tr>
                <tr>
                  <td className="ops-muted">  Verified incentives applied</td>
                  <td />
                  <td><Money value={result.ev.investment_breakdown.incentives_applied} currency={c} /></td>
                </tr>
              </>
            )}
            {categories.map((cat) => (
              <tr key={cat}>
                <td>{COST_LABEL[cat] ?? cat} (annual)</td>
                <td><Money value={result.ice.annual_costs[cat]} currency={c} /></td>
                <td><Money value={result.ev.annual_costs[cat]} currency={c} /></td>
              </tr>
            ))}
            <tr>
              <td>Annual operating total</td>
              <td><Money value={result.ice.annual_operating_total} currency={c} /></td>
              <td><Money value={result.ev.annual_operating_total} currency={c} /></td>
            </tr>
            <tr>
              <td>Residual value (end of horizon)</td>
              <td>{result.ice.residual_value === null ? "Not included" : <Money value={result.ice.residual_value} currency={c} />}</td>
              <td>{result.ev.residual_value === null ? "Not included" : <Money value={result.ev.residual_value} currency={c} />}</td>
            </tr>
            <tr>
              <td>Operating cost per km</td>
              <td>{formatMoney(result.ice.operating_cost_per_km, c, 2)}</td>
              <td>{formatMoney(result.ev.operating_cost_per_km, c, 2)}</td>
            </tr>
            <tr>
              <td>Levelised cost per km</td>
              <td>{formatMoney(result.ice.levelised_cost_per_km, c, 2)}</td>
              <td>{formatMoney(result.ev.levelised_cost_per_km, c, 2)}</td>
            </tr>
            <tr>
              <td>Energy per year</td>
              <td>{formatValue(result.ice.energy_quantity.fuel_l_per_year, "L")}</td>
              <td>{formatValue(result.ev.energy_quantity.grid_kwh_per_year, "kWh")}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td>Net present cost</td>
              <td><Money value={result.ice.net_present_cost} currency={c} /></td>
              <td><Money value={result.ev.net_present_cost} currency={c} /></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {(result.notes.length > 0 || result.excluded_categories.length > 0) && (
        <div className="ops-callout ops-callout--warn">
          <ul className="intel-notes">
            {result.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      <Disclosure title="Discounted cash flows" meta={`${result.common.horizon_years + 1} rows per scenario`}>
        {(["ice", "ev"] as const).map((side) => (
          <div key={side} style={{ marginTop: 8 }}>
            <p className="intel-card-title" style={{ marginBottom: 4 }}>
              {side === "ice" ? "ICE baseline" : "EV"}
            </p>
            <div className="ops-table-scroll">
              <table className="intel-compare">
                <thead>
                  <tr>
                    <th scope="col">Year</th>
                    <th scope="col">Investment</th>
                    <th scope="col">Operating</th>
                    <th scope="col">Residual credit</th>
                    <th scope="col">Discount factor</th>
                    <th scope="col">Discounted</th>
                  </tr>
                </thead>
                <tbody>
                  {result[side].cash_flows.map((row) => (
                    <tr key={row.year}>
                      <td>{row.year}</td>
                      <td>{formatMoney(row.investment, c)}</td>
                      <td>{formatMoney(row.operating, c)}</td>
                      <td>{formatMoney(row.residual_credit, c)}</td>
                      <td>{row.discount_factor.toFixed(4)}</td>
                      <td>{formatMoney(row.discounted_net_cost, c)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        <Definition>NPC = I₀ + Σ C/(1+r)ᵗ − R/(1+r)ᴺ. Costs are held flat in today&apos;s money (no escalation).</Definition>
      </Disclosure>

      {result.sensitivity && result.sensitivity.length > 0 && (
        <Disclosure title="Sensitivity (one input at a time)" defaultOpen>
          <div className="ops-table-scroll">
            <table className="intel-compare">
              <thead>
                <tr>
                  <th scope="col">Input</th>
                  <th scope="col">Low value</th>
                  <th scope="col">Savings at low</th>
                  <th scope="col">Savings at base</th>
                  <th scope="col">High value</th>
                  <th scope="col">Savings at high</th>
                </tr>
              </thead>
              <tbody>
                {result.sensitivity.map((row) => (
                  <tr key={row.input}>
                    <td>{SENS_LABEL[row.input] ?? row.input}</td>
                    <td>{formatValue(row.low_value, undefined, 4)}</td>
                    <td>{row.low_net_present_savings === null ? (row.low_error ?? "—") : formatMoney(row.low_net_present_savings, c)}</td>
                    <td>{formatMoney(row.base_net_present_savings, c)}</td>
                    <td>{formatValue(row.high_value, undefined, 4)}</td>
                    <td>{row.high_net_present_savings === null ? (row.high_error ?? "—") : formatMoney(row.high_net_present_savings, c)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Disclosure>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Emissions                                                           */
/* ------------------------------------------------------------------ */

export function EmissionsView({ result }: { result: EmissionsResult }) {
  if (result.status !== "ok" || !result.baseline || !result.ev) {
    return <p className="ops-muted">No emissions comparison could be calculated from the available factors.</p>;
  }
  return (
    <div className="intel-stack">
      <div className="intel-headline">
        <div>
          <span>ICE baseline</span>
          <strong>{formatKg(result.baseline.kgco2e_per_year)}</strong>
          <small>per year · {result.baseline.boundary.replace(/_/g, " ")}</small>
        </div>
        <div>
          <span>EV (electricity)</span>
          <strong>{formatKg(result.ev.kgco2e_per_year)}</strong>
          <small>per year · {result.ev.boundary.replace(/_/g, " ")}</small>
        </div>
        <div>
          <span>Difference</span>
          <strong>{formatKg(result.reduction_kgco2e_per_year ?? null)}</strong>
          <small>{formatPct(result.reduction_fraction ?? null)} of baseline</small>
        </div>
      </div>
      <Definition>
        {result.ev.note} Comparison boundary: <strong>{result.comparison_boundary}</strong>.{" "}
        {result.comparison_note} Excluded: {(result.excluded ?? []).join(", ")}.
      </Definition>
      <div className="ops-table-scroll">
        <table className="intel-compare">
          <thead>
            <tr>
              <th scope="col">Basis</th>
              <th scope="col">Energy per year</th>
              <th scope="col">Factor</th>
              <th scope="col">Emissions per year</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>ICE fuel</td>
              <td>{formatValue(result.baseline.fuel_l_per_year, "L")}</td>
              <td>{formatValue(result.baseline.factor_kgco2e_per_l, "kgCO₂e/L", 4)}</td>
              <td>{formatKg(result.baseline.kgco2e_per_year)}</td>
            </tr>
            <tr>
              <td>EV grid electricity</td>
              <td>{formatValue(result.ev.grid_kwh_per_year, "kWh")}</td>
              <td>{formatValue(result.ev.factor_kgco2e_per_kwh, "kgCO₂e/kWh", 4)}</td>
              <td>{formatKg(result.ev.kgco2e_per_year)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Maintenance                                                         */
/* ------------------------------------------------------------------ */

export function MaintenanceView({ result }: { result: MaintenanceResult }) {
  return (
    <div className="intel-stack">
      <div className="intel-headline">
        <div><span>Overdue</span><strong>{result.counts.overdue}</strong></div>
        <div><span>Due soon</span><strong>{result.counts.due_soon}</strong></div>
        <div><span>Undetermined</span><strong>{result.counts.undetermined}</strong></div>
        <div><span>Open faults</span><strong>{result.counts.open_faults}</strong></div>
      </div>
      {result.service_requirements.length > 0 && (
        <div className="ops-table-scroll">
          <table className="ops-table">
            <thead>
              <tr>
                <th scope="col">Requirement</th>
                <th scope="col">Status</th>
                <th scope="col">Time</th>
                <th scope="col">Distance</th>
              </tr>
            </thead>
            <tbody>
              {result.service_requirements.map((s) => (
                <tr key={s.requirement_id}>
                  <td>
                    {s.name}
                    <small className="ops-muted" style={{ display: "block" }}>{s.source?.title}</small>
                  </td>
                  <td><ServicePill status={s.status} /></td>
                  <td>
                    {s.dimensions.time
                      ? s.dimensions.time.due_date
                        ? `Due ${formatDay(s.dimensions.time.due_date)}`
                        : s.dimensions.time.reason
                      : "—"}
                  </td>
                  <td>
                    {s.dimensions.distance
                      ? s.dimensions.distance.status === "undetermined"
                        ? s.dimensions.distance.reason
                        : `${formatValue(s.dimensions.distance.km_remaining, "km")} left`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {result.messages.length > 0 && (
        <ul className="intel-notes">
          {result.messages.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
      <Definition>{result.predictive_assessment.reason}</Definition>
      {Object.keys(result.records.events_by_type).length > 0 && (
        <p className="ops-muted" style={{ margin: 0 }}>
          Records {formatDay(result.records.window.start)} – {formatDay(result.records.window.end)}:{" "}
          {Object.entries(result.records.events_by_type)
            .map(([type, n]) => `${n} ${EVENT_TYPE_LABEL[type] ?? type}`)
            .join(", ")}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Incentives (TCO snapshot context)                                   */
/* ------------------------------------------------------------------ */

interface IncentiveRow {
  observation_id: string;
  name: string;
  amount: number;
  included: boolean;
  reason: string;
}

function isIncentive(value: unknown): value is IncentiveRow {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.amount === "number" && typeof v.included === "boolean";
}

function Incentives({ assessment }: { assessment: KnownAssessment }) {
  if (assessment.kind !== "tco") return null;
  const raw = assessment.input_snapshot.context.incentives;
  const rows = Array.isArray(raw) ? raw.filter(isIncentive) : [];
  const currency = typeof assessment.input_snapshot.context.currency === "string"
    ? assessment.input_snapshot.context.currency : null;
  return (
    <Disclosure title="Incentives considered" meta={rows.length ? `${rows.length} recorded` : "none recorded"}>
      {rows.length === 0 ? (
        <p className="ops-muted" style={{ margin: 0 }}>No incentives were recorded for this candidate.</p>
      ) : (
        <ul className="ops-rows">
          {rows.map((r) => (
            <li key={r.observation_id}>
              <div className="ops-rowbtn" style={{ cursor: "default" }}>
                <span className="ops-list__main">
                  <strong>{r.name || "Incentive"} · {formatMoney(r.amount, currency)}</strong>
                  <small>{r.included ? "Included: verified source, in force." : `Not included: ${r.reason}`}</small>
                </span>
                <Pill tone={r.included ? "ok" : "warn"}>{r.included ? "Included" : "Excluded"}</Pill>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Definition>Only incentives whose source has been verified and that are in force are applied.</Definition>
    </Disclosure>
  );
}

/* ------------------------------------------------------------------ */
/* Dispatcher                                                          */
/* ------------------------------------------------------------------ */

function inputsOf(assessment: Pick<KnownAssessment, "input_snapshot">): ResolvedInput[] {
  return Object.values(assessment.input_snapshot.inputs ?? {});
}

export function AssessmentBody({ assessment }: { assessment: KnownAssessment }) {
  return (
    <div className="intel-stack">
      <AssessmentHeader assessment={assessment} />
      <MissingInputs names={assessment.missing_inputs} />
      {assessment.warnings.length > 0 && (
        <div className="ops-callout ops-callout--warn">
          <ul className="intel-notes">
            {assessment.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      {assessment.kind === "ev_readiness" && <ReadinessView result={assessment.result} />}
      {assessment.kind === "tco" && (
        <TcoView result={assessment.result} parameters={assessment.parameters} />
      )}
      <Incentives assessment={assessment} />
      {assessment.kind === "emissions" && <EmissionsView result={assessment.result} />}
      {assessment.kind === "maintenance_status" && <MaintenanceView result={assessment.result} />}
      <section className="ops-section">
        <div className="ops-section__head">
          <h3>Evidence coverage</h3>
        </div>
        <CoverageExplain assessment={assessment} />
      </section>
      <Disclosure title="Inputs and provenance" meta={`${inputsOf(assessment).length} inputs`} defaultOpen>
        <ProvenanceTable inputs={inputsOf(assessment)} caption="Assessment inputs" />
      </Disclosure>
      <Disclosure title="Parameters used">
        <dl className="ops-deflist">
          {Object.entries(assessment.parameters).map(([key, value]) => (
            <div key={key} className="ops-deflist__row">
              <dt>{key.replace(/_/g, " ")}</dt>
              <dd>{String(value)}</dd>
            </div>
          ))}
        </dl>
      </Disclosure>
    </div>
  );
}
