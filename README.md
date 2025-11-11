# AI-response-quality-analyzer

A small app to generate, analyze, compare and export multiple LLM responses across parameter sweeps (temperature / top_p). FastAPI backend with provider adapters (OpenAI / Gemini / Groq / Mock) and a Next.js frontend.

Quick links

- Backend: backend/main.py — endpoints: create/list/get/export
- Storage: backend/storage.py — SQL <-> Mongo switch
- Providers: backend/openai_client.py, backend/gemini_client.py, backend/groq_client.py
- Metrics: backend/metrics.py (lexical_diversity, repetition, readability, clarity, aggregate)
- Frontend entry: frontend/src/app/page.tsx
- Key frontend: frontend/src/components/{PromptForm,ResponsesTable,ExperimentHistory}.tsx
- API helpers: frontend/src/lib/api.ts

Prerequisites

- Python 3.10+ (backend)
- Node 18+ (frontend) + npm/pnpm/yarn
- Optional DB: SQLite (default) or MongoDB (set DB_KIND=mongo)
- Provider API keys for real providers (OpenAI / Gemini / Groq)

Installation

1. Backend

```bash
# from project root
python -m venv .venv
.venv/Scripts/activate   # Windows
# or
source .venv/bin/activate

pip install -r [requirements.txt]
```

2. Frontend

```bash
cd frontend
npm install
```

Configuration (env)

- DB_KIND (default: "sql") — set to "mongo" to use MongoDB
- DATABASE_URL — SQL DSN (default: sqlite:///./llmlab.db)
- MONGO_URL, MONGO_DB — for Mongo mode
- OPENAI_API_KEY, GEMINI_API_KEY, GROQ_API_KEY
- Optional model overrides: OPENAI_MODEL, GEMINI_MODEL, GROQ_MODEL
- MAX_RETRIES, CORS_ORIGINS

Running (dev)

1. Backend

```bash
# run from repo root
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

Health: GET /health

2. Frontend

```bash
cd frontend
npm run dev
# open http://localhost:3000
```

Usage (quick)

- In UI: enter title + prompt, choose provider/model, set temperature/top_p ranges and steps (PromptForm builds param sets), click "Generate Responses".
- View experiments in history, inspect responses and metrics, export JSON/CSV.

Provider defaults

- OpenAI: gpt-4o-mini (override via OPENAI_MODEL or request)
- Gemini: gemini-2.5-flash
- Groq: llama-3.1-8b-instant
- Mock: local generator for development

Exporting

- JSON: GET /experiments/{id}/export/json
- CSV: GET /experiments/{id}/export/csv
- Frontend uses frontend/src/lib/api.ts to download

Troubleshooting (brief)

- CORS: check CORS_ORIGINS or backend middleware
- Missing API keys: set env or POST /apikey (demo)
- Provider errors/quotas: backend returns 429; frontend shows modal

Developer notes

- Metrics: backend/metrics.py
- Param sweep: frontend/src/components/PromptForm.tsx (buildParamSets)
- Add providers: edit adapters in backend/
