/**
 * Typed calls for the shared intelligence foundation (evidence store,
 * EV Migration assessments, Health & Maintenance checks).
 *
 * Reuses `apiFetch` from ./api (auth, base URL, error handling) and the
 * query helpers from ./opsApi. No UI consumes these yet: they are the
 * contract the EV Migration and Health & Maintenance screens will build on.
 *
 * Numbers that the backend stores as decimals arrive as strings (DRF
 * DecimalField); calculated values inside assessment results are numbers.
 */
import { apiFetch } from "./api";
import { qs, type ListParams, type Paged } from "./opsApi";

/* ------------------------------------------------------------------ */
/* Provenance vocabulary                                               */
/* ------------------------------------------------------------------ */

export type Origin =
  | "measured"
  | "external"
  | "organization_provided"
  | "modelled"
  | "assumed";

export type EvidenceClass =
  | "measured"
  | "verified_external"
  | "unverified_external"
  | "organization_provided"
  | "modelled"
  | "assumed"
  | "stale"
  | "missing";

export type EvidenceLevel = "high" | "moderate" | "low" | "insufficient";

export interface SourceReference {
  id: string;
  title: string;
  source_type: string;
  publisher: string;
  identifier: string;
  url: string;
  retrieval_method: string;
  retrieved_at: string;
  verification_status: "unverified" | "verified" | "rejected";
  verified_at: string | null;
  last_refresh_status: "not_applicable" | "succeeded" | "failed";
}

export interface ResolvedInput {
  name: string;
  value: number | null;
  unit: string;
  origin: Origin | null;
  evidence_class: EvidenceClass;
  stale: boolean;
  stale_reason: string;
  observation_id: string | null;
  source: SourceReference | null;
  observed_at: string | null;
  period: { start: string; end: string } | null;
  effective: { from: string; to: string | null } | null;
  qualifiers: Record<string, string | number>;
  transformation: string;
  note: string;
  critical: boolean;
}

/** Either a stored observation or an inline, clearly-labelled value. */
export type InputSpec =
  | { observation_id: string }
  | {
      value: number;
      unit: string;
      origin: "organization_provided" | "assumed";
      note?: string;
    };

/* ------------------------------------------------------------------ */
/* Evidence store                                                      */
/* ------------------------------------------------------------------ */

export interface ObservationKind {
  key: string;
  label: string;
  unit: string;
  subjects: Array<"vehicle" | "depot" | "ev_candidate" | "organization">;
  temporal: "instant" | "period" | "effective";
  min_value: number;
  min_inclusive: boolean;
  max_value: number;
  max_age_days: number | null;
  qualifiers: Record<string, string[] | null>;
  required_qualifiers: string[];
  description: string;
}

export interface EvidenceSource {
  id: string;
  organization_id: string;
  title: string;
  source_type: string;
  publisher: string;
  identifier: string;
  url: string;
  retrieval_method: "manual_entry" | "document" | "file_import" | "api";
  retrieved_at: string;
  published_on: string | null;
  effective_from: string | null;
  effective_to: string | null;
  geographic_scope: string;
  applicability: string;
  methodology: string;
  notes: string;
  verification_status: "unverified" | "verified" | "rejected";
  verified_by_id: string | null;
  verified_at: string | null;
  verification_note: string;
  refresh_interval_days: number | null;
  last_refresh_status: "not_applicable" | "succeeded" | "failed";
  last_refresh_attempt_at: string | null;
  last_successful_refresh_at: string | null;
  last_refresh_error: string;
  created_at: string;
}

export type EvidenceSourceInput = Pick<
  EvidenceSource,
  "title" | "source_type" | "retrieval_method" | "retrieved_at"
> &
  Partial<
    Pick<
      EvidenceSource,
      | "publisher"
      | "identifier"
      | "url"
      | "published_on"
      | "effective_from"
      | "effective_to"
      | "geographic_scope"
      | "applicability"
      | "methodology"
      | "notes"
      | "refresh_interval_days"
    >
  >;

export interface Observation {
  id: string;
  organization_id: string;
  kind: string;
  value: string;
  unit: string;
  subject: "vehicle" | "depot" | "ev_candidate" | "organization";
  vehicle_id: string | null;
  depot_id: string | null;
  ev_candidate_id: string | null;
  qualifiers: Record<string, string | number>;
  origin: Origin;
  source_id: string | null;
  source: SourceReference | null;
  observed_at: string | null;
  period_start: string | null;
  period_end: string | null;
  effective_from: string | null;
  effective_to: string | null;
  validation_status: "valid" | "flagged";
  validation_notes: string[];
  transformation: string;
  note: string;
  supersedes_id: string | null;
  superseded_by_id: string | null;
  correction_reason: string;
  evidence_class: EvidenceClass;
  stale: boolean;
  stale_reason: string;
  created_at: string;
}

export interface ObservationInput {
  kind: string;
  value: number | string;
  unit: string;
  origin: Origin;
  vehicle_id?: string | null;
  depot_id?: string | null;
  ev_candidate_id?: string | null;
  source_id?: string | null;
  qualifiers?: Record<string, string | number>;
  observed_at?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  effective_from?: string | null;
  effective_to?: string | null;
  transformation?: string;
  note?: string;
}

export interface EnergyRecord {
  id: string;
  organization_id: string;
  vehicle_id: string;
  record_type: "fuel_fill" | "charging_session";
  occurred_at: string;
  quantity: string;
  unit: "L" | "kWh";
  energy_basis: "" | "grid" | "vehicle";
  is_full: boolean;
  odometer_km: string | null;
  cost: string | null;
  currency: string;
  depot_id: string | null;
  origin: Origin;
  source_id: string | null;
  note: string;
  voided_at: string | null;
  void_reason: string;
  created_at: string;
}

export type EnergyRecordInput = Omit<
  EnergyRecord,
  "id" | "organization_id" | "unit" | "voided_at" | "void_reason" | "created_at"
>;

export interface UsageProfile {
  vehicle_id: string;
  registration_number: string;
  measured: {
    odometer: {
      method_version: string;
      status: "ok" | "insufficient" | "invalid";
      reasons: string[];
      window: { start: string; end: string; days: number; timezone: string };
      reading_count: number;
      distance_km: number | null;
      span_days: number | null;
      window_coverage_fraction: number | null;
      annualised_distance_km: number | null;
      daily: {
        sample_count: number;
        mean_km: number | null;
        median_km: number | null;
        p90_km: number | null;
        max_observed_km: number | null;
        coefficient_of_variation: number | null;
        operating_days: number | null;
        operating_day_share: number | null;
      };
    };
    fuel_consumption: Record<string, unknown> & { status: string };
    energy_consumption: Record<string, unknown> & { status: string };
  };
  planned: {
    basis: "planned";
    completed_jobs: number;
    total_planned_km: number | null;
    max_planned_day_km: number | null;
  } & Record<string, unknown>;
  vehicle_record: { basis: "organization_provided" } & Record<
    string,
    unknown
  >;
}

export type AssessmentKind =
  | "ev_readiness"
  | "tco"
  | "emissions"
  | "maintenance_status";

export interface Assessment<R = Record<string, unknown>> {
  id: string;
  organization_id: string;
  kind: AssessmentKind;
  method_version: string;
  vehicle_id: string | null;
  ev_candidate_id: string | null;
  subject_snapshot: Record<string, unknown>;
  status: "completed" | "insufficient_evidence";
  evidence_level: EvidenceLevel;
  evidence_reasons: string[];
  input_snapshot: {
    inputs: Record<string, ResolvedInput>;
    context: Record<string, unknown>;
  };
  parameters: Record<string, unknown>;
  result: R;
  missing_inputs: string[];
  warnings: string[];
  fingerprint: string;
  created_by_id: string | null;
  created_at: string;
}

export interface ReproduceResult {
  assessment_id: string;
  method_version: string;
  fingerprint_matches: boolean;
  result_matches: boolean;
  status_matches: boolean;
  evidence_level_matches: boolean;
  recomputed_result: Record<string, unknown>;
}

export function listObservationKinds(): Promise<ObservationKind[]> {
  return apiFetch("/evidence/kinds");
}

export function listEvidenceSources(
  params: ListParams = {},
): Promise<EvidenceSource[] | Paged<EvidenceSource>> {
  return apiFetch(`/evidence/sources${qs(params)}`);
}

export function createEvidenceSource(
  input: EvidenceSourceInput,
): Promise<EvidenceSource> {
  return apiFetch("/evidence/sources", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function verifyEvidenceSource(
  id: string,
  status: "verified" | "rejected",
  note: string,
): Promise<EvidenceSource> {
  return apiFetch(`/evidence/sources/${id}/verify`, {
    method: "POST",
    body: JSON.stringify({ status, note }),
  });
}

export interface ObservationListParams extends ListParams {
  kind?: string;
  vehicle_id?: string;
  depot_id?: string;
  ev_candidate_id?: string;
  subject?: "organization";
  include_superseded?: boolean;
}

export function listObservations(
  params: ObservationListParams = {},
): Promise<Observation[] | Paged<Observation>> {
  return apiFetch(`/evidence/observations${qs(params)}`);
}

export function createObservation(
  input: ObservationInput,
): Promise<Observation> {
  return apiFetch("/evidence/observations", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function supersedeObservation(
  id: string,
  input: ObservationInput & { correction_reason: string },
): Promise<Observation> {
  return apiFetch(`/evidence/observations/${id}/supersede`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function importObservations(
  file: File,
  sourceId: string,
): Promise<{ imported: number; source_id: string; observation_ids: string[] }> {
  const form = new FormData();
  form.append("file", file);
  form.append("source_id", sourceId);
  return apiFetch("/evidence/observations/import", {
    method: "POST",
    body: form,
  });
}

export function listEnergyRecords(
  params: ListParams & { vehicle_id?: string; record_type?: string } = {},
): Promise<EnergyRecord[] | Paged<EnergyRecord>> {
  return apiFetch(`/evidence/energy-records${qs(params)}`);
}

export function createEnergyRecord(
  input: EnergyRecordInput,
): Promise<EnergyRecord> {
  return apiFetch("/evidence/energy-records", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function voidEnergyRecord(
  id: string,
  reason: string,
): Promise<EnergyRecord> {
  return apiFetch(`/evidence/energy-records/${id}/void`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function getVehicleUsage(
  vehicleId: string,
  windowDays?: number,
): Promise<UsageProfile> {
  return apiFetch(
    `/evidence/vehicles/${vehicleId}/usage${qs({ window_days: windowDays })}`,
  );
}

export function listAssessments(
  params: ListParams & {
    kind?: string;
    vehicle_id?: string;
    ev_candidate_id?: string;
  } = {},
): Promise<Assessment[] | Paged<Assessment>> {
  return apiFetch(`/evidence/assessments${qs(params)}`);
}

export function getAssessment(id: string): Promise<Assessment> {
  return apiFetch(`/evidence/assessments/${id}`);
}

export function reproduceAssessment(id: string): Promise<ReproduceResult> {
  return apiFetch(`/evidence/assessments/${id}/reproduce`, {
    method: "POST",
    body: "{}",
  });
}

/* ------------------------------------------------------------------ */
/* EV Migration                                                        */
/* ------------------------------------------------------------------ */

export interface EvCandidate {
  id: string;
  organization_id: string;
  label: string;
  manufacturer: string;
  model: string;
  variant: string;
  vehicle_type: string;
  usable_battery_kwh: string;
  energy_consumption_kwh_per_km: string;
  consumption_basis: "grid" | "vehicle";
  consumption_source_type:
    | "manufacturer_rated"
    | "measured_trial"
    | "measured_fleet";
  consumption_conditions: string;
  payload_kg: string;
  gvw_kg: string | null;
  max_ac_charge_kw: string | null;
  max_dc_charge_kw: string | null;
  rated_range_km: string | null;
  rated_range_cycle: string;
  origin: "external" | "measured";
  source_id: string;
  source: SourceReference;
  created_at: string;
}

export type EvCandidateInput = Omit<
  EvCandidate,
  "id" | "organization_id" | "label" | "source" | "created_at"
>;

interface AssessmentRequestBase {
  vehicle_id: string;
  ev_candidate_id: string;
  usage_window_days?: number;
  inputs?: Record<string, InputSpec>;
}

export interface ReadinessRequest extends AssessmentRequestBase {
  reserve_fraction: number;
  charging_connector: "ac" | "dc";
  design_day_distance:
    | { basis: "measured_p90" | "measured_max" | "planned_max" }
    | { value: number; unit: "km"; origin: "organization_provided" | "assumed"; note?: string };
}

export interface ReadinessCheck {
  check: "range" | "payload" | "charging";
  status: "pass" | "fail" | "insufficient";
  explanation: string;
  values: Record<string, number | null>;
}

export interface ReadinessResult {
  method_version: string;
  outcome: "meets_requirements" | "not_suitable" | "insufficient_evidence";
  eligible_for_scoring: boolean;
  checks: ReadinessCheck[];
  derived: Record<string, number | null>;
  rated_range_km: number | null;
  rated_range_note: string;
  warnings: string[];
  limitations: string[];
}

export interface TcoRequest extends AssessmentRequestBase {
  horizon_years: number;
  discount_rate: number;
  discount_rate_basis?: "real" | "nominal";
  baseline: "retain_existing" | "replace_with_ice";
  sensitivity_fraction?: number;
}

export interface CashFlowRow {
  year: number;
  investment: number;
  operating: number;
  residual_credit: number;
  net_cost: number;
  discount_factor: number;
  discounted_net_cost: number;
}

export interface TcoScenario {
  initial_investment: number;
  annual_costs: Record<string, number>;
  annual_operating_total: number;
  residual_value: number | null;
  cash_flows: CashFlowRow[];
  net_present_cost: number;
  levelised_cost_per_km: number;
  operating_cost_per_km: number;
  energy_quantity: Record<string, number>;
  investment_breakdown?: Record<string, number>;
}

export type TcoResult =
  | { method_version: string; status: "insufficient"; missing: string[]; currency: string }
  | {
      method_version: string;
      status: "ok";
      currency: string;
      common: { annual_distance_km: number; horizon_years: number; discount_rate: number };
      ice: TcoScenario;
      ev: TcoScenario;
      net_present_savings: number;
      extra_upfront_cost: number;
      annual_operating_saving: number;
      simple_payback_years: number | null;
      discounted_payback_years: number | null;
      excluded_categories: string[];
      notes: string[];
      sensitivity?: Array<Record<string, number | string | null>>;
    };

export interface EmissionsRequest extends AssessmentRequestBase {
  fuel_boundary: "tank_to_wheel" | "well_to_wheel";
  grid_boundary: "generation" | "consumption_incl_td_losses";
}

export function listEvCandidates(
  params: ListParams & { vehicle_type?: string } = {},
): Promise<EvCandidate[] | Paged<EvCandidate>> {
  return apiFetch(`/ev-migration/candidates${qs(params)}`);
}

export function createEvCandidate(
  input: EvCandidateInput,
): Promise<EvCandidate> {
  return apiFetch("/ev-migration/candidates", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function runReadinessAssessment(
  input: ReadinessRequest,
): Promise<Assessment<ReadinessResult>> {
  return apiFetch("/ev-migration/assessments/readiness", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function runTcoAssessment(
  input: TcoRequest,
): Promise<Assessment<TcoResult>> {
  return apiFetch("/ev-migration/assessments/tco", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function runEmissionsAssessment(
  input: EmissionsRequest,
): Promise<Assessment> {
  return apiFetch("/ev-migration/assessments/emissions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface MigrationDecision {
  id: string;
  organization_id: string;
  vehicle_id: string | null;
  vehicle_snapshot: Record<string, unknown>;
  ev_candidate_id: string | null;
  decision: "approve_transition" | "defer" | "reject";
  readiness_assessment_id: string | null;
  tco_assessment_id: string | null;
  emissions_assessment_id: string | null;
  rationale: string;
  decided_by_id: string | null;
  decided_at: string;
}

export function recordMigrationDecision(
  input: Omit<
    MigrationDecision,
    "id" | "organization_id" | "vehicle_snapshot" | "decided_by_id" | "decided_at"
  >,
): Promise<MigrationDecision> {
  return apiFetch("/ev-migration/decisions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listMigrationDecisions(
  params: ListParams & { vehicle_id?: string } = {},
): Promise<MigrationDecision[] | Paged<MigrationDecision>> {
  return apiFetch(`/ev-migration/decisions${qs(params)}`);
}

/* ------------------------------------------------------------------ */
/* Health & Maintenance                                                */
/* ------------------------------------------------------------------ */

export interface ServiceRequirement {
  id: string;
  organization_id: string;
  vehicle_id: string;
  name: string;
  component: string;
  interval_km: string | null;
  interval_days: number | null;
  warning_km: string | null;
  warning_days: number | null;
  source_id: string;
  source: SourceReference;
  retired_at: string | null;
  retired_reason: string;
  created_at: string;
}

export type MaintenanceEventType =
  | "scheduled_service"
  | "inspection"
  | "repair"
  | "component_replacement"
  | "fault_report";

export interface MaintenanceEvent {
  id: string;
  organization_id: string;
  vehicle_id: string;
  event_type: MaintenanceEventType;
  occurred_on: string;
  completed_on: string | null;
  odometer_km: string | null;
  requirement_id: string | null;
  component: string;
  fault_code: string;
  fault_severity: "" | "unknown" | "low" | "medium" | "high" | "critical";
  resolves_id: string | null;
  description: string;
  provider: string;
  cost: string | null;
  currency: string;
  downtime_hours: string | null;
  origin: "measured" | "organization_provided";
  source_id: string | null;
  voided_at: string | null;
  void_reason: string;
  created_at: string;
}

export interface MaintenanceStatus {
  vehicle_id: string;
  parameters: { as_of: string; window_days: number };
  evidence: Record<string, ResolvedInput>;
  result: {
    method_version: string;
    as_of: string;
    service_requirements: Array<{
      requirement_id: string;
      name: string;
      status: "overdue" | "due_soon" | "ok" | "undetermined";
      dimensions: Record<string, Record<string, unknown>>;
      source: SourceReference;
      notes: string[];
      kind: "schedule_check";
    }>;
    counts: Record<string, number>;
    open_faults: Array<Record<string, unknown>>;
    battery: Record<string, unknown>;
    records: Record<string, unknown>;
    predictive_assessment: { available: false; reason: string };
    messages: string[];
  };
}

export function listServiceRequirements(
  params: ListParams & { vehicle_id?: string; include_retired?: boolean } = {},
): Promise<ServiceRequirement[] | Paged<ServiceRequirement>> {
  return apiFetch(`/maintenance/requirements${qs(params)}`);
}

export function createServiceRequirement(
  input: Omit<
    ServiceRequirement,
    "id" | "organization_id" | "source" | "retired_at" | "retired_reason" | "created_at"
  >,
): Promise<ServiceRequirement> {
  return apiFetch("/maintenance/requirements", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listMaintenanceEvents(
  params: ListParams & { vehicle_id?: string; event_type?: string } = {},
): Promise<MaintenanceEvent[] | Paged<MaintenanceEvent>> {
  return apiFetch(`/maintenance/events${qs(params)}`);
}

export function createMaintenanceEvent(
  input: Omit<
    MaintenanceEvent,
    "id" | "organization_id" | "voided_at" | "void_reason" | "created_at"
  >,
): Promise<MaintenanceEvent> {
  return apiFetch("/maintenance/events", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function voidMaintenanceEvent(
  id: string,
  reason: string,
): Promise<MaintenanceEvent> {
  return apiFetch(`/maintenance/events/${id}/void`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function getMaintenanceStatus(
  vehicleId: string,
  windowDays?: number,
): Promise<MaintenanceStatus> {
  return apiFetch(
    `/maintenance/vehicles/${vehicleId}/status${qs({ window_days: windowDays })}`,
  );
}

export function persistMaintenanceAssessment(
  vehicleId: string,
  windowDays?: number,
): Promise<Assessment> {
  return apiFetch("/maintenance/assessments", {
    method: "POST",
    body: JSON.stringify({ vehicle_id: vehicleId, window_days: windowDays }),
  });
}
