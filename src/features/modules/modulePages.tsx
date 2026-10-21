import { Truck } from "lucide-react";

import ModulePage from "./ModulePage";

export function ManageFleetsPage() {
  return (
    <ModulePage
      icon={Truck}
      title="Manage Fleets"
      description="Add, import and update your vehicles, drivers, depots and routes. This page is next on the build list."
    />
  );
}
