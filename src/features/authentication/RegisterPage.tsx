import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { supabase } from "../../lib/supabase";
import { resolveOnboardingStep, STEP_ROUTES } from "../../lib/onboardingFlow";
import { useTransition } from "../../app/useTransition";
import "./LoginPage.css";
import "./RegisterPage.css";

function RegisterPage() {
  const navigate = useNavigate();
  const { runTransition } = useTransition();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!name || !email || !password || busy) {
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
      },
    });

    if (authError) {
      setBusy(false);
      setError(authError.message);
      return;
    }

    if (data.session) {
      void runTransition(async () => {
        setError(null);

        try {
          const result = await resolveOnboardingStep();
          navigate(STEP_ROUTES[result.step], {
            replace: true,
            viewTransition: true,
          });
        } catch {
          setError("Account created, but we could not load your profile.");
        } finally {
          setBusy(false);
        }
      });
      return;
    }

    setBusy(false);
    setNotice("Check your email to confirm your account before signing in.");
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
    <main className="auth-page register-page">
      <section className="auth-page__content">
        <div className="auth-page__brand">EVORA</div>

        <h1>Join the Future of Fleet Intelligence</h1>

        <p className="auth-page__subtitle">
          Create your account to start your electrification roadmap.
        </p>

        <form className="auth-card" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="register-name">FULL NAME</label>

            <input
              id="register-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Jane Doe"
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="register-email">WORK EMAIL</label>

            <input
              id="register-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="jane@company.com"
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="register-password">PASSWORD</label>

            <input
              id="register-password"
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="••••••••"
              minLength={12}
              required
            />

            <span className="password-hint">
              Must be at least 12 characters.
            </span>
          </div>

          {error && <p className="auth-error">{error}</p>}
          {notice && <p className="auth-error auth-notice">{notice}</p>}

          <Button type="submit" disabled={busy}>
            {busy ? "CREATING…" : "CREATE ACCOUNT"}
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
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => navigate("/login")}
            >
              Log in
            </button>
          </p>
        </form>

        <p className="auth-security">
          ◈ &nbsp; ENTERPRISE-GRADE SECURITY
        </p>
      </section>
    </main>
  );
}

export default RegisterPage;
