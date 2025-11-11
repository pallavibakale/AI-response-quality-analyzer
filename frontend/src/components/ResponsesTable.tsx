"use client";
import { useQuery } from "@tanstack/react-query";
import { fetchExperiment, downloadExport } from "../lib/api";
import type { ExperimentData, ResponseRecord } from "../lib/types";

function ResponseText({ text }: { text: string }) {
  const cleaned = text.replace(/^sdk_http_response=.*$/gis, "").trim(); // guard if old data exists
  if (!cleaned) return <span className="muted">(no text returned)</span>;
  const short = cleaned.slice(0, 400);
  const truncated = cleaned.length > 400;
  if (!truncated)
    return <div style={{ whiteSpace: "pre-wrap" }}>{cleaned}</div>;
  return (
    <details>
      <summary style={{ cursor: "pointer", userSelect: "none" }}>
        <span style={{ whiteSpace: "pre-wrap" }}>{short}…</span>
        <em className="muted"> (show more)</em>
      </summary>
      <div style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{cleaned}</div>
    </details>
  );
}

function ParamSet({ data }: { data: any }) {
  if (data == null) return <span className="muted">(no parameters)</span>;

  const renderValue = (v: any, level = 0) => {
    if (v == null) return <span className="muted">null</span>;
    if (typeof v === "string") return <span>{v}</span>;
    if (typeof v === "number" || typeof v === "boolean")
      return <span>{String(v)}</span>;
    if (Array.isArray(v)) {
      if (v.length === 0) return <span>[]</span>;
      return (
        <div>
          <details className="param-details">
            <summary className="param-summary">Array[{v.length}]</summary>
            <div className="param-nested">
              {v.map((item, i) => (
                <div key={i} className="param-row">
                  <strong className="param-key index">{i}.</strong>
                  <span className="param-value">
                    {renderValue(item, level + 1)}
                  </span>
                </div>
              ))}
            </div>
          </details>
        </div>
      );
    }
    // object
    const entries = Object.entries(v as Record<string, any>);
    if (entries.length === 0) return <span>{{}.toString()}</span>;
    return (
      <div>
        <details className="param-details">
          <summary className="param-summary">Object</summary>
          <div className="param-nested">
            {entries.map(([k, val]) => (
              <div key={k} className="param-row">
                <strong className="param-key">{k}:</strong>
                <span className="param-value">
                  {typeof val === "object" && val !== null
                    ? renderValue(val, level + 1)
                    : String(val)}
                </span>
              </div>
            ))}
          </div>
        </details>
      </div>
    );
  };

  // If the top-level data is a simple object, render its key/value list directly
  if (typeof data === "object" && !Array.isArray(data)) {
    const entries = Object.entries(data as Record<string, any>);
    if (entries.length === 0)
      return <span className="muted">(no parameters)</span>;
    return (
      <div>
        {entries.map(([k, v]) => (
          <div key={k} className="param-row">
            <strong className="param-key">{k}:</strong>
            <span className="param-value">
              {typeof v === "object" && v !== null ? renderValue(v) : String(v)}
            </span>
          </div>
        ))}
      </div>
    );
  }

  // fallback (primitive)
  return <span>{String(data)}</span>;
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
              <th>Aggregate</th>
              <th>Lexical</th>
              <th>Repetition</th>
              <th>Readability</th>
              <th>Clarity</th>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
