import { useMemo, useState } from "react";
import { Plus } from "lucide-react";

import {
  createEvidenceSource,
  getEvidenceSource,
  listEvidenceSources,
  verifyEvidenceSource,
  type EvidenceSource,
  type EvidenceSourceInput,
} from "../../lib/intelligenceApi";
import { useResource } from "../operations/hooks";
import { useOps } from "../operations/useOps";
import { useSubmit } from "../operations/workspaceHooks";
import Drawer from "../operations/ui/Drawer";
import { SelectField, TextArea, TextField } from "../operations/ui/Fields";
import { Pill } from "../operations/ui/Pill";
import { ErrorBlock, Skeleton } from "../operations/ui/states";
import { formatDay, formatStamp } from "./format";
import { SOURCE_TYPES } from "./labels";
import { Segmented } from "./ui";



const RETRIEVAL = [
  { value: "document", label: "Document" },
  { value: "manual_entry", label: "Manual entry" },
  { value: "file_import", label: "File import" },
  { value: "api", label: "API" },
];

function verificationTone(status: EvidenceSource["verification_status"]) {
  return status === "verified" ? "ok" : status === "rejected" ? "danger" : "warn";
}

export function VerificationPill({ source }: { source: Pick<EvidenceSource, "verification_status"> }) {
  const label =
    source.verification_status === "verified"
      ? "Verified"
      : source.verification_status === "rejected"
        ? "Rejected"
        : "Unverified";
  return <Pill tone={verificationTone(source.verification_status)}>{label}</Pill>;
}

function nowLocalInput() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

/** Create a source. Returns the created source to the caller. */
export function NewSourceDrawer({
  open,
  onClose,
  onCreated,
  level = 1,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (source: EvidenceSource) => void;
  level?: 1 | 2;
}) {
  const { invalidate, toast } = useOps();
  const submit = useSubmit();
  const [form, setForm] = useState({
    title: "",
    source_type: "",
    retrieval_method: "document",
    retrieved_at: nowLocalInput(),
    publisher: "",
    identifier: "",
    url: "",
    effective_from: "",
    effective_to: "",
    geographic_scope: "",
    applicability: "",
    notes: "",
  });
  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const save = () =>
    submit.run(async () => {
      const input: EvidenceSourceInput = {
        title: form.title.trim(),
        source_type: form.source_type,
        retrieval_method: form.retrieval_method as EvidenceSourceInput["retrieval_method"],
        retrieved_at: new Date(form.retrieved_at).toISOString(),
        publisher: form.publisher.trim(),
        identifier: form.identifier.trim(),
        url: form.url.trim(),
        effective_from: form.effective_from || null,
        effective_to: form.effective_to || null,
        geographic_scope: form.geographic_scope.trim(),
        applicability: form.applicability.trim(),
        notes: form.notes.trim(),
      };
      const created = await createEvidenceSource(input);
      toast.success(`Source "${created.title}" recorded. It is unverified until someone checks it.`);
      invalidate();
      onCreated(created);
    });

  const e = submit.errors;
  return (
    <Drawer
      open={open}
      level={level}
      title="Record a source"
      subtitle="The document, record export or quotation a value was taken from."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ops-btn ops-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="ops-btn ops-btn--primary" onClick={save} disabled={submit.busy}>
            {submit.busy ? "Saving…" : "Save source"}
          </button>
        </>
      }
    >
      <form className="ops-form" onSubmit={(ev) => { ev.preventDefault(); void save(); }}>
        {submit.formError && <p className="ops-callout ops-callout--danger" role="alert">{submit.formError}</p>}
        <TextField label="Title" required value={form.title} error={e.title}
          onChange={(ev) => set("title", ev.target.value)} placeholder="e.g. Utility bill, Sep 2026" />
        <div className="ops-form__row">
          <SelectField label="Source type" required value={form.source_type} error={e.source_type}
            options={SOURCE_TYPES} placeholder="Select…" onChange={(ev) => set("source_type", ev.target.value)} />
          <SelectField label="How it was obtained" required value={form.retrieval_method} error={e.retrieval_method}
            options={RETRIEVAL} onChange={(ev) => set("retrieval_method", ev.target.value)} />
        </div>
        <div className="ops-form__row">
          <TextField label="Retrieved at" type="datetime-local" required value={form.retrieved_at}
            error={e.retrieved_at} onChange={(ev) => set("retrieved_at", ev.target.value)} />
          <TextField label="Publisher" value={form.publisher} error={e.publisher}
            onChange={(ev) => set("publisher", ev.target.value)} />
        </div>
        <div className="ops-form__row">
          <TextField label="Identifier" hint="Document, quote or notification number" value={form.identifier}
            error={e.identifier} onChange={(ev) => set("identifier", ev.target.value)} />
          <TextField label="URL" type="url" value={form.url} error={e.url}
            hint={form.retrieval_method === "api" ? "Required for API sources" : undefined}
            onChange={(ev) => set("url", ev.target.value)} />
        </div>
        <div className="ops-form__row">
          <TextField label="Effective from" type="date" value={form.effective_from} error={e.effective_from}
            onChange={(ev) => set("effective_from", ev.target.value)} />
          <TextField label="Effective to" type="date" value={form.effective_to} error={e.effective_to}
            onChange={(ev) => set("effective_to", ev.target.value)} />
        </div>
        <TextField label="Geographic scope" value={form.geographic_scope} error={e.geographic_scope}
          onChange={(ev) => set("geographic_scope", ev.target.value)} placeholder="e.g. Maharashtra" />
        <TextArea label="Applicability" value={form.applicability} error={e.applicability}
          hint="Vehicle categories or conditions this source applies to"
          onChange={(ev) => set("applicability", ev.target.value)} />
        <TextArea label="Notes" value={form.notes} error={e.notes} onChange={(ev) => set("notes", ev.target.value)} />
        <p className="ops-muted" style={{ margin: 0 }}>
          A new source is <strong>unverified</strong>. Verifying it records that a named user in your
          organization checked the values against this document.
        </p>
      </form>
    </Drawer>
  );
}

/** Source details, verification history and the verify/reject action. */
export function SourceDetailDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { invalidate, toast } = useOps();
  const { data, error, reload } = useResource(getEvidenceSource, id);
  const source = data && data.id === id ? data : undefined;
  const submit = useSubmit();
  const [decision, setDecision] = useState<"verified" | "rejected">("verified");
  const [note, setNote] = useState("");

  const verify = () =>
    submit.run(async () => {
      if (!id) return;
      await verifyEvidenceSource(id, decision, note.trim());
      toast.success(decision === "verified" ? "Source verified." : "Source rejected.");
      setNote("");
      invalidate();
      reload();
    });

  return (
    <Drawer open={Boolean(id)} title={source?.title ?? "Source"} onClose={onClose} level={2}
      subtitle={source && <VerificationPill source={source} />}>
      {error && !source ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : !source ? (
        <Skeleton lines={6} />
      ) : (
        <div className="intel-stack">
          <dl className="ops-deflist">
            {([
              ["Type", source.source_type.replace(/_/g, " ")],
              ["Publisher", source.publisher || "—"],
              ["Identifier", source.identifier || "—"],
              ["Obtained", `${source.retrieval_method.replace(/_/g, " ")} · ${formatStamp(source.retrieved_at)}`],
              ["In force", source.effective_from ? `${formatDay(source.effective_from)} – ${source.effective_to ? formatDay(source.effective_to) : "open"}` : "—"],
              ["Scope", source.geographic_scope || "—"],
              ["Applicability", source.applicability || "—"],
              ["Refresh", source.last_refresh_status === "not_applicable" ? "Not refreshed automatically" : `${source.last_refresh_status}${source.last_refresh_error ? ` — ${source.last_refresh_error}` : ""}`],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="ops-deflist__row"><dt>{k}</dt><dd>{v}</dd></div>
            ))}
            {source.url && (
              <div className="ops-deflist__row">
                <dt>URL</dt>
                <dd><a className="ops-link" href={source.url} target="_blank" rel="noreferrer">{source.url}</a></dd>
              </div>
            )}
          </dl>

          <section className="ops-section">
            <div className="ops-section__head"><h3>Verification history</h3></div>
            {source.verification_history.length === 0 ? (
              <p className="ops-muted">Never verified.</p>
            ) : (
              <ul className="intel-timeline">
                {source.verification_history.map((h, i) => (
                  <li key={`${h.decided_at}-${i}`}>
                    <strong>{h.status}</strong> · {formatStamp(h.decided_at)}
                    <small>{h.note}</small>
                    <small>By user {h.decided_by_id ? h.decided_by_id.slice(0, 8) : "system"} in your organization</small>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="ops-section">
            <div className="ops-section__head"><h3>Record a verification decision</h3></div>
            <form className="ops-form" onSubmit={(ev) => { ev.preventDefault(); void verify(); }}>
              {submit.formError && <p className="ops-callout ops-callout--danger" role="alert">{submit.formError}</p>}
              <Segmented label="Decision" value={decision} onChange={setDecision}
                options={[{ value: "verified", label: "Verified" }, { value: "rejected", label: "Rejected" }]} />
              <TextArea label="What did you check?" required value={note} error={submit.errors.note}
                onChange={(ev) => setNote(ev.target.value)}
                hint="Recorded with your name and the time. This is an internal check, not independent verification." />
              <div>
                <button type="submit" className="ops-btn ops-btn--primary" disabled={submit.busy || !note.trim()}>
                  {submit.busy ? "Saving…" : "Record decision"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </Drawer>
  );
}

const SOURCE_LIST = { ordering: "-created_at" };

/** Select an existing source, or create one in a stacked drawer. */
export function SourceSelect({
  value,
  onChange,
  error,
  required,
}: {
  value: string;
  onChange: (id: string) => void;
  error?: string;
  required?: boolean;
}) {
  const { data, reload } = useResource(listEvidenceSources, SOURCE_LIST);
  const [creating, setCreating] = useState(false);
  const options = useMemo(
    () =>
      (data ?? [])
        .filter((s) => s.verification_status !== "rejected")
        .map((s) => ({
          value: s.id,
          label: `${s.title} · ${s.verification_status === "verified" ? "verified" : "unverified"}`,
        })),
    [data],
  );
  return (
    <div>
      <SelectField label="Source" required={required} value={value} error={error}
        options={options} placeholder={required ? "Select a source…" : "No cited source"}
        onChange={(ev) => onChange(ev.target.value)} />
      <button type="button" className="ops-link" style={{ marginTop: 4 }} onClick={() => setCreating(true)}>
        <Plus size={13} /> New source
      </button>
      <NewSourceDrawer
        open={creating}
        level={2}
        onClose={() => setCreating(false)}
        onCreated={(s) => {
          setCreating(false);
          reload();
          onChange(s.id);
        }}
      />
    </div>
  );
}
