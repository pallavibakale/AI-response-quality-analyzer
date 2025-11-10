# db.py
import os
from typing import Optional, Dict, Any
from sqlmodel import SQLModel, Field, create_engine, Session
from sqlalchemy import Column, JSON as SA_JSON

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./llmlab.db")
connect_args = {"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
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

def init_db():
    SQLModel.metadata.create_all(engine)

def get_session():
    return Session(engine)
