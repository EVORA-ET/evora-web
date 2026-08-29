import { useRef, useState } from "react";
import type {
  ClipboardEvent,
  KeyboardEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import "./LinkOrganizationPage.css";

const CODE_LENGTH = 6;

function LinkOrganizationPage() {
  const navigate = useNavigate();

  const [code, setCode] = useState<string[]>(
    Array(CODE_LENGTH).fill(""),
  );

  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const handleChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);

    const nextCode = [...code];
    nextCode[index] = digit;
    setCode(nextCode);

    if (digit && index < CODE_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    event: KeyboardEvent<HTMLInputElement>,
  ) => {
    if (
      event.key === "Backspace" &&
      !code[index] &&
      index > 0
    ) {
      inputsRef.current[index - 1]?.focus();
    }

    if (
      event.key === "ArrowLeft" &&
      index > 0
    ) {
      inputsRef.current[index - 1]?.focus();
    }

    if (
      event.key === "ArrowRight" &&
      index < CODE_LENGTH - 1
    ) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (
    event: ClipboardEvent<HTMLInputElement>,
  ) => {
    event.preventDefault();

    const pastedCode = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, CODE_LENGTH);

    if (!pastedCode) {
      return;
    }

    const nextCode = Array(CODE_LENGTH).fill("");

    pastedCode.split("").forEach((digit, index) => {
      nextCode[index] = digit;
    });

    setCode(nextCode);

    const nextIndex = Math.min(
      pastedCode.length,
      CODE_LENGTH - 1,
    );

    inputsRef.current[nextIndex]?.focus();
  };

  const handleSubmit = () => {
    const invitationCode = code.join("");

    if (invitationCode.length !== CODE_LENGTH) {
      return;
    }

    // Temporary frontend-only behavior.
    // Backend verification will replace this later.
    navigate("/dashboard");
  };

  const isComplete = code.every(Boolean);

  return (
    <main className="link-organization">
      <button
        className="link-organization__back"
        type="button"
        onClick={() => navigate("/organization/setup")}
      >
        ← <span>Back</span>
      </button>

      <section className="link-organization__card">
        <div className="link-organization__icon">
          ▦
        </div>

        <h1>Join Organization</h1>

        <p className="link-organization__description">
          Enter the 6-digit invitation code provided by your
          administrator.
        </p>

        <div className="code-inputs">
          {code.map((digit, index) => (
            <div
              className="code-input-wrapper"
              key={index}
            >
              <input
                ref={(element) => {
                  inputsRef.current[index] = element;
                }}
                value={digit}
                onChange={(event) =>
                  handleChange(index, event.target.value)
                }
                onKeyDown={(event) =>
                  handleKeyDown(index, event)
                }
                onPaste={handlePaste}
                inputMode="numeric"
                maxLength={1}
                aria-label={`Invitation code digit ${index + 1}`}
              />

              {index === 2 && (
                <span className="code-separator">−</span>
              )}
            </div>
          ))}
        </div>

        <p className="link-organization__hint">
          Codes are case-insensitive and expire after 24 hours.
        </p>

        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!isComplete}
        >
          VERIFY & JOIN →
        </Button>

        <div className="link-organization__help">
          <span aria-hidden="true">?</span>
          <button type="button">
            Need help finding your code?
          </button>
        </div>
      </section>
    </main>
  );
}

export default LinkOrganizationPage;