import { useContext } from "react";

import { OperationsContext } from "./operationsContext";

export function useOps() {
  const value = useContext(OperationsContext);
  if (!value) throw new Error("useOps must be used inside OperationsProvider");
  return value;
}
