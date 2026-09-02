import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./FleetOnboardingPage.css";

type FleetType = "ice" | "ev" | null;

interface VehicleFormData {
  registration_number: string;
  vin: string;
  chassis_number: string;
  manufacturer: string;
  model: string;
  variant: string;
  manufacture_year: string;
  purchase_date: string;
  vehicle_type: string;
  fuel_type: string;
  engine_cc: string;
  fuel_tank_capacity: string;
  battery_capacity_kwh: string;
  mileage_kmpl: string;
  payload_kg: string;
  seating_capacity: string;
  gvw_kg: string;
}

const FLEET_STORAGE_KEY = "evora-fleet-onboarding";

interface SavedFleetState {
  iceVehicles: VehicleFormData[];
  evVehicles: VehicleFormData[];
}

function loadSavedFleetState(): SavedFleetState {
  try {
    const saved = localStorage.getItem(FLEET_STORAGE_KEY);

    if (!saved) {
      return {
        iceVehicles: [],
        evVehicles: [],
      };
    }

    const parsed = JSON.parse(saved) as Partial<SavedFleetState>;

    return {
      iceVehicles: Array.isArray(parsed.iceVehicles)
        ? parsed.iceVehicles
        : [],
      evVehicles: Array.isArray(parsed.evVehicles)
        ? parsed.evVehicles
        : [],
    };
  } catch {
    return {
      iceVehicles: [],
      evVehicles: [],
    };
  }
}

const initialForm: VehicleFormData = {
  registration_number: "",
  vin: "",
  chassis_number: "",
  manufacturer: "",
  model: "",
  variant: "",
  manufacture_year: "",
  purchase_date: "",
  vehicle_type: "",
  fuel_type: "",
  engine_cc: "",
  fuel_tank_capacity: "",
  battery_capacity_kwh: "",
  mileage_kmpl: "",
  payload_kg: "",
  seating_capacity: "",
  gvw_kg: "",
};

export default function FleetOnboardingPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeForm, setActiveForm] = useState<FleetType>(null);
  const [showImport, setShowImport] = useState(false);
  const [formData, setFormData] =
    useState<VehicleFormData>(initialForm);

  const [iceVehicles, setIceVehicles] = useState<VehicleFormData[]>(
    () => loadSavedFleetState().iceVehicles
  );
  const [evVehicles, setEvVehicles] = useState<VehicleFormData[]>(
    () => loadSavedFleetState().evVehicles
  );

  useEffect(() => {
    try {
      localStorage.setItem(
        FLEET_STORAGE_KEY,
        JSON.stringify({
          iceVehicles,
          evVehicles,
        })
      );
    } catch {
      // Ignore localStorage errors.
    }
  }, [iceVehicles, evVehicles]);

  function saveFleetProgress() {
    try {
      localStorage.setItem(
        FLEET_STORAGE_KEY,
        JSON.stringify({
          iceVehicles,
          evVehicles,
        })
      );
    } catch {
      // Ignore localStorage errors.
    }
  }

  function handleSaveAndFinishLater() {
    saveFleetProgress();
    //navigate("/dashboard");
  }

  function handleContinueToFleetBaseline() {
    if (totalVehicles < 1) return;

    saveFleetProgress();
    navigate("/dashboard");
  }

  function handleBack() {
    navigate("/onboarding/infrastructure");
  }

  function openVehicleForm(type: "ice" | "ev") {
    setActiveForm(type);

    setFormData({
      ...initialForm,
      fuel_type: type === "ev" ? "ev" : "",
    });
  }

  function closeVehicleForm() {
    setActiveForm(null);
    setFormData(initialForm);
  }

  function handleInputChange(
    field: keyof VehicleFormData,
    value: string
  ) {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function handleAddVehicle() {
    if (
      !formData.registration_number ||
      !formData.manufacturer ||
      !formData.model ||
      !formData.manufacture_year ||
      !formData.purchase_date ||
      !formData.vehicle_type ||
      !formData.fuel_type
    ) {
      return;
    }

    if (activeForm === "ice") {
      setIceVehicles((prev) => [...prev, formData]);
    }

    if (activeForm === "ev") {
      setEvVehicles((prev) => [...prev, formData]);
    }

    closeVehicleForm();
  }

  function downloadTemplate() {
    const headers = [
      "registration_number",
      "vin",
      "chassis_number",
      "manufacturer",
      "model",
      "variant",
      "manufacture_year",
      "purchase_date",
      "vehicle_type",
      "fuel_type",
      "engine_cc",
      "fuel_tank_capacity",
      "battery_capacity_kwh",
      "mileage_kmpl",
      "payload_kg",
      "seating_capacity",
      "gvw_kg",
    ];

    const csvContent = headers.join(",") + "\n";

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "evora-fleet-template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  function handleFileUpload(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    console.log("Fleet CSV selected:", file.name);

    // Backend / CSV parsing will be connected later.
  }

  const totalVehicles =
    iceVehicles.length + evVehicles.length;

  const canContinueToFleetBaseline = totalVehicles >= 1;

  const isFormValid =
    Boolean(formData.registration_number) &&
    Boolean(formData.manufacturer) &&
    Boolean(formData.model) &&
    Boolean(formData.manufacture_year) &&
    Boolean(formData.purchase_date) &&
    Boolean(formData.vehicle_type) &&
    Boolean(formData.fuel_type);

  return (
    <div className="fleet-page">

      {/* --------------------------------------------------
          TOP BAR
      -------------------------------------------------- */}

      <header className="fleet-header">
        <div className="fleet-brand">EVORA</div>

        <button
          type="button"
          className="fleet-back-button"
          onClick={handleBack}
        >
          <span className="back-arrow">←</span>
          Back to Infrastructure
        </button>
      </header>

      {/* --------------------------------------------------
          MAIN CONTENT
      -------------------------------------------------- */}

      <main className="fleet-main">

        <section className="fleet-hero">

          <div className="fleet-hero-content">
            <div className="fleet-eyebrow">
              FLEET INTELLIGENCE
            </div>

            <h1>
              Now, let's get to know your fleet.
            </h1>

            <p>
              Add the vehicles that keep your operations moving.
              EVORA will use this information to understand
              performance, utilization and opportunities across
              your fleet.
            </p>
          </div>

          {/* FLEET INTELLIGENCE CARD */}

          <div className="fleet-intelligence-card">

            <div className="intelligence-title">
              Your fleet, evolving.
            </div>

            <div className="intelligence-row">

              <div className="intelligence-side">
                <span className="intelligence-icon ice-icon">
                  🚚
                </span>

                <span className="intelligence-label ice-text">
                  ICE
                </span>
              </div>
              <div className="intelligence-middle">
                <div className="intelligence-line" />

                <div className="intelligence-symbol">
                  ✦
                </div>

                <div className="intelligence-line" />
              </div>
              <div className="intelligence-side intelligence-right">
                <span className="intelligence-label ev-text">
                  EV
                </span>
                <span className="intelligence-icon ev-icon">
                  ⚡
                </span>
                {/* <strong>{evVehicles.length}</strong> */}
              </div>

            </div>
          </div>

        </section>

        {/* --------------------------------------------------
            ADD YOUR FLEET
        -------------------------------------------------- */}

        <section className="fleet-container">

          <div className="fleet-section-header">

            <div>
              <h2>Add your fleet</h2>

              <p>
                Start with the vehicles you operate today.
                Add them individually or bring your fleet in
                at once.
              </p>
            </div>

            <div className="fleet-note">
              Your data doesn't need to be perfect.
            </div>

          </div>

          <div className="fleet-options">

            {/* ICE */}

            <div className="fleet-option ice-card">

              <div className="option-icon ice-option-icon">
                🚚
              </div>

              <h3>ICE Fleet</h3>

              <p>
                Add vehicles powered by conventional fuel.
              </p>

              <button
                type="button"
                className="fleet-action-button ice-button"
                onClick={() => openVehicleForm("ice")}
              >
                Add ICE vehicles
              </button>

            </div>

            {/* EV */}

            <div className="fleet-option ev-card">

              <div className="option-icon ev-option-icon">
                ⚡
              </div>

              <h3>EV Fleet</h3>

              <p>
                Add the electric vehicles already in operation.
              </p>

              <button
                type="button"
                className="fleet-action-button ev-button"
                onClick={() => openVehicleForm("ev")}
              >
                Add EV vehicles
              </button>

            </div>

            {/* IMPORT */}

            <div className="fleet-option import-card">

              <div className="option-icon import-option-icon">
                ▦
              </div>

              <h3>Import your fleet</h3>

              <p>
                Have a larger fleet? Upload your vehicles
                using CSV.
              </p>

              <div className="import-actions">

                <button
                  type="button"
                  className="upload-button"
                  onClick={() => setShowImport(true)}
                >
                  Upload CSV
                </button>

                <button
                  type="button"
                  className="template-link"
                  onClick={downloadTemplate}
                >
                  Download template
                </button>

              </div>

            </div>

          </div>


        </section>
        <section className="fleet-overview-card">
          <div className="fleet-overview-header">
            <h2>Your fleet</h2>
            <p>A living view of the vehicles in your operation.</p>
          </div>

          <div className="fleet-stats">
            <div className="fleet-stat">
              <span className="fleet-stat-label">TOTAL VEHICLES</span>
              <span className="fleet-stat-value">
                {iceVehicles.length + evVehicles.length}
              </span>
            </div>

            <div className="fleet-stat">
              <span className="fleet-stat-label ice">ICE</span>
              <span className="fleet-stat-value">
                {iceVehicles.length}
              </span>
            </div>

            <div className="fleet-stat">
              <span className="fleet-stat-label ev">EV</span>
              <span className="fleet-stat-value">
                {evVehicles.length}
              </span>
            </div>
          </div>

          <div className="fleet-empty-state">
            <div className="fleet-empty-icon">
              <svg
                width="92"
                height="72"
                viewBox="0 0 92 72"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M16 48H25L31 30H61L72 48H81"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                <path
                  d="M31 30L39 18H57L68 30"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                <path
                  d="M25 48V55"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />

                <path
                  d="M72 48V55"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />

                <circle
                  cx="31"
                  cy="52"
                  r="8"
                  stroke="currentColor"
                  strokeWidth="2.5"
                />

                <circle
                  cx="61"
                  cy="52"
                  r="8"
                  stroke="currentColor"
                  strokeWidth="2.5"
                />

                <path
                  d="M81 15V43"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />

                <path
                  d="M68 29H94"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <h3>Your fleet will appear here as you add vehicles.</h3>



            <p>
              You can start with a single vehicle or import your entire fleet.
            </p>
          </div>

          {/* ==================================================
              VEHICLE LIST
          ================================================== */}

          {totalVehicles > 0 && (
            <div className="fleet-vehicle-list">

              {[...iceVehicles, ...evVehicles].map(
                (vehicle, index) => (
                  <div
                    className="fleet-vehicle-row"
                    key={`${vehicle.registration_number}-${index}`}
                  >

                    <div className="fleet-vehicle-main">

                      <div
                        className={`fleet-vehicle-type-icon ${vehicle.fuel_type === "ev"
                            ? "fleet-vehicle-ev"
                            : "fleet-vehicle-ice"
                          }`}
                      >
                        {vehicle.fuel_type === "ev" ? "⚡" : "🚚"}
                      </div>

                      <div className="fleet-vehicle-identity">
                        <h3>
                          {vehicle.registration_number}
                        </h3>

                        <p>
                          {vehicle.manufacturer} {vehicle.model}
                          {vehicle.variant
                            ? ` · ${vehicle.variant}`
                            : ""}
                        </p>
                      </div>

                    </div>

                    <div className="fleet-vehicle-details">

                      <div className="fleet-vehicle-detail">
                        <span>TYPE</span>
                        <strong>
                          {vehicle.vehicle_type
                            ? vehicle.vehicle_type
                              .charAt(0)
                              .toUpperCase() +
                            vehicle.vehicle_type.slice(1)
                            : "—"}
                        </strong>
                      </div>

                      <div className="fleet-vehicle-detail">
                        <span>FUEL</span>
                        <strong>
                          {vehicle.fuel_type === "ev"
                            ? "EV"
                            : vehicle.fuel_type
                              ? vehicle.fuel_type
                                .charAt(0)
                                .toUpperCase() +
                              vehicle.fuel_type.slice(1)
                              : "—"}
                        </strong>
                      </div>

                      <div className="fleet-vehicle-detail">
                        <span>YEAR</span>
                        <strong>
                          {vehicle.manufacture_year || "—"}
                        </strong>
                      </div>

                      <div className="fleet-vehicle-detail">
                        <span>MILEAGE</span>
                        <strong>
                          {vehicle.mileage_kmpl
                            ? `${vehicle.mileage_kmpl} km/l`
                            : "—"}
                        </strong>
                      </div>

                    </div>

                  </div>
                )
              )}

            </div>
          )}
        </section>

        <section className="fleet-looking-ahead">
          <div className="fleet-looking-ahead-content">
            <div className="fleet-section-label">LOOKING AHEAD</div>

            {/* <h2>Thinking ahead?</h2> */}

            <p>
              Once your fleet is captured, EVORA can help you understand which
              vehicles are best suited for future replacement, when to transition
              and what operational changes may be required.
            </p>

            {/* <div className="fleet-looking-ahead-actions">
              <button type="button" className="fleet-text-action">
                Explore fleet transition
              </button>

              <button type="button" className="fleet-text-action secondary">
                I'll do this later
              </button>
            </div> */}
          </div>
        </section>

        <section className="fleet-completion">
          <div className="fleet-completion-header">
            <div className="fleet-section-label">ONCE YOUR FLEET IS COMPLETE</div>

            <h2>EVORA will generate your Fleet Baseline.</h2>

            <div className="fleet-baseline-items">
              <span>Fleet composition</span>
              <span>Utilization profile</span>
              <span>Vehicle health</span>
              <span>Operating cost profile</span>
              <span>Route characteristics</span>
              <span>Electrification readiness</span>
            </div>
          </div>

          <div className="fleet-completion-divider" />

          <div className="fleet-completion-footer">
            <div>
              <h3>Your fleet is the starting point.</h3>
              <p>
                Complete your fleet profile and EVORA will turn your operational
                data into a living fleet baseline.
              </p>
            </div>

            <div className="fleet-completion-actions">
              <button
                type="button"
                className="fleet-save-later-button"
                onClick={handleSaveAndFinishLater}
              >
                Save &amp; finish later
              </button>

              <button
                type="button"
                className="fleet-baseline-button"
                disabled={!canContinueToFleetBaseline}
                onClick={handleContinueToFleetBaseline}
              >
                Continue to Fleet Baseline
                <span>→</span>
              </button>
            </div>
          </div>
        </section>

      </main>

      {/* ==================================================
          VEHICLE FORM DRAWER
      ================================================== */}

      {activeForm && (
        <div className="drawer-overlay">

          <aside className="vehicle-drawer">

            <div className="drawer-header">

              <div>
                <div className="drawer-eyebrow">
                  {activeForm === "ice"
                    ? "CONVENTIONAL FLEET"
                    : "ELECTRIC FLEET"}
                </div>

                <h2>
                  Add {activeForm === "ice" ? "ICE" : "EV"} vehicle
                </h2>

                <p>
                  Let's capture the information EVORA needs
                  to understand how this vehicle operates.
                </p>
              </div>

              <button
                type="button"
                className="drawer-close"
                onClick={closeVehicleForm}
              >
                ×
              </button>

            </div>

            <div className="drawer-body">

              <div className="form-section">

                <div className="form-section-title">
                  <div>
                    <h3>Vehicle identity</h3>
                    <p>
                      The essentials EVORA uses to identify
                      this asset.
                    </p>
                  </div>

                  <span>⌃</span>
                </div>

                <div className="form-grid">

                  <FormField
                    label="Vehicle registration number"
                    required
                    placeholder="e.g. MAT123456789"
                    value={formData.registration_number}
                    onChange={(value) =>
                      handleInputChange(
                        "registration_number",
                        value
                      )
                    }
                  />

                  <FormField
                    label="VIN"
                    placeholder="e.g. DL01AB1234"
                    value={formData.vin}
                    onChange={(value) =>
                      handleInputChange("vin", value)
                    }
                  />

                  <FormField
                    label="Chassis number"
                    placeholder="e.g. CHS-001234"
                    value={formData.chassis_number}
                    onChange={(value) =>
                      handleInputChange(
                        "chassis_number",
                        value
                      )
                    }
                  />

                  <FormField
                    label="Manufacturer"
                    required
                    placeholder="e.g. Tata"
                    value={formData.manufacturer}
                    onChange={(value) =>
                      handleInputChange(
                        "manufacturer",
                        value
                      )
                    }
                  />

                  <FormField
                    label="Model"
                    required
                    placeholder="e.g. Prima"
                    value={formData.model}
                    onChange={(value) =>
                      handleInputChange("model", value)
                    }
                  />

                  <FormField
                    label="Variant"
                    placeholder="e.g. 4018.S"
                    value={formData.variant}
                    onChange={(value) =>
                      handleInputChange("variant", value)
                    }
                  />

                  <FormField
                    label="Manufacturing year"
                    required
                    type="number"
                    placeholder="e.g. 2018"
                    value={formData.manufacture_year}
                    onChange={(value) =>
                      handleInputChange(
                        "manufacture_year",
                        value
                      )
                    }
                  />

                  <FormField
                    label="Purchase date"
                    required
                    type="date"
                    value={formData.purchase_date}
                    onChange={(value) =>
                      handleInputChange(
                        "purchase_date",
                        value
                      )
                    }
                  />

                  <SelectField
                    label="Vehicle type"
                    required
                    value={formData.vehicle_type}
                    options={[
                      ["bus", "Bus"],
                      ["truck", "Truck"],
                      ["car", "Car"],
                      ["van", "Van"],
                      ["trailer", "Trailer"],
                      ["other", "Other"],
                    ]}
                    onChange={(value) =>
                      handleInputChange(
                        "vehicle_type",
                        value
                      )
                    }
                  />

                  <SelectField
                    label="Fuel type"
                    required
                    value={formData.fuel_type}
                    disabled={activeForm === "ev"}
                    options={
                      activeForm === "ev"
                        ? [["ev", "EV"]]
                        : [
                          ["diesel", "Diesel"],
                          ["petrol", "Petrol"],
                          ["ev", "EV"],
                          ["cng", "CNG"],
                          ["lpg", "LPG"],
                          ["other", "Other"],
                        ]
                    }
                    onChange={(value) =>
                      handleInputChange(
                        "fuel_type",
                        value
                      )
                    }
                  />

                </div>

              </div>

              <div className="form-section">

                <div className="form-section-title">
                  <div>
                    <h3>Vehicle specifications</h3>
                    <p>
                      Technical and operating information
                      for this vehicle.
                    </p>
                  </div>

                  <span>⌄</span>
                </div>

                <div className="form-grid">

                  <FormField
                    label="Engine CC"
                    type="number"
                    placeholder="e.g. 5000"
                    value={formData.engine_cc}
                    onChange={(value) =>
                      handleInputChange(
                        "engine_cc",
                        value
                      )
                    }
                  />

                  <FormField
                    label="Fuel tank capacity"
                    type="number"
                    placeholder="e.g. 250"
                    value={formData.fuel_tank_capacity}
                    onChange={(value) =>
                      handleInputChange(
                        "fuel_tank_capacity",
                        value
                      )
                    }
                  />

                  <FormField
                    label="Battery capacity (kWh)"
                    type="number"
                    placeholder="e.g. 120"
                    value={formData.battery_capacity_kwh}
                    onChange={(value) =>
                      handleInputChange(
                        "battery_capacity_kwh",
                        value
                      )
                    }
                  />

                  <FormField
                    label="Mileage (km/l)"
                    required
                    type="number"
                    placeholder="e.g. 4.5"
                    value={formData.mileage_kmpl}
                    onChange={(value) =>
                      handleInputChange(
                        "mileage_kmpl",
                        value
                      )
                    }
                  />

                  <FormField
                    label="Payload (kg)"
                    required
                    type="number"
                    placeholder="e.g. 12000"
                    value={formData.payload_kg}
                    onChange={(value) =>
                      handleInputChange(
                        "payload_kg",
                        value
                      )
                    }
                  />

                  <FormField
                    label="Seating capacity"
                    required
                    type="number"
                    placeholder="e.g. 40"
                    value={formData.seating_capacity}
                    onChange={(value) =>
                      handleInputChange(
                        "seating_capacity",
                        value
                      )
                    }
                  />

                  <FormField
                    label="GVW (kg)"
                    required
                    type="number"
                    placeholder="e.g. 18000"
                    value={formData.gvw_kg}
                    onChange={(value) =>
                      handleInputChange(
                        "gvw_kg",
                        value
                      )
                    }
                  />

                </div>

              </div>

            </div>

            <div className="drawer-footer">

              <button
                type="button"
                className="drawer-cancel"
                onClick={closeVehicleForm}
              >
                Cancel
              </button>

              <button
                type="button"
                className="drawer-save"
                disabled={!isFormValid}
                onClick={handleAddVehicle}
              >
                Add vehicle
                <span>→</span>
              </button>

            </div>

          </aside>

        </div>
      )}

      {/* ==================================================
          CSV IMPORT MODAL
      ================================================== */}

      {showImport && (
        <div className="import-overlay">

          <div className="import-modal">

            <button
              type="button"
              className="import-close"
              onClick={() => setShowImport(false)}
            >
              ×
            </button>

            <div className="drawer-eyebrow">
              FLEET IMPORT
            </div>

            <h2>Bring your fleet with you.</h2>

            <p className="import-description">
              Upload your existing fleet data and EVORA will
              validate, organize and prepare it for onboarding.
            </p>

            <div className="import-steps">

              <div className="import-step active">
                <span>1</span>
                <strong>Download template</strong>
              </div>

              <div className="import-step">
                <span>2</span>
                <strong>Fill fleet data</strong>
              </div>

              <div className="import-step">
                <span>3</span>
                <strong>Upload CSV</strong>
              </div>

            </div>

            <div className="upload-zone">

              <div className="upload-icon">
                ↑
              </div>

              <h3>Drop your CSV here</h3>

              <p>
                or browse files from your computer
              </p>

              <button
                type="button"
                className="browse-button"
                onClick={() =>
                  fileInputRef.current?.click()
                }
              >
                Browse files
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                hidden
                onChange={handleFileUpload}
              />

            </div>

            <button
              type="button"
              className="modal-template-button"
              onClick={downloadTemplate}
            >
              Download CSV template
            </button>

          </div>

        </div>

      )}

    </div>

  );
}


/* ============================================================
   REUSABLE FORM FIELD
   ============================================================ */

interface FormFieldProps {
  label: string;
  required?: boolean;
  placeholder?: string;
  value: string;
  type?: string;
  onChange: (value: string) => void;
}

function FormField({
  label,
  required,
  placeholder,
  value,
  type = "text",
  onChange,
}: FormFieldProps) {
  return (
    <label className="form-field">

      <span className="form-label">
        {label}
        {required && (
          <span className="required-star">*</span>
        )}
      </span>

      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
      />

    </label>
  );
}


/* ============================================================
   SELECT FIELD
   ============================================================ */

interface SelectFieldProps {
  label: string;
  required?: boolean;
  value: string;
  disabled?: boolean;
  options: [string, string][];
  onChange: (value: string) => void;
}

function SelectField({
  label,
  required,
  value,
  disabled,
  options,
  onChange,
}: SelectFieldProps) {
  return (
    <label className="form-field">

      <span className="form-label">
        {label}
        {required && (
          <span className="required-star">*</span>
        )}
      </span>

      <select
        value={value}
        disabled={disabled}
        onChange={(event) =>
          onChange(event.target.value)
        }
      >
        <option value="">
          Select {label.toLowerCase()}
        </option>

        {options.map(([optionValue, optionLabel]) => (
          <option
            key={optionValue}
            value={optionValue}
          >
            {optionLabel}
          </option>
        ))}
      </select>

    </label>
  );


}