import os
from typing import List, Dict, Any
from dotenv import load_dotenv
load_dotenv()
import logging
import time

from openai import OpenAI

DEFAULT_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
DEFAULT_MAX_RETRIES = int(os.getenv("OPENAI_MAX_RETRIES", "2"))

# new sentinel exception to bubble quota issues to the API layer
class QuotaExceededError(Exception):
    pass

def _make_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise ValueError("OPENAI_API_KEY not found. Set it in your environment or .env file.")
    # If your OpenAI SDK supports max_retries on the client constructor you could pass it here:
    # return OpenAI(api_key=api_key, max_retries=DEFAULT_MAX_RETRIES)
    return OpenAI(api_key=api_key)

def generate_responses_sync(prompt: str, param_sets: List[Dict[str, Any]], model: str = DEFAULT_MODEL) -> List[Dict[str, Any]]:
    print("Creating OpenAI client...", prompt, param_sets, model)
    client = _make_client()
    results: List[Dict[str, Any]] = []
    max_retries = int(os.getenv("MAX_RETRIES", DEFAULT_MAX_RETRIES))
    print("Generating responses using OpenAI client (Responses API)...")
    for p in param_sets:
        prompt_text = prompt
        text = ""
        for attempt in range(1, max_retries + 1):
            try:
                # Use Responses API
                resp = client.responses.create(
                    model=model,
                    input=prompt_text,
                    temperature=float(p.get("temperature", 0.7)),
                    top_p=float(p.get("top_p", 1.0)),
                )

                # Robust extraction: prefer output_text, else walk output -> content -> text
                if getattr(resp, "output_text", None):
                    text = getattr(resp, "output_text") or ""
                else:
                    out_items = getattr(resp, "output", None) or []
                    parts: List[str] = []
                    for item in out_items:
                        content = getattr(item, "content", None) or (item.get("content") if isinstance(item, dict) else None)
                        if not content:
                            continue
                        for c in content:
                            t = getattr(c, "text", None) or (c.get("text") if isinstance(c, dict) else None)
                            if t:
                                parts.append(t)
                    text = "\n".join(parts).strip()
                break  # success -> exit retry loop
            except Exception as e:
                # detect quota/insufficient_quota errors and bail immediately
                msg = str(e).lower()
                if "insufficient_quota" in msg or "quota" in msg or "exceed" in msg:
                    logging.exception("Quota error detected, raising QuotaExceededError: %s", e)
                    raise QuotaExceededError(str(e))
                logging.exception("Attempt %s/%s failed for param_set %s: %s", attempt, max_retries, p, e)
                if attempt < max_retries:
                    backoff = min(2 ** (attempt - 1), 8)
                    time.sleep(backoff)
                    continue
                else:
                    print(f"Error generating response (final attempt): {e}")
                    text = ""
        results.append({"param_set": p, "text": text})
    return results
