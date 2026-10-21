/**
 * Shared vocabulary for the EV Migration and Health & Maintenance screens.
 * Every label and definition here mirrors the backend's definitions
 * (evidence/provenance.py, ev_migration/calc/*, maintenance/rules.py); the UI
 * never invents its own categories.
 */
import type {
  EvidenceClass,
  EvidenceLevel,
  MigrationDecision,
  PlanItemStatus,
  ReadinessCheck,
  ReadinessResult,
  ServiceStatus,
} from "../../lib/intelligenceApi";
import type { Tone } from "../operations/ui/Pill";

/* ---- Evidence coverage ------------------------------------------------ */

export const COVERAGE_LABEL: Record<EvidenceLevel, string> = {
  high: "High evidence",
  moderate: "Moderate evidence",
  low: "Low evidence",
  insufficient: "Insufficient evidence",
};

export const COVERAGE_DEFINITION: Record<EvidenceLevel, string> = {
  high: "Every critical input is measured or verified external evidence and within its freshness limit.",
  moderate:
    "All critical inputs are present and fresh, none assumed; at least one is organization-provided, unverified external or modelled.",
  low: "All critical inputs are present, but at least one is assumed or stale.",
  insufficient: "A critical input is missing, so no complete result could be produced.",
};

export const COVERAGE_NOTE =
  "Evidence coverage describes the evidence behind a result. It is not a probability that the result is correct.";

export function coverageTone(level: EvidenceLevel): Tone {
  if (level === "high") return "ok";
  if (level === "moderate") return "info";
  if (level === "low") return "warn";
  return "danger";
}

/* ---- Evidence classes ------------------------------------------------- */

export const EVIDENCE_CLASS_LABEL: Record<EvidenceClass, string> = {
  measured: "Measured",
  verified_external: "Verified external",
  unverified_external: "Unverified external",
  organization_provided: "Organization-provided",
  modelled: "Modelled",
  assumed: "Assumed",
  stale: "Stale",
  missing: "Missing",
};

export const EVIDENCE_CLASS_DEFINITION: Record<EvidenceClass, string> = {
  measured: "Read from an instrument or transactional record, with a cited source.",
  verified_external:
    "Published by a third party; a named user in your organization checked it against the cited document.",
  unverified_external: "Published by a third party; the source has not been verified yet.",
  organization_provided: "Stated by your organization without a cited record.",
  modelled: "Calculated from other values; the transformation is recorded.",
  assumed: "Chosen for analysis with no evidence behind it.",
  stale: "Older than its freshness limit, outside its effective dates, or its source failed a refresh.",
  missing: "No usable value was available.",
};

export function evidenceTone(cls: EvidenceClass): Tone {
  switch (cls) {
    case "measured":
    case "verified_external":
      return "ok";
    case "organization_provided":
    case "unverified_external":
    case "modelled":
      return "info";
    case "assumed":
    case "stale":
      return "warn";
    default:
      return "danger";
  }
}

/* ---- Readiness -------------------------------------------------------- */

export const OUTCOME_LABEL: Record<ReadinessResult["outcome"], string> = {
  meets_requirements: "Meets requirements",
  not_suitable: "Not suitable",
  insufficient_evidence: "Insufficient evidence",
};

export function outcomeTone(outcome: ReadinessResult["outcome"] | null | undefined): Tone {
  if (outcome === "meets_requirements") return "ok";
  if (outcome === "not_suitable") return "danger";
  if (outcome === "insufficient_evidence") return "warn";
  return "neutral";
}

export const CHECK_LABEL: Record<ReadinessCheck["check"], string> = {
  range: "Range",
  payload: "Payload",
  charging: "Charging",
};

export const CHECK_STATUS_LABEL: Record<ReadinessCheck["status"], string> = {
  pass: "Pass",
  fail: "Fail",
  insufficient: "Insufficient",
};

export function checkTone(status: ReadinessCheck["status"] | undefined): Tone {
  if (status === "pass") return "ok";
  if (status === "fail") return "danger";
  if (status === "insufficient") return "warn";
  return "neutral";
}

/* ---- Decisions and plans --------------------------------------------- */

export const DECISION_LABEL: Record<MigrationDecision["decision"], string> = {
  approve_transition: "Approved",
  defer: "Deferred",
  reject: "Rejected",
};

export function decisionTone(decision: MigrationDecision["decision"]): Tone {
  if (decision === "approve_transition") return "ok";
  if (decision === "defer") return "warn";
  return "danger";
}

export const PLAN_ITEM_STATUS_LABEL: Record<PlanItemStatus, string> = {
  planned: "Planned",
  in_progress: "In progress",
  completed: "Completed",
  deferred: "Deferred",
  cancelled: "Cancelled",
};

export function planItemTone(status: PlanItemStatus): Tone {
  switch (status) {
    case "completed":
      return "ok";
    case "in_progress":
      return "info";
    case "deferred":
      return "warn";
    case "cancelled":
      return "danger";
    default:
      return "neutral";
  }
}

/** Mirrors PLAN_ITEM_TRANSITIONS in ev_migration/models.py. */
export const PLAN_ITEM_NEXT: Record<PlanItemStatus, PlanItemStatus[]> = {
  planned: ["in_progress", "deferred", "cancelled"],
  deferred: ["planned", "cancelled"],
  in_progress: ["completed", "deferred", "cancelled"],
  cancelled: ["planned"],
  completed: [],
};

/* ---- Maintenance ------------------------------------------------------ */

export const SERVICE_STATUS_LABEL: Record<ServiceStatus, string> = {
  overdue: "Overdue",
  due_soon: "Due soon",
  ok: "Not due",
  undetermined: "Undetermined",
};

export function serviceTone(status: ServiceStatus | null | undefined): Tone {
  if (status === "overdue") return "danger";
  if (status === "due_soon") return "warn";
  if (status === "ok") return "ok";
  return "neutral";
}

export const EVENT_TYPE_LABEL: Record<string, string> = {
  scheduled_service: "Scheduled service",
  inspection: "Inspection",
  repair: "Repair",
  component_replacement: "Component replacement",
  fault_report: "Fault report",
};

/* ---- Resolved input names -------------------------------------------- */

export const INPUT_LABEL: Record<string, string> = {
  design_day_distance_km: "Design-day distance",
  candidate_consumption_kwh_per_km: "EV model energy consumption",
  charging_efficiency: "Charging efficiency",
  usable_battery_kwh: "Usable battery capacity",
  candidate_payload_kg: "EV model payload",
  vehicle_max_charge_kw: "Vehicle max charging power",
  charger_power_kw: "Charger power (per vehicle)",
  charging_window_hours: "Daily charging window",
  required_payload_kg: "Required payload",
  ev_grid_kwh_per_km: "EV grid-side consumption",
  annual_distance_km: "Annual distance",
  fuel_economy_km_per_l: "Fuel economy",
  fuel_price_per_l: "Fuel price",
  ice_initial_investment: "ICE initial investment",
  ice_maintenance_annual: "ICE maintenance (annual)",
  ev_purchase_price: "EV purchase price",
  charging_infrastructure_cost: "Charging infrastructure cost",
  electricity_tariff_per_kwh: "Electricity tariff",
  ev_maintenance_annual: "EV maintenance (annual)",
  ice_insurance_annual: "ICE insurance (annual)",
  ev_insurance_annual: "EV insurance (annual)",
  ice_fees_annual: "ICE taxes & fees (annual)",
  ev_fees_annual: "EV taxes & fees (annual)",
  ice_downtime_annual: "ICE downtime cost (annual)",
  ev_downtime_annual: "EV downtime cost (annual)",
  ice_residual_value: "ICE residual value",
  ev_residual_value: "EV residual value",
  fuel_factor_kgco2e_per_l: "Fuel emission factor",
  grid_factor_kgco2e_per_kwh: "Grid emission factor",
  service_requirements: "Documented service intervals",
  current_odometer_km: "Current odometer",
  maintenance_events: "Maintenance history",
};

export function inputLabel(name: string): string {
  if (name.startsWith("incentive:")) return "Incentive";
  return INPUT_LABEL[name] ?? name.replace(/_/g, " ");
}

/**
 * How a missing input can be supplied: which observation kind to record and
 * on which subject. Only inputs that are resolved from observations are
 * listed; others come from the vehicle, candidate or request parameters.
 */
export const SUPPLY_HINT: Record<
  string,
  { kind?: string; subject: "vehicle" | "depot" | "ev_candidate" | "organization"; text: string }
> = {
  charger_power_kw: {
    kind: "charger_power_kw",
    subject: "depot",
    text: "Record the charger power one vehicle can draw at its depot (AC or DC).",
  },
  charging_window_hours: {
    kind: "charging_window_hours",
    subject: "depot",
    text: "Record how many hours per day the vehicle is parked at a charger.",
  },
  charging_efficiency: {
    kind: "charging_efficiency_fraction",
    subject: "ev_candidate",
    text: "Record the grid-to-battery charging efficiency for this EV model.",
  },
  required_payload_kg: {
    kind: "required_payload_kg",
    subject: "vehicle",
    text: "Record the heaviest load this vehicle's duty must carry.",
  },
  design_day_distance_km: {
    kind: "odometer_km",
    subject: "vehicle",
    text: "Record daily odometer readings (30+ consecutive days for the 90th percentile), or enter a design-day distance with the request.",
  },
  annual_distance_km: {
    kind: "annual_distance_km",
    subject: "vehicle",
    text: "Record odometer readings spanning 28+ days, or an annual distance figure.",
  },
  fuel_economy_km_per_l: {
    kind: "fuel_economy_km_per_l",
    subject: "vehicle",
    text: "Record fuel fills (two full fills 300+ km apart) or a fuel economy figure.",
  },
  fuel_price_per_l: {
    kind: "fuel_price_per_l",
    subject: "organization",
    text: "Record the current fuel price from a dated notice.",
  },
  electricity_tariff_per_kwh: {
    kind: "electricity_tariff_per_kwh",
    subject: "organization",
    text: "Record the electricity energy charge from a tariff order or utility bill.",
  },
  ev_purchase_price: {
    kind: "vehicle_purchase_price",
    subject: "ev_candidate",
    text: "Record a dated quotation for this EV model (overrides the published list price).",
  },
  charging_infrastructure_cost: {
    kind: "charging_infrastructure_cost",
    subject: "ev_candidate",
    text: "Record the charging infrastructure cost for this vehicle (0 if none is needed).",
  },
  ev_maintenance_annual: {
    kind: "maintenance_cost_annual",
    subject: "ev_candidate",
    text: "Record the EV's annual maintenance cost from a quotation or service contract.",
  },
  ice_maintenance_annual: {
    kind: "maintenance_cost_annual",
    subject: "vehicle",
    text: "Record this vehicle's annual maintenance cost.",
  },
  fuel_factor_kgco2e_per_l: {
    kind: "fuel_emission_factor_kgco2e_per_l",
    subject: "organization",
    text: "Record the fuel emission factor for the chosen boundary from a cited publication.",
  },
  grid_factor_kgco2e_per_kwh: {
    kind: "grid_emission_factor_kgco2e_per_kwh",
    subject: "organization",
    text: "Record the grid emission factor for the chosen boundary from a cited publication.",
  },
  current_odometer_km: {
    kind: "odometer_km",
    subject: "vehicle",
    text: "Record a current odometer reading.",
  },
};

/** Mirrors evidence.models.SourceType. */
export const SOURCE_TYPES = [
  "manufacturer_document",
  "procurement_quotation",
  "invoice",
  "utility_bill",
  "tariff_order",
  "fuel_price_notice",
  "government_notification",
  "emission_factor_publication",
  "service_record",
  "telematics_export",
  "fuel_card_export",
  "charger_log",
  "internal_record",
  "other",
].map((value) => ({ value, label: value.replace(/_/g, " ") }));
