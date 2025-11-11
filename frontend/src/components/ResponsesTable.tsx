"use client";
import { useQuery } from "@tanstack/react-query";
import { fetchExperiment, downloadExport } from "../lib/api";
import type { ExperimentData, ResponseRecord } from "../lib/types";
import React from "react";

function ResponseText({ text }: { text: string }) {
  const cleaned = text.replace(/^sdk_http_response=[\s\S]*$/gi, "").trim(); // guard if old data exists
  if (!cleaned) return <span className="muted">(no text returned)</span>;
  const short = cleaned.slice(0, 400);
  const truncated = cleaned.length > 400;

  // track details open state so summary can show full sentence when expanded
  const [open, setOpen] = React.useState(false);

  if (!truncated)
    return <div style={{ whiteSpace: "pre-wrap" }}>{cleaned}</div>;
  return (
    <details onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary style={{ cursor: "pointer", userSelect: "none" }}>
        <span style={{ whiteSpace: "pre-wrap" }}>
          {open ? cleaned : short}
          {!open && <span className="trunc-ellipsis">…</span>}
        </span>
      </summary>
      <div style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{cleaned}</div>
    </details>
  );
}

function ParamSet({ data }: { data: any }) {
  // Only show temperature and top_p values (ignore other keys)
  if (data == null || typeof data !== "object") {
    return <span className="muted">(no parameters)</span>;
  }

  const allowed = ["temperature", "top_p"];
  const present = allowed.filter((k) =>
    Object.prototype.hasOwnProperty.call(data, k)
  );
  if (present.length === 0)
    return <span className="muted">(no parameters)</span>;

  return (
    <div>
      {present.map((k) => (
        <div key={k} className="param-row">
          <strong className="param-key">{k}:</strong>
          <span className="param-value">
            {String((data as Record<string, any>)[k])}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function ResponsesTable({
  experimentId,
}: {
  experimentId: string;
}) {
  function formatMetric(n: number | undefined | null) {
    if (n === null || n === undefined) return <span className="muted">—</span>;
    if (typeof n === "number")
      return <span className="metric-badge">{n.toFixed(3)}</span>;
    return <span className="muted">—</span>;
  }
  const { data, isLoading } = useQuery<ExperimentData>({
    queryKey: ["experiment", experimentId],
    queryFn: () => fetchExperiment(experimentId),
    enabled: !!experimentId,
  });
  if (isLoading) return <div className="muted">Loading…</div>;
  if (!data) return null;

  const rows: ResponseRecord[] = data.responses ?? [];
  const exp = data.experiment;

  // If there are no responses, show an explicit message (quota-exhausted UX)
  if (rows.length === 0) {
    return (
      <>
        <div className="h2">Responses</div>
        <div className="muted">
          Experiment name: {exp?.title ? `${exp.title} • ` : ""}Model:{" "}
          <b>{exp?.model}</b>
        </div>
        <div style={{ marginTop: 20, padding: 20 }}>
          <div className="muted">
            Sorry — your quota appears to be exhausted.
          </div>
          <div className="muted" style={{ marginTop: 8 }}>
            No responses were produced for this experiment.
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="h2">Responses</div>
      <div className="muted">
        Experiment name: {exp?.title ? `${exp.title} • ` : ""}Model:{" "}
        <b>{exp?.model}</b>
      </div>
      <div className="row" style={{ display: "flex", gap: 8 }}>
        <button
          className="btn"
          onClick={() => downloadExport(experimentId, "json")}
        >
          Export JSON
        </button>
        <button
          className="btn"
          onClick={() => downloadExport(experimentId, "csv")}
        >
          Export CSV
        </button>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 240 }}>Parameter set</th>
              <th>Text</th>
              <th title="Weighted composite of the metrics giving a single overall quality score.">
                Aggregate
              </th>
              <th title="Unique-word ratio — higher means more varied vocabulary.">
                Lexical
              </th>
              <th title="Fraction of repeated n‑grams — lower is better (less repetition).">
                Repetition
              </th>
              <th title="Normalized Flesch Reading Ease — higher values indicate easier reading.">
                Readability
              </th>
              <th title="Sentence-length balance (ideal ~12–24 words) — measures clarity.">
                Clarity
              </th>
              <th title="Signals like paragraphs, lists, or labeled sections that indicate clear structure.">
                Structure
              </th>
              <th title="Proportion of important prompt words that appear in the response.">
                Keyword coverage
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.response_id}>
                <td>
                  <div className="param">
                    <ParamSet data={r.param_set} />
                  </div>
                </td>
                <td>
                  <ResponseText text={r.text} />
                </td>
                <td>{formatMetric(r.metrics.aggregate_score)}</td>
                <td>{formatMetric(r.metrics.lexical_diversity)}</td>
                <td>{formatMetric(r.metrics.repetition)}</td>
                <td>{formatMetric(r.metrics.readability)}</td>
                <td>{formatMetric(r.metrics.clarity_score)}</td>
                <td>{formatMetric(r.metrics.structure)}</td>
                <td>{formatMetric(r.metrics.keyword_coverage)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
