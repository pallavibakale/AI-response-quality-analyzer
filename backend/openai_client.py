import os
from typing import List, Dict, Any
from dotenv import load_dotenv
load_dotenv()
import logging

# Log to console by default. The application can reconfigure logging if desired.
logging.basicConfig(level=logging.INFO)

from openai import OpenAI

DEFAULT_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

def _make_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise ValueError("OPENAI_API_KEY not found. Set it in your environment or .env file.")
    return OpenAI(api_key=api_key)

def generate_responses_sync(prompt: str, param_sets: List[Dict[str, Any]], model: str = DEFAULT_MODEL) -> List[Dict[str, Any]]:
    print("Creating OpenAI client...", prompt, param_sets, model)
    client = _make_client()
    results: List[Dict[str, Any]] = []
    print("Generating responses using OpenAI client (Responses API)...")
    for p in param_sets:
        prompt_text = prompt
        try:
            # Use Responses API
            resp = client.responses.create(
                model=model,
                input=prompt_text,
                temperature=float(p.get("temperature", 0.7)),
                top_p=float(p.get("top_p", 1.0)),
                max_tokens=int(p.get("max_tokens", 150)),
            )

            # Robust extraction: prefer output_text, else walk output -> content -> text
            text = ""
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
        except Exception as e:
            logging.exception("Failed to generate response for param_set %s: %s", p, e)
            print(f"Error generating response: {e}")
            text = ""
        results.append({"param_set": p, "text": text})
    return results
