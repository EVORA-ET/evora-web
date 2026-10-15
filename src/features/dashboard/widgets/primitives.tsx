import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

import { TONE_VAR, type Tone } from "./tones";

/* ------------------------------------------------------------------ */
/* Colour tones (all from the design tokens)                           */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Empty state                                                         */
/* ------------------------------------------------------------------ */

interface WidgetEmptyProps {
  icon: LucideIcon;
  title: string;
  text?: string;
  actionLabel?: string;
  to?: string;
}

export function WidgetEmpty({ icon: Icon, title, text, actionLabel, to }: WidgetEmptyProps) {
  return (
    <div className="w-empty">
      <span className="w-empty__icon">
        <Icon size={22} strokeWidth={1.6} />
      </span>
      <p className="w-empty__title">{title}</p>
      {text && <p className="w-empty__text">{text}</p>}
      {actionLabel && to && (
        <Link className="w-empty__action" to={to}>
          {actionLabel} →
        </Link>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Big number                                                          */
/* ------------------------------------------------------------------ */

export function BigNumber({
  value,
  unit,
  caption,
}: {
  value: ReactNode;
  unit?: string;
  caption?: string;
}) {
  return (
    <div className="w-number">
      <span className="w-number__value">{value}</span>
      {unit && <span className="w-number__unit">{unit}</span>}
      {caption && <p className="w-number__caption">{caption}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Legend rows                                                         */
/* ------------------------------------------------------------------ */

export interface LegendItem {
  label: string;
  value: number | string;
  tone: Tone;
}

export function Legend({ items, columns = 1 }: { items: LegendItem[]; columns?: 1 | 2 }) {
  return (
    <ul className={`w-legend w-legend--${columns}`}>
      {items.map((item) => (
        <li key={item.label}>
          <span className="w-legend__dot" style={{ background: TONE_VAR[item.tone] }} />
          <span className="w-legend__label">{item.label}</span>
          <span className="w-legend__value">{item.value}</span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Donut                                                               */
/* ------------------------------------------------------------------ */

export interface DonutSegment {
  label: string;
  value: number;
  tone: Tone;
}

export function Donut({
  segments,
  centerValue,
  centerLabel,
  size = 148,
  thickness = 18,
}: {
  segments: DonutSegment[];
  centerValue: ReactNode;
  centerLabel?: string;
  size?: number;
  thickness?: number;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;

  return (
    <div className="w-donut" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-surface-container)"
          strokeWidth={thickness}
        />
        {total > 0 &&
          segments
            .filter((segment) => segment.value > 0)
            .map((segment) => {
              const length = (segment.value / total) * circumference;
              const gap = segments.filter((s) => s.value > 0).length > 1 ? 3 : 0;
              const dash = Math.max(0, length - gap);
              const start = offset;
              offset += length;

              return (
                <circle
                  key={segment.label}
                  className="w-donut__segment"
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={TONE_VAR[segment.tone]}
                  strokeWidth={thickness}
                  strokeLinecap="butt"
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-start}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                  style={{ ["--circumference" as string]: circumference, ["--dash" as string]: dash }}
                >
                  <title>{`${segment.label}: ${segment.value}`}</title>
                </circle>
              );
            })}
      </svg>

      <div className="w-donut__center">
        <span className="w-donut__value">{centerValue}</span>
        {centerLabel && <span className="w-donut__label">{centerLabel}</span>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ring gauge (single value)                                           */
/* ------------------------------------------------------------------ */

export function RingGauge({
  percent,
  tone = "primary",
  centerValue,
  centerLabel,
  size = 148,
  thickness = 16,
}: {
  percent: number;
  tone?: Tone;
  centerValue?: ReactNode;
  centerLabel?: string;
  size?: number;
  thickness?: number;
}) {
  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <Donut
      size={size}
      thickness={thickness}
      segments={
        [
          { label: "Value", value: clamped, tone },
          { label: "Remaining", value: 100 - clamped, tone: "muted" },
        ] satisfies DonutSegment[]
      }
      centerValue={centerValue ?? `${Math.round(clamped)}%`}
      centerLabel={centerLabel}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Progress bar                                                        */
/* ------------------------------------------------------------------ */

export function ProgressBar({ percent, tone = "primary" }: { percent: number; tone?: Tone }) {
  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <div className="w-progress" role="progressbar" aria-valuenow={Math.round(clamped)} aria-valuemin={0} aria-valuemax={100}>
      <span className="w-progress__fill" style={{ width: `${clamped}%`, background: TONE_VAR[tone] }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stacked bar                                                         */
/* ------------------------------------------------------------------ */

export function StackedBar({ segments }: { segments: DonutSegment[] }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  return (
    <div className="w-stacked" aria-hidden="true">
      {segments
        .filter((segment) => segment.value > 0)
        .map((segment) => (
          <span
            key={segment.label}
            className="w-stacked__segment"
            style={{
              width: `${(segment.value / total) * 100}%`,
              background: TONE_VAR[segment.tone],
            }}
            title={`${segment.label}: ${segment.value}`}
          />
        ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Vertical bars                                                       */
/* ------------------------------------------------------------------ */

export interface BarDatum {
  label: string;
  value: number;
  tone?: Tone;
  display?: string;
}

export function BarChart({
  data,
  max,
  emphasiseLast = false,
}: {
  data: BarDatum[];
  max?: number;
  emphasiseLast?: boolean;
}) {
  const ceiling = max ?? Math.max(1, ...data.map((datum) => datum.value));

  return (
    <div className="w-bars">
      {data.map((datum, position) => {
        const height = Math.max(datum.value > 0 ? 4 : 0, (datum.value / ceiling) * 100);
        const isLast = position === data.length - 1;

        return (
          <div className="w-bars__col" key={`${datum.label}-${position}`}>
            <span className="w-bars__value">{datum.display ?? datum.value}</span>
            <div className="w-bars__track">
              <span
                className="w-bars__bar"
                style={{
                  height: `${height}%`,
                  background: TONE_VAR[datum.tone ?? (emphasiseLast && isLast ? "primary" : "green")],
                  opacity: datum.value === 0 ? 0.25 : 1,
                  animationDelay: `${position * 45}ms`,
                }}
              />
            </div>
            <span className="w-bars__label">{datum.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Horizontal bars                                                     */
/* ------------------------------------------------------------------ */

export function HBarList({
  data,
  max,
}: {
  data: { label: string; value: number; tone?: Tone; display?: string }[];
  max?: number;
}) {
  const ceiling = max ?? Math.max(1, ...data.map((datum) => datum.value));

  return (
    <ul className="w-hbars">
      {data.map((datum) => (
        <li key={datum.label}>
          <div className="w-hbars__row">
            <span>{datum.label}</span>
            <strong>{datum.display ?? datum.value}</strong>
          </div>
          <ProgressBar percent={(datum.value / ceiling) * 100} tone={datum.tone ?? "green"} />
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Line chart                                                          */
/* ------------------------------------------------------------------ */

export function LineChart({
  data,
  max,
  unit = "",
}: {
  data: { label: string; value: number }[];
  max?: number;
  unit?: string;
}) {
  const width = 320;
  const height = 130;
  const padX = 14;
  const padTop = 16;
  const padBottom = 10;

  const ceiling = max ?? Math.max(1, ...data.map((datum) => datum.value));
  const step = data.length > 1 ? (width - padX * 2) / (data.length - 1) : 0;

  const points = data.map((datum, position) => ({
    x: padX + position * step,
    y: padTop + (1 - datum.value / ceiling) * (height - padTop - padBottom),
    ...datum,
  }));

  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${padX},${height - padBottom} ${line} ${padX + (points.length - 1) * step},${height - padBottom}`;

  return (
    <div className="w-line">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img">
        {[0.25, 0.5, 0.75].map((fraction) => (
          <line
            key={fraction}
            x1={padX}
            x2={width - padX}
            y1={padTop + fraction * (height - padTop - padBottom)}
            y2={padTop + fraction * (height - padTop - padBottom)}
            stroke="var(--color-surface-container-high)"
            strokeDasharray="3 5"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <polygon points={area} className="w-line__area" />
        <polyline points={line} className="w-line__stroke" vectorEffect="non-scaling-stroke" />
      </svg>

      <div className="w-line__dots" aria-hidden="true">
        {points.map((point) => (
          <span
            key={point.label + point.x}
            className="w-line__dot"
            style={{ left: `${(point.x / width) * 100}%`, top: `${(point.y / height) * 100}%` }}
            title={`${point.label}: ${Math.round(point.value)}${unit}`}
          />
        ))}
      </div>

      <div className="w-line__labels">
        {data.map((datum, position) => (
          <span key={`${datum.label}-${position}`}>{datum.label}</span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Simple list row                                                     */
/* ------------------------------------------------------------------ */

export function ListRow({
  primary,
  secondary,
  trailing,
  tone,
  to,
}: {
  primary: ReactNode;
  secondary?: ReactNode;
  trailing?: ReactNode;
  tone?: Tone;
  to?: string;
}) {
  const content = (
    <>
      {tone && <span className="w-row__dot" style={{ background: TONE_VAR[tone] }} />}
      <span className="w-row__main">
        <span className="w-row__primary">{primary}</span>
        {secondary && <span className="w-row__secondary">{secondary}</span>}
      </span>
      {trailing && <span className="w-row__trailing">{trailing}</span>}
    </>
  );

  return to ? (
    <Link className="w-row w-row--link" to={to}>{content}</Link>
  ) : (
    <div className="w-row">{content}</div>
  );
}

export function Pill({ children, tone = "muted" }: { children: ReactNode; tone?: Tone }) {
  return <span className={`w-pill w-pill--${tone}`}>{children}</span>;
}
