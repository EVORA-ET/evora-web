import { PIN_PATH } from "./mapPins";

/** Small inline pin used in the map legend. */
function LegendPin({ variant }: { variant: "ev" | "ice" | "depot" | "attention" }) {
  return (
    <svg className={`legend-pin legend-pin--${variant}`} viewBox="0 0 40 52" width="14" height="18" aria-hidden="true">
      <path className="legend-pin__body" d={PIN_PATH} />
      <circle className="legend-pin__hole" cx="20" cy="19.5" r="9" />
    </svg>
  );
}

export default LegendPin;
