import { useNavigate } from "react-router-dom";
import { ArrowRight, Info, Sparkles } from "lucide-react";

import {
  getMigrationOverview,
  getRecordedCosts,
  type MigrationOverview,
  type RecordedCosts,
} from "../../lib/intelligenceApi";
import { useResource } from "../operations/hooks";
import { ErrorBlock, Skeleton } from "../operations/ui/states";
import { SERIES } from "../intelligence/chartColors";
import { ColumnChart, ProgressMeter, SplitBar } from "../intelligence/charts";
import { formatDay, formatMoney } from "../intelligence/format";
import { Definition, Disclosure } from "../intelligence/ui";

const COSTS = { months: 12, powertrain: "ice" as const };
const OVERVIEW = "overview";
const loadOverview = () => getMigrationOverview();

interface Message {
  title: string;
  text: string;
}

/** The headline message, derived only from recorded fleet composition and plan statuses. */
function journeyMessage(o: MigrationOverview): Message {
  const { ev, ice, unclassified, total, ev_share_pct } = o.composition;
  const unc = unclassified ? ` ${unclassified} vehicle(s) have fuel type "other" and are not counted either way.` : "";
  if (total === 0) {
    return { title: "Add your fleet to begin", text: "No vehicles are recorded yet. Add them in Operations and EVORA will map your transition from there." };
  }
  if (ev === 0) {
    return {
      title: "Your EV transition journey starts here.",
      text: `Your recorded fleet is 100% ICE (${ice} vehicle${ice === 1 ? "" : "s"}). Let's discover which vehicles could transition to electric first.${unc}`,
    };
  }
  if (ice === 0) {
    return { title: "Your recorded fleet is fully electric.", text: `All ${ev} classified vehicles are recorded as electric.${unc}` };
  }
  const share = ev_share_pct ?? 0;
  if (share >= 50) {
    return {
      title: share === 50 ? "You're halfway towards an all-electric fleet." : "You're past the halfway mark.",
      text: `${share}% of your classified fleet is electric. Let's assess the remaining ${ice} ICE vehicle${ice === 1 ? "" : "s"} and plan the next stage.${unc}`,
    };
  }
  return {
    title: "You've already taken the first step.",
    text: `${share}% of your classified fleet is electric (${ev} of ${ev + ice}). Let's identify the next opportunities among your ${ice} ICE vehicles.${unc}`,
  };
}

interface Action {
  label: string;
  text: string;
  to: string;
}

/** The single most useful next step for the recorded state. */
function nextAction(o: MigrationOverview): Action | null {
  const r = o.ice_readiness;
  const items = o.plan_items;
  const planned = (items.planned ?? 0) + (items.in_progress ?? 0) + (items.deferred ?? 0);
  if (r.vehicles === 0) return null;
  if (planned > 0) {
    return { label: "Continue your transition plan", text: `${planned} vehicle${planned === 1 ? " is" : "s are"} planned or in progress.`, to: "/ev-migration/plan" };
  }
  if (r.meets_requirements > 0) {
    return {
      label: "Review EV recommendations",
      text: `${r.meets_requirements} vehicle${r.meets_requirements === 1 ? "" : "s"} met every readiness check for at least one EV model. Compare costs and add them to a plan.`,
      to: "/ev-migration/discover?state=meets_requirements",
    };
  }
  if (r.needs_evidence > 0) {
    return {
      label: "Complete the missing information",
      text: `${r.needs_evidence} assessed vehicle${r.needs_evidence === 1 ? " needs" : "s need"} more information before EVORA can decide.`,
      to: "/ev-migration/discover?state=needs_evidence",
    };
  }
  return {
    label: "Discover EV opportunities",
    text: "Pick an ICE vehicle and EVORA will check it against EV models from its catalogue.",
    to: "/ev-migration/discover",
  };
}

function CostBaseline({ costs }: { costs: RecordedCosts }) {
  const c = costs.currency;
  const fuel = costs.categories.fuel;
  const maint = costs.categories.maintenance;
  const anyCost = fuel.total !== null || maint.total !== null;
  const recordedTotal = anyCost ? (fuel.total ?? 0) + (maint.total ?? 0) : null;
  const est = costs.vehicle_record_estimates;
  const missing = fuel.without_cost + maint.without_cost;
  const label = (m: string) => {
    const [y, mo] = m.split("-").map(Number);
    return new Date(y, mo - 1, 1).toLocaleDateString(undefined, { month: "short" });
  };

  return (
    <section className="ops-card intel-panel" aria-labelledby="mo-cost">
      <div className="ops-card__head">
        <div>
          <h2 id="mo-cost">What your ICE fleet costs today</h2>
          <p className="ops-card__sub">
            Recorded costs, {formatDay(costs.window.start)} – {formatDay(costs.window.end)} · {costs.vehicles_in_scope} ICE vehicles · {c}
          </p>
        </div>
      </div>
      {!anyCost ? (
        <div className="intel-setup">
          <p className="intel-setup__lead">No costed fuel or maintenance records yet.</p>
          <p className="ops-muted">
            A cost baseline comes from fuel records with an amount and maintenance events with a cost. EVORA can
            already check readiness without them; cost comparisons then rely on prices and figures you record.
          </p>
          {(fuel.records > 0 || maint.records > 0) && (
            <p className="ops-muted">{fuel.records + maint.records} record(s) exist but none carries a cost.</p>
          )}
        </div>
      ) : (
        <>
          <div className="intel-figures">
            <div>
              <span>Recorded fuel spend</span>
              <strong>{fuel.total === null ? "None recorded" : formatMoney(fuel.total, c)}</strong>
              <small>{fuel.with_cost} record(s) · {fuel.vehicles_with_cost} vehicle(s){fuel.without_cost ? ` · ${fuel.without_cost} without cost` : ""}</small>
            </div>
            <div>
              <span>Recorded maintenance spend</span>
              <strong>{maint.total === null ? "None recorded" : formatMoney(maint.total, c)}</strong>
              <small>{maint.with_cost} event(s) · {maint.vehicles_with_cost} vehicle(s){maint.without_cost ? ` · ${maint.without_cost} without cost` : ""}</small>
            </div>
            <div>
              <span>Recorded total, last {costs.window.months} months</span>
              <strong>{recordedTotal === null ? "—" : formatMoney(recordedTotal, c)}</strong>
              <small>{missing ? "Partial: some records have no cost" : "Sum of costed records only"}</small>
            </div>
          </div>
          <ColumnChart
            label={`Recorded ICE fuel and maintenance cost per month (${c})`}
            categories={costs.months.map((m) => label(m.month))}
            series={[
              { key: "fuel", label: "Fuel", color: SERIES.ice, values: costs.months.map((m) => m.fuel) },
              { key: "maintenance", label: "Maintenance", color: SERIES.maintenance, values: costs.months.map((m) => m.maintenance) },
            ]}
            format={(n) => formatMoney(n, c)} />
        </>
      )}
      {(est.fuel_cost_per_month.sum_per_month !== null || est.maintenance_cost_per_month.sum_per_month !== null) && (
        <Disclosure title="Monthly figures typed on vehicle records" meta="organization-provided, not recorded spend">
          <dl className="ops-deflist">
            <div className="ops-deflist__row">
              <dt>Fuel per month</dt>
              <dd>
                {est.fuel_cost_per_month.sum_per_month === null ? "Not entered" : formatMoney(est.fuel_cost_per_month.sum_per_month, c)}
                <small className="ops-muted" style={{ display: "block" }}>
                  {est.fuel_cost_per_month.vehicles_with_value} vehicle(s) with a value, {est.fuel_cost_per_month.vehicles_without_value} without
                </small>
              </dd>
            </div>
            <div className="ops-deflist__row">
              <dt>Maintenance per month</dt>
              <dd>
                {est.maintenance_cost_per_month.sum_per_month === null ? "Not entered" : formatMoney(est.maintenance_cost_per_month.sum_per_month, c)}
                <small className="ops-muted" style={{ display: "block" }}>
                  {est.maintenance_cost_per_month.vehicles_with_value} vehicle(s) with a value, {est.maintenance_cost_per_month.vehicles_without_value} without
                </small>
              </dd>
            </div>
          </dl>
          <Definition>{est.note}</Definition>
        </Disclosure>
      )}
      <Definition>{costs.definition}</Definition>
    </section>
  );
}

function MigrationOverviewPage() {
  const navigate = useNavigate();
  const overview = useResource(loadOverview, OVERVIEW);
  const costs = useResource(getRecordedCosts, COSTS);

  if (overview.error && !overview.data) return <ErrorBlock message={overview.error} onRetry={overview.reload} />;
  const o = overview.data;
  if (!o) {
    return (
      <div className="intel-stack">
        <section className="ops-card"><Skeleton lines={3} /></section>
        <section className="ops-card"><Skeleton lines={6} /></section>
      </div>
    );
  }

  const msg = journeyMessage(o);
  const action = nextAction(o);
  const comp = o.composition;
  const r = o.ice_readiness;
  const items = o.plan_items;
  const planActive = (items.planned ?? 0) + (items.in_progress ?? 0) + (items.deferred ?? 0) + (items.completed ?? 0);
  const completed = items.completed ?? 0;

  return (
    <div className="intel-stack">
      <section className="intel-hero" aria-labelledby="mo-msg">
        <div className="intel-hero__text">
          <span className="intel-hero__eyebrow"><Sparkles size={15} aria-hidden="true" /> Your fleet today</span>
          <h2 id="mo-msg">{msg.title}</h2>
          <p>{msg.text}</p>
          {completed > 0 && planActive > 0 && completed === planActive && (
            <p className="intel-hero__milestone">
              Milestone: all {completed} planned transition{completed === 1 ? "" : "s"} in your plans are recorded as completed.
            </p>
          )}
        </div>
        {action && (
          <div className="intel-hero__action">
            <span className="intel-hero__eyebrow">Recommended next step</span>
            <button type="button" className="ops-btn ops-btn--primary intel-hero__cta" onClick={() => navigate(action.to)}>
              {action.label} <ArrowRight size={16} aria-hidden="true" />
            </button>
            <p>{action.text}</p>
          </div>
        )}
      </section>

      <div className="intel-grid-2">
        <section className="ops-card intel-panel" aria-labelledby="mo-comp">
          <div className="ops-card__head"><h2 id="mo-comp">Fleet composition</h2></div>
          <SplitBar label="Fleet composition" height={34} segments={[
            { key: "ice", label: "ICE", value: comp.ice, color: SERIES.ice },
            { key: "ev", label: "EV", value: comp.ev, color: SERIES.ev },
            ...(comp.unclassified ? [{ key: "unc", label: "Unclassified (fuel type other)", value: comp.unclassified, color: SERIES.unknown }] : []),
          ]} />
          <Definition>{comp.definition}</Definition>
        </section>

        <section className="ops-card intel-panel" aria-labelledby="mo-prog">
          <div className="ops-card__head"><h2 id="mo-prog">Electrification progress</h2></div>
          <ProgressMeter label="Electric share of your classified fleet"
            value={comp.ev_share_pct} valueText={comp.ev_share_pct === null ? "No classified vehicles" : `${comp.ev_share_pct}%`}
            target={o.target?.ev_share_pct ?? null}
            targetLabel={o.target ? `Target ${o.target.ev_share_pct}%${o.target.by ? ` by ${formatDay(o.target.by)}` : ""} (plan “${o.target.plan_name}”)` : undefined} />
          {!o.target && (
            <p className="ops-muted" style={{ margin: "10px 0 0" }}>
              No transition target set.{" "}
              <button type="button" className="ops-link" onClick={() => navigate("/ev-migration/plan")}>Set one in your plan</button>
            </p>
          )}
          <Definition>
            Counts vehicles recorded as electric today. Approved or planned replacements are not counted until the
            vehicle record itself is electric.
          </Definition>
        </section>
      </div>

      <section className="ops-card intel-panel" aria-labelledby="mo-opp">
        <div className="ops-card__head">
          <div>
            <h2 id="mo-opp">Migration opportunities</h2>
            <p className="ops-card__sub">{r.vehicles} ICE vehicle{r.vehicles === 1 ? "" : "s"} · {r.vehicles - r.not_assessed} assessed</p>
          </div>
          <button type="button" className="ops-btn ops-btn--secondary ops-btn--sm" onClick={() => navigate("/ev-migration/discover")}>
            Discover &amp; compare
          </button>
        </div>
        <SplitBar label="ICE vehicles by readiness" showTable segments={[
          { key: "meets", label: "Meets every check", value: r.meets_requirements, color: SERIES.ok },
          { key: "evidence", label: "Needs more information", value: r.needs_evidence, color: SERIES.warn },
          { key: "fail", label: "Does not meet a requirement", value: r.not_suitable, color: SERIES.danger },
          { key: "none", label: "Not yet assessed", value: r.not_assessed, color: SERIES.unknown },
        ]} />
        <div className="intel-figures intel-figures--compact">
          <div>
            <span>Ready for a formal decision</span>
            <strong>{r.approvable}</strong>
            <small>meet every check with moderate or high evidence</small>
          </div>
          <div>
            <span>Approved transitions</span>
            <strong>{o.decisions.approve_transition}</strong>
            <small>latest recorded decision per vehicle</small>
          </div>
          <div>
            <span>Transitions completed</span>
            <strong>{completed}</strong>
            <small>plan items recorded as completed</small>
          </div>
        </div>
        <p className="intel-note">
          <Info size={15} aria-hidden="true" />
          Start with vehicles that have predictable routes and recorded odometer history. EVORA checks range, payload
          and charging for each EV model before anything is recommended.
        </p>
        <Definition>{r.definition}</Definition>
      </section>

      {costs.error && !costs.data ? (
        <ErrorBlock compact message={costs.error} onRetry={costs.reload} />
      ) : !costs.data ? (
        <section className="ops-card"><Skeleton lines={5} /></section>
      ) : (
        <CostBaseline costs={costs.data} />
      )}
    </div>
  );
}

export default MigrationOverviewPage;
