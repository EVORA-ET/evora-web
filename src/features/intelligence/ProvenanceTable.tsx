import { Fragment, useState } from "react";
import { ChevronRight } from "lucide-react";

import type { ResolvedInput } from "../../lib/intelligenceApi";
import { formatDay, formatStamp, formatValue } from "./format";
import { inputLabel } from "./labels";
import { EvidencePill } from "./ui";

/**
 * Every input behind an assessment, exactly as frozen in its snapshot:
 * value + unit, origin and evidence class, source and its verification,
 * dates, staleness and the transformation used.
 */
function ProvenanceTable({
  inputs,
  caption,
}: {
  inputs: ResolvedInput[];
  caption: string;
}) {
  const [open, setOpen] = useState<string | null>(null);

  if (inputs.length === 0) {
    return <p className="ops-muted">No evidence inputs were recorded for this result.</p>;
  }

  const ordered = [...inputs].sort(
    (a, b) => Number(b.critical) - Number(a.critical) || a.name.localeCompare(b.name),
  );

  return (
    <div className="ops-table-scroll">
      <table className="ops-table">
        <caption className="ops-sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Input</th>
            <th scope="col">Value</th>
            <th scope="col">Evidence</th>
            <th scope="col">Source</th>
            <th scope="col">Date</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((input) => {
            const expanded = open === input.name;
            const date =
              input.observed_at ?? input.effective?.from ?? input.period?.end ?? null;
            return (
              <Fragment key={input.name}>
                <tr
                  className="ops-row--click"
                  tabIndex={0}
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : input.name)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setOpen(expanded ? null : input.name);
                    }
                  }}
                >
                  <td>
                    <span className="intel-row" style={{ flexWrap: "nowrap" }}>
                      <ChevronRight
                        size={14}
                        aria-hidden="true"
                        style={{ transform: expanded ? "rotate(90deg)" : undefined, flex: "none" }}
                      />
                      <span>
                        {inputLabel(input.name)}
                        {!input.critical && <small className="ops-muted"> · supporting</small>}
                      </span>
                    </span>
                  </td>
                  <td className="ops-num">
                    {input.value === null ? (
                      <span className="ops-muted">Not available</span>
                    ) : (
                      formatValue(input.value, input.unit, 4)
                    )}
                  </td>
                  <td>
                    <EvidencePill cls={input.evidence_class} />
                  </td>
                  <td>
                    {input.source ? (
                      <span>
                        {input.source.title}
                        <small className="ops-muted" style={{ display: "block" }}>
                          {input.source.verification_status === "verified"
                            ? `Verified ${formatDay(input.source.verified_at)}`
                            : input.source.verification_status === "rejected"
                              ? "Rejected"
                              : "Not verified"}
                        </small>
                      </span>
                    ) : (
                      <span className="ops-muted">No cited source</span>
                    )}
                  </td>
                  <td>{date ? formatDay(date) : <span className="ops-muted">—</span>}</td>
                </tr>
                {expanded && (
                  <tr>
                    <td colSpan={5}>
                      <dl className="ops-deflist">
                        <div className="ops-deflist__row">
                          <dt>Origin</dt>
                          <dd>{input.origin ? input.origin.replace(/_/g, " ") : "—"}</dd>
                        </div>
                        {input.stale && (
                          <div className="ops-deflist__row">
                            <dt>Why stale</dt>
                            <dd>{input.stale_reason || "—"}</dd>
                          </div>
                        )}
                        {input.transformation && (
                          <div className="ops-deflist__row">
                            <dt>How derived</dt>
                            <dd>{input.transformation}</dd>
                          </div>
                        )}
                        {input.note && (
                          <div className="ops-deflist__row">
                            <dt>Note</dt>
                            <dd>{input.note}</dd>
                          </div>
                        )}
                        {input.effective && (
                          <div className="ops-deflist__row">
                            <dt>In force</dt>
                            <dd>
                              {formatDay(input.effective.from)} –{" "}
                              {input.effective.to ? formatDay(input.effective.to) : "open"}
                            </dd>
                          </div>
                        )}
                        {input.period && (
                          <div className="ops-deflist__row">
                            <dt>Period</dt>
                            <dd>
                              {formatDay(input.period.start)} – {formatDay(input.period.end)}
                            </dd>
                          </div>
                        )}
                        {Object.keys(input.qualifiers ?? {}).length > 0 && (
                          <div className="ops-deflist__row">
                            <dt>Qualifiers</dt>
                            <dd>
                              {Object.entries(input.qualifiers)
                                .map(([k, v]) => `${k}: ${String(v)}`)
                                .join(" · ")}
                            </dd>
                          </div>
                        )}
                        {input.source && (
                          <div className="ops-deflist__row">
                            <dt>Source detail</dt>
                            <dd>
                              {[input.source.publisher, input.source.identifier, input.source.source_type.replace(/_/g, " ")]
                                .filter(Boolean)
                                .join(" · ")}
                              {input.source.url && (
                                <>
                                  {" · "}
                                  <a href={input.source.url} target="_blank" rel="noreferrer" className="ops-link">
                                    Open
                                  </a>
                                </>
                              )}
                              <small className="ops-muted" style={{ display: "block" }}>
                                Retrieved {formatStamp(input.source.retrieved_at)} via{" "}
                                {input.source.retrieval_method.replace(/_/g, " ")}
                                {input.source.verification_status === "verified" &&
                                  " · verified by a user in your organization (not independent verification)"}
                              </small>
                            </dd>
                          </div>
                        )}
                        {input.observation_id && (
                          <div className="ops-deflist__row">
                            <dt>Observation</dt>
                            <dd className="intel-mono">{input.observation_id}</dd>
                          </div>
                        )}
                        {input.derived_from_ids && input.derived_from_ids.length > 0 && (
                          <div className="ops-deflist__row">
                            <dt>Derived from</dt>
                            <dd>{input.derived_from_ids.length} stored record(s)</dd>
                          </div>
                        )}
                      </dl>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default ProvenanceTable;
