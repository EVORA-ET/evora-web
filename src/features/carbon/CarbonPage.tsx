import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Download, Info, Leaf, Lightbulb, Sparkles } from "lucide-react";

import {
  downloadCarbonReport,
  getFootprint,
  type CarbonParams,
  type Footprint,
  type FuelBoundary,
  type GridBoundary,
  type Scenario,
} from "../../lib/carbonApi";
import { getMigrationOverview } from "../../lib/intelligenceApi";
import { OperationsProvider } from "../operations/OperationsProvider";
import { errorMessage, useResource } from "../operations/hooks";
import { useOps } from "../operations/useOps";
import { Pill } from "../operations/ui/Pill";
import { ErrorBlock, Skeleton } from "../operations/ui/states";
import { SERIES } from "../intelligence/chartColors";
import { ColumnChart, PairedBars, ProgressMeter, SplitBar } from "../intelligence/charts";
import { formatDay } from "../intelligence/format";
import { Definition, Disclosure, Segmented } from "../intelligence/ui";
import "../operations/operations.css";
import "../intelligence/intel.css";
import "../intelligence/charts.css";
import "./carbon.css";

type Preset = "3m" | "6m" | "12m" | "ytd";
const PRESETS: { value: Preset; label: string }[] = [
  { value: "3m", label: "3 months" },
  { value: "6m", label: "6 months" },
  { value: "12m", label: "12 months" },
  { value: "ytd", label: "This year" },
];

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Whole calendar months ending with the current month (to date). */
function periodOf(p: Preset): { start: string; end: string } {
  const today = new Date();
  const back = p === "3m" ? 2 : p === "6m" ? 5 : 11;
  const start = p === "ytd" ? new Date(today.getFullYear(), 0, 1) : new Date(today.getFullYear(), today.getMonth() - back, 1);
  return { start: iso(start), end: iso(today) };
}

function formatCo2(kg: number | null | undefined): string {
  if (kg === null || kg === undefined) return "—";
  const abs = Math.abs(kg);
  if (abs >= 1000) return `${(kg / 1000).toLocaleString(undefined, { maximumFractionDigits: abs >= 100000 ? 0 : 2 })} t CO₂e`;
  return `${kg.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg CO₂e`;
}

const OVERVIEW = "overview";
const loadOverview = () => getMigrationOverview();

/* ------------------------------------------------------------------ */

function Hero({ fp }: { fp: Footprint }) {
  const navigate = useNavigate();
  const t = fp.totals;
  const cov = fp.coverage;
  const prev = fp.previous;
  if (fp.status !== "ok") {
    return (
      <section className="carbon-hero carbon-hero--setup" aria-labelledby="cb-hero">
        <div>
          <span className="intel-hero__eyebrow"><Leaf size={15} aria-hidden="true" /> Your fleet's footprint</span>
          <h2 id="cb-hero">Your footprint can't be calculated reliably yet.</h2>
          <p>
            EVORA calculates emissions from the fuel and charging your vehicles actually used, multiplied by emission
            factors your organisation records with their source. For {formatDay(fp.period.start)} – {formatDay(fp.period.end)} it needs:
          </p>
          <ul className="carbon-needs">
            {fp.missing.includes("fuel_emission_factor_kgco2e_per_l") && (
              <li><strong>A fuel emission factor</strong> (diesel or petrol, kg CO₂e per litre) from a published source.</li>
            )}
            {fp.missing.includes("grid_emission_factor_kgco2e_per_kwh") && (
              <li><strong>A grid emission factor</strong> (kg CO₂e per kWh) for charging your EVs.</li>
            )}
            {cov.records_counted === 0 && (
              <li><strong>Fuel or charging records</strong> for the period — litres per fill, kWh per charge.</li>
            )}
            {cov.records_excluded.map((e) => <li key={e.reason}>{e.records} record(s) skipped: {e.reason}.</li>)}
          </ul>
          <div className="intel-row">
            <button type="button" className="ops-btn ops-btn--primary intel-hero__cta" onClick={() => navigate("/ev-migration/data")}>
              Add factors and records <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>
    );
  }
  const down = prev.comparable && (prev.change_kgco2e ?? 0) < 0;
  return (
    <section className="carbon-hero" aria-labelledby="cb-hero">
      <div className="carbon-hero__main">
        <span className="intel-hero__eyebrow"><Leaf size={15} aria-hidden="true" /> {formatDay(fp.period.start)} – {formatDay(fp.period.end)}</span>
        <h2 id="cb-hero" className="carbon-hero__label">Your fleet's estimated emissions this period</h2>
        <p className="carbon-hero__value">{formatCo2(t.kgco2e)}</p>
        <p className="carbon-hero__scope">{fp.boundary.label} · lifecycle (vehicle and battery manufacturing) not included</p>
        {prev.comparable && prev.change_kgco2e !== null ? (
          <p className={`carbon-delta ${down ? "carbon-delta--down" : "carbon-delta--up"}`}>
            {down ? <ArrowDownRight size={17} aria-hidden="true" /> : <ArrowUpRight size={17} aria-hidden="true" />}
            {formatCo2(Math.abs(prev.change_kgco2e))} ({Math.abs(prev.change_pct ?? 0).toFixed(1)}%) {down ? "lower" : "higher"} than {formatDay(prev.period.start)} – {formatDay(prev.period.end)}
            <span>
              {down
                ? "Your recorded emissions are lower than the previous comparable period."
                : "Recorded emissions rose against the previous comparable period — compare monthly activity below to see where."}
            </span>
          </p>
        ) : (
          <p className="carbon-delta carbon-delta--none">
            No like-for-like comparison with the previous period: {prev.reasons.join(" ")}
          </p>
        )}
      </div>
      <div className="carbon-hero__side">
        <div className="carbon-split">
          <div><span>Fuel (ICE)</span><strong>{formatCo2(t.fuel_kgco2e)}</strong><small>{t.fuel_litres?.toLocaleString()} L</small></div>
          <div><span>Electricity (EV)</span><strong>{t.electricity_kgco2e === null ? "None recorded" : formatCo2(t.electricity_kgco2e)}</strong><small>{t.electricity_kwh ? `${t.electricity_kwh.toLocaleString()} kWh` : "no charging records"}</small></div>
        </div>
        <div className="carbon-coverage">
          <ProgressMeter label="Vehicles with records in the period" color="#a8cfb8"
            value={cov.vehicles_in_service ? (100 * cov.reporting_vehicles) / cov.vehicles_in_service : null}
            valueText={`${cov.reporting_vehicles} of ${cov.vehicles_in_service}`} />
          <small>
            Vehicles without fuel or charging records are not included — their emissions are unknown, not zero.
            {cov.records_excluded.length > 0 && ` ${cov.records_excluded.reduce((s, e) => s + e.records, 0)} record(s) could not be converted.`}
          </small>
        </div>
      </div>
    </section>
  );
}

function Trend({ fp }: { fp: Footprint }) {
  const withData = fp.months.filter((m) => m.kgco2e !== null);
  const label = (m: string) => {
    const [y, mo] = m.split("-").map(Number);
    return new Date(y, mo - 1, 1).toLocaleDateString(undefined, { month: "short", year: fp.months.length > 12 ? "2-digit" : undefined });
  };
  return (
    <section className="ops-card intel-panel" aria-labelledby="cb-trend">
      <div className="ops-card__head">
        <div>
          <h2 id="cb-trend">Emissions over time</h2>
          <p className="ops-card__sub">Per calendar month · {fp.boundary.label} · kg CO₂e</p>
        </div>
      </div>
      {withData.length < 2 ? (
        <div className="intel-setup">
          <p className="intel-setup__lead">Not enough history for a trend yet.</p>
          <p className="ops-muted">
            {withData.length === 1 ? `Only ${label(withData[0].month)} has converted records in this period.` : "No month in this period has converted records."}{" "}
            A trend appears once two or more months have fuel or charging records.
          </p>
        </div>
      ) : (
        <ColumnChart label="Estimated emissions per month (kg CO₂e)" height={250} width={560}
          categories={fp.months.map((m) => label(m.month))}
          series={[
            { key: "fuel", label: "Fuel (ICE)", color: SERIES.ice, values: fp.months.map((m) => m.fuel_kgco2e) },
            { key: "ev", label: "Electricity (EV)", color: SERIES.ev, values: fp.months.map((m) => m.electricity_kgco2e) },
          ]}
          format={formatCo2} />
      )}
      <Definition>
        Every month uses the same emission factors (in force on {formatDay(fp.factors.as_of)}), so changes reflect recorded
        activity rather than factor updates. Months without records show as no data.
      </Definition>
    </section>
  );
}

function progressMessage(c: Footprint["composition"], target: number | null): { title: string; text: string } {
  const share = c.ev_share_pct;
  if (c.ice + c.ev === 0) return { title: "Add your vehicles to see your progress.", text: "Fleet composition comes from your vehicles in Operations." };
  if (c.ev === 0) return { title: "Your electrification journey starts here.", text: `All ${c.ice} classified vehicles run on fuel today.` };
  if (c.ice === 0) return { title: "Your recorded fleet is fully electric.", text: `All ${c.ev} classified vehicles are electric.` };
  if (target !== null && share !== null && share >= target) return { title: "You've reached your transition target.", text: `${share}% of your classified fleet is electric, meeting your ${target}% goal.` };
  if (share !== null && share >= 50) return { title: share === 50 ? "Half of your recorded fleet is now electric." : "Most of your recorded fleet is now electric.", text: `${c.ev} electric and ${c.ice} ICE vehicles.` };
  return {
    title: "You've taken the first step towards a cleaner fleet.",
    text: target !== null ? `${share}% electric today, working towards ${target}%.` : `${c.ev} of ${c.ev + c.ice} classified vehicles are electric.`,
  };
}

function Progress({ fp, target }: { fp: Footprint; target: number | null }) {
  const c = fp.composition;
  const msg = progressMessage(c, target);
  return (
    <section className="ops-card intel-panel" aria-labelledby="cb-prog">
      <div className="ops-card__head"><h2 id="cb-prog">Electrification progress</h2></div>
      <p className="carbon-msg"><Sparkles size={16} aria-hidden="true" /> <span><strong>{msg.title}</strong> {msg.text}</span></p>
      <SplitBar label="Fleet composition" height={30} segments={[
        { key: "ice", label: "ICE", value: c.ice, color: SERIES.ice },
        { key: "ev", label: "EV", value: c.ev, color: SERIES.ev },
        ...(c.unclassified ? [{ key: "u", label: "Unclassified", value: c.unclassified, color: SERIES.unknown }] : []),
      ]} />
      {target !== null && (
        <div style={{ marginTop: 14 }}>
          <ProgressMeter label="Towards your transition target" value={c.ev_share_pct}
            valueText={`${c.ev_share_pct ?? 0}% of ${target}%`} target={target} />
        </div>
      )}
      <Definition>
        Composition counts vehicles recorded as electric today; planned replacements are not counted. The share of
        electric vehicles is not an emissions figure — reductions depend on how far each vehicle drives and on the
        electricity behind it.
      </Definition>
    </section>
  );
}

function ScenarioSection({ sc, fp, share, setShare }: { sc: Scenario; fp: Footprint; share: number; setShare: (n: number) => void }) {
  const navigate = useNavigate();
  const chosen = sc.shares.find((s) => s.share_pct === share) ?? sc.shares[sc.shares.length - 1];
  return (
    <section className="ops-card intel-panel carbon-scenario" aria-labelledby="cb-sc">
      <div className="ops-card__head">
        <div>
          <h2 id="cb-sc">Imagine what the next stage of electrification could achieve</h2>
          <p className="ops-card__sub">Explore how transitioning more of your fleet could change its estimated emissions.</p>
        </div>
        <Pill tone="info">Modelled estimate</Pill>
      </div>
      {sc.status !== "ok" || !chosen ? (
        <div className="intel-setup">
          <p className="intel-setup__lead">A scenario can't be modelled yet.</p>
          <p className="ops-muted">{sc.reason}</p>
          {sc.skipped && sc.skipped.length > 0 && (
            <ul className="intel-notes">{sc.skipped.map((s) => <li key={s.reason}>{s.vehicles} vehicle(s): {s.reason}.</li>)}</ul>
          )}
          <button type="button" className="ops-btn ops-btn--secondary ops-btn--sm" style={{ marginTop: 10 }} onClick={() => navigate("/ev-migration/discover")}>
            Check vehicles in Discover &amp; Compare <ArrowRight size={14} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <>
          <div className="carbon-scenario__controls">
            <span className="ops-muted">Share of eligible vehicles' activity moved to their assessed EV model</span>
            <Segmented label="Electrification scenario" value={String(share)} onChange={(v) => setShare(Number(v))}
              options={sc.shares.map((s) => ({ value: String(s.share_pct), label: `${s.share_pct}%` }))} />
          </div>
          <div className="intel-figures">
            <div><span>Current estimated emissions</span><strong>{formatCo2(fp.totals.kgco2e)}</strong><small>recorded activity, this period</small></div>
            <div><span>Modelled emissions</span><strong>{formatCo2(chosen.modelled_kgco2e)}</strong><small>with {chosen.share_pct}% of eligible activity electric</small></div>
            <div className="intel-figure--good">
              <span>Potential reduction</span>
              <strong>{formatCo2(chosen.reduction_kgco2e)}</strong>
              <small>{chosen.reduction_pct !== null ? `${chosen.reduction_pct}% of this period's footprint` : ""}</small>
            </div>
          </div>
          <PairedBars label="Current vs modelled emissions" format={formatCo2}
            a={{ label: "Current (recorded)", color: SERIES.ice }} b={{ label: `Scenario (${chosen.share_pct}%)`, color: SERIES.ev }}
            rows={[{ label: "Fleet emissions this period", a: fp.totals.kgco2e, b: chosen.modelled_kgco2e }]} />
          <Disclosure title="Assumptions behind this estimate" meta={`${sc.eligible_vehicles} of ${sc.ice_vehicles} ICE vehicles eligible`}>
            <div className="ops-table-scroll">
              <table className="ops-table">
                <caption className="ops-sr-only">Scenario assumptions per vehicle</caption>
                <thead>
                  <tr>
                    <th scope="col">Vehicle</th>
                    <th scope="col">Distance (period)</th>
                    <th scope="col">ICE emissions</th>
                    <th scope="col">EV model</th>
                    <th scope="col">EV electricity</th>
                    <th scope="col">EV emissions</th>
                  </tr>
                </thead>
                <tbody>
                  {sc.vehicles.map((v) => (
                    <tr key={v.vehicle_id}>
                      <td>{v.registration_number}</td>
                      <td>{v.distance_km.toLocaleString()} km<small className="ops-muted" style={{ display: "block" }}>{v.distance_note}{v.distance_basis === "organization_provided" ? " · organisation-provided" : ""}</small></td>
                      <td>{formatCo2(v.ice_kgco2e)}<small className="ops-muted" style={{ display: "block" }}>{v.litres.toLocaleString()} L recorded</small></td>
                      <td>{v.ev_model}<small className="ops-muted" style={{ display: "block" }}>{v.ev_grid_kwh_per_km} kWh/km{v.ev_consumption_source === "derived_from_rated_range" ? " (derived from published range)" : ""}</small></td>
                      <td>{v.ev_kwh.toLocaleString()} kWh</td>
                      <td>{formatCo2(v.ev_kgco2e)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="intel-notes" style={{ marginTop: 10 }}>
              <li>Grid factor: {sc.grid_factor ? `${sc.grid_factor.value} ${sc.grid_factor.unit}` : "—"}{sc.grid_factor?.source ? ` (${sc.grid_factor.source.title})` : ""}. EVs are not treated as zero-emission.</li>
              <li>Eligible = ICE vehicles with fuel records in the period and an EV model that met every readiness check.</li>
              {(sc.skipped ?? []).map((s) => <li key={s.reason}>Not modelled: {s.vehicles} vehicle(s) — {s.reason}.</li>)}
            </ul>
          </Disclosure>
          <Definition>{sc.definition}</Definition>
        </>
      )}
    </section>
  );
}

function Insights({ fp }: { fp: Footprint }) {
  const notes: string[] = [];
  const cov = fp.coverage;
  if (fp.status === "ok" && cov.reporting_vehicles < cov.vehicles_in_service) {
    notes.push(`${cov.vehicles_in_service - cov.reporting_vehicles} vehicle(s) have no fuel or charging records this period. More complete records make the footprint more reliable.`);
  }
  if (fp.boundary.fuel === "tank_to_wheel") {
    notes.push("This boundary counts tailpipe emissions for fuel. Electrifying a vehicle removes its tailpipe emissions; the overall benefit also depends on the electricity source and the comparison boundary.");
  } else {
    notes.push("Well-to-wheel includes emissions from producing and delivering fuel and electricity — the closest like-for-like comparison available here.");
  }
  if (fp.scenario.status === "ok") notes.push("The scenario replays this period's recorded activity on assessed EV models. It is a modelled estimate, not a measured or guaranteed reduction.");
  if (cov.records_excluded.length > 0) notes.push(`Some records could not be converted: ${cov.records_excluded.map((e) => e.reason).join("; ")}.`);
  return (
    <section className="carbon-insights" aria-labelledby="cb-ins">
      <h2 id="cb-ins"><Lightbulb size={17} aria-hidden="true" /> What this means</h2>
      <ul>{notes.slice(0, 3).map((n) => <li key={n}>{n}</li>)}</ul>
    </section>
  );
}

function CarbonContent() {
  const { toast } = useOps();
  const [preset, setPreset] = useState<Preset>("12m");
  const [boundary, setBoundary] = useState<`${FuelBoundary}|${GridBoundary}`>("tank_to_wheel|generation");
  const [share, setShare] = useState(50);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const params: CarbonParams = useMemo(() => {
    const [fuel_boundary, grid_boundary] = boundary.split("|") as [FuelBoundary, GridBoundary];
    return { ...periodOf(preset), fuel_boundary, grid_boundary };
  }, [preset, boundary]);
  const fp = useResource(getFootprint, params);
  const overview = useResource(loadOverview, OVERVIEW);
  const d = fp.data;

  const download = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const name = await downloadCarbonReport({ ...params, scenario_pct: share });
      toast.success(`Report downloaded: ${name}`);
    } catch (e) {
      setDownloadError(errorMessage(e, "The report could not be generated."));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="ops">
      <header className="ops-head carbon-head">
        <div>
          <h1 className="ops-head__title">Carbon Footprints &amp; Reports</h1>
          <p className="ops-head__desc">
            Measure your fleet's environmental impact, celebrate your progress, and discover the potential of a cleaner fleet.
          </p>
        </div>
        <div className="carbon-head__controls">
          <Segmented label="Reporting period" value={preset} onChange={setPreset} options={PRESETS} />
          <button type="button" className="ops-btn ops-btn--primary" onClick={() => void download()} disabled={downloading || !d}>
            <Download size={16} aria-hidden="true" /> {downloading ? "Preparing PDF…" : "Download Report"}
          </button>
        </div>
      </header>
      {downloadError && <p className="ops-callout ops-callout--danger" role="alert">{downloadError}</p>}

      <div className="ops-content intel-stack">
        {d && d.boundaries.length > 0 && (
          <div className="carbon-boundary">
            <label htmlFor="cb-boundary" className="ops-muted">Emissions boundary</label>
            <select id="cb-boundary" className="carbon-boundary__select" value={boundary}
              onChange={(e) => setBoundary(e.target.value as `${FuelBoundary}|${GridBoundary}`)}>
              {d.boundaries.map((b) => (
                <option key={`${b.fuel_boundary}|${b.grid_boundary}`} value={`${b.fuel_boundary}|${b.grid_boundary}`}>
                  {b.label}{b.fuel_factors.length === 0 && !b.grid_factor ? " (no factors recorded)" : ""}
                </option>
              ))}
            </select>
            <span className="ops-muted carbon-boundary__note"><Info size={14} aria-hidden="true" /> {d.boundary.explanation}</span>
          </div>
        )}

        {fp.error && !d ? (
          <ErrorBlock message={fp.error} onRetry={fp.reload} />
        ) : !d ? (
          <>
            <section className="ops-card"><Skeleton lines={4} /></section>
            <section className="ops-card"><Skeleton lines={6} /></section>
          </>
        ) : (
          <div className={fp.loading ? "carbon-refreshing intel-stack" : "intel-stack"}>
            <Hero fp={d} />
            <div className="intel-grid-2 carbon-grid">
              <Trend fp={d} />
              <Progress fp={d} target={overview.data?.target?.ev_share_pct ?? null} />
            </div>
            <ScenarioSection sc={d.scenario} fp={d} share={share} setShare={setShare} />
            <Insights fp={d} />
            <Definition>{d.definition} Method {d.method_version}.</Definition>
          </div>
        )}
      </div>
    </div>
  );
}

function CarbonPage() {
  return (
    <OperationsProvider>
      <CarbonContent />
    </OperationsProvider>
  );
}

export default CarbonPage;
