import { useMemo, useState } from "react";
import { Plus } from "lucide-react";

import {
  listAssessments,
  listEvCandidates,
  listMigrationDecisions,
  listMigrationPlanItems,
  recordMigrationDecision,
  type AssessmentSummary,
  type MigrationDecision,
  type PlanItemStatus,
} from "../../lib/intelligenceApi";
import { useResource } from "../operations/hooks";
import { useOps } from "../operations/useOps";
import { useSubmit } from "../operations/workspaceHooks";
import DataTable, { type Column } from "../operations/ui/DataTable";
import Drawer from "../operations/ui/Drawer";
import { FilterBar, FilterSelect, SearchBox } from "../operations/ui/FilterBar";
import { SelectField, TextArea } from "../operations/ui/Fields";
import { Pill } from "../operations/ui/Pill";
import { EmptyBlock } from "../operations/ui/states";
import { formatDay, formatMoney, formatStamp } from "../intelligence/format";
import { useParam } from "../intelligence/hooks";
import {
  DECISION_LABEL,
  PLAN_ITEM_STATUS_LABEL,
  decisionTone,
  planItemTone,
} from "../intelligence/labels";
import { CoverageBadge, Definition, OutcomePill } from "../intelligence/ui";
import VehiclePicker from "../intelligence/VehiclePicker";
import { candidateOptions } from "./derive";

const ALL = {};
type DecisionType = MigrationDecision["decision"];

function assessmentLabel(a: AssessmentSummary): string {
  const what =
    a.kind === "ev_readiness"
      ? (a.headline.outcome ?? "no result").replace(/_/g, " ")
      : a.headline.result_status === "ok"
        ? a.kind === "tco"
          ? `NPS ${formatMoney(a.headline.net_present_savings, a.headline.currency)}`
          : "calculated"
        : "insufficient evidence";
  return `${formatStamp(a.created_at)} · ${a.subject_snapshot.ev_candidate?.label ?? ""} · ${what} · ${a.evidence_level} evidence`;
}

export interface DecisionPreset {
  vehicle: { id: string; label: string };
  candidateId?: string;
  readinessId?: string;
  tcoId?: string;
}

/** Record a formal decision; from Discover & Compare it opens prefilled. */
export function RecordDecisionDrawer({
  open,
  onClose,
  preset,
}: {
  open: boolean;
  onClose: () => void;
  preset?: DecisionPreset;
}) {
  const { invalidate, toast } = useOps();
  const submit = useSubmit();
  const candidates = useResource(listEvCandidates, ALL);
  const [vehicle, setVehicle] = useState<{ id: string; label: string } | null>(preset?.vehicle ?? null);
  const params = useMemo(() => (vehicle ? { vehicle_id: vehicle.id } : null), [vehicle]);
  const assessments = useResource(listAssessments, params);
  const [f, setF] = useState({
    ev_candidate_id: preset?.candidateId ?? "",
    decision: "" as DecisionType | "",
    readiness_assessment_id: preset?.readinessId ?? "",
    tco_assessment_id: preset?.tcoId ?? "",
    emissions_assessment_id: "",
    rationale: "",
  });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const of = (kind: AssessmentSummary["kind"]) =>
    (assessments.data ?? [])
      .filter((a) => a.kind === kind && (!f.ev_candidate_id || a.ev_candidate_id === f.ev_candidate_id))
      .map((a) => ({ value: a.id, label: assessmentLabel(a) }));

  const save = () =>
    submit.run(async () => {
      if (!vehicle) throw new Error("Select a vehicle.");
      if (!f.decision) throw new Error("Choose the decision.");
      const decisionType: DecisionType = f.decision;
      await recordMigrationDecision({
        vehicle_id: vehicle.id,
        ev_candidate_id: f.ev_candidate_id || null,
        decision: decisionType,
        readiness_assessment_id: f.readiness_assessment_id || null,
        tco_assessment_id: f.tco_assessment_id || null,
        emissions_assessment_id: f.emissions_assessment_id || null,
        rationale: f.rationale.trim(),
      });
      toast.success("Decision recorded.");
      invalidate();
      onClose();
    });

  const e = submit.errors;
  return (
    <Drawer open={open} title="Record a migration decision" onClose={onClose} wide
      footer={
        <>
          <button type="button" className="ops-btn ops-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="ops-btn ops-btn--primary" onClick={save} disabled={submit.busy || !vehicle}>
            {submit.busy ? "Recording…" : "Record decision"}
          </button>
        </>
      }>
      <form className="ops-form" onSubmit={(ev) => { ev.preventDefault(); void save(); }}>
        <div className="ops-callout">
          A formal approval is accepted only when the linked readiness assessment is completed, met every
          mandatory check and has moderate or high evidence coverage. The server enforces this; lower-coverage
          assessments can still back a deferral or rejection. Decisions cannot be edited afterwards.
        </div>
        {submit.formError && (
          <div className="ops-callout ops-callout--danger" role="alert">
            {submit.formError}
            {Object.entries(e).filter(([k]) => !["non_field_errors", "detail"].includes(k)).length > 0 && (
              <ul className="intel-notes" style={{ marginTop: 6 }}>
                {Object.entries(e).map(([k, v]) => <li key={k}><strong>{k.replace(/_id$/, "").replace(/_/g, " ")}:</strong> {v}</li>)}
              </ul>
            )}
          </div>
        )}
        {preset ? (
          <p style={{ margin: 0 }}>Vehicle: <strong>{preset.vehicle.label}</strong></p>
        ) : (
          <div>
            <p className="ops-muted" style={{ margin: "0 0 6px" }}>Vehicle: <strong>{vehicle?.label ?? "none selected"}</strong></p>
            <VehiclePicker powertrain="ice" selectedId={vehicle?.id ?? null} label="Combustion vehicles"
              onSelect={(v) => setVehicle({ id: v.id, label: v.registration_number })} />
          </div>
        )}
        <div className="ops-form__row">
          <SelectField label="EV model" value={f.ev_candidate_id} error={e.ev_candidate_id}
            options={candidateOptions(candidates.data)} placeholder="None" hint="Required to approve."
            onChange={(ev) => set("ev_candidate_id", ev.target.value)} />
          <SelectField label="Decision" required value={f.decision} error={e.decision}
            options={(Object.keys(DECISION_LABEL) as DecisionType[]).map((d) => ({ value: d, label: DECISION_LABEL[d] }))}
            placeholder="Select…" onChange={(ev) => set("decision", ev.target.value)} />
        </div>
        {vehicle && (
          <>
            <SelectField label="Readiness assessment" value={f.readiness_assessment_id} error={e.readiness_assessment_id}
              options={of("ev_readiness")} placeholder="None" onChange={(ev) => set("readiness_assessment_id", ev.target.value)} />
            <SelectField label="TCO assessment" value={f.tco_assessment_id} error={e.tco_assessment_id}
              options={of("tco")} placeholder="None" onChange={(ev) => set("tco_assessment_id", ev.target.value)} />
            <SelectField label="Emissions assessment" value={f.emissions_assessment_id} error={e.emissions_assessment_id}
              options={of("emissions")} placeholder="None" onChange={(ev) => set("emissions_assessment_id", ev.target.value)} />
          </>
        )}
        <TextArea label="Rationale" required value={f.rationale} error={e.rationale}
          hint="Why this decision was taken, including how cost and emissions were weighed."
          onChange={(ev) => set("rationale", ev.target.value)} />
      </form>
    </Drawer>
  );
}

function DecisionDrawer({
  decision,
  assessments,
  candidateLabel,
  onClose,
}: {
  decision: MigrationDecision | undefined;
  assessments: Map<string, AssessmentSummary>;
  candidateLabel: string;
  onClose: () => void;
}) {
  const params = useMemo(() => (decision?.vehicle_id ? { vehicle_id: decision.vehicle_id } : null), [decision]);
  const items = useResource(listMigrationPlanItems, params);
  const [, openAssessment] = useParam("assessment");
  if (!decision) return null;
  const linked = items.data?.filter((i) => i.decision_id === decision.id) ?? [];

  const links: [string, string | null][] = [
    ["Readiness", decision.readiness_assessment_id],
    ["TCO", decision.tco_assessment_id],
    ["Emissions", decision.emissions_assessment_id],
  ];

  const outstanding: string[] = [];
  if (decision.decision === "approve_transition") {
    if (!decision.tco_assessment_id) outstanding.push("No TCO assessment was linked to this approval.");
    if (!items.data) {
      /* still loading */
    } else if (linked.length === 0) outstanding.push("Not yet part of a migration plan.");
    else if (!linked.some((i) => i.status === "completed")) outstanding.push("Transition not recorded as completed.");
  }

  return (
    <Drawer open title={String(decision.vehicle_snapshot.registration_number ?? "Decision")} onClose={onClose}
      subtitle={<Pill tone={decisionTone(decision.decision)}>{DECISION_LABEL[decision.decision]}</Pill>}>
      <div className="intel-stack">
        <dl className="ops-deflist">
          <div className="ops-deflist__row"><dt>EV model</dt><dd>{candidateLabel}</dd></div>
          <div className="ops-deflist__row"><dt>Decided</dt><dd>{formatStamp(decision.decided_at)}</dd></div>
          <div className="ops-deflist__row"><dt>Rationale</dt><dd>{decision.rationale}</dd></div>
        </dl>
        <section className="ops-section">
          <div className="ops-section__head"><h3>Assessments behind this decision</h3></div>
          <ul className="ops-rows">
            {links.map(([label, id]) => {
              const a = id ? assessments.get(id) : undefined;
              return (
                <li key={label}>
                  {id ? (
                    <button type="button" className="ops-rowbtn" onClick={() => openAssessment(id)}>
                      <span className="ops-list__main">
                        <strong>{label}</strong>
                        <small>{a ? formatStamp(a.created_at) : "Open to view"}</small>
                      </span>
                      <span className="ops-pills">
                        {a?.kind === "ev_readiness" && <OutcomePill outcome={a.headline.outcome} />}
                        {a?.kind === "tco" && a.headline.result_status === "ok" && (
                          <Pill tone="info">NPS {formatMoney(a.headline.net_present_savings, a.headline.currency)}</Pill>
                        )}
                        {a && <CoverageBadge level={a.evidence_level} />}
                      </span>
                    </button>
                  ) : (
                    <div className="ops-rowbtn" style={{ cursor: "default" }}>
                      <span className="ops-list__main"><strong>{label}</strong><small>Not linked</small></span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
        <section className="ops-section">
          <div className="ops-section__head"><h3>Transition progress</h3></div>
          {linked.length === 0 ? (
            <p className="ops-muted" style={{ margin: 0 }}>No plan item references this decision.</p>
          ) : (
            <ul className="ops-rows">
              {linked.map((i) => (
                <li key={i.id}>
                  <div className="ops-rowbtn" style={{ cursor: "default" }}>
                    <span className="ops-list__main">
                      <strong>{i.plan_name} · phase {i.phase}</strong>
                      <small>
                        Target {formatDay(i.target_date)}
                        {i.completed_on && ` · completed ${formatDay(i.completed_on)}`}
                      </small>
                    </span>
                    <Pill tone={planItemTone(i.status)}>{PLAN_ITEM_STATUS_LABEL[i.status]}</Pill>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {outstanding.length > 0 && (
            <ul className="intel-notes" style={{ marginTop: 8 }}>{outstanding.map((o) => <li key={o}>{o}</li>)}</ul>
          )}
          <Definition>An approval does not mean the transition happened; completion is recorded on the plan item.</Definition>
        </section>
      </div>
    </Drawer>
  );
}

/** Recorded decisions with their evidence and plan progress (part of My Transition Plan). */
export function DecisionsSection() {
  const decisions = useResource(listMigrationDecisions, ALL);
  const assessments = useResource(listAssessments, ALL);
  const candidates = useResource(listEvCandidates, ALL);
  const items = useResource(listMigrationPlanItems, ALL);
  const [openId, setOpenId] = useParam("decision");
  const [creating, setCreating] = useState(false);
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");

  const byId = useMemo(() => new Map((assessments.data ?? []).map((a) => [a.id, a])), [assessments.data]);
  const candLabel = useMemo(() => new Map((candidates.data ?? []).map((c) => [c.id, c.label])), [candidates.data]);
  const itemsByDecision = useMemo(() => {
    const m = new Map<string, PlanItemStatus[]>();
    for (const i of items.data ?? []) if (i.decision_id) m.set(i.decision_id, [...(m.get(i.decision_id) ?? []), i.status]);
    return m;
  }, [items.data]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (decisions.data ?? []).filter(
      (d) =>
        (!type || d.decision === type) &&
        (!q || String(d.vehicle_snapshot.registration_number ?? "").toLowerCase().includes(q)),
    );
  }, [decisions.data, type, search]);

  const columns: Column<MigrationDecision>[] = [
    { key: "date", header: "Decided", render: (d) => formatDay(d.decided_at) },
    { key: "vehicle", header: "Vehicle", render: (d) => String(d.vehicle_snapshot.registration_number ?? "—") },
    { key: "cand", header: "EV model", render: (d) => (d.ev_candidate_id ? candLabel.get(d.ev_candidate_id) ?? "—" : <span className="ops-muted">None</span>) },
    { key: "decision", header: "Decision", render: (d) => <Pill tone={decisionTone(d.decision)}>{DECISION_LABEL[d.decision]}</Pill> },
    {
      key: "readiness",
      header: "Readiness evidence",
      render: (d) => {
        const a = d.readiness_assessment_id ? byId.get(d.readiness_assessment_id) : undefined;
        return a ? <span className="intel-row"><OutcomePill outcome={a.headline.outcome} /><CoverageBadge level={a.evidence_level} /></span>
          : <span className="ops-muted">Not linked</span>;
      },
    },
    {
      key: "tco",
      header: "TCO",
      render: (d) => {
        const a = d.tco_assessment_id ? byId.get(d.tco_assessment_id) : undefined;
        return a ? (a.headline.result_status === "ok" ? formatMoney(a.headline.net_present_savings, a.headline.currency) : "Insufficient")
          : <span className="ops-muted">Not linked</span>;
      },
    },
    {
      key: "plan",
      header: "Plan status",
      render: (d) => {
        const st = itemsByDecision.get(d.id);
        return st && st.length ? st.map((s) => PLAN_ITEM_STATUS_LABEL[s]).join(", ")
          : <span className="ops-muted">No linked plan item</span>;
      },
    },
  ];

  return (
    <section className="ops-card intel-panel" aria-labelledby="dec-head">
      <div className="ops-card__head">
        <div>
          <h2 id="dec-head">Decisions</h2>
          <p className="ops-card__sub">Formal decisions and the stored assessments behind them. Decisions cannot be edited.</p>
        </div>
        <button type="button" className="ops-btn ops-btn--secondary ops-btn--sm" onClick={() => setCreating(true)}>
          <Plus size={15} /> Record decision
        </button>
      </div>
      <FilterBar active={Boolean(type || search)} onClear={() => { setType(""); setSearch(""); }}>
        <SearchBox value={search} onChange={setSearch} placeholder="Registration" label="Search decisions" />
        <FilterSelect label="Decision" value={type} onChange={setType}
          options={[{ value: "", label: "All" }, ...(Object.keys(DECISION_LABEL) as DecisionType[]).map((d) => ({ value: d, label: DECISION_LABEL[d] }))]} />
      </FilterBar>
      <DataTable
        columns={columns}
        rows={decisions.data ? rows : undefined}
        rowKey={(d) => d.id}
        onRowClick={(d) => setOpenId(d.id)}
        loading={decisions.loading}
        error={decisions.error}
        onRetry={decisions.reload}
        caption="Migration decisions"
        empty={<EmptyBlock title={decisions.data?.length ? "No decisions match" : "No decisions recorded yet"}
          text="Decisions link to stored assessments and cannot be edited after recording." />}
      />
      {creating && <RecordDecisionDrawer open onClose={() => setCreating(false)} />}
      <DecisionDrawer decision={decisions.data?.find((d) => d.id === openId)} assessments={byId}
        candidateLabel={(() => {
          const d = decisions.data?.find((x) => x.id === openId);
          return d?.ev_candidate_id ? candLabel.get(d.ev_candidate_id) ?? "—" : "None";
        })()}
        onClose={() => setOpenId(null)} />
    </section>
  );
}
