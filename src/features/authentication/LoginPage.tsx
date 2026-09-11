import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { supabase } from "../../lib/supabase";
import { resolveOnboardingStep, STEP_ROUTES } from "../../lib/onboardingFlow";
import { useTransition } from "../../app/useTransition";
import "./LoginPage.css";

function LoginPage() {
  const navigate = useNavigate();
  const { runTransition } = useTransition();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const resolving = useRef(false);

  const continueAfterLogin = () => {
    if (resolving.current) return;
    resolving.current = true;

    void runTransition(async () => {
      setError(null);

      try {
        const result = await resolveOnboardingStep();
        navigate(STEP_ROUTES[result.step], {
          replace: true,
          viewTransition: true,
        });
      } catch {
        setError("Could not load your profile. Please try again.");
      } finally {
        resolving.current = false;
      }
    });
  };

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const signedIn =
        event === "SIGNED_IN" || (event === "INITIAL_SESSION" && session);
      if (signedIn) {
        void continueAfterLogin();
      }
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email || !password || busy) {
      return;
    }

    setBusy(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setBusy(false);
      setError(authError.message);
      return;
    }

    continueAfterLogin();
  };

  const handleGoogle = async () => {
    setError(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/login`,
      },
    });

    if (oauthError) {
      setError(oauthError.message);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-page__content">
        <div className="auth-page__brand">EVORA</div>

        <h1>Welcome Back</h1>

        <p className="auth-page__subtitle">
          Access your fleet intelligence dashboard.
        </p>

        <form className="auth-card" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="login-email">WORK EMAIL</label>

            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@company.com"
              required
            />
          </div>

          <div className="auth-field">
            <div className="auth-field__label-row">
              <label htmlFor="login-password">PASSWORD</label>

              <button type="button">
                Forgot Password?
              </button>
            </div>

            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="••••••••"
              required
            />
          </div>

          {error && <p className="auth-error">{error}</p>}

          <Button type="submit" disabled={busy}>
            {busy ? "SIGNING IN…" : "SIGN IN →"}
          </Button>

          <div className="auth-divider">
            <span>OR</span>
          </div>

          <button
            className="google-button"
            type="button"
            onClick={handleGoogle}
            disabled={busy}
          >
            <span>G</span>
            Continue with Google
          </button>

          <p className="auth-card__footer">
            Don't have an account?{" "}
            <button
              type="button"
              onClick={() => navigate("/register")}
            >
              Request Access
            </button>
          </p>
        </form>

        <p className="auth-security">
          ◈ &nbsp; ENTERPRISE GRADE SECURITY & ENCRYPTION
        </p>
      </section>
    </main>
  );
}

export default LoginPage;
