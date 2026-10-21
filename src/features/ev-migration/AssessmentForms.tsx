import { useMemo, useState } from "react";
import { Calculator, Leaf } from "lucide-react";

import {
  listObservations,
  runEmissionsAssessment,
  runTcoAssessment,
  type EmissionsRequest,
  type InputSpec,
  type KnownAssessment,
  type TcoRequest,
} from "../../lib/intelligenceApi";
import { useResource } from "../operations/hooks";
import { useOps } from "../operations/useOps";
import { useSubmit } from "../operations/workspaceHooks";
import { SelectField, TextField } from "../operations/ui/Fields";
import { Definition, Disclosure, Segmented } from "../intelligence/ui";

type InlineOrigin = "organization_provided" | "assumed";

/** Financial comparison (TCO) for one ICE vehicle and one EV model. */
export function TcoForm({
  vehicleId,
  candidateId,
  onResult,
}: {
  vehicleId: string;
  candidateId: string;
  onResult: (a: KnownAssessment) => void;
}) {
  const { invalidate, toast } = useOps();
  const submit = useSubmit();
  const quotesParams = useMemo(
    () => ({ kind: "vehicle_purchase_price", vehicle_id: vehicleId }),
    [vehicleId],
  );
  const quotes = useResource(listObservations, quotesParams);
  const [horizon, setHorizon] = useState("");
  const [rate, setRate] = useState("");
  const [basis, setBasis] = useState<"real" | "nominal">("real");
  const [baseline, setBaseline] = useState<"retain_existing" | "replace_with_ice" | "">("");
  const [quoteId, setQuoteId] = useState("");
  const [sens, setSens] = useState("");
  const [distance, setDistance] = useState({ value: "", origin: "organization_provided" as InlineOrigin });

  const replacementQuotes = (quotes.data ?? []).filter((o) => o.qualifiers.purpose === "replacement_quote");

  const run = () =>
    submit.run(async () => {
      if (!baseline) throw new Error("Choose the ICE baseline.");
      const inputs: Record<string, InputSpec> = {};
      if (baseline === "replace_with_ice" && quoteId) inputs.ice_replacement_price = { observation_id: quoteId };
      if (distance.value !== "") {
        inputs.annual_distance_km = { value: Number(distance.value), unit: "km/year", origin: distance.origin };
      }
      const request: TcoRequest = {
        vehicle_id: vehicleId,
        ev_candidate_id: candidateId,
        horizon_years: Number(horizon),
        discount_rate: Number(rate) / 100,
        discount_rate_basis: basis,
        baseline,
        inputs,
      };
      if (sens !== "") request.sensitivity_fraction = Number(sens) / 100;
      const result = await runTcoAssessment(request);
      toast.success("TCO assessment stored.");
      invalidate();
      onResult(result);
    });

  const e = submit.errors;
  return (
    <form className="ops-form" onSubmit={(ev) => { ev.preventDefault(); void run(); }}>
      {submit.formError && <p className="ops-callout ops-callout--danger" role="alert">{submit.formError}</p>}
      <div className="ops-form__row ops-form__row--3">
        <TextField label="Horizon (years)" required type="number" min={1} max={30} step={1} value={horizon}
          error={e.horizon_years} onChange={(ev) => setHorizon(ev.target.value)} />
        <TextField label="Discount rate (%)" required type="number" min={0} max={99} step="any" value={rate}
          error={e.discount_rate} onChange={(ev) => setRate(ev.target.value)} />
        <div className="ops-field">
          <span className="ops-field__label">Rate basis</span>
          <Segmented label="Discount rate basis" value={basis} onChange={setBasis}
            options={[{ value: "real", label: "Real" }, { value: "nominal", label: "Nominal" }]} />
        </div>
      </div>
      <Definition>
        Costs are held flat in today&apos;s money, so a real discount rate is the consistent choice; a nominal
        rate is accepted with a warning.
      </Definition>
      <SelectField label="ICE baseline" required value={baseline} error={e.baseline}
        options={[
          { value: "retain_existing", label: "Keep the existing vehicle (no new investment)" },
          { value: "replace_with_ice", label: "Replace with a new combustion vehicle" },
        ]}
        placeholder="What is the EV compared against?"
        onChange={(ev) => setBaseline(ev.target.value as "retain_existing" | "replace_with_ice")} />
      {baseline === "replace_with_ice" && (
        <SelectField label="Replacement quotation" value={quoteId} error={e.ice_replacement_price}
          options={replacementQuotes.map((q) => ({
            value: q.id,
            label: `${q.value} ${q.unit} · in force ${q.effective_from ?? "—"}${q.source ? ` · ${q.source.title}` : ""}`,
          }))}
          placeholder={replacementQuotes.length ? "Select a quotation…" : "No replacement quotation recorded"}
          hint="Record it under Evidence as 'Vehicle purchase price' for this vehicle with purpose 'replacement quote'."
          onChange={(ev) => setQuoteId(ev.target.value)} />
      )}
      <Disclosure title="Optional settings" meta="sensitivity, distance override">
      <div className="ops-form__row">
        <TextField label="Sensitivity (± %)" type="number" min={1} max={90} step="any" value={sens}
          error={e.sensitivity_fraction} hint="Optional. Varies each input up and down by this share."
          onChange={(ev) => setSens(ev.target.value)} />
        <TextField label="Annual distance override (km/year)" type="number" step="any" value={distance.value}
          error={e.annual_distance_km}
          hint="Optional. Otherwise measured odometer history, then recorded figures."
          onChange={(ev) => setDistance((d) => ({ ...d, value: ev.target.value }))} />
      </div>
      {distance.value !== "" && (
        <SelectField label="The distance override is" value={distance.origin}
          options={[{ value: "organization_provided", label: "Organization-provided" }, { value: "assumed", label: "Assumed" }]}
          onChange={(ev) => setDistance((d) => ({ ...d, origin: ev.target.value as InlineOrigin }))} />
      )}
      </Disclosure>
      <div>
        <button type="submit" className="ops-btn ops-btn--primary" disabled={submit.busy}>
          <Calculator size={16} /> {submit.busy ? "Calculating…" : "Compare costs"}
        </button>
      </div>
    </form>
  );
}

/** Emissions comparison for one ICE vehicle and one EV model. */
export function EmissionsForm({
  vehicleId,
  candidateId,
  onResult,
}: {
  vehicleId: string;
  candidateId: string;
  onResult: (a: KnownAssessment) => void;
}) {
  const { invalidate, toast } = useOps();
  const submit = useSubmit();
  const [fuel, setFuel] = useState<EmissionsRequest["fuel_boundary"] | "">("");
  const [grid, setGrid] = useState<EmissionsRequest["grid_boundary"] | "">("");

  const run = () =>
    submit.run(async () => {
      if (!fuel || !grid) throw new Error("Choose both emission boundaries.");
      const result = await runEmissionsAssessment({
        vehicle_id: vehicleId,
        ev_candidate_id: candidateId,
        fuel_boundary: fuel,
        grid_boundary: grid,
      });
      toast.success("Emissions assessment stored.");
      invalidate();
      onResult(result);
    });

  return (
    <form className="ops-form" onSubmit={(ev) => { ev.preventDefault(); void run(); }}>
      {submit.formError && <p className="ops-callout ops-callout--danger" role="alert">{submit.formError}</p>}
      <div className="ops-form__row">
        <SelectField label="Fuel boundary" required value={fuel} error={submit.errors.fuel_boundary}
          options={[
            { value: "tank_to_wheel", label: "Tank-to-wheel (tailpipe)" },
            { value: "well_to_wheel", label: "Well-to-wheel (incl. fuel supply)" },
          ]}
          placeholder="Select…" onChange={(ev) => setFuel(ev.target.value as EmissionsRequest["fuel_boundary"])} />
        <SelectField label="Grid boundary" required value={grid} error={submit.errors.grid_boundary}
          options={[
            { value: "generation", label: "Generation" },
            { value: "consumption_incl_td_losses", label: "Consumption (incl. network losses)" },
          ]}
          placeholder="Select…" onChange={(ev) => setGrid(ev.target.value as EmissionsRequest["grid_boundary"])} />
      </div>
      <Definition>
        A recorded emission factor with the same boundary must exist. Lifecycle emissions (vehicle and
        battery manufacturing) are not included.
      </Definition>
      <div>
        <button type="submit" className="ops-btn ops-btn--primary" disabled={submit.busy}>
          <Leaf size={16} /> {submit.busy ? "Calculating…" : "Run emissions comparison"}
        </button>
      </div>
    </form>
  );
}
