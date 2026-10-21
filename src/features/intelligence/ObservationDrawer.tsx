import { useState } from "react";

import {
  createObservation,
  listEvCandidates,
  supersedeObservation,
  type Observation,
  type ObservationInput,
  type ObservationKind,
  type Origin,
} from "../../lib/intelligenceApi";
import { useResource } from "../operations/hooks";
import { useOps } from "../operations/useOps";
import { useLookups, useSubmit } from "../operations/workspaceHooks";
import Drawer from "../operations/ui/Drawer";
import { SelectField, TextArea, TextField } from "../operations/ui/Fields";
import { ErrorBlock, Skeleton } from "../operations/ui/states";
import { todayInput } from "./format";
import { useKinds } from "./hooks";
import { SourceSelect } from "./SourceDrawer";
import VehiclePicker from "./VehiclePicker";

type SubjectType = ObservationKind["subjects"][number];

export interface ObservationPreset {
  kind?: string;
  subject?: { type: SubjectType; id: string | null; label: string };
  qualifiers?: Record<string, string>;
}

const ORIGINS: { value: Origin; label: string; hint: string }[] = [
  { value: "measured", label: "Measured", hint: "Read from an instrument or record (odometer, invoice, meter). Needs a source." },
  { value: "external", label: "External", hint: "Published by a third party (manufacturer, regulator, utility, quotation). Needs a source." },
  { value: "organization_provided", label: "Organization-provided", hint: "Your organization's own figure without a cited record." },
  { value: "modelled", label: "Modelled", hint: "Calculated from other values. Describe how." },
  { value: "assumed", label: "Assumed", hint: "Chosen for analysis with no evidence. Lowers evidence coverage." },
];

const SUBJECT_LABEL: Record<SubjectType, string> = {
  vehicle: "Vehicle",
  depot: "Depot",
  ev_candidate: "EV model",
  organization: "Whole organization",
};

function nowLocalInput() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

const CANDIDATES = { ordering: "manufacturer" };

function Form({
  kinds,
  preset,
  supersede,
  onClose,
  onSaved,
}: {
  kinds: ObservationKind[];
  preset?: ObservationPreset;
  supersede?: Observation;
  onClose: () => void;
  onSaved: (obs: Observation) => void;
}) {
  const { invalidate, toast } = useOps();
  const submit = useSubmit();
  const { depots } = useLookups();
  const candidates = useResource(listEvCandidates, CANDIDATES);

  const lockedKind = supersede?.kind ?? preset?.kind;
  const [kindKey, setKindKey] = useState(lockedKind ?? "");
  const kind = kinds.find((k) => k.key === kindKey);

  const presetSubject = supersede
    ? {
        type: supersede.subject,
        id: supersede.vehicle_id ?? supersede.depot_id ?? supersede.ev_candidate_id,
        label: "Same as the original",
      }
    : preset?.subject;
  const [subjectType, setSubjectType] = useState<SubjectType | "">(presetSubject?.type ?? "");
  const [subjectId, setSubjectId] = useState<string>(presetSubject?.id ?? "");
  const [subjectLabel, setSubjectLabel] = useState(presetSubject?.label ?? "");

  const [value, setValue] = useState(supersede ? supersede.value : "");
  const [qualifiers, setQualifiers] = useState<Record<string, string>>(() => {
    const base: Record<string, string> = {};
    for (const [k, v] of Object.entries(supersede?.qualifiers ?? preset?.qualifiers ?? {})) base[k] = String(v);
    return base;
  });
  const [observedAt, setObservedAt] = useState(nowLocalInput());
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(todayInput());
  const [effectiveTo, setEffectiveTo] = useState("");
  const [origin, setOrigin] = useState<Origin | "">(supersede?.origin ?? "");
  const [sourceId, setSourceId] = useState(supersede?.source_id ?? "");
  const [transformation, setTransformation] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");

  const subjectChoices = kind?.subjects ?? [];
  const fixedSubject = Boolean(presetSubject && kind && kind.subjects.includes(presetSubject.type));

  const kindOptions = kinds
    .filter((k) => !presetSubject || k.subjects.includes(presetSubject.type))
    .map((k) => ({ value: k.key, label: `${k.label} (${k.unit})` }));

  const save = () =>
    submit.run(async () => {
      if (!kind) throw new Error("Choose what you are recording.");
      const q: Record<string, string | number> = {};
      for (const [k, v] of Object.entries(qualifiers)) {
        if (v === "" || !(k in kind.qualifiers)) continue;
        q[k] = k === "horizon_years" ? Number(v) : v;
      }
      const input: ObservationInput = {
        kind: kind.key,
        value,
        unit: kind.unit,
        origin: origin as Origin,
        qualifiers: q,
        source_id: sourceId || null,
        note: note.trim(),
        transformation: transformation.trim(),
        vehicle_id: subjectType === "vehicle" ? subjectId || null : null,
        depot_id: subjectType === "depot" ? subjectId || null : null,
        ev_candidate_id: subjectType === "ev_candidate" ? subjectId || null : null,
      };
      if (kind.temporal === "instant") input.observed_at = new Date(observedAt).toISOString();
      if (kind.temporal === "period") {
        input.period_start = periodStart || null;
        input.period_end = periodEnd || null;
      }
      if (kind.temporal === "effective") {
        input.effective_from = effectiveFrom || null;
        input.effective_to = effectiveTo || null;
      }
      const saved = supersede
        ? await supersedeObservation(supersede.id, { ...input, correction_reason: reason.trim() })
        : await createObservation(input);
      toast.success(supersede ? "Correction recorded; the original is kept." : `${kind.label} recorded.`);
      invalidate();
      onSaved(saved);
    });

  const e = submit.errors;
  const needsSource = origin === "measured" || origin === "external";

  return (
    <>
      <form className="ops-form" onSubmit={(ev) => { ev.preventDefault(); void save(); }}>
        {submit.formError && <p className="ops-callout ops-callout--danger" role="alert">{submit.formError}</p>}

        {lockedKind ? (
          <p style={{ margin: 0 }}>
            <strong>{kind?.label ?? lockedKind}</strong>
            {kind?.description && <span className="ops-muted"> — {kind.description}</span>}
          </p>
        ) : (
          <SelectField label="What are you recording?" required value={kindKey} error={e.kind}
            options={kindOptions} placeholder="Select…"
            onChange={(ev) => {
              setKindKey(ev.target.value);
              setQualifiers({});
              const next = kinds.find((k) => k.key === ev.target.value);
              if (!fixedSubject && next && !next.subjects.includes(subjectType as SubjectType)) {
                setSubjectType(next.subjects.length === 1 ? next.subjects[0] : "");
                setSubjectId("");
              }
            }}
            hint={kind?.description} />
        )}

        {kind && (
          <>
            {fixedSubject && presetSubject ? (
              <p className="ops-muted" style={{ margin: 0 }}>
                For: <strong>{SUBJECT_LABEL[presetSubject.type]}</strong> {presetSubject.label}
              </p>
            ) : (
              <>
                <SelectField label="Describes" required value={subjectType} error={e.subject}
                  options={subjectChoices.map((s) => ({ value: s, label: SUBJECT_LABEL[s] }))}
                  placeholder="Select…"
                  onChange={(ev) => { setSubjectType(ev.target.value as SubjectType); setSubjectId(""); }} />
                {subjectType === "depot" && (
                  <SelectField label="Depot" required value={subjectId} error={e.depot_id}
                    options={depots} placeholder="Select a depot…" onChange={(ev) => setSubjectId(ev.target.value)} />
                )}
                {subjectType === "ev_candidate" && (
                  <SelectField label="EV model" required value={subjectId} error={e.ev_candidate_id}
                    options={(candidates.data ?? []).map((c) => ({ value: c.id, label: c.label }))}
                    placeholder="Select an EV model…" onChange={(ev) => setSubjectId(ev.target.value)} />
                )}
                {subjectType === "vehicle" && (
                  <div>
                    <p className="ops-muted" style={{ margin: "0 0 6px" }}>
                      Vehicle: <strong>{subjectLabel || "none selected"}</strong>
                    </p>
                    <VehiclePicker selectedId={subjectId || null} label="Vehicles"
                      onSelect={(v) => { setSubjectId(v.id); setSubjectLabel(v.registration_number); }} />
                    {e.vehicle_id && <p className="ops-field__error">{e.vehicle_id}</p>}
                  </div>
                )}
              </>
            )}

            <div className="ops-form__row">
              <TextField label={`Value (${kind.unit})`} required type="number" step="any" value={value}
                error={e.value} onChange={(ev) => setValue(ev.target.value)}
                hint={`${kind.min_inclusive ? "≥" : ">"} ${kind.min_value} and ≤ ${kind.max_value}`} />
              <TextField label="Unit" value={kind.unit} readOnly
                hint="Fixed per kind; EVORA does not convert units." />
            </div>

            {Object.entries(kind.qualifiers).map(([q, allowed]) => {
              const required = kind.required_qualifiers.includes(q);
              return allowed ? (
                <SelectField key={q} label={q.replace(/_/g, " ")} required={required}
                  value={qualifiers[q] ?? ""} error={e.qualifiers}
                  options={allowed.map((a) => ({ value: a, label: a.replace(/_/g, " ") }))}
                  placeholder={required ? "Select…" : "Not specified"}
                  onChange={(ev) => setQualifiers((p) => ({ ...p, [q]: ev.target.value }))} />
              ) : (
                <TextField key={q} label={q.replace(/_/g, " ")} required={required}
                  type={q === "horizon_years" ? "number" : "text"} value={qualifiers[q] ?? ""}
                  error={e.qualifiers}
                  onChange={(ev) => setQualifiers((p) => ({ ...p, [q]: ev.target.value }))} />
              );
            })}

            {kind.temporal === "instant" && (
              <TextField label="Observed at" type="datetime-local" required value={observedAt}
                error={e.observed_at} onChange={(ev) => setObservedAt(ev.target.value)} />
            )}
            {kind.temporal === "period" && (
              <div className="ops-form__row">
                <TextField label="Period start" type="date" required value={periodStart}
                  error={e.period_start} onChange={(ev) => setPeriodStart(ev.target.value)} />
                <TextField label="Period end" type="date" required value={periodEnd}
                  error={e.period_end} onChange={(ev) => setPeriodEnd(ev.target.value)} />
              </div>
            )}
            {kind.temporal === "effective" && (
              <div className="ops-form__row">
                <TextField label="In force from" type="date" required value={effectiveFrom}
                  error={e.effective_from} onChange={(ev) => setEffectiveFrom(ev.target.value)} />
                <TextField label="In force until" type="date" value={effectiveTo}
                  error={e.effective_to} onChange={(ev) => setEffectiveTo(ev.target.value)}
                  hint="Leave empty if open-ended" />
              </div>
            )}
            {kind.max_age_days !== null && (
              <p className="ops-muted" style={{ margin: 0 }}>
                Considered stale {kind.max_age_days} days after its date (a provisional EVORA default).
              </p>
            )}

            <SelectField label="Origin" required value={origin} error={e.origin}
              options={ORIGINS.map((o) => ({ value: o.value, label: o.label }))} placeholder="How did this value come to exist?"
              onChange={(ev) => setOrigin(ev.target.value as Origin)}
              hint={ORIGINS.find((o) => o.value === origin)?.hint} />
            <SourceSelect value={sourceId} onChange={setSourceId} error={e.source_id} required={needsSource} />
            {origin === "modelled" && (
              <TextArea label="How it was calculated" required value={transformation}
                error={e.transformation} onChange={(ev) => setTransformation(ev.target.value)} />
            )}
            <TextArea label="Note" value={note} error={e.note} onChange={(ev) => setNote(ev.target.value)} />
            {supersede && (
              <TextArea label="Why is this a correction?" required value={reason}
                error={e.correction_reason} onChange={(ev) => setReason(ev.target.value)} />
            )}
          </>
        )}
      </form>
      <div className="intel-row intel-actions">
        <button type="button" className="ops-btn ops-btn--ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="ops-btn ops-btn--primary" onClick={save} disabled={submit.busy || !kind}>
          {submit.busy ? "Saving…" : supersede ? "Record correction" : "Record"}
        </button>
      </div>
    </>
  );
}

/**
 * Record one observation (or a correction of one). The form is generated
 * from the kind registry, so units, qualifiers and time fields always match
 * what the backend validates.
 */
function ObservationDrawer({
  open,
  onClose,
  onSaved,
  preset,
  supersede,
  title,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: (obs: Observation) => void;
  preset?: ObservationPreset;
  supersede?: Observation;
  title?: string;
}) {
  const { data: kinds, error, reload } = useKinds();
  return (
    <Drawer open={open} title={title ?? (supersede ? "Correct an observation" : "Record evidence")} onClose={onClose}>
      {error && !kinds ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : !kinds ? (
        <Skeleton lines={6} />
      ) : (
        <Form
          key={`${preset?.kind ?? ""}-${preset?.subject?.id ?? ""}-${supersede?.id ?? ""}`}
          kinds={kinds}
          preset={preset}
          supersede={supersede}
          onClose={onClose}
          onSaved={(obs) => {
            onSaved?.(obs);
            onClose();
          }}
        />
      )}
    </Drawer>
  );
}

export default ObservationDrawer;
