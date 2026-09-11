import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import ComingSoonModal from "../../components/ui/ComingSoonModal";
import "./OrganizationSetupPage.css";

function OrganizationSetupPage() {
  const navigate = useNavigate();
  const [linkModalOpen, setLinkModalOpen] = useState(false);

  return (
    <main className="organization-setup">
      <section className="organization-setup__content">
        <div className="organization-setup__brand">EVORA</div>

        <h1>Welcome to your fleet.</h1>

        <p className="organization-setup__intro">
          Let's get started. Choose how you want to set up your
          workspace to begin managing your assets and infrastructure.
        </p>

        <div className="organization-setup__options">
          <article className="organization-option">
            <div className="organization-option__icon" aria-hidden="true">
              ↗
            </div>

            <div>
              <h2>Link an Organization</h2>

              <p>
                Join an existing enterprise workspace. You'll need an
                invite code or administrator approval to connect to an
                established fleet.
              </p>
            </div>

            <Button
              variant="ghost"
              onClick={() => setLinkModalOpen(true)}
            >
              Connect now →
            </Button>
          </article>

          <article className="organization-option">
            <div className="organization-option__icon" aria-hidden="true">
              +
            </div>

            <div>
              <h2>Create an Organization</h2>

              <p>
                Set up a new enterprise hub from scratch. Configure
                your initial fleet parameters, invite your team, and
                establish infrastructure rules.
              </p>
            </div>

            <Button
              variant="ghost"
              onClick={() => navigate("/organization/create")}
            >
              Start building →
            </Button>
          </article>
        </div>

        <button
          className="organization-setup__support"
          type="button"
        >
          ⓘ Need help deciding? Contact Support
        </button>
      </section>

      <ComingSoonModal
        open={linkModalOpen}
        title="Link an Organization"
        description="Bringing existing enterprise workspaces into EVORA takes a bit more time. Linking will be available soon."
        onClose={() => setLinkModalOpen(false)}
      />
    </main>
  );
}

export default OrganizationSetupPage;