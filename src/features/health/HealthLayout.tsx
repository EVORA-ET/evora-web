import IntelFrame from "../intelligence/IntelFrame";

const TABS = [
  { to: "/health", label: "Fleet Health", end: true },
  { to: "/health/vehicles", label: "Vehicles" },
  { to: "/health/records", label: "Maintenance Records & Rules" },
];

function HealthLayout() {
  return (
    <IntelFrame
      title="Fleet Health & Maintenance"
      description="Keep your fleet reliable, plan service work, and understand which vehicles need attention."
      tabs={TABS}
      navLabel="Fleet health and maintenance"
    />
  );
}

export default HealthLayout;
