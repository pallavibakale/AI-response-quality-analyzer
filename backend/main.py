# main.py (provider switch + storage abstraction for SQL or Mongo)
import os
import io
import json
import uuid
import pandas as pd
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

# storage abstraction (SQL or Mongo depending on DB_KIND)
from storage import init_storage, create_experiment as st_create_experiment, add_responses as st_add_responses, list_experiments as st_list_experiments, get_experiment as st_get_experiment

# Provider adapters
def _gemini_generate(prompt: str, param_sets: List[Dict[str, Any]], model: str):
    from gemini_client import generate_responses_sync
    print("Using Gemini provider with model:", model)
    return generate_responses_sync(prompt, param_sets, model=model)

def _openai_generate(prompt: str, param_sets: List[Dict[str, Any]], model: str):
    from openai_client import generate_responses_sync
    print("Using OpenAI provider with model:", model, prompt, param_sets)
    return generate_responses_sync(prompt, param_sets, model=model)

def _groq_generate(prompt: str, param_sets: List[Dict[str, Any]], model: str):
    from groq_client import generate_responses_sync
    print("Using Groq provider with model:", model)
    return generate_responses_sync(prompt, param_sets, model=model)


def _mock_generate(prompt: str, param_sets: List[Dict[str, Any]]):
    out = []
    print("Mock generate called with prompt:", prompt)
    print("Param sets:", param_sets)
    for p in param_sets:
        txt = f"[MOCK] temp={p.get('temperature')} top_p={p.get('top_p')}: {prompt[:160]}"
        out.append({"param_set": p, "text": txt})
    return out

from metrics import analyze_response_batch

app = FastAPI(title="LLM Lab Backend")

origins = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    init_storage()

class ParamSet(BaseModel):
    temperature: Optional[float] = Field(0.7, ge=0.0, le=2.0)
    top_p: Optional[float] = Field(1.0, ge=0.0, le=1.0)
    max_tokens: Optional[int] = Field(150, ge=1)
    # prompt_override: Optional[str] = None

class CreateExperimentRequest(BaseModel):
    title: str = "untitled experiment"
    prompt: str
    param_sets: List[ParamSet]
    provider: Optional[str] = Field(default="gemini", description="gemini | openai | groq | mock")
    model: Optional[str] = Field(default=None, description="model name for selected provider")

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/experiments")
def create_exp(req: CreateExperimentRequest):
    print("Create experiment request received:", req)
    provider = (req.provider or "gemini").lower().strip()
    # req.model may be None; avoid calling .lower() on None
    model = (req.model or "").lower().strip() or ("gemini-2.5-flash" if provider == "gemini" else "gpt-4o-mini")
    exp_id = st_create_experiment(req.title, req.prompt, model)

    params = [p.dict() for p in req.param_sets]
    try:
        if provider == "gemini":
            raw = _gemini_generate(req.prompt, params, model=model)
        elif provider == "openai":
            raw = _openai_generate(req.prompt, params, model=model)
        elif provider == "groq":  
            raw = _groq_generate(req.prompt, params, model=model)
        else:
            print("Using Mock provider")
            raw = _mock_generate(req.prompt, params)
    except Exception:
        # raw = _mock_generate(req.prompt, params)
        raise HTTPException(status_code=500, detail="Failed to generate responses from provider")
    print("Raw responses generated:", raw)
    enriched = analyze_response_batch(req.prompt, raw)
    st_add_responses(exp_id, enriched)
    print(f"Experiment {exp_id} created with {len(enriched)} responses.")
    return {"experiment_id": exp_id, "num_responses": len(enriched)}

@app.get("/experiments")
def list_exps(skip: int = 0, limit: int = 50):
    return {"experiments": st_list_experiments(skip, limit)}

@app.get("/experiments/{exp_id}")
def get_exp(exp_id: str):
    payload = st_get_experiment(exp_id)
    if not payload:
        raise HTTPException(status_code=404, detail="Experiment not found")
    # normalize responses field
    norm = []
    for r in payload.get("responses", []):
        norm.append({
            "response_id": r.get("response_id") or r.get("id") or str(uuid.uuid4()),
            "param_set": r.get("param_set", {}),
            "text": r.get("text",""),
            "metrics": r.get("metrics", {}),
        })
    payload["responses"] = norm
    return payload

@app.get("/experiments/{exp_id}/export/json")
def export_json(exp_id: str):
    payload = get_exp(exp_id)
    s = json.dumps(payload, indent=2, ensure_ascii=False)
    return StreamingResponse(io.BytesIO(s.encode("utf-8")),
                             media_type="application/json",
                             headers={"Content-Disposition": f"attachment; filename={exp_id}.json"})

@app.get("/experiments/{exp_id}/export/csv")
def export_csv(exp_id: str):
    payload = get_exp(exp_id)
    rows = []
    exp_model = payload.get("experiment", {}).get("model", "")
    for r in payload.get("responses", []):
        row = {
            "response_id": r["response_id"],
            "model": exp_model,
            "param_set": json.dumps(r.get("param_set", {})),
            "text": r.get("text",""),
        }
        for k, v in r.get("metrics", {}).items():
            row[f"metric_{k}"] = v
        rows.append(row)
    import pandas as pd
    df = pd.DataFrame(rows)
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    return StreamingResponse(io.BytesIO(buf.getvalue().encode()),
                             media_type="text/csv",
                             headers={"Content-Disposition": f"attachment; filename={exp_id}.csv"})
