import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import "./LoginPage.css";

function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email || !password) {
      return;
    }

    navigate("/organization/setup");
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

          <Button type="submit">SIGN IN →</Button>

          <div className="auth-divider">
            <span>OR</span>
          </div>

          <button
            className="google-button"
            type="button"
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