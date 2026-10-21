import { useMemo, useState } from "react";

import {
  addMigrationPlanItem,
  changeMigrationPlanItemStatus,
  createMigrationPlan,
  listAssessments,
  listEvCandidates,
  listMigrationDecisions,
  listMigrationPlans,
  removeMigrationPlanItem,
  updateMigrationPlan,
  updateMigrationPlanItem,
  type MigrationPlan,
  type MigrationPlanInput,
  type MigrationPlanItem,
  type MigrationPlanItemInput,
  type PlanItemStatus,
  type PlanStatus,
} from "../../lib/intelligenceApi";
import { useResource } from "../operations/hooks";
import { useOps } from "../operations/useOps";
import { useSubmit } from "../operations/workspaceHooks";
import ConfirmDialog from "../operations/ui/ConfirmDialog";
import Drawer from "../operations/ui/Drawer";
import { SelectField, TextArea, TextField } from "../operations/ui/Fields";
import { Pill } from "../operations/ui/Pill";
import { formatDay, formatMoney, formatStamp, todayInput } from "../intelligence/format";
import { useParam } from "../intelligence/hooks";
import {
  DECISION_LABEL,
  PLAN_ITEM_NEXT,
  PLAN_ITEM_STATUS_LABEL,
  decisionTone,
  planItemTone,
} from "../intelligence/labels";
import { CoverageBadge, Definition, OutcomePill } from "../intelligence/ui";
import VehiclePicker from "../intelligence/VehiclePicker";
import { candidateOptions } from "./derive";

const ALL = {};
const PLAN_STATUS: { value: PlanStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

/* ------------------------------------------------------------------ */
/* Plan form                                                           */
/* ------------------------------------------------------------------ */

export function PlanDrawer({
  plan,
  open,
  onClose,
  onSaved,
}: {
  plan?: MigrationPlan;
  open: boolean;
  onClose: () => void;
  onSaved: (plan: MigrationPlan) => void;
}) {
  const { invalidate, toast } = useOps();
  const submit = useSubmit();
  const [f, setF] = useState({
    name: plan?.name ?? "",
    description: plan?.description ?? "",
    status: plan?.status ?? ("draft" as PlanStatus),
    start_date: plan?.start_date ?? "",
    end_date: plan?.end_date ?? "",
    budget_amount: plan?.budget_amount ?? "",
    assumptions: plan?.assumptions ?? "",
    target_ev_share_pct: plan?.target_ev_share_pct ?? "",
  });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = () =>
    submit.run(async () => {
      const input: MigrationPlanInput = {
        name: f.name.trim(),
        description: f.description.trim(),
        status: f.status,
        start_date: f.start_date || null,
        end_date: f.end_date || null,
        budget_amount: f.budget_amount === "" ? null : f.budget_amount,
        assumptions: f.assumptions.trim(),
        target_ev_share_pct: f.target_ev_share_pct === "" ? null : f.target_ev_share_pct,
      };
      const saved = plan ? await updateMigrationPlan(plan.id, input) : await createMigrationPlan(input);
      toast.success(plan ? "Plan updated." : "Plan created.");
      invalidate();
      onSaved(saved);
    });

  const e = submit.errors;
  return (
    <Drawer open={open} title={plan ? "Edit plan" : "New migration plan"} onClose={onClose}
      footer={
        <>
          <button type="button" className="ops-btn ops-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="ops-btn ops-btn--primary" onClick={save} disabled={submit.busy}>
            {submit.busy ? "Saving…" : "Save plan"}
          </button>
        </>
      }>
      <form className="ops-form" onSubmit={(ev) => { ev.preventDefault(); void save(); }}>
        {submit.formError && <p className="ops-callout ops-callout--danger" role="alert">{submit.formError}</p>}
        <TextField label="Name" required value={f.name} error={e.name} onChange={(ev) => set("name", ev.target.value)} />
        <SelectField label="Status" value={f.status} error={e.status} options={PLAN_STATUS}
          onChange={(ev) => set("status", ev.target.value)} />
        <div className="ops-form__row">
          <TextField label="Start" type="date" value={f.start_date} error={e.start_date}
            onChange={(ev) => set("start_date", ev.target.value)} />
          <TextField label="End" type="date" value={f.end_date} error={e.end_date}
            onChange={(ev) => set("end_date", ev.target.value)} />
        </div>
        <TextField label="Target electric share of the fleet (%)" type="number" min={1} max={100} step="any"
          value={f.target_ev_share_pct} error={e.target_ev_share_pct}
          hint="Optional goal, e.g. 50 — compared with the vehicles actually recorded as electric, by the end date."
          onChange={(ev) => set("target_ev_share_pct", ev.target.value)} />
        <TextField label="Budget" type="number" min={0} step="any" value={f.budget_amount} error={e.budget_amount}
          hint="In your organization's currency. Leave empty if not set." onChange={(ev) => set("budget_amount", ev.target.value)} />
        <TextArea label="Planning assumptions" value={f.assumptions} error={e.assumptions}
          hint="e.g. funding source, procurement lead times, depot works — stated by your organization"
          onChange={(ev) => set("assumptions", ev.target.value)} />
        <TextArea label="Description" value={f.description} error={e.description}
          onChange={(ev) => set("description", ev.target.value)} />
      </form>
    </Drawer>
  );
}

/* ------------------------------------------------------------------ */
/* Item form (create + edit share the link fields)                     */
/* ------------------------------------------------------------------ */

function LinkFields({
  vehicleId,
  candidateId,
  values,
  set,
  errors,
}: {
  vehicleId: string;
  candidateId: string;
  values: { readiness_assessment_id: string; tco_assessment_id: string; decision_id: string };
  set: (key: "readiness_assessment_id" | "tco_assessment_id" | "decision_id", value: string) => void;
  errors: Record<string, string>;
}) {
  const params = useMemo(() => ({ vehicle_id: vehicleId }), [vehicleId]);
  const assessments = useResource(listAssessments, params);
  const decisions = useResource(listMigrationDecisions, params);
  const of = (kind: string) =>
    (assessments.data ?? [])
      .filter((a) => a.kind === kind && (!candidateId || a.ev_candidate_id === candidateId))
      .map((a) => ({
        value: a.id,
        label: `${formatStamp(a.created_at)} · ${a.subject_snapshot.ev_candidate?.label ?? ""} · ${
          kind === "ev_readiness" ? (a.headline.outcome ?? "").replace(/_/g, " ") : a.headline.result_status ?? ""
        } · ${a.evidence_level} evidence`,
      }));
  return (
    <>
      <SelectField label="Readiness assessment" value={values.readiness_assessment_id}
        error={errors.readiness_assessment_id} options={of("ev_readiness")} placeholder="None linked"
        onChange={(ev) => set("readiness_assessment_id", ev.target.value)} />
      <SelectField label="TCO assessment" value={values.tco_assessment_id} error={errors.tco_assessment_id}
        options={of("tco")} placeholder="None linked" onChange={(ev) => set("tco_assessment_id", ev.target.value)} />
      <SelectField label="Decision" value={values.decision_id} error={errors.decision_id}
        options={(decisions.data ?? [])
          .filter((d) => !candidateId || !d.ev_candidate_id || d.ev_candidate_id === candidateId)
          .map((d) => ({ value: d.id, label: `${DECISION_LABEL[d.decision]} · ${formatStamp(d.decided_at)}` }))}
        placeholder="None linked" hint="Record decisions in the Decisions section of this page."
        onChange={(ev) => set("decision_id", ev.target.value)} />
    </>
  );
}

export interface PlanItemPreset {
  vehicle: { id: string; label: string };
  candidateId?: string;
  readinessId?: string;
  tcoId?: string;
}

/** Add a vehicle to a plan; from Discover & Compare it arrives prefilled and asks which plan. */
export function AddToPlanDrawer({
  plan: fixedPlan,
  preset,
  onClose,
}: {
  plan?: MigrationPlan;
  preset?: PlanItemPreset;
  onClose: () => void;
}) {
  const plans = useResource(listMigrationPlans, fixedPlan ? null : ALL);
  const [planId, setPlanId] = useState(fixedPlan?.id ?? "");
  const openPlans = (plans.data ?? []).filter((p) => p.status !== "archived");
  const plan = fixedPlan ?? openPlans.find((p) => p.id === planId);
  const { invalidate, toast } = useOps();
  const submit = useSubmit();
  const candidates = useResource(listEvCandidates, ALL);
  const [vehicle, setVehicle] = useState<{ id: string; label: string } | null>(preset?.vehicle ?? null);
  const [f, setF] = useState({
    ev_candidate_id: preset?.candidateId ?? "",
    phase: "1",
    target_date: "",
    estimated_cost: "",
    readiness_assessment_id: preset?.readinessId ?? "",
    tco_assessment_id: preset?.tcoId ?? "",
    decision_id: "",
    notes: "",
  });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = () =>
    submit.run(async () => {
      if (!vehicle) throw new Error("Select a vehicle.");
      if (!plan) throw new Error("Choose a plan.");
      const input: MigrationPlanItemInput = {
        vehicle_id: vehicle.id,
        ev_candidate_id: f.ev_candidate_id || null,
        phase: Number(f.phase),
        target_date: f.target_date || null,
        estimated_cost: f.estimated_cost === "" ? null : f.estimated_cost,
        readiness_assessment_id: f.readiness_assessment_id || null,
        tco_assessment_id: f.tco_assessment_id || null,
        decision_id: f.decision_id || null,
        notes: f.notes.trim(),
      };
      await addMigrationPlanItem(plan.id, input);
      toast.success(`${vehicle.label} added to the plan.`);
      invalidate();
      onClose();
    });

  const e = submit.errors;
  return (
    <Drawer open title="Add a vehicle to a transition plan" onClose={onClose} wide
      footer={
        <>
          <button type="button" className="ops-btn ops-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="ops-btn ops-btn--primary" onClick={save} disabled={submit.busy || !vehicle || !plan}>
            {submit.busy ? "Adding…" : "Add to plan"}
          </button>
        </>
      }>
      <form className="ops-form" onSubmit={(ev) => { ev.preventDefault(); void save(); }}>
        {submit.formError && <p className="ops-callout ops-callout--danger" role="alert">{submit.formError}</p>}
        {!fixedPlan && (
          plans.data && openPlans.length === 0 ? (
            <p className="ops-callout">You have no open plan yet. Create one on My Transition Plan first.</p>
          ) : (
            <SelectField label="Plan" required value={planId} options={openPlans.map((p) => ({ value: p.id, label: p.name }))}
              placeholder={plans.data ? "Choose a plan…" : "Loading plans…"} onChange={(ev) => setPlanId(ev.target.value)} />
          )
        )}
        {preset ? (
          <p style={{ margin: 0 }}>Vehicle: <strong>{preset.vehicle.label}</strong>{e.vehicle_id && <span className="ops-field__error"> {e.vehicle_id}</span>}</p>
        ) : (
          <div>
            <p className="ops-muted" style={{ margin: "0 0 6px" }}>
              Vehicle: <strong>{vehicle?.label ?? "none selected"}</strong>
            </p>
            <VehiclePicker powertrain="ice" selectedId={vehicle?.id ?? null} label="Combustion vehicles"
              onSelect={(v) => setVehicle({ id: v.id, label: v.registration_number })} />
            {e.vehicle_id && <p className="ops-field__error">{e.vehicle_id}</p>}
          </div>
        )}
        <div className="ops-form__row ops-form__row--3">
          <SelectField label="EV model" value={f.ev_candidate_id} error={e.ev_candidate_id}
            options={candidateOptions(candidates.data)} placeholder="Not chosen yet"
            onChange={(ev) => set("ev_candidate_id", ev.target.value)} />
          <TextField label="Phase" required type="number" min={1} max={50} value={f.phase} error={e.phase}
            onChange={(ev) => set("phase", ev.target.value)} />
          <TextField label="Target date" type="date" value={f.target_date} error={e.target_date}
            onChange={(ev) => set("target_date", ev.target.value)} />
        </div>
        <TextField label={`Estimated cost${plan ? ` (${plan.currency})` : ""}`} type="number" min={0} step="any"
          value={f.estimated_cost} error={e.estimated_cost}
          hint="Your budget line for this transition. Leave empty if not estimated — it is not counted as zero."
          onChange={(ev) => set("estimated_cost", ev.target.value)} />
        {vehicle && (
          <LinkFields vehicleId={vehicle.id} candidateId={f.ev_candidate_id} values={f}
            set={(k, v) => set(k, v)} errors={e} />
        )}
        <TextArea label="Notes" value={f.notes} error={e.notes} onChange={(ev) => set("notes", ev.target.value)} />
      </form>
    </Drawer>
  );
}

function statusLabel(status: string): string {
  const known = (Object.keys(PLAN_ITEM_STATUS_LABEL) as PlanItemStatus[]).find((k) => k === status);
  return known ? PLAN_ITEM_STATUS_LABEL[known] : status;
}

export function ItemDrawer({ item, onClose }: { item: MigrationPlanItem | undefined; onClose: () => void }) {
  const { invalidate, toast } = useOps();
  const submit = useSubmit();
  const candidates = useResource(listEvCandidates, ALL);
  const [f, setF] = useState(() => ({
    ev_candidate_id: item?.ev_candidate_id ?? "",
    phase: String(item?.phase ?? 1),
    target_date: item?.target_date ?? "",
    estimated_cost: item?.estimated_cost ?? "",
    readiness_assessment_id: item?.readiness_assessment_id ?? "",
    tco_assessment_id: item?.tco_assessment_id ?? "",
    decision_id: item?.decision_id ?? "",
    notes: item?.notes ?? "",
  }));
  const [transition, setTransition] = useState<PlanItemStatus | null>(null);
  const [note, setNote] = useState("");
  const [completedOn, setCompletedOn] = useState(todayInput());
  const [removing, setRemoving] = useState(false);
  const statusSubmit = useSubmit();
  const removeSubmit = useSubmit();
  const [, openAssessment] = useParam("assessment");

  if (!item) return null;
  const locked = item.status === "completed" || item.status === "cancelled";
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = () =>
    submit.run(async () => {
      const input: MigrationPlanItemInput = locked
        ? { notes: f.notes.trim() }
        : {
            ev_candidate_id: f.ev_candidate_id || null,
            phase: Number(f.phase),
            target_date: f.target_date || null,
            estimated_cost: f.estimated_cost === "" ? null : f.estimated_cost,
            readiness_assessment_id: f.readiness_assessment_id || null,
            tco_assessment_id: f.tco_assessment_id || null,
            decision_id: f.decision_id || null,
            notes: f.notes.trim(),
          };
      await updateMigrationPlanItem(item.id, input);
      toast.success("Plan item saved.");
      invalidate();
    });

  const changeStatus = () =>
    statusSubmit.run(async () => {
      if (!transition) return;
      await changeMigrationPlanItemStatus(item.id, {
        status: transition,
        note: note.trim(),
        completed_on: transition === "completed" ? completedOn : null,
      });
      toast.success(`Marked ${PLAN_ITEM_STATUS_LABEL[transition].toLowerCase()}.`);
      setTransition(null);
      setNote("");
      invalidate();
    });

  const remove = () =>
    removeSubmit.run(async () => {
      await removeMigrationPlanItem(item.id);
      toast.success("Removed from the plan.");
      setRemoving(false);
      invalidate();
      onClose();
    });

  const e = submit.errors;
  return (
    <Drawer open title={item.vehicle.registration_number} wide onClose={onClose}
      subtitle={<span className="intel-row"><Pill tone={planItemTone(item.status)}>{PLAN_ITEM_STATUS_LABEL[item.status]}</Pill>
        <span>{item.plan_name} · phase {item.phase}</span></span>}
      footer={
        <>
          {item.status === "planned" && item.status_history.length <= 1 && (
            <button type="button" className="ops-btn ops-btn--danger-text" onClick={() => setRemoving(true)}>Remove</button>
          )}
          <span style={{ flex: 1 }} />
          <button type="button" className="ops-btn ops-btn--ghost" onClick={onClose}>Close</button>
          <button type="button" className="ops-btn ops-btn--primary" onClick={save} disabled={submit.busy}>
            {submit.busy ? "Saving…" : "Save changes"}
          </button>
        </>
      }>
      <div className="intel-stack">
        {item.flags.length > 0 && (
          <div className="ops-callout ops-callout--warn">
            <ul className="intel-notes">{item.flags.map((fl) => <li key={fl.code}>{fl.text}</li>)}</ul>
          </div>
        )}

        <section className="ops-section">
          <div className="ops-section__head"><h3>Status</h3></div>
          <div className="intel-row">
            {PLAN_ITEM_NEXT[item.status].length === 0 ? (
              <span className="ops-muted">Final state — no further changes.</span>
            ) : (
              PLAN_ITEM_NEXT[item.status].map((s) => (
                <button key={s} type="button" className="ops-btn ops-btn--secondary ops-btn--sm"
                  onClick={() => { statusSubmit.reset(); setTransition(s); }}>
                  Mark {PLAN_ITEM_STATUS_LABEL[s].toLowerCase()}
                </button>
              ))
            )}
          </div>
          <Definition>
            Status changes only when someone records it. Starting needs a linked approval decision; completing
            needs the date the EV entered service. Approval never marks anything complete.
          </Definition>
        </section>

        <section className="ops-section">
          <div className="ops-section__head"><h3>Linked evidence</h3></div>
          <dl className="ops-deflist">
            <div className="ops-deflist__row">
              <dt>Readiness</dt>
              <dd>
                {item.readiness ? (
                  <button type="button" className="ops-link" onClick={() => item.readiness && openAssessment(item.readiness.id)}>
                    <span className="intel-row"><OutcomePill outcome={item.readiness.outcome} /><CoverageBadge level={item.readiness.evidence_level} /></span>
                  </button>
                ) : "None linked"}
              </dd>
            </div>
            <div className="ops-deflist__row">
              <dt>TCO</dt>
              <dd>
                {item.tco ? (
                  <button type="button" className="ops-link" onClick={() => item.tco && openAssessment(item.tco.id)}>
                    {item.tco.status === "completed"
                      ? `NPS ${formatMoney(item.tco.net_present_savings, item.tco.currency)}`
                      : "Insufficient evidence"}
                  </button>
                ) : "None linked"}
              </dd>
            </div>
            <div className="ops-deflist__row">
              <dt>Decision</dt>
              <dd>{item.decision ? <Pill tone={decisionTone(item.decision.decision)}>{DECISION_LABEL[item.decision.decision]} · {formatDay(item.decision.decided_at)}</Pill> : "None linked"}</dd>
            </div>
          </dl>
        </section>

        <section className="ops-section">
          <div className="ops-section__head"><h3>{locked ? "Notes" : "Details"}</h3></div>
          <form className="ops-form" onSubmit={(ev) => { ev.preventDefault(); void save(); }}>
            {submit.formError && <p className="ops-callout ops-callout--danger" role="alert">{submit.formError}</p>}
            {!locked && (
              <>
                <div className="ops-form__row ops-form__row--3">
                  <SelectField label="EV model" value={f.ev_candidate_id} error={e.ev_candidate_id}
                    options={candidateOptions(candidates.data)} placeholder="Not chosen yet"
                    onChange={(ev) => set("ev_candidate_id", ev.target.value)} />
                  <TextField label="Phase" type="number" min={1} max={50} value={f.phase} error={e.phase}
                    onChange={(ev) => set("phase", ev.target.value)} />
                  <TextField label="Target date" type="date" value={f.target_date} error={e.target_date}
                    onChange={(ev) => set("target_date", ev.target.value)} />
                </div>
                <TextField label="Estimated cost" type="number" min={0} step="any" value={f.estimated_cost}
                  error={e.estimated_cost} onChange={(ev) => set("estimated_cost", ev.target.value)} />
                <LinkFields vehicleId={item.vehicle_id} candidateId={f.ev_candidate_id} values={f}
                  set={(k, v) => set(k, v)} errors={e} />
              </>
            )}
            <TextArea label="Notes" value={f.notes} error={e.notes} onChange={(ev) => set("notes", ev.target.value)} />
          </form>
        </section>

        <section className="ops-section">
          <div className="ops-section__head"><h3>History</h3></div>
          <ul className="intel-timeline">
            {item.status_history.map((h, i) => (
              <li key={`${h.changed_at}-${i}`}>
                <strong>{h.from_status ? `${statusLabel(h.from_status)} → ` : ""}{PLAN_ITEM_STATUS_LABEL[h.to_status]}</strong>
                <small>{formatStamp(h.changed_at)}{h.note ? ` · ${h.note}` : ""}</small>
              </li>
            ))}
          </ul>
          {item.completed_on && <p className="ops-muted">Completed on {formatDay(item.completed_on)}.</p>}
        </section>
      </div>

      <ConfirmDialog open={Boolean(transition)} title={`Mark ${transition ? PLAN_ITEM_STATUS_LABEL[transition].toLowerCase() : ""}?`}
        confirmLabel="Record status" busy={statusSubmit.busy} error={statusSubmit.errors.status ?? statusSubmit.formError}
        danger={transition === "cancelled"} onCancel={() => setTransition(null)} onConfirm={changeStatus}>
        <p style={{ marginTop: 0 }}>
          {transition === "completed"
            ? "Confirm the EV has actually entered service. This is final."
            : transition === "in_progress"
              ? "The server checks that a formal approval decision is linked."
              : "This change is recorded in the item's history."}
        </p>
        {transition === "completed" && (
          <TextField label="Entered service on" type="date" required value={completedOn}
            error={statusSubmit.errors.completed_on} onChange={(ev) => setCompletedOn(ev.target.value)} />
        )}
        <TextArea label={transition === "completed" ? "How was completion confirmed?" : "Note"}
          required={transition === "completed"} value={note} error={statusSubmit.errors.note}
          onChange={(ev) => setNote(ev.target.value)} />
      </ConfirmDialog>

      <ConfirmDialog open={removing} title="Remove from plan?" danger confirmLabel="Remove"
        busy={removeSubmit.busy} error={removeSubmit.formError}
        onCancel={() => setRemoving(false)} onConfirm={remove}>
        <p style={{ margin: 0 }}>
          Only items that never changed status can be removed. Otherwise cancel the item so its history is kept.
        </p>
      </ConfirmDialog>
    </Drawer>
  );
}

