"use client";
import React, { useState, ChangeEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createExperiment } from "../lib/api";
import type {
  CreateExperimentPayload,
  CreateExperimentResponse,
  ParamSet,
  Provider,
} from "../lib/types";

const PRESETS: Record<
  "Creative" | "Balanced" | "Precise",
  { temp: [number, number]; topp: [number, number] }
> = {
  Creative: { temp: [0.7, 1.0], topp: [0.9, 1.0] },
  Balanced: { temp: [0.4, 0.8], topp: [0.6, 1.0] },
  Precise: { temp: [0.1, 0.7], topp: [0.4, 0.9] },
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function sweep(min: number, max: number, steps = 3): number[] {
  if (steps <= 1) return [min];
  const out: number[] = [];
  const step = (max - min) / (steps - 1);
  for (let i = 0; i < steps; i++)
    out.push(parseFloat((min + i * step).toFixed(2)));
  return out;
}

function DualRange({
  value,
  onChange,
  min = 0,
  max = 1,
}: {
  value: [number, number];
  onChange: (v: [number, number]) => void;
  min?: number;
  max?: number;
}) {
  const [a, b] = value;
  const step = 0.01;
  const left = Math.min(a, b);
  const right = Math.max(a, b);
  const pctL = ((left - min) / (max - min)) * 100;
  const pctR = ((right - min) / (max - min)) * 100;

  // refs & state for wrapper-based pointer routing
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const activeRef = React.useRef<"left" | "right" | null>(null);
  const [active, setActive] = React.useState<"left" | "right" | null>(null);
  const [srText, setSrText] = React.useState<string>(
    `Minimum ${left.toFixed(2)}, Maximum ${right.toFixed(2)}`
  );

  const toValue = (clientX: number) => {
    const el = wrapRef.current;
    if (!el) return min;
    const { left: L, width } = el.getBoundingClientRect();
    const rel = (clientX - L) / width;
    const v = Math.min(Math.max(rel * (max - min) + min, min), max);
    // snap to step
    return Math.round(v / step) * step;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const clientX = e.clientX;
    // pick nearest thumb (use actual value scale, not normalized 0..1)
    const el = wrapRef.current;
    if (!el) return;
    const { left: L, width } = el.getBoundingClientRect();
    const rel = (clientX - L) / width;
    const candidateValue = Math.min(
      Math.max(rel * (max - min) + min, min),
      max
    );
    const dLeft = Math.abs(candidateValue - left);
    const dRight = Math.abs(candidateValue - right);
    activeRef.current = dLeft <= dRight ? "left" : "right";
    setActive(activeRef.current);
    // capture pointer so we continue getting move/up
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    // update immediately
    const v = toValue(clientX);
    if (activeRef.current === "left") {
      const newLeft = Math.min(v, right);
      onChange([newLeft, right]);
    } else {
      const newRight = Math.max(v, left);
      onChange([left, newRight]);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activeRef.current) return;
    const v = toValue(e.clientX);
    if (activeRef.current === "left") {
      const newLeft = Math.min(v, right);
      onChange([newLeft, right]);
    } else {
      const newRight = Math.max(v, left);
      onChange([left, newRight]);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    } catch (_) {
      // ignore
    }
    activeRef.current = null;
    setActive(null);
  };

  React.useEffect(() => {
    setSrText(`Minimum ${left.toFixed(2)}, Maximum ${right.toFixed(2)}`);
  }, [left, right]);

  return (
    <div className="dual">
      <div className="dual-row">
        <span className="muted">Minimum</span>
        <span className="muted">Maximum</span>
      </div>
      <div
        className="dual-wrap"
        ref={wrapRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Keep inputs for form/value semantics but make them non-interactive; wrapper handles events */}
        <input
          aria-label="minimum"
          type="range"
          min={min}
          max={max}
          step={step}
          value={left}
          readOnly
        />
        <input
          aria-label="maximum"
          type="range"
          min={min}
          max={max}
          step={step}
          value={right}
          readOnly
        />
        <div className="track" />
        <div
          className="range"
          style={{ left: `${pctL}%`, width: `${pctR - pctL}%` }}
        />
        <div
          role="slider"
          tabIndex={0}
          aria-label="Minimum"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={left}
          aria-valuetext={left.toFixed(2)}
          className={`thumb ${active === "left" ? "active" : ""}`}
          style={{ left: `${pctL}%` }}
        />
        <div
          role="slider"
          tabIndex={0}
          aria-label="Maximum"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={right}
          aria-valuetext={right.toFixed(2)}
          className={`thumb ${active === "right" ? "active" : ""}`}
          style={{ left: `${pctR}%` }}
        />
      </div>
      {/* live region for screen readers to announce changes */}
      <div aria-live="polite" className="sr-only">
        {srText}
      </div>
      <div className="dual-row small">
        <span>{left.toFixed(2)}</span>
        <span>{right.toFixed(2)}</span>
      </div>
    </div>
  );
}

export default function PromptForm({
  onCreated,
}: {
  onCreated: (id: string) => void;
}) {
  const [title, setTitle] = useState<string>("LLM Title");
  const [prompt, setPrompt] = useState<string>("");
  const [chars, setChars] = useState<number>(0);
  const limit = 2000;

  const [provider, setProvider] = useState<Provider>("gemini");
  const defaultModelFor = (prov: Provider): string => {
    switch (prov) {
      case "gemini":
        return "gemini-2.5-flash";
      case "openai":
        return "gpt-4o-mini";
      case "groq":
        return "llama-3.1-8b-instant";
      case "mock":
        return "mock";
      default:
        return "";
    }
  };

  const [model, setModel] = useState<string>(defaultModelFor(provider));

  const [tempRange, setTempRange] = useState<[number, number]>([0.7, 1.0]);
  const [toppRange, setToppRange] = useState<[number, number]>([0.7, 1.0]);
  const [steps, setSteps] = useState<number>(3);
  const [alertData, setAlertData] = useState<{
    title: string;
    message: string;
  } | null>(null);

  const qc = useQueryClient();
  const mutation = useMutation<
    CreateExperimentResponse,
    Error,
    CreateExperimentPayload
  >({
    mutationFn: (payload: CreateExperimentPayload) => createExperiment(payload),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["experiments"] });
      onCreated(res.experiment_id);
    },
    onError: (error: any) => {
      console.error("Experiment creation failed:", error);
      // Try to extract a structured body (support various shapes)
      let body: any = error?.body ?? null;
      if (!body && typeof error?.message === "string") {
        try {
          body = JSON.parse(error.message);
        } catch {
          body = null;
        }
      }

      const detail = (body && (body.detail ?? body)) ?? null;

      // Extract user-facing message (many possible shapes)
      let reasonText = "";
      if (detail && typeof detail === "string") reasonText = detail;
      else if (detail?.reason && typeof detail.reason === "string")
        reasonText = detail.reason;
      else if (detail?.message && typeof detail.message === "string")
        reasonText = detail.message;
      else if (body?.error?.message && typeof body.error.message === "string")
        reasonText = body.error.message;
      else if (error?.message && typeof error.message === "string")
        reasonText = error.message;
      else
        reasonText = "An unknown error occurred while creating the experiment.";

      // Normalize and detect quota problems
      const norm = reasonText.toLowerCase();
      const isQuota =
        norm.includes("quota") ||
        norm.includes("quota_exceeded") ||
        norm.includes("insufficient_quota") ||
        norm.includes("429");

      // Try to extract the OpenAI human message if embedded (fallback to full reasonText)
      let userMsg = reasonText;
      try {
        // common pattern: "...{'error': {'message': 'You exceeded your current quota, ...'}}"
        const m = reasonText.match(/You exceeded[^\.\}']+(?:\.[^']*)?/i);
        if (m) userMsg = m[0].trim();
      } catch {
        /* ignore */
      }

      if (isQuota) {
        // surface modal with friendly message
        setAlertData({
          title: "Quota exceeded",
          message:
            userMsg ||
            "You exceeded your current quota, please check your plan and billing details.",
        });
        // if backend included experiment id, set it so ResponsesTable renders
        const expId =
          detail?.experiment_id ??
          body?.experiment_id ??
          body?.experimentId ??
          null;
        if (expId) onCreated(expId);
        return;
      }

      // fallback simple alert for other errors
      setAlertData({
        title: "Error",
        message: userMsg,
      });
    },
  });
  // Simple dismiss handler for the modal
  const closeAlert = () => setAlertData(null);

  function buildParamSets(): ParamSet[] {
    const temps = sweep(tempRange[0], tempRange[1], steps);
    const topps = sweep(toppRange[0], toppRange[1], steps);
    const out: ParamSet[] = [];
    for (const t of temps) {
      for (const p of topps) {
        // inside buildParamSets():
        out.push({
          temperature: clamp(t, 0, 2),
          top_p: clamp(p, 0, 1),
          max_tokens: 256,
        });
      }
    }
    return out;
  }

  const applyPreset = (name: keyof typeof PRESETS): void => {
    const p = PRESETS[name];
    setTempRange(p.temp);
    setToppRange(p.topp);
  };

  const onProviderChange = (e: ChangeEvent<HTMLSelectElement>): void => {
    const p = e.target.value as Provider;
    setProvider(p);
    // set the model to the provider-specific default whenever provider changes
    setModel(defaultModelFor(p));
  };

  return (
    <div>
      {alertData && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.4)",
            zIndex: 2000,
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            style={{
              background: "var(--bg, #fff)",
              borderRadius: 8,
              padding: 20,
              maxWidth: 700,
              width: "90%",
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 style={{ margin: 0 }}>{alertData.title}</h3>
              <button
                onClick={closeAlert}
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: 18,
                  cursor: "pointer",
                }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>
              {alertData.message}
            </div>
            <div
              style={{
                marginTop: 20,
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
              }}
            >
              <button
                className="btn"
                onClick={() => {
                  closeAlert();
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="head">
        <div className="h2">Experiment title*</div>
        <div className="section-head">
          <input
            className="input"
            placeholder="Enter a title for your experiment"
            value={title}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setTitle(e.target.value)
            }
            style={{ marginRight: 8, maxWidth: 280 }}
            required={true}
          />
          <div className="count">
            {chars} / {limit}
          </div>
        </div>
      </div>
      <div className="h2">Enter a Prompt*</div>
      <div className="muted">
        Enter a detailed prompt to generate multiple responses with different
        parameter configurations.
      </div>

      <textarea
        className="input area"
        rows={5}
        placeholder="Example: Explain the concept of neural networks to a beginner with no technical background."
        value={prompt}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
          const v = e.target.value.slice(0, limit);
          setPrompt(v);
          setChars(v.length);
        }}
        required={true}
      />

      <div className="h2">Parameter Presets</div>
      <div className="chip-row">
        <button className="chip" onClick={() => applyPreset("Creative")}>
          Creative
        </button>
        <button className="chip" onClick={() => applyPreset("Balanced")}>
          Balanced
        </button>
        <button className="chip" onClick={() => applyPreset("Precise")}>
          Precise
        </button>
      </div>
      <div className="muted">
        Quick presets to experiment with different creativity levels
      </div>

      {/* Ranges: show temperature and top-p side-by-side */}
      <div className="ranges-row">
        <div className="range-col">
          <div className="h2 space">
            Temperature Range
            <span className="hint" title="Randomness of the model's output">
              i
            </span>
          </div>
          <DualRange
            value={tempRange}
            onChange={setTempRange}
            min={0}
            max={2}
          />
        </div>
        <div className="range-col">
          <div className="h2 space">
            Top P Range{" "}
            <span className="hint" title="Randomness of text generated">
              i
            </span>
          </div>
          <DualRange value={toppRange} onChange={setToppRange} />
        </div>
      </div>

      <div className="grid-2">
        <div>
          <label>Provider</label>
          <select
            className="input"
            value={provider}
            onChange={onProviderChange}
          >
            <option value="gemini">Gemini</option>
            <option value="openai">OpenAI</option>
            <option value="groq">Groq</option>
            <option value="mock">Mock</option>
          </select>
        </div>
        <div>
          <label>Model (selected by provider)</label>
          <select
            className="input"
            value={model}
            onChange={(e: ChangeEvent<HTMLSelectElement>) =>
              setModel(e.target.value)
            }
          >
            {/* Only show the provider-specific model as an option */}
            <option value={defaultModelFor(provider)}>
              {defaultModelFor(provider)}
            </option>
          </select>
        </div>
      </div>

      <div className="row">
        <label>Combinations to Generate</label>
        <div
          role="group"
          aria-label="Combinations to generate"
          className="button-row"
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={`chip ${steps === n ? "active" : ""}`}
              onClick={() => setSteps(n)}
              aria-pressed={steps === n}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="muted">
          <p>
            How many discrete values to sample from each numeric range — this
            determines how many parameter combinations the experiment will
            generate.
          </p>
          <p>
            <strong>Total responses:</strong> (Temperature steps) × (Top P
            steps)
          </p>

          <div className="example-block" aria-hidden="true">
            <div className="example-title">Example</div>
            <div>
              If steps = 3 and temperature range = [0.7, 1.0] and Top P range =
              [0.7, 1.0] <br />
              then Temperature = [0.70, 0.85, 1.00]
              <br /> Top P = [0.70, 0.85, 1.00] <br />
              There will be 3 * 3 = 9 parameter combinations.
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <button
          className="btn primary"
          disabled={
            mutation.status === "pending" || !prompt.trim() || !title.trim()
          }
          onClick={() =>
            mutation.mutate({
              title: title ? title : "LLM Title",
              prompt,
              provider,
              model: model || undefined,
              param_sets: buildParamSets(),
            })
          }
        >
          {mutation.status === "pending"
            ? "Generating…"
            : "Generate Responses →"}
        </button>
      </div>
    </div>
  );
}
