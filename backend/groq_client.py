import os
from typing import List, Dict, Any
from groq import Groq

DEFAULT_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")

def _get_key() -> str:
    key = os.getenv("GROQ_API_KEY", "").strip()
    if not key:
        raise ValueError("GROQ_API_KEY not set in environment (.env)")
    return key

def generate_responses_sync(
    prompt: str, param_sets: List[Dict[str, Any]], model: str = DEFAULT_MODEL
) -> List[Dict[str, Any]]:
    """
    Generate Groq responses for each parameter set using streaming completion.
    Collects all streamed chunks into a single text string for display.
    """
    api_key = _get_key()
    client = Groq(api_key=api_key)
    results: List[Dict[str, Any]] = []

    for p in param_sets:
        n = int(p.get("n", 1))
        for _ in range(n):
            try:
                stream = client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "user", "content": p.get("prompt_override") or prompt}
                    ],
                    temperature=float(p.get("temperature", 0.7)),
                    top_p=float(p.get("top_p", 1.0)),
                    max_completion_tokens=int(p.get("max_tokens", 256)),
                    stream=True, 
                )
                collected = []
                for chunk in stream:
                    delta = getattr(chunk.choices[0].delta, "content", "") or ""
                    collected.append(delta)

                text = "".join(collected).strip()
                results.append({"param_set": p, "text": text})

            except Exception as e:
                print(f"[Groq Error] {e}")
                results.append({"param_set": p, "text": f"[GroqError] {e}"})

    return results
