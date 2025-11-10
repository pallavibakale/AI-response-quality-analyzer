# storage.py
import os
import uuid
from typing import List, Dict, Any, Optional

DB_KIND = os.getenv("DB_KIND", "sql").lower()  # 'sql' or 'mongo'

# ---------------- SQL (SQLite/MySQL/Postgres) ----------------
if DB_KIND == "sql":
    from sqlmodel import SQLModel, Field, Session, create_engine, select
    from sqlalchemy import Column, JSON as SA_JSON

    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./llmlab.db")
    connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
    engine = create_engine(DATABASE_URL, echo=False, connect_args=connect_args)

    class Experiment(SQLModel, table=True):
        id: str = Field(primary_key=True)
        title: Optional[str] = None
        prompt: str
        model: str

    class ResponseRecord(SQLModel, table=True):
        id: str = Field(primary_key=True)
        experiment_id: str = Field(index=True)
        param_set: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(SA_JSON))
        text: str
        metrics: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(SA_JSON))

    def init_storage():
        SQLModel.metadata.create_all(engine)

    def _session():
        return Session(engine)

    def create_experiment(title: Optional[str], prompt: str, model: str) -> str:
        exp_id = str(uuid.uuid4())
        with _session() as s:
            s.add(Experiment(id=exp_id, title=title, prompt=prompt, model=model))
            s.commit()
        return exp_id

    def add_responses(exp_id: str, enriched: List[Dict[str, Any]]) -> None:
        with _session() as s:
            for r in enriched:
                s.add(ResponseRecord(
                    id=str(uuid.uuid4()),
                    experiment_id=exp_id,
                    param_set=r.get("param_set", {}),
                    text=r.get("text",""),
                    metrics=r.get("metrics",{}),
                ))
            s.commit()

    def list_experiments(skip:int=0, limit:int=50) -> List[Dict[str, Any]]:
        with _session() as s:
            rows = s.exec(select(Experiment).offset(skip).limit(limit)).all()
            return [{"id": e.id, "title": e.title, "prompt": e.prompt, "model": e.model} for e in rows]

    def get_experiment(exp_id: str) -> Dict[str, Any]:
        with _session() as s:
            exp = s.get(Experiment, exp_id)
            if not exp:
                return {}
            resp_rows = s.exec(select(ResponseRecord).where(ResponseRecord.experiment_id==exp_id)).all()
            return {
                "experiment": {"id": exp.id, "title": exp.title, "prompt": exp.prompt, "model": exp.model},
                "responses": [{
                    "response_id": r.id,
                    "param_set": r.param_set,
                    "text": r.text,
                    "metrics": r.metrics,
                } for r in resp_rows]
            }

# ---------------- MongoDB (NoSQL) ----------------
else:
    from pymongo import MongoClient, ASCENDING
    import datetime

    MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
    MONGO_DB = os.getenv("MONGO_DB", "llmlab")
    client = MongoClient(MONGO_URL)
    db = client[MONGO_DB]
    exps = db["experiments"]
    resps = db["responses"]
    exps.create_index([("id", ASCENDING)], unique=True)
    resps.create_index([("experiment_id", ASCENDING)])

    def init_storage():
        # No migrations needed for Mongo
        pass

    def create_experiment(title: Optional[str], prompt: str, model: str) -> str:
        exp_id = str(uuid.uuid4())
        exps.insert_one({
            "id": exp_id,
            "title": title,
            "prompt": prompt,
            "model": model,
            "created_at": datetime.datetime.utcnow()
        })
        return exp_id

    def add_responses(exp_id: str, enriched: List[Dict[str, Any]]) -> None:
        docs = []
        for r in enriched:
            docs.append({
                "response_id": str(uuid.uuid4()),
                "experiment_id": exp_id,
                "param_set": r.get("param_set", {}),
                "text": r.get("text", ""),
                "metrics": r.get("metrics", {}),
                "created_at": datetime.datetime.utcnow()
            })
        if docs:
            resps.insert_many(docs)

    def list_experiments(skip:int=0, limit:int=50) -> List[Dict[str, Any]]:
        rows = list(exps.find({}, {"_id": False}).skip(skip).limit(limit))
        return rows

    def get_experiment(exp_id: str) -> Dict[str, Any]:
        exp = exps.find_one({"id": exp_id}, {"_id": False})
        if not exp: return {}
        rows = list(resps.find({"experiment_id": exp_id}, {"_id": False}))
        return {
            "experiment": {k: exp[k] for k in ["id","title","prompt","model"] if k in exp},
            "responses": rows
        }
