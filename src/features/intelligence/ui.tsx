import { useId, useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown, Info } from "lucide-react";

import type {
  EvidenceClass,
  EvidenceLevel,
  ReadinessCheck,
  ReadinessResult,
  ServiceStatus,
} from "../../lib/intelligenceApi";
import { Pill } from "../operations/ui/Pill";
import {
  CHECK_STATUS_LABEL,
  COVERAGE_DEFINITION,
  COVERAGE_LABEL,
  EVIDENCE_CLASS_DEFINITION,
  EVIDENCE_CLASS_LABEL,
  OUTCOME_LABEL,
  SERVICE_STATUS_LABEL,
  checkTone,
  coverageTone,
  evidenceTone,
  outcomeTone,
  serviceTone,
} from "./labels";

export function CoverageBadge({ level }: { level: EvidenceLevel | null | undefined }) {
  if (!level) return <Pill>Not assessed</Pill>;
  return (
    <span title={COVERAGE_DEFINITION[level]}>
      <Pill tone={coverageTone(level)}>{COVERAGE_LABEL[level]}</Pill>
    </span>
  );
}

export function EvidencePill({ cls }: { cls: EvidenceClass }) {
  return (
    <span title={EVIDENCE_CLASS_DEFINITION[cls]}>
      <Pill tone={evidenceTone(cls)}>{EVIDENCE_CLASS_LABEL[cls]}</Pill>
    </span>
  );
}

export function OutcomePill({ outcome }: { outcome: ReadinessResult["outcome"] | null | undefined }) {
  if (!outcome) return <Pill>No result</Pill>;
  return <Pill tone={outcomeTone(outcome)}>{OUTCOME_LABEL[outcome]}</Pill>;
}

export function CheckPill({ status }: { status: ReadinessCheck["status"] | undefined }) {
  if (!status) return <Pill>—</Pill>;
  return <Pill tone={checkTone(status)}>{CHECK_STATUS_LABEL[status]}</Pill>;
}

export function ServicePill({ status }: { status: ServiceStatus | null | undefined }) {
  if (!status) return <Pill>No requirements</Pill>;
  return <Pill tone={serviceTone(status)}>{SERVICE_STATUS_LABEL[status]}</Pill>;
}

/** Expandable details, keyboard accessible, closed by default. */
export function Disclosure({
  title,
  children,
  defaultOpen = false,
  meta,
}: {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  meta?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className={`intel-disclosure ${open ? "intel-disclosure--open" : ""}`}>
      <button
        type="button"
        className="intel-disclosure__toggle"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronDown size={16} aria-hidden="true" className="intel-disclosure__chev" />
        <span className="intel-disclosure__title">{title}</span>
        {meta && <span className="intel-disclosure__meta">{meta}</span>}
      </button>
      {open && (
        <div id={id} className="intel-disclosure__body">
          {children}
        </div>
      )}
    </div>
  );
}

/** A short definition shown under a metric or table. */
export function Definition({ children }: { children: ReactNode }) {
  return (
    <p className="intel-def">
      <Info size={13} aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

export function Stat({
  label,
  value,
  note,
  tone,
  onClick,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  tone?: "warn" | "danger";
  onClick?: () => void;
}) {
  const body = (
    <>
      <span className="ops-metric__label">{label}</span>
      <span className="ops-metric__value">{value}</span>
      {note && <span className="ops-metric__note">{note}</span>}
    </>
  );
  const cls = `ops-metric ${tone ? `ops-metric--${tone}` : ""} ${onClick ? "" : "intel-metric--static"}`;
  return onClick ? (
    <button type="button" className={cls} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Horizontal distribution bar; segments with zero count are omitted. */
export function Distribution({
  items,
  total,
  label,
}: {
  items: { key: string; label: string; count: number; tone: string }[];
  total: number;
  label: string;
}) {
  if (total === 0) return null;
  return (
    <div className="intel-dist">
      <div className="intel-dist__bar" role="img" aria-label={label}>
        {items
          .filter((item) => item.count > 0)
          .map((item) => (
            <span
              key={item.key}
              className={`intel-dist__seg intel-tone--${item.tone}`}
              style={{ width: `${(item.count / total) * 100}%` }}
              title={`${item.label}: ${item.count}`}
            />
          ))}
      </div>
      <ul className="intel-dist__legend">
        {items.map((item) => (
          <li key={item.key}>
            <span className={`intel-dot intel-tone--${item.tone}`} aria-hidden="true" />
            {item.label} <strong>{item.count}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Segmented choice using the Operations `ops-seg` pattern (aria-pressed). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="ops-seg" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
