export type Provider = "gemini" | "openai" | "groq" | "mock";

export interface ExperimentSummary {
  id: string;
  title?: string;
  prompt?: string;
  model?: string;
}

export interface Metrics {
  lexical_diversity: number;
  repetition: number;
  length_ok: number;
  structure: number;
  keyword_coverage: number;
  readability: number;
  clarity_score: number;
  aggregate_score: number;
}

export interface ResponseRecord {
  response_id: string;
  param_set: Record<string, unknown>;
  text: string;
  metrics: Metrics;
}

export interface ExperimentData {
  experiment: ExperimentSummary;
  responses: ResponseRecord[];
}

export interface ExperimentsListResponse {
  experiments: ExperimentSummary[];
}

export interface ParamSet {
  temperature: number;
  top_p: number;
  max_tokens: number;
  // n: number;
  prompt_override?: string;
}

export interface CreateExperimentPayload {
  title: string;
  prompt: string;
  provider: Provider;
  model?: string;
  param_sets: ParamSet[];
}

export interface CreateExperimentResponse {
  experiment_id: string;
  num_responses: number;
}
