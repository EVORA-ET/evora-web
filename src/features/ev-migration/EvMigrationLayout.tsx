import IntelFrame from "../intelligence/IntelFrame";

const TABS = [
  { to: "/ev-migration", label: "Overview", end: true },
  { to: "/ev-migration/discover", label: "Discover & Compare" },
  { to: "/ev-migration/plan", label: "My Transition Plan" },
];

function EvMigrationLayout() {
  return (
    <IntelFrame
      title="Your Fleet's EV Transition"
      description="Understand your current fleet costs, discover suitable electric vehicles, and build a practical transition plan."
      tabs={TABS}
      navLabel="EV transition"
      secondary={{ to: "/ev-migration/data", label: "Data & sources" }}
    />
  );
}

export default EvMigrationLayout;
