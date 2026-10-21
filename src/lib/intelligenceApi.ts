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

/** List filters for endpoints called without paging (bare-array response). */
export type ListFilters = Omit<ListParams, "page" | "page_size">;

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
  /** Ids of the stored records a derived measured value was calculated from. */
  derived_from_ids?: string[];
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
  /** Append-only record of every verify/reject decision and refresh reset. */
  verification_history: Array<{
    status: "unverified" | "verified" | "rejected";
    note: string;
    decided_by_id: string | null;
    decided_at: string;
  }>;
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

/** Fill-to-fill consumption (evidence/usage.py). Absent fields = not derived. */
export interface FillToFill {
  status: "ok" | "insufficient" | "invalid";
  reasons: string[];
  distance_km?: number;
  records_used?: number;
  record_ids?: string[];
  fuel_l?: number;
  km_per_l?: number;
  l_per_100km?: number;
  energy_kwh?: number;
  kwh_per_km?: number;
  basis?: "grid" | "vehicle";
}

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
    fuel_consumption: FillToFill;
    energy_consumption: FillToFill;
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
  subject_snapshot: SubjectSnapshot;
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

export interface SubjectSnapshot {
  vehicle?: {
    vehicle_id?: string;
    id?: string;
    registration_number: string;
    manufacturer?: string;
    model?: string;
    vehicle_type?: string;
    fuel_type?: string;
  };
  ev_candidate?: { ev_candidate_id: string; label: string; vehicle_type?: string };
}

/** An assessment whose `result` type follows from its `kind`. */
export type KnownAssessment =
  | (Assessment<ReadinessResult> & { kind: "ev_readiness" })
  | (Assessment<TcoResult> & { kind: "tco" })
  | (Assessment<EmissionsResult> & { kind: "emissions" })
  | (Assessment<MaintenanceResult> & { kind: "maintenance_status" });

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
  params: ListFilters = {},
): Promise<EvidenceSource[]> {
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

export interface ObservationListParams extends ListFilters {
  kind?: string;
  vehicle_id?: string;
  depot_id?: string;
  ev_candidate_id?: string;
  subject?: "organization";
  include_superseded?: boolean;
}

export function listObservations(
  params: ObservationListParams = {},
): Promise<Observation[]> {
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
  params: ListFilters & { vehicle_id?: string; record_type?: string } = {},
): Promise<EnergyRecord[]> {
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
  params: ListFilters & {
    kind?: string;
    vehicle_id?: string;
    ev_candidate_id?: string;
  } = {},
): Promise<AssessmentSummary[]> {
  return apiFetch(`/evidence/assessments${qs(params)}`);
}

export function getAssessment(id: string): Promise<KnownAssessment> {
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
  /** Set when EVORA created this record from its EV catalogue. */
  catalogue_model_id: string | null;
  created_at: string;
}

export type EvCandidateInput = Omit<
  EvCandidate,
  "id" | "organization_id" | "label" | "source" | "catalogue_model_id" | "created_at"
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
      simple_payback_note: string;
      discounted_payback_note: string;
      net_present_savings_note: string;
      excluded_categories: string[];
      notes: string[];
      sensitivity?: SensitivityRow[];
    };

export interface SensitivityRow {
  input: string;
  base_value: number;
  base_net_present_savings: number;
  low_value: number;
  low_net_present_savings: number | null;
  high_value: number;
  high_net_present_savings: number | null;
  low_error?: string;
  high_error?: string;
}

export interface EmissionsRequest extends AssessmentRequestBase {
  fuel_boundary: "tank_to_wheel" | "well_to_wheel";
  grid_boundary: "generation" | "consumption_incl_td_losses";
}

export function listEvCandidates(
  params: ListFilters & { vehicle_type?: string } = {},
): Promise<EvCandidate[]> {
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
): Promise<Assessment<ReadinessResult> & { kind: "ev_readiness" }> {
  return apiFetch("/ev-migration/assessments/readiness", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function runTcoAssessment(
  input: TcoRequest,
): Promise<Assessment<TcoResult> & { kind: "tco" }> {
  return apiFetch("/ev-migration/assessments/tco", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function runEmissionsAssessment(
  input: EmissionsRequest,
): Promise<Assessment<EmissionsResult> & { kind: "emissions" }> {
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
  params: ListFilters & { vehicle_id?: string } = {},
): Promise<MigrationDecision[]> {
  return apiFetch(`/ev-migration/decisions${qs(params)}`);
}

/* ------------------------------------------------------------------ */
/* Health & Maintenance                                                */
/* ------------------------------------------------------------------ */

export interface ServiceRequirement {
  id: string;
  organization_id: string;
  vehicle_id: string;
  vehicle_registration: string;
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
  vehicle_registration: string;
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

export interface ServiceDimension {
  status: ServiceStatus;
  reason?: string;
  baseline_date?: string;
  baseline_basis?: string;
  due_date?: string;
  days_remaining?: number;
  warning_days?: number | null;
  baseline_odometer_km?: number;
  due_odometer_km?: number;
  current_odometer_km?: number;
  current_odometer_at?: string | null;
  km_remaining?: number;
  warning_km?: number | null;
}

export interface ServiceRequirementResult {
  requirement_id: string;
  name: string;
  component: string;
  interval_km: number | null;
  interval_days: number | null;
  source: SourceReference;
  status: ServiceStatus;
  dimensions: { time?: ServiceDimension; distance?: ServiceDimension };
  last_event_id: string | null;
  notes: string[];
  kind: "schedule_check";
}

export interface OpenFault {
  event_id: string;
  fault_code: string;
  severity: string;
  component: string;
  reported_on: string;
  days_open: number;
  description: string;
  status: "review_required";
}

export interface BatteryReading {
  pct: number;
  at: string | null;
  method?: string;
  stale?: boolean;
  stale_reason?: string;
  observation_id?: string;
  source?: SourceReference | null;
}

export interface BatteryCheck {
  applicable: boolean;
  state_of_health?: BatteryReading | null;
  warranty_threshold?: { pct: number; source: SourceReference | null; observation_id: string } | null;
  warranty_check?: { status: "below_threshold" | "at_or_above_threshold"; explanation: string } | null;
  capacity_retention?: {
    measured_capacity_kwh: number;
    nominal_capacity_kwh: number;
    retention_pct: number;
    basis: "measured" | "estimated";
    method: string;
    at: string | null;
    stale: boolean;
  } | null;
  state_of_charge?: { pct: number; at: string | null; note: string } | null;
  messages?: string[];
}

export interface MaintenanceRecordsSummary {
  window: { start: string; end: string };
  event_count: number;
  events_by_type: Partial<Record<MaintenanceEventType, number>>;
  recorded_cost_by_currency: Record<string, number>;
  events_without_cost: number;
  recorded_downtime_hours: number | null;
  events_with_downtime: number;
  repair_count: number;
  note: string;
}

export interface MaintenanceResult {
  method_version: string;
  as_of: string;
  service_requirements: ServiceRequirementResult[];
  counts: Record<ServiceStatus | "open_faults", number>;
  open_faults: OpenFault[];
  battery: BatteryCheck;
  records: MaintenanceRecordsSummary;
  predictive_assessment: { available: false; reason: string };
  messages: string[];
}

export interface MaintenanceStatus {
  vehicle_id: string;
  parameters: { as_of: string; window_days: number };
  evidence: Record<string, ResolvedInput>;
  result: MaintenanceResult;
}

export interface EmissionsResult {
  method_version: string;
  status: "ok" | "insufficient";
  missing?: string[];
  annual_distance_km?: number;
  baseline?: {
    fuel_l_per_year: number;
    factor_kgco2e_per_l: number;
    boundary: string;
    kgco2e_per_year: number;
  };
  ev?: {
    grid_kwh_per_year: number;
    factor_kgco2e_per_kwh: number;
    boundary: string;
    kgco2e_per_year: number;
    tailpipe_kgco2e_per_year: number;
    note: string;
  };
  reduction_kgco2e_per_year?: number;
  reduction_fraction?: number | null;
  comparison_boundary?: string;
  comparison_note?: string;
  excluded?: string[];
}

export function listServiceRequirements(
  params: ListFilters & { vehicle_id?: string; include_retired?: boolean } = {},
): Promise<ServiceRequirement[]> {
  return apiFetch(`/maintenance/requirements${qs(params)}`);
}

export function createServiceRequirement(
  input: Omit<
    ServiceRequirement,
    | "id"
    | "organization_id"
    | "vehicle_registration"
    | "source"
    | "retired_at"
    | "retired_reason"
    | "created_at"
  >,
): Promise<ServiceRequirement> {
  return apiFetch("/maintenance/requirements", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listMaintenanceEvents(
  params: ListFilters & { vehicle_id?: string; event_type?: string } = {},
): Promise<MaintenanceEvent[]> {
  return apiFetch(`/maintenance/events${qs(params)}`);
}

export function createMaintenanceEvent(
  input: Omit<
    MaintenanceEvent,
    | "id"
    | "organization_id"
    | "vehicle_registration"
    | "voided_at"
    | "void_reason"
    | "created_at"
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
): Promise<Assessment<MaintenanceResult> & { kind: "maintenance_status" }> {
  return apiFetch("/maintenance/assessments", {
    method: "POST",
    body: JSON.stringify({ vehicle_id: vehicleId, window_days: windowDays }),
  });
}

/* ------------------------------------------------------------------ */
/* Assessment summaries, paging and single-record reads                */
/* ------------------------------------------------------------------ */

/** Values copied verbatim from the stored result by the list endpoint. */
export interface AssessmentHeadline {
  outcome?: ReadinessResult["outcome"] | null;
  checks?: Partial<Record<ReadinessCheck["check"], ReadinessCheck["status"]>>;
  result_status?: "ok" | "insufficient" | null;
  currency?: string | null;
  net_present_savings?: number | null;
  simple_payback_years?: number | null;
  discounted_payback_years?: number | null;
  reduction_kgco2e_per_year?: number | null;
  comparison_boundary?: string | null;
  counts?: Record<string, number> | null;
}

export interface AssessmentSummary {
  id: string;
  kind: AssessmentKind;
  method_version: string;
  vehicle_id: string | null;
  ev_candidate_id: string | null;
  subject_snapshot: SubjectSnapshot;
  status: "completed" | "insufficient_evidence";
  evidence_level: EvidenceLevel;
  missing_inputs: string[];
  warnings: string[];
  headline: AssessmentHeadline;
  fingerprint: string;
  created_at: string;
}

export function getEvidenceSource(id: string): Promise<EvidenceSource> {
  return apiFetch(`/evidence/sources/${id}`);
}

export function getObservation(id: string): Promise<Observation> {
  return apiFetch(`/evidence/observations/${id}`);
}

export function getEvCandidate(id: string): Promise<EvCandidate> {
  return apiFetch(`/ev-migration/candidates/${id}`);
}

export function listObservationsPage(
  params: ObservationListParams & { page: number; page_size: number },
): Promise<Paged<Observation>> {
  return apiFetch(`/evidence/observations${qs(params)}`);
}

export function listMaintenanceEventsPage(
  params: ListParams & {
    page: number;
    page_size: number;
    vehicle_id?: string;
    event_type?: string;
    include_voided?: boolean;
  },
): Promise<Paged<MaintenanceEvent>> {
  return apiFetch(`/maintenance/events${qs(params)}`);
}

export function retireServiceRequirement(
  id: string,
  reason: string,
): Promise<ServiceRequirement> {
  return apiFetch(`/maintenance/requirements/${id}/retire`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

/* ------------------------------------------------------------------ */
/* Fleet maintenance status                                            */
/* ------------------------------------------------------------------ */

export type ServiceStatus = "overdue" | "due_soon" | "ok" | "undetermined";

export interface FleetMaintenanceRow {
  vehicle_id: string;
  registration_number: string;
  manufacturer: string;
  model: string;
  fuel_type: string;
  vehicle_status: string;
  worst_service_status: ServiceStatus | null;
  counts: Record<ServiceStatus | "open_faults", number>;
  evidence_level: EvidenceLevel;
  battery_soh: { pct: number; at: string | null; method: string; stale: boolean } | null;
  last_event_on: string | null;
  requirements: Array<{
    requirement_id: string;
    name: string;
    status: ServiceStatus;
    /** Date of the last recorded service that satisfied this requirement. */
    last_service_on: string | null;
    due_date: string | null;
    days_remaining: number | null;
    due_odometer_km: number | null;
    km_remaining: number | null;
    undetermined_reasons: string[];
  }>;
}

export interface FleetMaintenanceStatus {
  method_version: string;
  as_of: string;
  window_days: number;
  vehicles_in_scope: number;
  vehicles_evaluated: number;
  vehicles_without_records: number;
  definition: string;
  totals: Record<ServiceStatus | "open_faults", number>;
  vehicles: FleetMaintenanceRow[];
}

export function getFleetMaintenanceStatus(
  windowDays?: number,
): Promise<FleetMaintenanceStatus> {
  return apiFetch(`/maintenance/fleet-status${qs({ window_days: windowDays })}`);
}

/* ------------------------------------------------------------------ */
/* Migration planning                                                  */
/* ------------------------------------------------------------------ */

export type PlanStatus = "draft" | "active" | "archived";
export type PlanItemStatus =
  | "planned"
  | "in_progress"
  | "completed"
  | "deferred"
  | "cancelled";

export interface MigrationPlan {
  id: string;
  organization_id: string;
  name: string;
  description: string;
  status: PlanStatus;
  start_date: string | null;
  end_date: string | null;
  budget_amount: string | null;
  currency: string;
  assumptions: string;
  /** Goal for the share of the fleet that is electric by end_date. */
  target_ev_share_pct: string | null;
  summary: {
    item_count: number;
    by_status: Record<PlanItemStatus, number>;
    completed_fraction: number | null;
    completed_fraction_note: string;
    estimated_cost_total: string | null;
    items_without_cost: number;
    phases: number[];
  };
  created_at: string;
  updated_at: string;
}

export type MigrationPlanInput = Partial<
  Pick<
    MigrationPlan,
    | "name"
    | "description"
    | "status"
    | "start_date"
    | "end_date"
    | "budget_amount"
    | "assumptions"
    | "target_ev_share_pct"
  >
>;

export interface LinkedAssessmentRef {
  id: string;
  kind: AssessmentKind;
  status: Assessment["status"];
  evidence_level: EvidenceLevel;
  outcome: ReadinessResult["outcome"] | null;
  net_present_savings: number | null;
  currency: string | null;
  created_at: string;
}

export interface PlanItemFlag {
  code: string;
  text: string;
}

export interface MigrationPlanItem {
  id: string;
  plan_id: string;
  plan_name: string;
  vehicle_id: string;
  vehicle: {
    id: string;
    registration_number: string;
    manufacturer: string;
    model: string;
    vehicle_type: string;
    fuel_type: string;
    depot_id: string | null;
  };
  ev_candidate_id: string | null;
  ev_candidate_label: string | null;
  phase: number;
  target_date: string | null;
  estimated_cost: string | null;
  readiness_assessment_id: string | null;
  readiness: LinkedAssessmentRef | null;
  tco_assessment_id: string | null;
  tco: LinkedAssessmentRef | null;
  decision_id: string | null;
  decision: { id: string; decision: MigrationDecision["decision"]; decided_at: string } | null;
  status: PlanItemStatus;
  completed_on: string | null;
  notes: string;
  flags: PlanItemFlag[];
  status_history: Array<{
    from_status: string;
    to_status: PlanItemStatus;
    note: string;
    changed_by_id: string | null;
    changed_at: string;
  }>;
  created_at: string;
  updated_at: string;
}

export interface MigrationPlanItemInput {
  vehicle_id?: string;
  ev_candidate_id?: string | null;
  phase?: number;
  target_date?: string | null;
  estimated_cost?: string | null;
  readiness_assessment_id?: string | null;
  tco_assessment_id?: string | null;
  decision_id?: string | null;
  notes?: string;
}

export function listMigrationPlans(
  params: ListFilters & { status?: PlanStatus } = {},
): Promise<MigrationPlan[]> {
  return apiFetch(`/ev-migration/plans${qs(params)}`);
}

export function getMigrationPlan(
  id: string,
): Promise<MigrationPlan & { items: MigrationPlanItem[] }> {
  return apiFetch(`/ev-migration/plans/${id}`);
}

export function createMigrationPlan(input: MigrationPlanInput): Promise<MigrationPlan> {
  return apiFetch("/ev-migration/plans", { method: "POST", body: JSON.stringify(input) });
}

export function updateMigrationPlan(
  id: string,
  input: MigrationPlanInput,
): Promise<MigrationPlan> {
  return apiFetch(`/ev-migration/plans/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function addMigrationPlanItem(
  planId: string,
  input: MigrationPlanItemInput,
): Promise<MigrationPlanItem> {
  return apiFetch(`/ev-migration/plans/${planId}/items`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listMigrationPlanItems(
  params: ListFilters & { plan_id?: string; vehicle_id?: string; status?: string } = {},
): Promise<MigrationPlanItem[]> {
  return apiFetch(`/ev-migration/plan-items${qs(params)}`);
}

export function updateMigrationPlanItem(
  id: string,
  input: MigrationPlanItemInput,
): Promise<MigrationPlanItem> {
  return apiFetch(`/ev-migration/plan-items/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function removeMigrationPlanItem(id: string): Promise<void> {
  return apiFetch(`/ev-migration/plan-items/${id}`, { method: "DELETE" });
}

export function changeMigrationPlanItemStatus(
  id: string,
  input: { status: PlanItemStatus; note?: string; completed_on?: string | null },
): Promise<MigrationPlanItem> {
  return apiFetch(`/ev-migration/plan-items/${id}/status`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/* ------------------------------------------------------------------ */
/* EV catalogue, migration overview and recorded costs                 */
/* ------------------------------------------------------------------ */

export type CatalogueSpec = "battery_capacity_kwh" | "energy_consumption_kwh_per_km" | "payload_kg";

/** One model in EVORA's shared catalogue, copied from a cited manufacturer document. */
export interface EvCatalogueModel {
  id: string;
  label: string;
  manufacturer: string;
  model: string;
  variant: string;
  vehicle_type: string;
  body: string;
  battery_capacity_kwh: string | null;
  battery_capacity_is_usable: boolean;
  energy_consumption_kwh_per_km: string | null;
  published_range_km: string | null;
  range_basis: "" | "certified" | "manufacturer_claim";
  range_cycle: string;
  payload_kg: string | null;
  gvw_kg: string | null;
  max_ac_charge_kw: string | null;
  max_dc_charge_kw: string | null;
  charging_notes: string;
  list_price: string | null;
  price_currency: string;
  price_basis: string;
  price_as_of: string | null;
  source_title: string;
  source_publisher: string;
  source_url: string;
  source_published_on: string | null;
  retrieved_at: string;
  notes: string;
  verification_status: "unverified" | "verified" | "rejected";
  verified_by_name: string;
  verified_at: string | null;
  consumption: { kwh_per_km: number; basis: "manufacturer_rated" | "derived_from_rated_range" } | null;
  missing_specs: CatalogueSpec[];
  assessable: boolean;
  updated_at: string;
}

export function listEvCatalogue(params: { vehicle_type?: string } = {}): Promise<EvCatalogueModel[]> {
  return apiFetch(`/ev-migration/catalogue${qs(params)}`);
}

/** The organization's candidate record for a catalogue model (created by EVORA when needed). */
export function candidateForCatalogueModel(modelId: string): Promise<EvCandidate> {
  return apiFetch(`/ev-migration/catalogue/${modelId}/candidate`, { method: "POST" });
}

export type VehicleReadinessState = "meets_requirements" | "not_suitable" | "needs_evidence" | "not_assessed";

export interface VehicleReadinessSummary {
  state: VehicleReadinessState;
  models_assessed: number;
  approvable: boolean;
  last_assessed_at: string | null;
}

export function getVehicleReadinessStates(): Promise<Record<string, VehicleReadinessSummary>> {
  return apiFetch("/ev-migration/vehicle-states");
}

export interface MigrationOverview {
  method_version: string;
  composition: {
    total: number;
    ev: number;
    ice: number;
    unclassified: number;
    by_fuel: Record<string, number>;
    ev_share_pct: number | null;
    definition: string;
  };
  ice_readiness: {
    vehicles: number;
    meets_requirements: number;
    not_suitable: number;
    needs_evidence: number;
    not_assessed: number;
    approvable: number;
    definition: string;
  };
  decisions: { approve_transition: number; defer: number; reject: number; definition: string };
  plan_items: Partial<Record<PlanItemStatus, number>>;
  target: { plan_id: string; plan_name: string; ev_share_pct: number; by: string | null } | null;
}

export function getMigrationOverview(): Promise<MigrationOverview> {
  return apiFetch("/ev-migration/overview");
}

export type CostCategory = "fuel" | "charging" | "maintenance";

export interface CostCategoryStats {
  records: number;
  with_cost: number;
  without_cost: number;
  other_currency: number;
  total: number | null;
  vehicles_with_cost: number;
}

export interface RecordedCosts {
  method_version: string;
  currency: string;
  powertrain: "all" | "ice" | "ev";
  vehicles_in_scope: number;
  window: { start: string; end: string; months: number };
  months: Array<{ month: string } & Record<CostCategory, number | null>>;
  categories: Record<CostCategory, CostCategoryStats>;
  vehicle_record_estimates: {
    fuel_cost_per_month: { sum_per_month: number | null; vehicles_with_value: number; vehicles_without_value: number };
    maintenance_cost_per_month: { sum_per_month: number | null; vehicles_with_value: number; vehicles_without_value: number };
    note: string;
  };
  definition: string;
}

export function getRecordedCosts(params: { months?: number; powertrain?: "ice" | "ev" }): Promise<RecordedCosts> {
  return apiFetch(`/costs/recorded${qs(params)}`);
}
