import type { ReactNode } from "react";
import { Search, X } from "lucide-react";

import type { Option } from "./Fields";

export function SearchBox({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <label className="ops-search">
      <Search size={17} strokeWidth={1.8} aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
      />
    </label>
  );
}

export function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
}) {
  return (
    <label className="ops-filter">
      <span className="ops-filter__label">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FilterBar({
  children,
  onClear,
  active,
}: {
  children: ReactNode;
  onClear: () => void;
  active: boolean;
}) {
  return (
    <div className="ops-filterbar">
      {children}
      {active && (
        <button type="button" className="ops-btn ops-btn--ghost ops-btn--sm" onClick={onClear}>
          <X size={15} /> Clear filters
        </button>
      )}
    </div>
  );
}
