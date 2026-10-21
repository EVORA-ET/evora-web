import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Flag, Pencil, Plus } from "lucide-react";

import {
  getMigrationOverview,
  getMigrationPlan,
  listMigrationPlans,
  type MigrationOverview,
  type MigrationPlan,
  type MigrationPlanItem,
  type PlanStatus,
} from "../../lib/intelligenceApi";
import { useResource } from "../operations/hooks";
import { Pill, type Tone } from "../operations/ui/Pill";
import { EmptyBlock, ErrorBlock, Skeleton } from "../operations/ui/states";
import { SERIES } from "../intelligence/chartColors";
import { ProgressMeter, SplitBar } from "../intelligence/charts";
import { formatDay, formatMoney, num } from "../intelligence/format";
import { useParam } from "../intelligence/hooks";
import { DECISION_LABEL, PLAN_ITEM_STATUS_LABEL, decisionTone, planItemTone } from "../intelligence/labels";
import { Definition, OutcomePill, Segmented } from "../intelligence/ui";
import { DecisionsSection } from "./Decisions";
import { AddToPlanDrawer, ItemDrawer, PlanDrawer } from "./PlanForms";

const ALL = {};
const OVERVIEW = "overview";
const loadOverview = () => getMigrationOverview();
const STATUS_LABEL: Record<PlanStatus, string> = { draft: "Draft", active: "Active", archived: "Archived" };
const STATUS_TONE: Record<PlanStatus, Tone> = { draft: "neutral", active: "ok", archived: "warn" };

type Readiness = "ready" | "awaiting" | "evidence" | "blocked" | "done";

/** Where a plan item stands before it can proceed, from its linked records only. */
function readinessOf(it: MigrationPlanItem): Readiness {
  if (it.status === "completed" || it.status === "cancelled") return "done";
  if (it.readiness?.outcome === "not_suitable") return "blocked";
  const strong = it.readiness?.outcome === "meets_requirements"
    && it.readiness.status === "completed"
    && (it.readiness.evidence_level === "high" || it.readiness.evidence_level === "moderate");
  if (!strong) return "evidence";
  if (it.decision?.decision === "approve_transition") return "ready";
  return "awaiting";
}

const READINESS_LABEL: Record<Exclude<Readiness, "done">, string> = {
  ready: "Approved — can proceed",
  awaiting: "Meets the criteria — awaiting a formal decision",
  evidence: "Needs more evidence",
  blocked: "Does not meet the requirements",
};
const READINESS_COLOR: Record<Exclude<Readiness, "done">, string> = {
  ready: SERIES.ok,
  awaiting: SERIES.maintenance,
  evidence: SERIES.warn,
  blocked: SERIES.danger,
};

function PhaseTimeline({ items, onOpen }: { items: MigrationPlanItem[]; onOpen: (id: string) => void }) {
  const phases = useMemo(() => {
    const map = new Map<number, MigrationPlanItem[]>();
    for (const it of items) map.set(it.phase, [...(map.get(it.phase) ?? []), it]);
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [items]);

  return (
    <ol className="intel-phases">
      {phases.map(([phase, list]) => {
        const live = list.filter((i) => i.status !== "cancelled");
        const done = live.filter((i) => i.status === "completed").length;
        const dates = live.map((i) => i.target_date).filter((d): d is string => Boolean(d)).sort();
        const complete = live.length > 0 && done === live.length;
        return (
          <li key={phase} className={complete ? "intel-phases__item intel-phases__item--done" : "intel-phases__item"}>
            <div className="intel-phases__marker" aria-hidden="true">{complete ? "✓" : phase}</div>
            <div className="intel-phases__body">
              <div className="intel-phases__head">
                <h3>Phase {phase}</h3>
                <span className="ops-muted">
                  {dates.length ? (dates[0] === dates[dates.length - 1] ? `Target ${formatDay(dates[0])}` : `${formatDay(dates[0])} – ${formatDay(dates[dates.length - 1])}`) : "No target dates"}
                </span>
                <span className="ops-muted">· {done} of {live.length} completed</span>
              </div>
              <div className="ops-table-scroll">
                <table className="ops-table">
                  <caption className="ops-sr-only">Phase {phase} vehicles</caption>
                  <thead>
                    <tr>
                      <th scope="col">Vehicle</th>
                      <th scope="col">EV model</th>
                      <th scope="col">Target</th>
                      <th scope="col">Readiness</th>
                      <th scope="col">Decision</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((it) => (
                      <tr key={it.id} className="ops-row--click" tabIndex={0} onClick={() => onOpen(it.id)}
                        onKeyDown={(ev) => { if (ev.key === "Enter") onOpen(it.id); }}>
                        <td>
                          {it.vehicle.registration_number}
                          {it.flags.length > 0 && it.status !== "completed" && it.status !== "cancelled" && (
                            <small className="ops-muted" style={{ display: "block" }}>{it.flags.length} open point(s)</small>
                          )}
                        </td>
                        <td>{it.ev_candidate_label ?? <span className="ops-muted">Not chosen</span>}</td>
                        <td>{it.target_date ? formatDay(it.target_date) : <span className="ops-muted">—</span>}</td>
                        <td>{it.readiness ? <OutcomePill outcome={it.readiness.outcome} /> : <span className="ops-muted">Not linked</span>}</td>
                        <td>{it.decision ? <Pill tone={decisionTone(it.decision.decision)}>{DECISION_LABEL[it.decision.decision]}</Pill> : <span className="ops-muted">None</span>}</td>
                        <td><Pill tone={planItemTone(it.status)}>{PLAN_ITEM_STATUS_LABEL[it.status]}</Pill></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function PlanDetail({ planId, overview }: { planId: string; overview: MigrationOverview | undefined }) {
  const { data, error, reload } = useResource(getMigrationPlan, planId);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [itemId, setItemId] = useParam("item");
  const plan = data && data.id === planId ? data : undefined;

  if (error && !plan) return <ErrorBlock message={error} onRetry={reload} />;
  if (!plan) return <section className="ops-card"><Skeleton lines={8} /></section>;

  const s = plan.summary;
  const live = s.item_count - s.by_status.cancelled;
  const remaining = s.by_status.planned + s.by_status.in_progress + s.by_status.deferred;
  const budget = num(plan.budget_amount);
  const estimated = num(s.estimated_cost_total);
  const target = num(plan.target_ev_share_pct);
  const item = plan.items.find((i) => i.id === itemId);
  const counts: Record<Exclude<Readiness, "done">, MigrationPlanItem[]> = { ready: [], awaiting: [], evidence: [], blocked: [] };
  for (const it of plan.items) {
    const r = readinessOf(it);
    if (r !== "done") counts[r].push(it);
  }
  const share = overview?.composition.ev_share_pct ?? null;
  const decisionsLinked = plan.items.filter((i) => i.decision).length;

  return (
    <div className="intel-stack">
      <section className="ops-card intel-panel" aria-labelledby="tp-plan">
        <div className="ops-card__head">
          <div>
            <h2 id="tp-plan">{plan.name}</h2>
            <p className="ops-card__sub">
              {plan.start_date && plan.end_date ? `${formatDay(plan.start_date)} – ${formatDay(plan.end_date)}`
                : plan.end_date ? `Until ${formatDay(plan.end_date)}` : plan.start_date ? `From ${formatDay(plan.start_date)}` : "No dates set"}
              {target !== null && ` · target ${target}% electric`}
            </p>
          </div>
          <span className="intel-row">
            <Pill tone={STATUS_TONE[plan.status]}>{STATUS_LABEL[plan.status]}</Pill>
            <button type="button" className="ops-btn ops-btn--ghost ops-btn--sm" onClick={() => setEditing(true)}>
              <Pencil size={14} /> Edit plan
            </button>
          </span>
        </div>
        <div className="intel-figures">
          <div><span>Vehicles in plan</span><strong>{live}</strong><small>{s.by_status.cancelled} cancelled</small></div>
          <div><span>Decisions linked</span><strong>{decisionsLinked}</strong><small>of {s.item_count} items</small></div>
          <div><span>Transitions completed</span><strong>{s.by_status.completed}</strong><small>recorded with a service date</small></div>
          <div><span>Remaining</span><strong>{remaining}</strong><small>planned, in progress or deferred</small></div>
          <div>
            <span>Estimated cost</span>
            <strong>{estimated === null ? "Not estimated" : formatMoney(estimated, plan.currency)}</strong>
            <small>
              {budget === null ? "No budget set" : `Budget ${formatMoney(budget, plan.currency)}`}
              {s.items_without_cost > 0 && ` · ${s.items_without_cost} without estimate`}
            </small>
          </div>
        </div>
        <div className="intel-grid-2" style={{ marginTop: 16 }}>
          <ProgressMeter label="Actual fleet electrification" color={SERIES.ev}
            value={share} valueText={share === null ? "—" : `${share}% electric`}
            target={target} targetLabel={target !== null ? `Plan target ${target}%` : undefined} />
          <ProgressMeter label="Plan completion" color={SERIES.ok}
            value={s.completed_fraction === null ? null : s.completed_fraction * 100}
            valueText={s.completed_fraction === null ? "No vehicles yet" : `${s.by_status.completed} of ${live} transitions`} />
        </div>
        <Definition>
          Fleet electrification counts vehicles recorded as electric in Operations. Plan completion counts plan
          items recorded as completed out of those not cancelled. A planned or approved vehicle counts as neither
          until it is recorded.
        </Definition>
        {plan.assumptions && <p className="ops-muted" style={{ marginBottom: 0 }}><strong>Assumptions:</strong> {plan.assumptions}</p>}
      </section>

      {live - s.by_status.completed > 0 && (
        <section className="ops-card intel-panel" aria-labelledby="tp-ready">
          <div className="ops-card__head"><h2 id="tp-ready">Before vehicles can proceed</h2></div>
          <SplitBar label="Open plan items by readiness" segments={(Object.keys(counts) as Exclude<Readiness, "done">[]).map((k) => ({
            key: k, label: READINESS_LABEL[k], value: counts[k].length, color: READINESS_COLOR[k],
          }))} />
          {[...counts.blocked, ...counts.evidence, ...counts.awaiting].length > 0 && (
            <ul className="ops-rows" style={{ marginTop: 12 }}>
              {[...counts.blocked, ...counts.evidence, ...counts.awaiting].slice(0, 8).map((it) => (
                <li key={it.id}>
                  <button type="button" className="ops-rowbtn" onClick={() => setItemId(it.id)}>
                    <span className="ops-list__main">
                      <strong>{it.vehicle.registration_number}{it.ev_candidate_label ? ` → ${it.ev_candidate_label}` : ""}</strong>
                      <small>{it.flags.map((f) => f.text).join(" ") || READINESS_LABEL[readinessOf(it) as Exclude<Readiness, "done">]}</small>
                    </span>
                    <ArrowRight size={15} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="ops-card intel-panel" aria-labelledby="tp-time">
        <div className="ops-card__head">
          <h2 id="tp-time">Timeline</h2>
          {plan.status !== "archived" && (
            <button type="button" className="ops-btn ops-btn--primary ops-btn--sm" onClick={() => setAdding(true)}>
              <Plus size={15} /> Add vehicle
            </button>
          )}
        </div>
        {plan.items.length === 0 ? (
          <EmptyBlock compact title="No vehicles in this plan yet"
            text="Add vehicles from Discover & Compare after checking them, or add one here and link its assessments." />
        ) : (
          <PhaseTimeline items={plan.items} onOpen={setItemId} />
        )}
        <Definition>
          Starting a transition needs a linked approval; completing it needs the date the EV entered service.
          Approval alone never marks a vehicle as transitioned.
        </Definition>
      </section>

      {editing && <PlanDrawer plan={plan} open onClose={() => setEditing(false)} onSaved={() => { setEditing(false); reload(); }} />}
      {adding && <AddToPlanDrawer plan={plan} onClose={() => { setAdding(false); reload(); }} />}
      {item && <ItemDrawer key={`${item.id}-${item.updated_at}`} item={item} onClose={() => setItemId(null)} />}
    </div>
  );
}

function TransitionPlanPage() {
  const navigate = useNavigate();
  const plans = useResource(listMigrationPlans, ALL);
  const overview = useResource(loadOverview, OVERVIEW);
  const [planId, setPlanId] = useParam("plan");
  const [creating, setCreating] = useState(false);
  const list: MigrationPlan[] = plans.data ?? [];
  const selected = planId ?? list.find((p) => p.status !== "archived")?.id ?? list[0]?.id ?? null;
  const o = overview.data;

  return (
    <div className="ops-ws">
      <div className="ops-wshead">
        <div>
          <h2 className="ops-wshead__title">My Transition Plan</h2>
          <p className="ops-wshead__desc">Turn recommendations into phased replacements, record decisions and track what has actually happened.</p>
        </div>
        <div className="ops-wshead__actions">
          <button type="button" className="ops-btn ops-btn--primary" onClick={() => setCreating(true)}>
            <Plus size={17} /> New plan
          </button>
        </div>
      </div>

      {plans.error && !plans.data ? (
        <ErrorBlock message={plans.error} onRetry={plans.reload} />
      ) : !plans.data ? (
        <Skeleton lines={6} />
      ) : list.length === 0 ? (
        <section className="intel-hero" aria-labelledby="tp-empty">
          <div className="intel-hero__text">
            <span className="intel-hero__eyebrow"><Flag size={15} aria-hidden="true" /> Plan your transition</span>
            <h2 id="tp-empty">Turn your recommendations into a plan.</h2>
            <p>
              {o && o.ice_readiness.meets_requirements > 0
                ? `${o.ice_readiness.meets_requirements} of your ICE vehicles met every readiness check for at least one EV model${o.ice_readiness.approvable ? `, ${o.ice_readiness.approvable} with enough evidence for a formal decision` : ""}. Group them into phases with target dates and a budget.`
                : "Check a few vehicles in Discover & Compare first, then group the suitable ones into phases with target dates and a budget."}
            </p>
          </div>
          <div className="intel-hero__action">
            <button type="button" className="ops-btn ops-btn--primary intel-hero__cta" onClick={() => setCreating(true)}>
              Create a plan <ArrowRight size={16} aria-hidden="true" />
            </button>
            <button type="button" className="ops-link" onClick={() => navigate("/ev-migration/discover")}>Go to Discover &amp; Compare</button>
          </div>
        </section>
      ) : (
        <>
          {list.length > 1 && (
            <Segmented label="Plans" value={selected ?? ""} onChange={(v) => setPlanId(v)}
              options={list.map((p) => ({ value: p.id, label: `${p.name}${p.status === "archived" ? " (archived)" : ""}` }))} />
          )}
          {selected && <PlanDetail key={selected} planId={selected} overview={o} />}
        </>
      )}

      <DecisionsSection />

      {creating && (
        <PlanDrawer open onClose={() => setCreating(false)}
          onSaved={(p) => { setCreating(false); plans.reload(); setPlanId(p.id); }} />
      )}
    </div>
  );
}

export default TransitionPlanPage;
