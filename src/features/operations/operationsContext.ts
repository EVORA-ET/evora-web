import { createContext } from "react";

export interface OpsToast {
  success: (message: string) => void;
  error: (message: string) => void;
}

export interface OpsValue {
  /** Selected operational day, YYYY-MM-DD in the browser's zone. */
  date: string;
  setDate: (date: string) => void;
  /** Bumped after any successful write so mounted lists and summaries reload. */
  version: number;
  invalidate: () => void;
  toast: OpsToast;
  /** In-memory filter state per workspace, so tabs remember their filters. */
  loadState: (key: string) => unknown;
  saveState: (key: string, value: unknown) => void;
}

export const OperationsContext = createContext<OpsValue | null>(null);
