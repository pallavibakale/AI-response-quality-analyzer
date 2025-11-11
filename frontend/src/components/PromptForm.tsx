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
}: {
  value: [number, number];
  onChange: (v: [number, number]) => void;
}) {
  const [a, b] = value;
  const min = 0;
  const max = 1;
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
    if (!el) return 0;
    const { left: L, width } = el.getBoundingClientRect();
    const rel = (clientX - L) / width;
    const v = Math.min(Math.max(rel * (max - min) + min, min), max);
    // snap to step
    return Math.round(v / step) * step;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const clientX = e.clientX;
    // pick nearest thumb
    const el = wrapRef.current;
    if (!el) return;
    const { left: L, width } = el.getBoundingClientRect();
    const rel = (clientX - L) / width;
    const candidate = Math.min(Math.max(rel, 0), 1);
    const dLeft = Math.abs(candidate - left);
    const dRight = Math.abs(candidate - right);
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
  });

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

      <div className="h2 space">
        Temperature Range
        <span className="hint" title="Randomness of the model's output">
          i
        </span>
      </div>
      <DualRange value={tempRange} onChange={setTempRange} />

      <div className="h2 space">
        Top P Range{" "}
        <span className="hint" title="Randomness of text generated">
          i
        </span>
      </div>
      <DualRange value={toppRange} onChange={setToppRange} />

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
          Number of different parameter combinations to test
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
