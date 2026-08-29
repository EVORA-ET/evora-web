import { createBrowserRouter } from "react-router-dom";

import LandingPage from "../features/landing/LandingPage";
import LoginPage from "../features/authentication/LoginPage";
import RegisterPage from "../features/authentication/RegisterPage";

import OrganizationSetupPage from "../features/organization/OrganizationSetupPage";
import CreateOrganizationPage from "../features/organization/CreateOrganizationPage";
import LinkOrganizationPage from "../features/organization/LinkOrganizationPage";

import InfrastructureOnboardingPage from "../features/onboarding/InfrastructureOnboardingPage";
import FleetOnboardingPage from "../features/onboarding/FleetOnboardingPage";

import DashboardPage from "../features/dashboard/DashboardPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <LandingPage />,
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
    element: <OrganizationSetupPage />,
  },
  {
    path: "/organization/create",
    element: <CreateOrganizationPage />,
  },
  {
    path: "/organization/link",
    element: <LinkOrganizationPage />,
  },
  {
    path: "/onboarding/infrastructure",
    element: <InfrastructureOnboardingPage />,
  },
  {
    path: "/onboarding/fleet",
    element: <FleetOnboardingPage />,
  },
  {
    path: "/dashboard",
    element: <DashboardPage />,
  },
]);