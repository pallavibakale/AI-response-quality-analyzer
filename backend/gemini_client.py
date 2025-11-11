import os, time, re
from typing import List, Dict, Any
from dotenv import load_dotenv
load_dotenv()

from google import genai
from google.genai import types as gt  # typed config

DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

def _client() -> genai.Client:
    key = os.getenv("geminiPi") or os.getenv("GEMINI_API_KEY") or os.getenv("GEMINI_KEY")
    if not key:
        raise ValueError("Gemini API key not found (geminiPi / GEMINI_API_KEY / GEMINI_KEY).")
    return genai.Client(api_key=key)

def _extract_text(resp) -> str:
    # 1) direct attributes
    for attr in ("text", "output_text"):
        t = getattr(resp, attr, None)
        if isinstance(t, str) and t.strip():
            return t.strip()
    # 2) candidate -> content.parts[].text
    try:
        for c in getattr(resp, "candidates", []) or []:
            content = getattr(c, "content", None)
            parts = getattr(content, "parts", None) if content else None
            if parts:
                texts = []
                for p in parts:
                    txt = getattr(p, "text", None) or (p.get("text") if isinstance(p, dict) else None)
                    if isinstance(txt, str) and txt.strip():
                        texts.append(txt.strip())
                if texts:
                    return "\n".join(texts)
    except Exception:
        pass
    # 3) dict-ish dumps
    for attr in ("to_dict", "model_dump"):
        fn = getattr(resp, attr, None)
        if callable(fn):
            try:
                d = fn() or {}
                for c in d.get("candidates") or []:
                    parts = (c.get("content") or {}).get("parts") or []
                    texts = [p.get("text") for p in parts if isinstance(p, dict) and p.get("text")]
                    if texts:
                        return "\n".join(texts).strip()
            except Exception:
                pass
    # 4) last-resort regex from string dump
    try:
        s = str(resp)
        hits = re.findall(r"text='([^']+)'", s)
        if hits:
            return "\n".join(h.strip() for h in hits if h.strip())[:4000]
    except Exception:
        pass
    return ""


def generate_responses_sync(prompt: str, param_sets: List[Dict[str, Any]], model: str = DEFAULT_MODEL) -> List[Dict[str, Any]]:
    """
    Use GenerativeModel.generate_content (stable .text) and fall back to Client.models
    only if needed. Persist empty string only if the API truly returns no text.
    """
    _ = _client()  # validate key early
    results: List[Dict[str, Any]] = []

    for p in param_sets:
        user_text = p.get("prompt_override") or prompt
        cfg = gt.GenerateContentConfig(
            temperature=float(p.get("temperature", 0.7)),
            top_p=float(p.get("top_p", 1.0)),
            # max_output_tokens=int(p.get("max_tokens", 256)),
        )
        n = int(p.get("n", 1))

        for _i in range(n):
            tries = 0
            while True:
                tries += 1
                try:
                # Primary path: GenerativeModel (preferred)
                # gm = genai.GenerativeModel(model_name=model, client=_client())
                # resp = gm.generate_content(user_text, generation_config=cfg)
                # text = (getattr(resp, "text", None) or _extract_text(resp)).strip()
                # # Fallback path only if still empty (older odd SDKs)
                # if not text:
                #     cli = _client()
                #     contents = [gt.Content(role="user", parts=[gt.Part.from_text(user_text)])]
                #     resp2 = cli.models.generate_content(model=model, contents=contents, config=cfg)
                #     text = _extract_text(resp2).strip()
                #     results.append({"param_set": p, "text": text})
                #     break
                    cli = _client()
                    contents = [gt.Content(role="user", parts=[gt.Part.from_text(user_text)])]
                    resp = cli.models.generate_content(model=model, contents=contents, config=cfg)
                    text = _extract_text(resp).strip()
                    results.append({"param_set": p, "text": text})
                    break
                except Exception as e:
                    if tries == 1 and "quota" in str(e).lower():
                        time.sleep(0.8); continue
                    raise
    return results
