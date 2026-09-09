import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import { TransitionContext } from "./transitionContext";
import PageLoader from "../components/ui/PageLoader";

const MIN_TRANSITION_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function TransitionProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);

  const runTransition = useCallback(async (work: () => Promise<void>) => {
    const startedAt = Date.now();

    setActive(true);

    try {
      await work();
    } finally {
      const remaining = MIN_TRANSITION_MS - (Date.now() - startedAt);
      if (remaining > 0) {
        await sleep(remaining);
      }
      setActive(false);
    }
  }, []);

  return (
    <TransitionContext.Provider value={{ active, runTransition }}>
      {children}
      <PageLoader active={active} />
    </TransitionContext.Provider>
  );
}
