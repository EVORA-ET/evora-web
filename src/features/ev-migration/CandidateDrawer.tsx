import { useState } from "react";

import { createEvCandidate, type EvCandidate, type EvCandidateInput } from "../../lib/intelligenceApi";
import { useOps } from "../operations/useOps";
import { useSubmit } from "../operations/workspaceHooks";
import Drawer from "../operations/ui/Drawer";
import { SelectField, TextArea, TextField } from "../operations/ui/Fields";
import { SourceSelect } from "../intelligence/SourceDrawer";

const VEHICLE_TYPES = ["truck", "van", "bus", "car", "trailer", "other"].map((v) => ({
  value: v,
  label: v.charAt(0).toUpperCase() + v.slice(1),
}));

const CONSUMPTION_SOURCE = [
  { value: "manufacturer_rated", label: "Manufacturer-rated (external)" },
  { value: "measured_trial", label: "Measured in a trial" },
  { value: "measured_fleet", label: "Measured in our fleet" },
];

/** Record an EV model specification with its cited source. */
function CandidateDrawer({
  open,
  onClose,
  onCreated,
  defaultVehicleType,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (candidate: EvCandidate) => void;
  defaultVehicleType?: string;
}) {
  const { invalidate, toast } = useOps();
  const submit = useSubmit();
  const [f, setF] = useState({
    manufacturer: "",
    model: "",
    variant: "",
    vehicle_type: defaultVehicleType ?? "",
    usable_battery_kwh: "",
    energy_consumption_kwh_per_km: "",
    consumption_basis: "",
    consumption_source_type: "",
    consumption_conditions: "",
    payload_kg: "",
    gvw_kg: "",
    max_ac_charge_kw: "",
    max_dc_charge_kw: "",
    rated_range_km: "",
    rated_range_cycle: "",
    source_id: "",
  });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = () =>
    submit.run(async () => {
      const input: EvCandidateInput = {
        manufacturer: f.manufacturer.trim(),
        model: f.model.trim(),
        variant: f.variant.trim(),
        vehicle_type: f.vehicle_type,
        usable_battery_kwh: f.usable_battery_kwh,
        energy_consumption_kwh_per_km: f.energy_consumption_kwh_per_km,
        consumption_basis: f.consumption_basis as EvCandidateInput["consumption_basis"],
        consumption_source_type: f.consumption_source_type as EvCandidateInput["consumption_source_type"],
        consumption_conditions: f.consumption_conditions.trim(),
        payload_kg: f.payload_kg,
        gvw_kg: f.gvw_kg || null,
        max_ac_charge_kw: f.max_ac_charge_kw || null,
        max_dc_charge_kw: f.max_dc_charge_kw || null,
        rated_range_km: f.rated_range_km || null,
        rated_range_cycle: f.rated_range_cycle.trim(),
        // Manufacturer figures are external; trial/fleet figures are measured.
        origin: f.consumption_source_type === "manufacturer_rated" ? "external" : "measured",
        source_id: f.source_id,
      };
      const created = await createEvCandidate(input);
      toast.success(`${created.label} recorded.`);
      invalidate();
      onCreated(created);
    });

  const e = submit.errors;
  return (
    <Drawer
      open={open}
      title="Add an EV model not in the catalogue"
      subtitle="A specification from a cited document or measurement. Prices and incentives are recorded separately as dated evidence."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ops-btn ops-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="ops-btn ops-btn--primary" onClick={save} disabled={submit.busy}>
            {submit.busy ? "Saving…" : "Save candidate"}
          </button>
        </>
      }
    >
      <form className="ops-form" onSubmit={(ev) => { ev.preventDefault(); void save(); }}>
        {submit.formError && <p className="ops-callout ops-callout--danger" role="alert">{submit.formError}</p>}
        <div className="ops-form__row">
          <TextField label="Manufacturer" required value={f.manufacturer} error={e.manufacturer}
            onChange={(ev) => set("manufacturer", ev.target.value)} />
          <TextField label="Model" required value={f.model} error={e.model} onChange={(ev) => set("model", ev.target.value)} />
        </div>
        <div className="ops-form__row">
          <TextField label="Variant" value={f.variant} error={e.variant} onChange={(ev) => set("variant", ev.target.value)} />
          <SelectField label="Vehicle type" required value={f.vehicle_type} error={e.vehicle_type}
            options={VEHICLE_TYPES} placeholder="Select…" onChange={(ev) => set("vehicle_type", ev.target.value)} />
        </div>
        <div className="ops-form__row">
          <TextField label="Usable battery (kWh)" required type="number" step="any" value={f.usable_battery_kwh}
            error={e.usable_battery_kwh} onChange={(ev) => set("usable_battery_kwh", ev.target.value)} />
          <TextField label="Payload (kg)" required type="number" step="any" value={f.payload_kg}
            error={e.payload_kg} onChange={(ev) => set("payload_kg", ev.target.value)} />
        </div>
        <div className="ops-form__row">
          <TextField label="Energy consumption (kWh/km)" required type="number" step="any"
            value={f.energy_consumption_kwh_per_km} error={e.energy_consumption_kwh_per_km}
            hint="kWh per km, not Wh/km or km/kWh"
            onChange={(ev) => set("energy_consumption_kwh_per_km", ev.target.value)} />
          <SelectField label="Consumption measured at" required value={f.consumption_basis}
            error={e.consumption_basis} placeholder="Select…"
            options={[
              { value: "vehicle", label: "Battery (vehicle-side)" },
              { value: "grid", label: "Charger (grid-side, incl. losses)" },
            ]}
            onChange={(ev) => set("consumption_basis", ev.target.value)} />
        </div>
        <SelectField label="Consumption figure comes from" required value={f.consumption_source_type}
          error={e.consumption_source_type ?? e.origin} options={CONSUMPTION_SOURCE} placeholder="Select…"
          hint="Manufacturer-rated figures are flagged in every readiness result as not measured on your duty cycle."
          onChange={(ev) => set("consumption_source_type", ev.target.value)} />
        <TextArea label="Consumption conditions" value={f.consumption_conditions}
          error={e.consumption_conditions} hint="Test cycle, load, route type"
          onChange={(ev) => set("consumption_conditions", ev.target.value)} />
        <div className="ops-form__row ops-form__row--3">
          <TextField label="Max AC charge (kW)" type="number" step="any" value={f.max_ac_charge_kw}
            error={e.max_ac_charge_kw} onChange={(ev) => set("max_ac_charge_kw", ev.target.value)} />
          <TextField label="Max DC charge (kW)" type="number" step="any" value={f.max_dc_charge_kw}
            error={e.max_dc_charge_kw} onChange={(ev) => set("max_dc_charge_kw", ev.target.value)} />
          <TextField label="GVW (kg)" type="number" step="any" value={f.gvw_kg} error={e.gvw_kg}
            onChange={(ev) => set("gvw_kg", ev.target.value)} />
        </div>
        <div className="ops-form__row">
          <TextField label="Certified range (km)" type="number" step="any" value={f.rated_range_km}
            error={e.rated_range_km} hint="Shown for reference only; never used in readiness checks."
            onChange={(ev) => set("rated_range_km", ev.target.value)} />
          <TextField label="Test cycle" value={f.rated_range_cycle} error={e.rated_range_cycle}
            onChange={(ev) => set("rated_range_cycle", ev.target.value)} />
        </div>
        <SourceSelect required value={f.source_id} error={e.source_id} onChange={(id) => set("source_id", id)} />
      </form>
    </Drawer>
  );
}

export default CandidateDrawer;
