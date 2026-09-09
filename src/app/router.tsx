import { createBrowserRouter } from "react-router-dom";

import LandingPage from "../features/landing/LandingPage";

import { RedirectIfSignedIn } from "./RedirectIfSignedIn";
import LoginPage from "../features/authentication/LoginPage";
import RegisterPage from "../features/authentication/RegisterPage";

import OrganizationSetupPage from "../features/organization/OrganizationSetupPage";
import CreateOrganizationPage from "../features/organization/CreateOrganizationPage";
import LinkOrganizationPage from "../features/organization/LinkOrganizationPage";

import InfrastructureOnboardingPage from "../features/onboarding/InfrastructureOnboardingPage";
import FleetOnboardingPage from "../features/onboarding/FleetOnboardingPage";

import DashboardPage from "../features/dashboard/DashboardPage";

import { RequireAuth } from "./RequireAuth";

export const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <RedirectIfSignedIn>
        <LandingPage />
      </RedirectIfSignedIn>
    ),
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/register",
    element: <RegisterPage />,
  },
  {
    path: "/organization/setup",
    element: (
      <RequireAuth>
        <OrganizationSetupPage />
      </RequireAuth>
    ),
  },
  {
    path: "/organization/create",
    element: (
      <RequireAuth>
        <CreateOrganizationPage />
      </RequireAuth>
    ),
  },
  {
    path: "/organization/link",
    element: (
      <RequireAuth>
        <LinkOrganizationPage />
      </RequireAuth>
    ),
  },
  {
    path: "/onboarding/infrastructure",
    element: (
      <RequireAuth>
        <InfrastructureOnboardingPage />
      </RequireAuth>
    ),
  },
  {
    path: "/onboarding/fleet",
    element: (
      <RequireAuth>
        <FleetOnboardingPage />
      </RequireAuth>
    ),
  },
  {
    path: "/dashboard",
    element: (
      <RequireAuth>
        <DashboardPage />
      </RequireAuth>
    ),
  },
]);
