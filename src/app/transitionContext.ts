import { createContext } from "react";

export interface TransitionState {
  active: boolean;
  runTransition: (work: () => Promise<void>) => Promise<void>;
}

export const TransitionContext = createContext<TransitionState | null>(
  null,
);
