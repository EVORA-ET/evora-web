import { useParam } from "../intelligence/hooks";
import { Segmented } from "../intelligence/ui";
import EventLogPage from "./EventLogPage";
import SchedulePage from "./SchedulePage";

type Tab = "log" | "rules";

/** Service & fault records and the maintenance rules behind due dates, in one place. */
function RecordsPage() {
  const [tabParam, setTab] = useParam("tab");
  const tab: Tab = tabParam === "rules" ? "rules" : "log";
  return (
    <div className="intel-stack">
      <div className="intel-row intel-row--between">
        <Segmented<Tab> label="Records or rules" value={tab} onChange={(v) => setTab(v)}
          options={[{ value: "log", label: "Service & fault records" }, { value: "rules", label: "Maintenance requirements" }]} />
        <p className="ops-muted" style={{ margin: 0, maxWidth: 520 }}>
          Maintenance status is calculated from configured requirements and recorded service history. Vehicles
          without a baseline stay unevaluated rather than guessed.
        </p>
      </div>
      {tab === "log" ? <EventLogPage /> : <SchedulePage />}
    </div>
  );
}

export default RecordsPage;
