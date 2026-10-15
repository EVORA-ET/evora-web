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
import AppShell from "../components/layout/AppShell";
import {
  EvMigrationPage,
  HealthMaintenancePage,
  ManageFleetsPage,
  ReportsPage,
  SettingsPage,
} from "../features/modules/modulePages";

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
    /* Everything inside the app shell shares the sidebar, top bar and live data. */
    element: (
      <RequireAuth showSignOut={false}>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { path: "/dashboard", element: <DashboardPage /> },
      { path: "/fleets", element: <ManageFleetsPage /> },
      { path: "/ev-migration", element: <EvMigrationPage /> },
      { path: "/health", element: <HealthMaintenancePage /> },
      { path: "/reports", element: <ReportsPage /> },
      { path: "/settings", element: <SettingsPage /> },
    ],
  },
]);
