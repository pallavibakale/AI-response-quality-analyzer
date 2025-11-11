import type {
  CreateExperimentPayload,
  CreateExperimentResponse,
  ExperimentData,
  ExperimentSummary,
} from "./types";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"
).replace(/\/+$/, "");

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function createExperiment(
  payload: CreateExperimentPayload
): Promise<CreateExperimentResponse> {
  const res = await fetch(`${API_BASE}/experiments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  console.log("createExperiment response:", res);
  return handle<CreateExperimentResponse>(res);
}

export async function fetchExperiments(): Promise<{
  experiments: ExperimentSummary[];
}> {
  const res = await fetch(`${API_BASE}/experiments`, { cache: "no-store" });
  return handle<{ experiments: ExperimentSummary[] }>(res);
}

export async function fetchExperiment(id: string): Promise<ExperimentData> {
  const res = await fetch(`${API_BASE}/experiments/${id}`, {
    cache: "no-store",
  });
  return handle<ExperimentData>(res);
}

export function exportJsonUrl(id: string): string {
  return `${API_BASE}/experiments/${id}/export/json`;
}
export function exportCsvUrl(id: string): string {
  return `${API_BASE}/experiments/${id}/export/csv`;
}

/** Fetches a file and triggers a download reliably across origins. */
export async function downloadExport(
  id: string,
  kind: "json" | "csv"
): Promise<void> {
  const url = kind === "json" ? exportJsonUrl(id) : exportCsvUrl(id);
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${id}.${kind}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}
