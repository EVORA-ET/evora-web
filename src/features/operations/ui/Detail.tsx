import type { ReactNode } from "react";

export function DetailList({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="ops-deflist">
      {items.map(([label, value]) => (
        <div key={label} className="ops-deflist__row">
          <dt>{label}</dt>
          <dd>{value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="ops-section">
      <div className="ops-section__head">
        <h3>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
