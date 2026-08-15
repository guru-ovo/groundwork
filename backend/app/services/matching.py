"""
Deterministic occupation matching — the floor under Stage 0.

Stage 0 uses a small LLM to map a free-text job title onto a SOC code. That
call can fail for reasons that have nothing to do with the user: a gated
model, an expired key, a provider outage. When it does, the entire product
is unreachable, because every downstream stage needs a SOC code.

This module is the fallback. It contains no LLM call and no network I/O, so
it cannot fail for any of those reasons. The scoring pipeline it feeds is
already pure computation, which means Groundwork can answer the question
"what is changing in my field" with the LLM completely unavailable — the
answer is just less eloquently phrased.
"""

import re
from collections import Counter

# Words that carry no signal about *which* occupation is meant. Matching on
# them makes "senior data analyst" look like every other "senior" role.
_STOPWORDS = {
    "a", "an", "and", "the", "of", "for", "in", "at", "to",
    "junior", "senior", "lead", "principal", "staff", "entry", "level",
    "assistant", "associate", "intern", "trainee", "graduate",
    "i", "ii", "iii", "iv", "jr", "sr",
}

# Occupation titles are formal ("Data Scientists"); what people type is not
# ("data sci", "ds intern"). A few hand-written equivalences buy far more
# accuracy here than any cleverness, because the candidate list is small.
_SYNONYMS = {
    "ds": "data scientist",
    "da": "data analyst",
    "swe": "software developer",
    "dev": "developer",
    "eng": "engineer",
    "sci": "scientist",
    "ml": "machine learning",
    "ai": "artificial intelligence",
    "acct": "accountant",
    "analytics": "analyst",
    "programmer": "software developer",
    "coder": "software developer",
    "accounting": "accountant",
    "auditing": "auditor",
}


def _tokenize(text: str) -> list[str]:
    words = re.findall(r"[a-z]+", str(text).lower())
    expanded: list[str] = []
    for word in words:
        expanded.extend(_SYNONYMS.get(word, word).split())
    # Singularise crudely: "Data Scientists" must match "data scientist".
    return [w[:-1] if len(w) > 3 and w.endswith("s") else w for w in expanded]


def _content_tokens(text: str) -> list[str]:
    return [t for t in _tokenize(text) if t not in _STOPWORDS]


def _similarity(query_tokens: list[str], title_tokens: list[str]) -> float:
    """
    Weighted overlap, asymmetric on purpose.

    A typed title is short, so recall against the *query* matters more than
    against the candidate: "data analyst" should match "Data Scientists"
    strongly even though the candidate has words the query lacks. Plain
    Jaccard punishes exactly that case.
    """
    if not query_tokens or not title_tokens:
        return 0.0

    query_counts = Counter(query_tokens)
    title_set = set(title_tokens)
    matched = sum(count for token, count in query_counts.items() if token in title_set)
    coverage = matched / sum(query_counts.values())

    # Small bonus when the candidate is also well covered, so an exact match
    # outranks a partial one that happens to cover the query.
    reverse = len(title_set & set(query_tokens)) / len(title_set)
    return round(coverage * 0.75 + reverse * 0.25, 4)


def _confidence(score: float) -> str:
    if score >= 0.6:
        return "high"
    if score >= 0.3:
        return "medium"
    return "low"


def match_occupations(free_text_title: str, candidates: list[dict], limit: int = 3) -> dict:
    """
    Rank candidate occupations against a typed title.

    Mirrors the shape returned by featherless_client.resolve_occupation()
    exactly — {"matches": [{"soc_code", "title", "confidence"}]} — so the
    router can substitute one for the other without the frontend noticing.
    """
    query_tokens = _content_tokens(free_text_title)

    scored = []
    for candidate in candidates:
        score = _similarity(query_tokens, _content_tokens(candidate["title"]))
        if score > 0:
            scored.append((score, candidate))

    scored.sort(key=lambda pair: pair[0], reverse=True)

    # Nothing matched at all — return the full list rather than an empty
    # result. A user staring at three clickable occupations can still reach
    # the grounded data; a user staring at "no matches" cannot.
    if not scored:
        return {
            "matches": [
                {"soc_code": c["soc_code"], "title": c["title"], "confidence": "low"}
                for c in candidates[:limit]
            ],
            "matched_by": "fallback",
        }

    return {
        "matches": [
            {
                "soc_code": candidate["soc_code"],
                "title": candidate["title"],
                "confidence": _confidence(score),
            }
            for score, candidate in scored[:limit]
        ],
        "matched_by": "fallback",
    }
