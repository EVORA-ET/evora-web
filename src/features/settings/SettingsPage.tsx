import { useEffect, useState, type ReactNode } from "react";
import { Building2, Globe2, LogOut, ShieldCheck, UserRound } from "lucide-react";

import { getMe, type Me, type Organization } from "../../lib/api";
import { getOrganization, updateMe, updateOrganization } from "../../lib/accountApi";
import { signOutAndGoHome } from "../../lib/session";
import { supabase } from "../../lib/supabase";
import { OperationsProvider } from "../operations/OperationsProvider";
import { useResource } from "../operations/hooks";
import { useOps } from "../operations/useOps";
import { useSubmit } from "../operations/workspaceHooks";
import { TextArea, TextField } from "../operations/ui/Fields";
import { ErrorBlock, Skeleton } from "../operations/ui/states";
import { formatDay } from "../intelligence/format";
import "../operations/operations.css";
import "../intelligence/intel.css";
import "./settings.css";

const ME = "me";
const loadMe = () => getMe();

function Section({ icon, title, description, children }: { icon: ReactNode; title: string; description: string; children: ReactNode }) {
  const id = `set-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <section className="settings-section" aria-labelledby={id}>
      <div className="settings-section__intro">
        <span className="settings-section__icon" aria-hidden="true">{icon}</span>
        <div>
          <h2 id={id}>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      <div className="settings-section__body">{children}</div>
    </section>
  );
}

function ReadOnly({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="settings-readonly">
      <span>{label}</span>
      <strong>{value || <span className="ops-muted">Not set</span>}</strong>
      {hint && <small>{hint}</small>}
    </div>
  );
}

function Actions({ dirty, busy, onCancel }: { dirty: boolean; busy: boolean; onCancel: () => void }) {
  return (
    <div className="settings-actions">
      <button type="button" className="ops-btn ops-btn--ghost" onClick={onCancel} disabled={!dirty || busy}>Cancel</button>
      <button type="submit" className="ops-btn ops-btn--primary" disabled={!dirty || busy}>{busy ? "Saving…" : "Save changes"}</button>
    </div>
  );
}

function ProfileForm({ me, onSaved }: { me: Me; onSaved: (m: Me) => void }) {
  const { toast } = useOps();
  const submit = useSubmit();
  const initial = { name: me.name, mobile_number: me.mobile_number ?? "" };
  const [f, setF] = useState(initial);
  const dirty = f.name !== initial.name || f.mobile_number !== initial.mobile_number;

  const save = () =>
    submit.run(async () => {
      const name = f.name.trim();
      if (!name) throw new Error("Enter your name.");
      const mobile = f.mobile_number.trim();
      if (mobile && !/^\+?[0-9 ()-]{7,20}$/.test(mobile)) throw new Error("Enter a valid phone number (digits, spaces, + and dashes).");
      const saved = await updateMe(me.id, { name, mobile_number: mobile });
      toast.success("Profile saved.");
      onSaved(saved);
    });

  return (
    <form className="ops-form" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      {submit.formError && <p className="ops-callout ops-callout--danger" role="alert">{submit.formError}</p>}
      <div className="ops-form__row">
        <TextField label="Full name" required value={f.name} error={submit.errors.name} maxLength={255}
          onChange={(e) => setF({ ...f, name: e.target.value })} />
        <TextField label="Mobile number" value={f.mobile_number} error={submit.errors.mobile_number} maxLength={20}
          inputMode="tel" hint="Optional" onChange={(e) => setF({ ...f, mobile_number: e.target.value })} />
      </div>
      <ReadOnly label="Email" value={me.email} hint="Your sign-in identity. It can't be changed here." />
      <Actions dirty={dirty} busy={submit.busy} onCancel={() => { setF(initial); submit.reset(); }} />
    </form>
  );
}

type OrgFields = { name: string; industry: string; country: string; headquarters_address: string; gst_number: string; website: string; operating_cities: string };

function orgFields(o: Organization): OrgFields {
  return {
    name: o.name, industry: o.industry, country: o.country, headquarters_address: o.headquarters_address,
    gst_number: o.gst_number, website: o.website, operating_cities: o.operating_cities.join(", "),
  };
}

function OrganisationForm({ org, onSaved }: { org: Organization; onSaved: (o: Organization) => void }) {
  const { toast } = useOps();
  const submit = useSubmit();
  const initial = orgFields(org);
  const [f, setF] = useState(initial);
  const dirty = (Object.keys(f) as (keyof OrgFields)[]).some((k) => f[k] !== initial[k]);
  const set = (k: keyof OrgFields, v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = () =>
    submit.run(async () => {
      if (!f.name.trim()) throw new Error("Enter the organisation name.");
      const website = f.website.trim();
      if (website && !/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(website)) throw new Error("Website must start with http:// or https://.");
      const saved = await updateOrganization(org.id, {
        name: f.name.trim(), industry: f.industry.trim(), country: f.country.trim(),
        headquarters_address: f.headquarters_address.trim(), gst_number: f.gst_number.trim(), website,
        operating_cities: f.operating_cities.split(",").map((c) => c.trim()).filter(Boolean),
      });
      toast.success("Organisation details saved.");
      onSaved(saved);
    });

  const e = submit.errors;
  return (
    <form className="ops-form" onSubmit={(ev) => { ev.preventDefault(); void save(); }}>
      {submit.formError && <p className="ops-callout ops-callout--danger" role="alert">{submit.formError}</p>}
      <div className="ops-form__row">
        <TextField label="Organisation name" required value={f.name} error={e.name} maxLength={255} onChange={(ev) => set("name", ev.target.value)} />
        <TextField label="Industry" value={f.industry} error={e.industry} maxLength={255} onChange={(ev) => set("industry", ev.target.value)} />
      </div>
      <div className="ops-form__row">
        <TextField label="Country" value={f.country} error={e.country} maxLength={100} onChange={(ev) => set("country", ev.target.value)} />
        <TextField label="GST number" value={f.gst_number} error={e.gst_number} maxLength={50} onChange={(ev) => set("gst_number", ev.target.value)} />
      </div>
      <TextField label="Website" type="url" value={f.website} error={e.website} placeholder="https://" onChange={(ev) => set("website", ev.target.value)} />
      <TextArea label="Headquarters address" value={f.headquarters_address} error={e.headquarters_address} onChange={(ev) => set("headquarters_address", ev.target.value)} />
      <TextField label="Operating cities" value={f.operating_cities} error={e.operating_cities} hint="Separate cities with commas"
        onChange={(ev) => set("operating_cities", ev.target.value)} />
      <Actions dirty={dirty} busy={submit.busy} onCancel={() => { setF(initial); submit.reset(); }} />
    </form>
  );
}

function SettingsContent() {
  const me = useResource(loadMe, ME);
  const [profile, setProfile] = useState<Me | null>(null);
  const current = profile ?? me.data ?? null;
  const orgId = current?.organization_id ?? null;
  const org = useResource(getOrganization, orgId);
  const [orgSaved, setOrgSaved] = useState<Organization | null>(null);
  const organisation = orgSaved ?? org.data ?? null;
  const [provider, setProvider] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let alive = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (alive) setProvider(data.session?.user.app_metadata.provider ?? null);
    });
    return () => { alive = false; };
  }, []);

  return (
    <div className="ops settings">
      <header className="ops-head">
        <div>
          <h1 className="ops-head__title">Settings</h1>
          <p className="ops-head__desc">Your profile, your organisation's details and your account.</p>
        </div>
      </header>

      {me.error && !current ? (
        <ErrorBlock message={me.error} onRetry={me.reload} />
      ) : !current ? (
        <div className="settings-list"><Skeleton lines={8} /></div>
      ) : (
        <div className="settings-list">
          <Section icon={<UserRound size={18} />} title="Profile" description="How you appear to colleagues in EVORA.">
            <ProfileForm key={current.updated_at} me={current} onSaved={setProfile} />
          </Section>

          <Section icon={<Building2 size={18} />} title="Organisation" description="Details shown on reports and used across EVORA.">
            {!orgId ? (
              <p className="ops-muted">Your account is not linked to an organisation yet.</p>
            ) : org.error && !organisation ? (
              <ErrorBlock compact message={org.error} onRetry={org.reload} />
            ) : !organisation ? (
              <Skeleton lines={5} />
            ) : (
              <OrganisationForm key={organisation.updated_at} org={organisation} onSaved={setOrgSaved} />
            )}
          </Section>

          <Section icon={<Globe2 size={18} />} title="Regional formats" description="How amounts, dates and distances are recorded.">
            {organisation ? (
              <div className="settings-grid">
                <ReadOnly label="Currency" value={organisation.currency} hint="Every cost in EVORA is recorded in this currency." />
                <ReadOnly label="Time zone" value={organisation.timezone} hint="Defines 'today' and monthly periods." />
                <ReadOnly label="Distance and energy" value="km · litres · kWh" hint="EVORA stores one unit per measure." />
              </div>
            ) : <Skeleton lines={2} />}
            <p className="settings-note">
              These are fixed after setup because existing records were entered in them. Contact EVORA support if they
              need to change.
            </p>
          </Section>

          <Section icon={<ShieldCheck size={18} />} title="Account & security" description="Your sign-in and session.">
            <div className="settings-grid">
              <ReadOnly label="Signed in as" value={current.email} />
              <ReadOnly label="Sign-in method" value={provider === "email" ? "Email and password" : provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : "—"} />
              <ReadOnly label="Member since" value={formatDay(current.created_at)} />
            </div>
            <p className="settings-note">Password and sign-in methods are managed by your sign-in provider.</p>
            <div className="settings-actions settings-actions--start">
              <button type="button" className="ops-btn ops-btn--secondary settings-signout" disabled={signingOut}
                onClick={() => { setSigningOut(true); void signOutAndGoHome(); }}>
                <LogOut size={16} aria-hidden="true" /> {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

function SettingsPage() {
  return (
    <OperationsProvider>
      <SettingsContent />
    </OperationsProvider>
  );
}

export default SettingsPage;
