import { useState } from "react";
import { signOutAndGoHome } from "../../lib/session";
import { useAuth } from "../../app/useAuth";
import "./SignOutButton.css";

function SignOutButton() {
  const { accessToken } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!accessToken) {
    return null;
  }

  const handleClick = () => {
    if (busy) return;
    setBusy(true);
    void signOutAndGoHome();
  };

  return (
    <button
      className="sign-out-button"
      onClick={handleClick}
      disabled={busy}
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}

export default SignOutButton;
