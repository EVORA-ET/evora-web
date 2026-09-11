import { useNavigate } from "react-router-dom";
import ComingSoonModal from "../../components/ui/ComingSoonModal";
import "./LinkOrganizationPage.css";

function LinkOrganizationPage() {
  const navigate = useNavigate();

  return (
    <main className="link-organization">
      <ComingSoonModal
        open
        title="Link an Organization"
        description="Bringing existing enterprise workspaces into EVORA takes a bit more time. Linking will be available soon."
        onClose={() => navigate("/organization/setup", { replace: true })}
        onBack={() => navigate("/organization/setup", { replace: true })}
      />
    </main>
  );
}

export default LinkOrganizationPage;