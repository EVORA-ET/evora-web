import { pluralize, formatNumber } from "../../../lib/format";
import { INSURANCE_WARNING_DAYS, vehicleIssues } from "../model/fleetModel";
import { useDashboardData } from "../useDashboardData";

export interface Insight {
  id: string;
  text: string;
  to?: string;
  cta?: string;
}

export function useInsights(): Insight[] {
  const { snapshot, stats } = useDashboardData();
  const insights: Insight[] = [];

  if (stats.total === 0) {
    return [
      {
        id: "start",
        text: "Add your vehicles and depots, and EVORA will start surfacing what matters here.",
        to: "/fleets",
        cta: "Add your fleet",
      },
    ];
  }

  const now = new Date();
  const lapsed = snapshot.vehicles.filter((vehicle) =>
    vehicleIssues(vehicle, now).some((issue) => issue.kind === "insurance_expired"),
  ).length;
  const soon = snapshot.vehicles.filter((vehicle) =>
    vehicleIssues(vehicle, now).some((issue) => issue.kind === "insurance_soon"),
  ).length;

  if (lapsed > 0) {
    insights.push({
      id: "insurance-lapsed",
      text: `${pluralize(lapsed, "vehicle")} ${lapsed === 1 ? "has" : "have"} lapsed insurance and shouldn't be dispatched until it's renewed.`,
      to: "/fleets",
      cta: "Review vehicles",
    });
  }

  if (soon > 0) {
    insights.push({
      id: "insurance-soon",
      text: `${pluralize(soon, "policy", "policies")} expire within ${INSURANCE_WARNING_DAYS} days.`,
      to: "/fleets",
      cta: "See renewals",
    });
  }

  if (stats.delayedStops > 0) {
    insights.push({
      id: "delays",
      text: `${pluralize(stats.delayedStops, "stop")} on live trips ${stats.delayedStops === 1 ? "is" : "are"} running 15+ minutes late.`,
    });
  }

  if (stats.evShare !== null) {
    insights.push({
      id: "ev-share",
      text:
        stats.ev === 0
          ? `All ${formatNumber(stats.total)} vehicles run on combustion engines today.`
          : `${formatNumber(stats.ev)} of ${formatNumber(stats.total)} vehicles (${Math.round(stats.evShare)}%) are already electric.`,
      to: "/ev-migration",
      cta: "Explore EV migration",
    });
  }

  if (stats.withoutLocation > 0) {
    insights.push({
      id: "locations",
      text: `${pluralize(stats.withoutLocation, "vehicle")} ${stats.withoutLocation === 1 ? "isn't" : "aren't"} reporting a location, so ${stats.withoutLocation === 1 ? "it's" : "they're"} missing from the map.`,
    });
  }

  if (stats.weekAvgUtilisation !== null && stats.week.some((day) => day.trips > 0)) {
    insights.push({
      id: "utilisation",
      text: `On average ${Math.round(stats.weekAvgUtilisation)}% of your operational vehicles ran a trip each day this week.`,
    });
  }

  return insights;
}

