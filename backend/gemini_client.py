# # import os, time
# # from typing import List, Dict, Any
# # from dotenv import load_dotenv
# # load_dotenv()

# # from google import genai
# # DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

# # def _client():
# #     key = os.getenv("geminiPi") or os.getenv("GEMINI_API_KEY") or os.getenv("GEMINI_KEY")
# #     if not key:
# #         raise ValueError("Gemini API key not found (geminiPi/GEMINI_API_KEY).")
# #     return genai.Client(api_key=key)

# # # ...top of file unchanged...
# # def _extract_text(resp) -> str:
# #     """
# #     Try multiple shapes the Google GenAI SDK can return.
# #     Falls back to a short string if nothing textual is found.
# #     """
# #     # 1) unified helpers some SDK builds expose
# #     for attr in ("text", "output_text"):
# #         try:
# #             t = getattr(resp, attr, None)
# #             if isinstance(t, str) and t.strip():
# #                 return t.strip()
# #         except Exception:
# #             pass

# #     # 2) walk candidates -> content -> parts -> text
# #     try:
# #         candidates = getattr(resp, "candidates", None) or []
# #         parts = []
# #         for c in candidates:
# #             content = getattr(c, "content", None)
# #             if content is None:
# #                 continue
# #             pts = getattr(content, "parts", None) or []
# #             for p in pts:
# #                 # part can have .text; sometimes str(p) is fine
# #                 txt = getattr(p, "text", None)
# #                 if isinstance(txt, str) and txt.strip():
# #                     parts.append(txt.strip())
# #                 else:
# #                     s = str(p).strip()
# #                     # filter obvious non-texty dumps
# #                     if not s.startswith("HttpResponse("):
# #                         parts.append(s[:2000])
# #         if parts:
# #             return "\n".join(parts).strip()
# #     except Exception:
# #         pass

# #     # 3) last resort, short summary to avoid dumping the whole object
# #     s = str(resp)
# #     return s[:1200]


# # def generate_responses_sync(prompt: str, param_sets: List[Dict[str, Any]], model: str = DEFAULT_MODEL) -> List[Dict[str, Any]]:
# #     c = _client()
# #     results: List[Dict[str, Any]] = []
# #     for p in param_sets:
# #         contents = p.get("prompt_override") or prompt
# #         cfg = {}
# #         if "temperature" in p: cfg["temperature"] = float(p["temperature"])
# #         if "top_p" in p: cfg["top_p"] = float(p["top_p"])
# #         if "max_tokens" in p: cfg["max_output_tokens"] = int(p["max_tokens"])
# #         n = int(p.get("n", 1))
# #         for _ in range(n):
# #             tries = 0
# #             while True:
# #                 tries += 1
# #                 try:
# #                     resp = c.models.generate_content(
# #                         model=model,
# #                         contents=contents,
# #                         config=genai.types.GenerateContentConfig(**cfg) if cfg else None
# #                     )
# #                     text = _extract_text(resp).strip()
# #                     results.append({"param_set": p, "text": text})
# #                     break
# #                 except Exception as e:
# #                     if "quota" in str(e).lower() or tries > 1:
# #                         raise
# #                     time.sleep(0.8 * tries)
# #     return results





# import os, time, json
# from typing import List, Dict, Any
# from dotenv import load_dotenv
# load_dotenv()

# from google import genai
# DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

# def _client():
#     key = os.getenv("geminiPi") or os.getenv("GEMINI_API_KEY") or os.getenv("GEMINI_KEY")
#     if not key:
#         raise ValueError("Gemini API key not found (geminiPi/GEMINI_API_KEY/GEMINI_KEY).")
#     return genai.Client(api_key=key)

# def _parts_to_text(parts) -> str:
#     out: list[str] = []
#     for p in parts or []:
#         # Prefer .text if available
#         t = getattr(p, "text", None)
#         if isinstance(t, str) and t.strip():
#             out.append(t.strip())
#             continue
#         # If not, str(p) sometimes holds text for simple parts
#         s = str(p).strip()
#         # Filter obvious transport dumps
#         if s and not s.startswith("HttpResponse("):
#             out.append(s[:2000])
#     return "\n".join(out).strip()

# def _extract_text(resp) -> str:
#     """
#     Tries all known response shapes from google-genai.
#     Never returns the raw HttpResponse dump.
#     """
#     # 1) Simple: resp.text / resp.output_text
#     for attr in ("text", "output_text"):
#         try:
#             t = getattr(resp, attr, None)
#             if isinstance(t, str) and t.strip():
#                 return t.strip()
#         except Exception:
#             pass

#     # 2) Candidates -> content.parts[].text
#     try:
#         cands = getattr(resp, "candidates", None) or []
#         for c in cands:
#             content = getattr(c, "content", None)
#             if content is None:
#                 continue
#             txt = _parts_to_text(getattr(content, "parts", None))
#             if txt:
#                 return txt
#     except Exception:
#         pass

#     # 3) Some installs support to_dict()/model_dump()
#     for attr in ("to_dict", "model_dump"):
#         try:
#             fn = getattr(resp, attr, None)
#             if callable(fn):
#                 d = fn()
#                 # Best-effort walk
#                 cands = (d or {}).get("candidates") or []
#                 for c in cands:
#                     content = (c or {}).get("content") or {}
#                     parts = content.get("parts") or []
#                     texts = [p.get("text") for p in parts if isinstance(p, dict) and p.get("text")]
#                     if texts:
#                         return "\n".join(texts).strip()
#         except Exception:
#             pass

#     # 4) Give up: return empty string (never the dump)
#     return ""

# def generate_responses_sync(prompt: str, param_sets: List[Dict[str, Any]], model: str = DEFAULT_MODEL) -> List[Dict[str, Any]]:
#     c = _client()
#     results: List[Dict[str, Any]] = []
#     for p in param_sets:
#         contents = p.get("prompt_override") or prompt
#         cfg = {}
#         if "temperature" in p: cfg["temperature"] = float(p["temperature"])
#         if "top_p" in p: cfg["top_p"] = float(p["top_p"])
#         if "max_tokens" in p: cfg["max_output_tokens"] = int(p["max_tokens"])

#         n = int(p.get("n", 1))
#         for _ in range(n):
#             tries = 0
#             while True:
#                 tries += 1
#                 try:
#                     resp = c.models.generate_content(
#                         model=model,
#                         contents=contents,
#                         config=genai.types.GenerateContentConfig(**cfg) if cfg else None
#                     )
#                     text = _extract_text(resp)
#                     # If nothing came back (e.g., MAX_TOKENS before any text), keep empty string
#                     results.append({"param_set": p, "text": text})
#                     break
#                 except Exception as e:
#                     # One light retry for flaky quotas
#                     if "quota" in str(e).lower() and tries == 1:
#                         time.sleep(0.8)
#                         continue
#                     raise
#     return results



# *******************************************


# import os, time, re, json
# from typing import List, Dict, Any
# from dotenv import load_dotenv
# load_dotenv()

# from google import genai
# DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

# def _client():
#     key = os.getenv("geminiPi") or os.getenv("GEMINI_API_KEY") or os.getenv("GEMINI_KEY")
#     if not key:
#         raise ValueError("Gemini API key not found (geminiPi/GEMINI_API_KEY/GEMINI_KEY).")
#     return genai.Client(api_key=key)

# def _parts_to_text(parts) -> str:
#     out: list[str] = []
#     for p in parts or []:
#         # 1) direct .text
#         t = getattr(p, "text", None)
#         if isinstance(t, str) and t.strip():
#             out.append(t.strip()); continue
#         # 2) dict-like
#         if isinstance(p, dict) and isinstance(p.get("text"), str):
#             out.append(p["text"].strip()); continue
#         # 3) as string (avoid full transport dumps)
#         s = str(p).strip()
#         if s and not s.startswith("HttpResponse("):
#             out.append(s[:2000])
#     return "\n".join(out).strip()

# def _extract_text(resp) -> str:
#     # A) happy paths
#     for attr in ("text", "output_text"):
#         try:
#             t = getattr(resp, attr, None)
#             if isinstance(t, str) and t.strip():
#                 return t.strip()
#         except Exception:
#             pass

#     try:
#         cands = getattr(resp, "candidates", None) or []
#         for c in cands:
#             content = getattr(c, "content", None)
#             if content is None: 
#                 continue
#             txt = _parts_to_text(getattr(content, "parts", None))
#             if txt:
#                 return txt
#     except Exception:
#         pass

#     # B) dataclass/json-style dumps
#     for attr in ("to_dict", "model_dump"):
#         try:
#             fn = getattr(resp, attr, None)
#             if callable(fn):
#                 d = fn()
#                 cands = (d or {}).get("candidates") or []
#                 for c in cands:
#                     content = (c or {}).get("content") or {}
#                     parts = content.get("parts") or []
#                     if isinstance(parts, list):
#                         texts = [p.get("text") for p in parts if isinstance(p, dict) and p.get("text")]
#                         if texts:
#                             return "\n".join(texts).strip()
#         except Exception:
#             pass

#     # C) last-resort regex from string representation (never return the whole dump)
#     try:
#         s = str(resp)
#         # grab text='...' fragments safely
#         matches = re.findall(r"text='([^']+)'", s)
#         if matches:
#             return "\n".join(m.strip() for m in matches if m.strip())[:4000]
#     except Exception:
#         pass

#     return ""  # give empty rather than a noisy dump

# def generate_responses_sync(prompt: str, param_sets: List[Dict[str, Any]], model: str = DEFAULT_MODEL) -> List[Dict[str, Any]]:
#     c = _client()
#     results: List[Dict[str, Any]] = []
#     for p in param_sets:
#         contents = p.get("prompt_override") or prompt
#         # gentler defaults if caller omitted
#         temperature = float(p.get("temperature", 0.7))
#         top_p = float(p.get("top_p", 1.0))
#         max_out = int(p.get("max_tokens", 256))  # bumped from 150

#         cfg = genai.types.GenerateContentConfig(
#             temperature=temperature,
#             top_p=top_p,
#             max_output_tokens=max_out,
#         )

#         n = int(p.get("n", 1))
#         for _ in range(n):
#             tries = 0
#             while True:
#                 tries += 1
#                 try:
#                     resp = c.models.generate_content(
#                         model=model,
#                         contents=contents,
#                         config=cfg
#                     )
#                     text = _extract_text(resp)
#                     results.append({"param_set": p, "text": text})
#                     break
#                 except Exception as e:
#                     if "quota" in str(e).lower() and tries == 1:
#                         time.sleep(0.8); continue
#                     raise
#     return results


# ***************************************************

# import os, time
# from typing import List, Dict, Any
# from dotenv import load_dotenv
# load_dotenv()

# from google import genai
# from google.genai import types as gt

# DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

# def _client():
#     key = os.getenv("geminiPi") or os.getenv("GEMINI_API_KEY") or os.getenv("GEMINI_KEY")
#     if not key:
#         raise ValueError("Gemini API key not found (geminiPi/GEMINI_API_KEY/GEMINI_KEY).")
#     return genai.Client(api_key=key)

# def _extract_text(resp) -> str:
#     # 1) Preferred fields
#     for attr in ("text", "output_text"):
#         t = getattr(resp, attr, None)
#         if isinstance(t, str) and t.strip():
#             return t.strip()
#     # 2) Standard candidates -> content.parts[].text
#     try:
#         for c in getattr(resp, "candidates", []) or []:
#             content = getattr(c, "content", None)
#             parts = getattr(content, "parts", None) if content else None
#             if parts:
#                 texts = []
#                 for p in parts:
#                     # support both object + dict parts
#                     txt = getattr(p, "text", None)
#                     if not txt and isinstance(p, dict):
#                         txt = p.get("text")
#                     if isinstance(txt, str) and txt.strip():
#                         texts.append(txt.strip())
#                 if texts:
#                     return "\n".join(texts)
#     except Exception:
#         pass
#     # 3) to_dict()/model_dump() fallback
#     for attr in ("to_dict", "model_dump"):
#         fn = getattr(resp, attr, None)
#         if callable(fn):
#             d = fn() or {}
#             for c in d.get("candidates") or []:
#                 parts = (c.get("content") or {}).get("parts") or []
#                 texts = [p.get("text") for p in parts if isinstance(p, dict) and p.get("text")]
#                 if texts:
#                     return "\n".join(texts).strip()
#     return ""  # never return dumps

# def generate_responses_sync(prompt: str, param_sets: List[Dict[str, Any]], model: str = DEFAULT_MODEL) -> List[Dict[str, Any]]:
#     c = _client()
#     results: List[Dict[str, Any]] = []
#     for p in param_sets:
#         user_text = p.get("prompt_override") or prompt

#         # Use explicit Content/Part types so the SDK can always parse
#         contents = [
#             gt.Content(role="user", parts=[gt.Part.from_text(user_text)])
#         ]

#         cfg = gt.GenerateContentConfig(
#             temperature=float(p.get("temperature", 0.7)),
#             top_p=float(p.get("top_p", 1.0)),
#             max_output_tokens=int(p.get("max_tokens", 256)),
#         )

#         n = int(p.get("n", 1))
#         for _ in range(n):
#             tries = 0
#             while True:
#                 tries += 1
#                 try:
#                     resp = c.models.generate_content(model=model, contents=contents, config=cfg)
#                     text = _extract_text(resp).strip()
#                     results.append({"param_set": p, "text": text})
#                     break
#                 except Exception as e:
#                     # one gentle retry for transient quota/network
#                     if tries == 1 and "quota" in str(e).lower():
#                         time.sleep(0.8); continue
#                     raise
#     return results



# ****************************

# # backend/gemini_client.py
# import os, time
# from typing import List, Dict, Any
# from dotenv import load_dotenv
# load_dotenv()

# from google import genai
# from google.genai import types as gt  # <-- use typed content

# contents = [gt.Content(role="user", parts=[gt.Part.from_text(user_text)])]
# cfg = gt.GenerateContentConfig(
#     temperature=float(p.get("temperature", 0.7)),
#     top_p=float(p.get("top_p", 1.0)),
#     max_output_tokens=int(p.get("max_tokens", 256)),
# )
# resp = c.models.generate_content(model=model, contents=contents, config=cfg)
# text = _extract_text(resp).strip()

# DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

# def _client():
#     key = os.getenv("geminiPi") or os.getenv("GEMINI_API_KEY") or os.getenv("GEMINI_KEY")
#     if not key:
#         raise ValueError("Gemini API key not found (geminiPi/GEMINI_API_KEY/GEMINI_KEY).")
#     return genai.Client(api_key=key)

# # keep your existing _extract_text(...) here

# def generate_responses_sync(prompt: str, param_sets: List[Dict[str, Any]], model: str = DEFAULT_MODEL) -> List[Dict[str, Any]]:
#     c = _client()
#     results: List[Dict[str, Any]] = []
#     for p in param_sets:
#         user_text = p.get("prompt_override") or prompt

#         # Typed request shape (works across SDK versions)
#         contents = [gt.Content(role="user", parts=[gt.Part.from_text(user_text)])]

#         cfg = gt.GenerateContentConfig(
#             temperature=float(p.get("temperature", 0.7)),
#             top_p=float(p.get("top_p", 1.0)),
#             max_output_tokens=int(p.get("max_tokens", 256)),
#         )

#         n = int(p.get("n", 1))
#         for _ in range(n):
#             tries = 0
#             while True:
#                 tries += 1
#                 try:
#                     resp = c.models.generate_content(model=model, contents=contents, config=cfg)
#                     text = _extract_text(resp).strip()
#                     results.append({"param_set": p, "text": text})
#                     break
#                 except Exception as e:
#                     if tries == 1 and "quota" in str(e).lower():
#                         time.sleep(0.8); continue
#                     raise
#     return results




# ***********************************************************

# import os, time, re
# from typing import List, Dict, Any
# from dotenv import load_dotenv
# load_dotenv()

# from google import genai
# from google.genai import types as gt  # typed content helpers

# DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

# def _client():
#     key = (
#         os.getenv("geminiPi")
#         or os.getenv("GEMINI_API_KEY")
#         or os.getenv("GEMINI_KEY")
#     )
#     if not key:
#         raise ValueError(
#             "Gemini API key not found (geminiPi / GEMINI_API_KEY / GEMINI_KEY)."
#         )
#     return genai.Client(api_key=key)


# # ---------------------------------------------------------------------
# # Universal extractor: handles every known shape of google-genai response
# # ---------------------------------------------------------------------
# def _extract_text(resp) -> str:
#     """Safely extract text from any google.genai.models.generate_content response."""
#     # A) Common simple cases
#     for attr in ("text", "output_text"):
#         t = getattr(resp, attr, None)
#         if isinstance(t, str) and t.strip():
#             return t.strip()

#     # B) Candidate structure: candidates -> content.parts[].text
#     try:
#         for c in getattr(resp, "candidates", []) or []:
#             content = getattr(c, "content", None)
#             parts = getattr(content, "parts", None) if content else None
#             if parts:
#                 texts = []
#                 for p in parts:
#                     txt = getattr(p, "text", None)
#                     if not txt and isinstance(p, dict):
#                         txt = p.get("text")
#                     if isinstance(txt, str) and txt.strip():
#                         texts.append(txt.strip())
#                 if texts:
#                     return "\n".join(texts)
#     except Exception:
#         pass

#     # C) to_dict / model_dump fallback
#     for attr in ("to_dict", "model_dump"):
#         fn = getattr(resp, attr, None)
#         if callable(fn):
#             try:
#                 d = fn() or {}
#                 for c in d.get("candidates") or []:
#                     parts = (c.get("content") or {}).get("parts") or []
#                     texts = [
#                         p.get("text") for p in parts
#                         if isinstance(p, dict) and p.get("text")
#                     ]
#                     if texts:
#                         return "\n".join(texts).strip()
#             except Exception:
#                 pass

#     # D) Regex fallback from raw dump (never return the whole dump)
#     try:
#         s = str(resp)
#         hits = re.findall(r"text='([^']+)'", s)
#         if hits:
#             return "\n".join(h.strip() for h in hits if h.strip())[:4000]
#     except Exception:
#         pass

#     return ""  # if absolutely nothing found


# # ---------------------------------------------------------------------
# # Main generation function
# # ---------------------------------------------------------------------
# def generate_responses_sync(
#     prompt: str, param_sets: List[Dict[str, Any]], model: str = DEFAULT_MODEL
# ) -> List[Dict[str, Any]]:
#     """Generate text responses for each parameter set using Gemini."""
#     c = _client()
#     results: List[Dict[str, Any]] = []

#     for p in param_sets:
#         user_text = p.get("prompt_override") or prompt

#         # Typed request shape (consistent across SDK versions)
#         contents = [gt.Content(role="user", parts=[gt.Part.from_text(user_text)])]

#         cfg = gt.GenerateContentConfig(
#             temperature=float(p.get("temperature", 0.7)),
#             top_p=float(p.get("top_p", 1.0)),
#             max_output_tokens=int(p.get("max_tokens", 256)),
#         )

#         n = int(p.get("n", 1))
#         for _ in range(n):
#             tries = 0
#             while True:
#                 tries += 1
#                 try:
#                     resp = c.models.generate_content(
#                         model=model, contents=contents, config=cfg
#                     )
#                     text = _extract_text(resp).strip()
#                     results.append({"param_set": p, "text": text})
#                     break
#                 except Exception as e:
#                     # Retry once for transient quota/network issues
#                     if tries == 1 and "quota" in str(e).lower():
#                         time.sleep(0.8)
#                         continue
#                     raise
#     return results





#*************************************************************




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
            max_output_tokens=int(p.get("max_tokens", 256)),
        )
        # n = int(p.get("n", 1))

        # for _i in range(n):
        tries = 0
        while True:
            tries += 1
            try:
                # Primary path: GenerativeModel (preferred)
                gm = genai.GenerativeModel(model_name=model, client=_client())
                resp = gm.generate_content(user_text, generation_config=cfg)
                text = (getattr(resp, "text", None) or _extract_text(resp)).strip()
                # Fallback path only if still empty (older odd SDKs)
                if not text:
                    cli = _client()
                    contents = [gt.Content(role="user", parts=[gt.Part.from_text(user_text)])]
                    resp2 = cli.models.generate_content(model=model, contents=contents, config=cfg)
                    text = _extract_text(resp2).strip()
                    results.append({"param_set": p, "text": text})
                    break
            except Exception as e:
                if tries == 1 and "quota" in str(e).lower():
                    time.sleep(0.8); continue
                raise
    return results
