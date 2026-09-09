import { useEffect } from "react";
import "./ComingSoonModal.css";

interface ComingSoonModalProps {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
  onBack?: () => void;
}

function ComingSoonModal({
  open,
  title,
  description,
  onClose,
  onBack,
}: ComingSoonModalProps) {
  useEffect(() => {
    if (!open) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="coming-soon"
      onClick={onClose}
      role="presentation"
    >
      <section
        className="coming-soon__card"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <button
          className="coming-soon__close"
          type="button"
          aria-label="Close"
          onClick={onClose}
        >
          ✕
        </button>

        <div className="coming-soon__brand">EVORA</div>

        <div className="coming-soon__icon" aria-hidden="true">
          ◔
        </div>

        <h1>{title}</h1>

        <p>{description}</p>

        <div className="coming-soon__badge">COMING SOON</div>

        {onBack && (
          <button className="coming-soon__back" type="button" onClick={onBack}>
            ← Back
          </button>
        )}
      </section>
    </div>
  );
}

export default ComingSoonModal;
