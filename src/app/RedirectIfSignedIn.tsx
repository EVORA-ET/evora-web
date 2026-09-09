import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./useAuth";
import { resolveOnboardingStep, STEP_ROUTES } from "../lib/onboardingFlow";
import PageLoader from "../components/ui/PageLoader";

interface RedirectIfSignedInProps {
  children: ReactNode;
}

export function RedirectIfSignedIn({ children }: RedirectIfSignedInProps) {
  const { sessionReady, accessToken } = useAuth();
  const [stepResolved, setStepResolved] = useState(false);
  const [stepRoute, setStepRoute] = useState<string | null>(null);
  const resolving = useRef(false);

  const signedIn = sessionReady && Boolean(accessToken);

  useEffect(() => {
    if (!signedIn || resolving.current) {
      return;
    }

    resolving.current = true;

    void resolveOnboardingStep()
      .then((result) => {
        setStepRoute(STEP_ROUTES[result.step]);
      })
      .catch(() => {
        setStepResolved(true);
      })
      .finally(() => {
        resolving.current = false;
      });
  }, [signedIn]);

  if (!sessionReady) {
    return <PageLoader active />;
  }

  if (signedIn) {
    if (stepRoute) {
      return <Navigate to={stepRoute} replace />;
    }

    if (!stepResolved) {
      return <PageLoader active />;
    }
  }

  return <>{children}</>;
}
