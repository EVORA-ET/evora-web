import type { AssessmentSummary, EvCandidate } from "../../lib/intelligenceApi";

/** Latest assessment per vehicle + EV candidate pair (newest first). */
export function latestPerPair(rows: AssessmentSummary[]): AssessmentSummary[] {
  const latest = new Map<string, AssessmentSummary>();
  for (const row of rows) {
    const key = `${row.vehicle_id ?? "?"}|${row.ev_candidate_id ?? "?"}`;
    const seen = latest.get(key);
    if (!seen || row.created_at > seen.created_at) latest.set(key, row);
  }
  return [...latest.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Latest assessment of one kind for one candidate, or undefined. */
export function latestFor(
  rows: AssessmentSummary[] | undefined,
  kind: AssessmentSummary["kind"],
  candidateId: string,
): AssessmentSummary | undefined {
  let best: AssessmentSummary | undefined;
  for (const row of rows ?? []) {
    if (row.kind !== kind || row.ev_candidate_id !== candidateId) continue;
    if (!best || row.created_at > best.created_at) best = row;
  }
  return best;
}

export function candidateOptions(candidates: EvCandidate[] | undefined) {
  return (candidates ?? []).map((c) => ({
    value: c.id,
    label: `${c.label} · ${c.catalogue_model_id ? `catalogue figures of ${c.created_at.slice(0, 10)}` : "entered by your organization"}`,
  }));
}

/** EV candidates grouped by the catalogue model they were copied from. */
export function candidatesByModel(candidates: EvCandidate[] | undefined): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const c of candidates ?? []) {
    if (!c.catalogue_model_id) continue;
    const set = map.get(c.catalogue_model_id) ?? new Set<string>();
    set.add(c.id);
    map.set(c.catalogue_model_id, set);
  }
  return map;
}

/** Latest assessment of one kind for any of the given candidates. */
export function latestForAny(
  rows: AssessmentSummary[] | undefined,
  kind: AssessmentSummary["kind"],
  candidateIds: Set<string> | undefined,
): AssessmentSummary | undefined {
  let best: AssessmentSummary | undefined;
  if (!candidateIds) return undefined;
  for (const row of rows ?? []) {
    if (row.kind !== kind || !row.ev_candidate_id || !candidateIds.has(row.ev_candidate_id)) continue;
    if (!best || row.created_at > best.created_at) best = row;
  }
  return best;
}
