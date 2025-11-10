# metrics.py
from typing import List, Dict, Any
import re
from collections import Counter
import textstat

def _tokenize(text: str) -> List[str]:
    return re.findall(r"[A-Za-z']+", text.lower())

def lexical_diversity(text: str) -> float:
    toks = _tokenize(text)
    return 0.0 if not toks else len(set(toks)) / len(toks)

def repetition_score(text: str, n: int = 3) -> float:
    toks = _tokenize(text)
    if len(toks) < n:
        return 0.0
    ngrams = [' '.join(toks[i:i+n]) for i in range(len(toks)-n+1)]
    counts = Counter(ngrams)
    repeated = sum(1 for v in counts.values() if v > 1)
    return repeated / max(1, len(ngrams))

def length_ok(text: str, min_w=30, max_w=220) -> float:
    l = len(_tokenize(text))
    if min_w <= l <= max_w:
        return 1.0
    if l < min_w:
        return max(0.0, l / min_w)
    return max(0.0, (max_w - (l - max_w)) / max_w)

def structure_score(text: str) -> float:
    score = 0.0
    if "\n\n" in text: score += 0.4
    if re.search(r"^\s*[-*]\s+", text, flags=re.M): score += 0.3
    if re.search(r"^\s*[A-Z].{0,80}:(\s|$)", text, flags=re.M): score += 0.3
    return min(1.0, score)

def keyword_coverage(prompt: str, text: str) -> float:
    p = set(t for t in _tokenize(prompt) if len(t) > 3)
    if not p:
        return 0.0
    t = set(_tokenize(text))
    covered = sum(1 for k in p if k in t)
    return covered / len(p)

def readability_score(text: str) -> float:
    try:
        fre = textstat.flesch_reading_ease(text)
    except Exception:
        fre = 50.0
    fre = max(-20.0, min(120.0, fre))
    return (fre + 20.0) / 140.0

def analyze_response(prompt: str, text: str) -> Dict[str, float]:
    ld = lexical_diversity(text)
    rep = repetition_score(text)
    ln = length_ok(text)
    st = structure_score(text)
    kw = keyword_coverage(prompt, text)
    rd = readability_score(text)
    agg = 0.2*ld + 0.15*(1-rep) + 0.2*ln + 0.15*st + 0.15*kw + 0.15*rd
    return {
        "lexical_diversity": round(ld, 4),
        "repetition": round(rep, 4),
        "length_ok": round(ln, 4),
        "structure": round(st, 4),
        "keyword_coverage": round(kw, 4),
        "readability": round(rd, 4),
        "aggregate_score": round(agg, 4),
    }

def analyze_response_batch(prompt: str, raw: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    out = []
    for r in raw:
        txt = r.get("text", "")
        out.append({**r, "metrics": analyze_response(prompt, txt)})
    return out


def _sentences(text: str) -> List[str]:
    # light splitter that handles common punctuation
    chunks = re.split(r'(?<=[.!?])\s+', text.strip())
    return [c for c in chunks if c]

def clarity_score(text: str) -> float:
    """
    Rates average sentence length in words. Ideal band ~12–24 words.
    Scores 1.0 in-band, tapers outside.
    """
    sents = _sentences(text)
    if not sents:
        return 0.0
    lengths = [len(_tokenize(s)) for s in sents if _tokenize(s)]
    if not lengths:
        return 0.0
    avg = sum(lengths) / len(lengths)
    lo, hi = 12.0, 24.0
    if lo <= avg <= hi:
        return 1.0
    # linear falloff up to +/- 24 words from the band edges
    if avg < lo:
        return max(0.0, 1.0 - (lo - avg) / 24.0)
    return max(0.0, 1.0 - (avg - hi) / 24.0)

def analyze_response(prompt: str, text: str) -> Dict[str, float]:
    ld = lexical_diversity(text)
    rep = repetition_score(text)
    ln = length_ok(text)
    st = structure_score(text)
    kw = keyword_coverage(prompt, text)
    rd = readability_score(text)
    cl = clarity_score(text)

    # reweight aggregate to include clarity
    agg = (
        0.18 * ld +
        0.12 * (1 - rep) +
        0.18 * ln +
        0.14 * st +
        0.14 * kw +
        0.12 * rd +
        0.12 * cl
    )

    return {
        "lexical_diversity": round(ld, 4),
        "repetition": round(rep, 4),
        "length_ok": round(ln, 4),
        "structure": round(st, 4),
        "keyword_coverage": round(kw, 4),
        "readability": round(rd, 4),
        "clarity_score": round(cl, 4),
        "aggregate_score": round(agg, 4),
    }