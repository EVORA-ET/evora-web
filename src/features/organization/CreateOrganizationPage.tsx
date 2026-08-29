import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import "./CreateOrganizationPage.css";

interface OrganizationFormData {
  organizationName: string;
  industry: string;
  currency: string;
  headquartersAddress: string;
  operatingCountry: string;
  operatingCities: string;
  taxNumber: string;
  website: string;
  businessHoursStart: string;
  businessHoursEnd: string;
}

const initialForm: OrganizationFormData = {
  organizationName: "",
  industry: "",
  currency: "USD",
  headquartersAddress: "",
  operatingCountry: "",
  operatingCities: "",
  taxNumber: "",
  website: "",
  businessHoursStart: "08:00",
  businessHoursEnd: "18:00",
};

function CreateOrganizationPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState<OrganizationFormData>(initialForm);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [error, setError] = useState("");

  const updateField = (
    field: keyof OrganizationFormData,
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    if (field === "organizationName") {
      setError("");
    }
  };

  const handleLogoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Logo must be smaller than 5MB.");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      setLogoPreview(reader.result as string);
    };

    reader.readAsDataURL(file);
  };

  const saveDraft = () => {
    localStorage.setItem(
      "evora-organization-draft",
      JSON.stringify(form),
    );

    setError("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.organizationName.trim()) {
      setError("Organization name is required.");
      return;
    }

    localStorage.setItem(
      "evora-organization",
      JSON.stringify(form),
    );

    navigate("/onboarding/infrastructure");
  };

  return (
    <main className="create-organization">
      <section className="create-organization__panel">
        <aside className="create-organization__intro">
          <div className="create-organization__brand">
            EVORA
          </div>

          <h1>
            Set up your
            <br />
            workspace.
          </h1>

          <p>
            Configure your organization details to begin managing
            your enterprise fleet and infrastructure.
          </p>

          <div className="create-organization__security">
            <span aria-hidden="true">✧</span>

            <div>
              <strong>Secure Setup</strong>
              <p>Your data is encrypted and stored securely.</p>
            </div>
          </div>
        </aside>

        <form
          className="create-organization__form"
          onSubmit={handleSubmit}
        >
          <div className="logo-upload">
            <input
              id="organization-logo"
              type="file"
              accept=".png,.jpg,.jpeg"
              onChange={handleLogoChange}
              hidden
            />

            <label htmlFor="organization-logo">
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Organization logo preview"
                  className="logo-upload__preview"
                />
              ) : (
                <>
                  <span
                    className="logo-upload__icon"
                    aria-hidden="true"
                  >
                    ▧
                  </span>

                  <strong>Upload Organization Logo</strong>

                  <span>PNG, JPG up to 5MB</span>
                </>
              )}
            </label>
          </div>

          <div className="form-field">
            <label htmlFor="organizationName">
              Organization Name <span>*</span>
            </label>

            <input
              id="organizationName"
              value={form.organizationName}
              onChange={(event) =>
                updateField(
                  "organizationName",
                  event.target.value,
                )
              }
              placeholder="e.g. Acme Logistics"
              required
            />
          </div>

          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="industry">Industry</label>

              <select
                id="industry"
                value={form.industry}
                onChange={(event) =>
                  updateField("industry", event.target.value)
                }
              >
                <option value="">Select industry...</option>
                <option value="logistics">Logistics</option>
                <option value="transportation">
                  Transportation
                </option>
                <option value="manufacturing">
                  Manufacturing
                </option>
                <option value="distribution">
                  Distribution
                </option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="currency">Primary Currency</label>

              <select
                id="currency"
                value={form.currency}
                onChange={(event) =>
                  updateField("currency", event.target.value)
                }
              >
                <option value="USD">USD ($)</option>
                <option value="INR">INR (₹)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="headquartersAddress">
              Headquarters Address
            </label>

            <input
              id="headquartersAddress"
              value={form.headquartersAddress}
              onChange={(event) =>
                updateField(
                  "headquartersAddress",
                  event.target.value,
                )
              }
              placeholder="123 Enterprise Way, Suite 100"
            />
          </div>

          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="operatingCountry">
                Operating Country
              </label>

              <select
                id="operatingCountry"
                value={form.operatingCountry}
                onChange={(event) =>
                  updateField(
                    "operatingCountry",
                    event.target.value,
                  )
                }
              >
                <option value="">Select country...</option>
                <option value="india">India</option>
                <option value="usa">United States</option>
                <option value="uk">United Kingdom</option>
                <option value="germany">Germany</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="operatingCities">
                Operating Cities
              </label>

              <input
                id="operatingCities"
                value={form.operatingCities}
                onChange={(event) =>
                  updateField(
                    "operatingCities",
                    event.target.value,
                  )
                }
                placeholder="e.g. New York, Chicago"
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="taxNumber">
                GST / Tax Number
              </label>

              <input
                id="taxNumber"
                value={form.taxNumber}
                onChange={(event) =>
                  updateField("taxNumber", event.target.value)
                }
                placeholder="Tax ID"
              />
            </div>

            <div className="form-field">
              <label htmlFor="website">Website</label>

              <input
                id="website"
                type="url"
                value={form.website}
                onChange={(event) =>
                  updateField("website", event.target.value)
                }
                placeholder="https://example.com"
              />
            </div>
          </div>

          <fieldset className="business-hours">
            <legend>Business Hours</legend>

            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="businessHoursStart">From</label>

                <input
                  id="businessHoursStart"
                  type="time"
                  value={form.businessHoursStart}
                  onChange={(event) =>
                    updateField(
                      "businessHoursStart",
                      event.target.value,
                    )
                  }
                />
              </div>

              <div className="form-field">
                <label htmlFor="businessHoursEnd">To</label>

                <input
                  id="businessHoursEnd"
                  type="time"
                  value={form.businessHoursEnd}
                  onChange={(event) =>
                    updateField(
                      "businessHoursEnd",
                      event.target.value,
                    )
                  }
                />
              </div>
            </div>
          </fieldset>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <div className="create-organization__actions">
            <Button
              type="button"
              variant="secondary"
              onClick={saveDraft}
            >
              Save as Draft
            </Button>

            <Button type="submit">
              Complete Setup →
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}

export default CreateOrganizationPage;