import { useId, useState, type ReactNode } from "react";

import { SERIES } from "./chartColors";

/**
 * Small SVG chart kit for the intelligence screens (no chart library).
 * Every chart takes already-computed values; none of them invents data.
 * Missing values (null) are drawn as "no data", never as zero, and every
 * chart ships a table view so values never depend on hover or colour.
 */


export interface Segment {
  key: string;
  label: string;
  value: number;
  color: string;
  note?: string;
}

function pct(value: number, total: number): number {
  return total > 0 ? (100 * value) / total : 0;
}

function fmtPct(value: number, total: number): string {
  if (total <= 0) return "—";
  const p = pct(value, total);
  return `${p < 1 && p > 0 ? p.toFixed(1) : Math.round(p)}%`;
}

export function Legend({ items }: { items: { label: string; color: string; value?: ReactNode }[] }) {
  return (
    <ul className="chart-legend">
      {items.map((i) => (
        <li key={i.label}>
          <span className="chart-legend__swatch" style={{ background: i.color }} aria-hidden="true" />
          <span>{i.label}</span>
          {i.value !== undefined && <strong>{i.value}</strong>}
        </li>
      ))}
    </ul>
  );
}

function TableView({ caption, head, rows }: { caption: string; head: string[]; rows: ReactNode[][] }) {
  return (
    <details className="chart-table">
      <summary>Show as table</summary>
      <div className="ops-table-scroll">
        <table className="ops-table">
          <caption className="ops-sr-only">{caption}</caption>
          <thead>
            <tr>{head.map((h) => <th key={h} scope="col">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>{r.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>))}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** One horizontal bar split into labelled parts (e.g. ICE | EV | unclassified). */
export function SplitBar({
  segments,
  label,
  height = 28,
  showTable = true,
}: {
  segments: Segment[];
  label: string;
  height?: number;
  showTable?: boolean;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const visible = segments.filter((s) => s.value > 0);
  return (
    <div className="chart-split">
      <div className="chart-split__bar" style={{ height }} role="img"
        aria-label={`${label}: ${segments.map((s) => `${s.label} ${s.value} (${fmtPct(s.value, total)})`).join(", ")}`}>
        {total === 0 ? (
          <span className="chart-split__empty">No vehicles</span>
        ) : (
          visible.map((s) => (
            <span key={s.key} className="chart-split__seg" title={`${s.label}: ${s.value} (${fmtPct(s.value, total)})`}
              style={{ flexGrow: s.value, background: s.color }} />
          ))
        )}
      </div>
      <Legend items={segments.map((s) => ({
        label: s.label,
        color: s.color,
        value: `${s.value} · ${fmtPct(s.value, total)}`,
      }))} />
      {showTable && (
        <TableView caption={label} head={["Group", "Vehicles", "Share"]}
          rows={segments.map((s) => [s.label, s.value, fmtPct(s.value, total)])} />
      )}
    </div>
  );
}

/** Measured progress towards a whole (and optionally a target marker). */
export function ProgressMeter({
  value,
  label,
  valueText,
  target,
  targetLabel,
  color = SERIES.ev,
}: {
  value: number | null;
  label: string;
  valueText: string;
  target?: number | null;
  targetLabel?: string;
  color?: string;
}) {
  const v = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className="chart-meter">
      <div className="chart-meter__head">
        <span>{label}</span>
        <strong>{valueText}</strong>
      </div>
      <div className="chart-meter__track" role="progressbar" aria-label={label}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={value ?? undefined} aria-valuetext={valueText}>
        {value !== null && <span className="chart-meter__fill" style={{ width: `${v}%`, background: color }} />}
        {target !== undefined && target !== null && (
          <span className="chart-meter__target" style={{ left: `${Math.min(100, target)}%` }} title={targetLabel} />
        )}
      </div>
      {targetLabel && target !== null && target !== undefined && (
        <p className="chart-meter__note">{targetLabel}</p>
      )}
    </div>
  );
}

export interface Series {
  key: string;
  label: string;
  color: string;
  values: (number | null)[];
}

function niceMax(max: number): number {
  if (max <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(max)));
  const f = max / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * exp;
}

function compact(n: number): string {
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

/** Grouped columns per category (e.g. month). Null = no data, drawn as a hairline tick. */
export function ColumnChart({
  categories,
  series,
  label,
  format,
  height = 200,
  width = 960,
}: {
  categories: string[];
  series: Series[];
  label: string;
  format: (n: number) => string;
  height?: number;
  /** Drawing width in px; use roughly the container width so labels keep their size. */
  width?: number;
}) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const max = niceMax(Math.max(0, ...all));
  const pad = { l: 44, r: 8, t: 10, b: 26 };
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  const band = plotW / Math.max(1, categories.length);
  const barW = Math.min(18, (band - 6) / Math.max(1, series.length) - 2);
  const groupW = series.length * (barW + 2) - 2;
  const y = (v: number) => pad.t + plotH - (v / max) * plotH;
  const ticks = [0, max / 2, max];

  return (
    <figure className="chart-figure" aria-labelledby={`${id}-cap`}>
      <figcaption id={`${id}-cap`} className="ops-sr-only">{label}</figcaption>
      {series.length > 1 && <Legend items={series.map((s) => ({ label: s.label, color: s.color }))} />}
      <div className="chart-svgwrap">
        <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" aria-label={label}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} className="chart-grid" />
              <text x={pad.l - 6} y={y(t) + 4} className="chart-axis" textAnchor="end">{compact(t)}</text>
            </g>
          ))}
          {categories.map((c, i) => {
            const x0 = pad.l + i * band + (band - groupW) / 2;
            return (
              <g key={c} tabIndex={0} role="listitem" onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                aria-label={`${c}: ${series.map((s) => `${s.label} ${s.values[i] === null ? "no data" : format(s.values[i] as number)}`).join(", ")}`}>
                <rect x={pad.l + i * band} y={pad.t} width={band} height={plotH} className={hover === i ? "chart-hit chart-hit--on" : "chart-hit"} />
                {series.map((s, j) => {
                  const v = s.values[i];
                  const x = x0 + j * (barW + 2);
                  if (v === null) {
                    return <line key={s.key} x1={x} x2={x + barW} y1={y(0) - 1} y2={y(0) - 1} className="chart-nodata" />;
                  }
                  const h = Math.max(1, y(0) - y(v));
                  const r = Math.min(4, barW / 2, h);
                  return (
                    <path key={s.key} fill={s.color}
                      d={`M${x},${y(0)} V${y(0) - h + r} Q${x},${y(0) - h} ${x + r},${y(0) - h} H${x + barW - r} Q${x + barW},${y(0) - h} ${x + barW},${y(0) - h + r} V${y(0)} Z`} />
                  );
                })}
                <text x={pad.l + i * band + band / 2} y={height - 8} className="chart-axis" textAnchor="middle">{c}</text>
              </g>
            );
          })}
          <line x1={pad.l} x2={width - pad.r} y1={y(0)} y2={y(0)} className="chart-baseline" />
        </svg>
        {hover !== null && (
          <div className="chart-tip" style={{ left: `${((pad.l + hover * band + band / 2) / width) * 100}%` }} role="status">
            <strong>{categories[hover]}</strong>
            {series.map((s) => (
              <span key={s.key} className="chart-tip__row">
                <i style={{ background: s.color }} aria-hidden="true" />
                <b>{s.values[hover] === null ? "No data" : format(s.values[hover] as number)}</b> {s.label}
              </span>
            ))}
          </div>
        )}
      </div>
      <TableView caption={label} head={["Period", ...series.map((s) => s.label)]}
        rows={categories.map((c, i) => [c, ...series.map((s) => (s.values[i] === null ? "No data" : format(s.values[i] as number)))])} />
    </figure>
  );
}

/** Two values per row compared on one scale (e.g. ICE vs EV net present cost). */
export function PairedBars({
  rows,
  a,
  b,
  format,
  label,
  missingLabel = "Not available",
}: {
  rows: { label: string; a: number | null; b: number | null; note?: string }[];
  a: { label: string; color: string };
  b: { label: string; color: string };
  format: (n: number) => string;
  label: string;
  missingLabel?: string;
}) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.a ?? 0, r.b ?? 0].map(Math.abs)));
  const bar = (v: number | null, color: string, name: string) => (
    <div className="chart-pair__bar">
      {v === null ? (
        <span className="chart-pair__none">{missingLabel}</span>
      ) : (
        <>
          <span className="chart-pair__fill" style={{ width: `${Math.max(1, (100 * Math.abs(v)) / max)}%`, background: color }}
            aria-hidden="true" />
          <span className="chart-pair__value">{format(v)}</span>
        </>
      )}
      <span className="ops-sr-only">{name}</span>
    </div>
  );
  return (
    <figure className="chart-figure" aria-label={label}>
      <Legend items={[a, b]} />
      <div className="chart-pair">
        {rows.map((r) => (
          <div key={r.label} className="chart-pair__row">
            <div className="chart-pair__label">
              {r.label}
              {r.note && <small>{r.note}</small>}
            </div>
            <div className="chart-pair__bars">
              {bar(r.a, a.color, a.label)}
              {bar(r.b, b.color, b.label)}
            </div>
          </div>
        ))}
      </div>
      <TableView caption={label} head={["", a.label, b.label]}
        rows={rows.map((r) => [r.label, r.a === null ? missingLabel : format(r.a), r.b === null ? missingLabel : format(r.b)])} />
    </figure>
  );
}

/** Share of a whole by non-overlapping categories. */
export function Donut({
  segments,
  label,
  center,
  centerLabel,
  size = 148,
}: {
  segments: Segment[];
  label: string;
  center: ReactNode;
  centerLabel: string;
  size?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  const gap = total > 0 && segments.filter((s) => s.value > 0).length > 1 ? 2 : 0;
  let offset = 0;
  return (
    <div className="chart-donut">
      <div className="chart-donut__ring" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} role="img"
          aria-label={`${label}: ${segments.map((s) => `${s.label} ${s.value}`).join(", ")}`}>
          <circle cx={size / 2} cy={size / 2} r={r} className="chart-donut__track" />
          {total > 0 && segments.filter((s) => s.value > 0).map((s) => {
            const len = (s.value / total) * c;
            const el = (
              <circle key={s.key} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={16}
                strokeDasharray={`${Math.max(0, len - gap)} ${c - Math.max(0, len - gap)}`} strokeDashoffset={-offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}>
                <title>{`${s.label}: ${s.value}`}</title>
              </circle>
            );
            offset += len;
            return el;
          })}
        </svg>
        <div className="chart-donut__center">
          <strong>{center}</strong>
          <span>{centerLabel}</span>
        </div>
      </div>
      <div>
        <Legend items={segments.map((s) => ({ label: s.label, color: s.color, value: s.value }))} />
        <TableView caption={label} head={["Category", "Count", "Share"]}
          rows={segments.map((s) => [s.label, s.value, fmtPct(s.value, total)])} />
      </div>
    </div>
  );
}
