import { getMe, listDepots, listJobTemplates, listVehicles } from "./api";

export type OnboardingStep =
  | {
      step: "organization";
    }
  | {
      step: "depots";
    }
  | {
      step: "network";
    }
  | {
      step: "vehicles";
    }
  | {
      step: "dashboard";
    };

export const STEP_ROUTES: Record<OnboardingStep["step"], string> = {
  organization: "/organization/setup",
  depots: "/onboarding/infrastructure",
  network: "/onboarding/infrastructure",
  vehicles: "/onboarding/fleet",
  dashboard: "/dashboard",
};

export const MINIMUM_DEPOTS = 2;
export const MINIMUM_ROUTES = 1;

export async function resolveOnboardingStep(): Promise<OnboardingStep> {
  const me = await getMe();

  if (!me.organization_id) {
    return { step: "organization" };
  }

  let depots;
  try {
    depots = await listDepots();
  } catch (error) {
    depots = [];
    console.warn("Failed to load depots", error);
  }

  if (depots.length < MINIMUM_DEPOTS) {
    return { step: "depots" };
  }

  let routesCount: number;
  try {
    const templates = await listJobTemplates();
    routesCount = templates.length;
  } catch (error) {
    routesCount = 0;
    console.warn("Failed to load routes", error);
  }

  if (depots.length < MINIMUM_DEPOTS || routesCount < MINIMUM_ROUTES) {
    return { step: "network" };
  }

  let vehicles;
  try {
    vehicles = await listVehicles();
  } catch (error) {
    vehicles = [];
    console.warn("Failed to load vehicles", error);
  }

  if (vehicles.length === 0) {
    return { step: "vehicles" };
  }

  return { step: "dashboard" };
}
