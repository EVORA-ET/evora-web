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
import OperationsLayout from "../features/operations/OperationsLayout";
import OverviewPage from "../features/operations/OverviewPage";
import DepotsPage from "../features/operations/DepotsPage";
import FleetsPage from "../features/operations/FleetsPage";
import VehiclesPage from "../features/operations/VehiclesPage";
import DriversPage from "../features/operations/DriversPage";
import RoutesPage from "../features/operations/RoutesPage";
import JobsPage from "../features/operations/JobsPage";
import AssignmentsPage from "../features/operations/AssignmentsPage";
import AppShell from "../components/layout/AppShell";
import EvMigrationLayout from "../features/ev-migration/EvMigrationLayout";
import MigrationOverviewPage from "../features/ev-migration/MigrationOverviewPage";
import DiscoverPage from "../features/ev-migration/DiscoverPage";
import TransitionPlanPage from "../features/ev-migration/TransitionPlanPage";
import EvidencePage from "../features/ev-migration/EvidencePage";
import LegacyRedirect from "../features/intelligence/LegacyRedirect";
import HealthLayout from "../features/health/HealthLayout";
import FleetHealthPage from "../features/health/FleetHealthPage";
import VehicleHealthPage from "../features/health/VehicleHealthPage";
import RecordsPage from "../features/health/RecordsPage";
import CarbonPage from "../features/carbon/CarbonPage";
import SettingsPage from "../features/settings/SettingsPage";

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
      {
        path: "/fleets",
        element: <OperationsLayout />,
        children: [
          { index: true, element: <OverviewPage /> },
          { path: "depots", element: <DepotsPage /> },
          { path: "fleets", element: <FleetsPage /> },
          { path: "vehicles", element: <VehiclesPage /> },
          { path: "drivers", element: <DriversPage /> },
          { path: "routes", element: <RoutesPage /> },
          { path: "jobs", element: <JobsPage /> },
          { path: "assignments", element: <AssignmentsPage /> },
        ],
      },
      {
        path: "/ev-migration",
        element: <EvMigrationLayout />,
        children: [
          { index: true, element: <MigrationOverviewPage /> },
          { path: "discover", element: <DiscoverPage /> },
          { path: "plan", element: <TransitionPlanPage /> },
          { path: "data", element: <EvidencePage /> },
          /* Earlier six-tab layout: keep old links working. */
          { path: "readiness", element: <LegacyRedirect to="/ev-migration/discover" /> },
          { path: "recommendations", element: <LegacyRedirect to="/ev-migration/discover" /> },
          { path: "planner", element: <LegacyRedirect to="/ev-migration/plan" /> },
          { path: "tracking", element: <LegacyRedirect to="/ev-migration/plan" /> },
          { path: "evidence", element: <LegacyRedirect to="/ev-migration/data" /> },
        ],
      },
      {
        path: "/health",
        element: <HealthLayout />,
        children: [
          { index: true, element: <FleetHealthPage /> },
          { path: "vehicles", element: <VehicleHealthPage /> },
          { path: "records", element: <RecordsPage /> },
          { path: "schedule", element: <LegacyRedirect to="/health/records?tab=rules" /> },
          { path: "log", element: <LegacyRedirect to="/health/records?tab=log" /> },
        ],
      },
      { path: "/reports", element: <CarbonPage /> },
      { path: "/settings", element: <SettingsPage /> },
    ],
  },
]);
