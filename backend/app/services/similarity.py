"""
Occupation adjacency — which jobs are near which, and what separates them.

The career-path feature needs to answer "where could this person go next".
The honest version of that question is not "what job sounds similar" but
"what job is built from tasks they already do". This module answers the
second one, using only the joined task table.

Zero LLM calls, like scoring.py. The agent may *propose* a destination, but
the overlap percentage and the skill gap behind it are computed here, from
real task text. That distinction is the product.

Note on method: task IDs are unique per occupation in this dataset (T001…,
T101…, T201…), so two occupations never share a task ID even when they share
the work. Overlap therefore has to be computed from task *text*. TF-IDF
cosine over each occupation's pooled task descriptions does that in about
thirty lines, which is a better trade than adding scikit-learn to a free
instance for a single cosine.
"""

import math
import re
from collections import Counter

import pandas as pd

from app.services.scoring import score_occupation

# Words that appear in nearly every task statement and so distinguish
# nothing. IDF suppresses these anyway, but dropping them early keeps the
# vectors small and the debugging readable.
_STOPWORDS = {
    "a", "an", "and", "or", "the", "of", "for", "in", "on", "at", "to", "with",
    "by", "from", "as", "is", "are", "be", "that", "this", "such", "other",
    "using", "use", "used", "including", "into", "their", "them", "may",
}


def _tokens(text: str) -> list[str]:
    words = re.findall(r"[a-z]+", str(text).lower())
    return [
        w[:-1] if len(w) > 3 and w.endswith("s") else w
        for w in words
        if len(w) > 2 and w not in _STOPWORDS
    ]


def occupation_task_profiles(df: pd.DataFrame) -> dict[str, Counter]:
    """Pool every task description for an occupation into one term-frequency bag."""
    profiles: dict[str, Counter] = {}
    for soc_code, group in df.groupby("soc_code"):
        bag: Counter = Counter()
        for description in group["task_description"]:
            bag.update(_tokens(description))
        profiles[str(soc_code)] = bag
    return profiles


def _tfidf_vectors(profiles: dict[str, Counter]) -> dict[str, dict[str, float]]:
    """
    Convert term-frequency bags to L2-normalised TF-IDF vectors.

    IDF matters more than usual here: task statements across occupations share
    a lot of generic verbs ("develop", "analyze", "prepare"). Without IDF,
    every occupation looks similar to every other one.
    """
    n_docs = len(profiles)
    doc_freq: Counter = Counter()
    for bag in profiles.values():
        doc_freq.update(bag.keys())

    vectors: dict[str, dict[str, float]] = {}
    for soc_code, bag in profiles.items():
        total = sum(bag.values()) or 1
        vector: dict[str, float] = {}
        for term, count in bag.items():
            tf = count / total
            idf = math.log((1 + n_docs) / (1 + doc_freq[term])) + 1.0
            vector[term] = tf * idf
        norm = math.sqrt(sum(w * w for w in vector.values())) or 1.0
        vectors[soc_code] = {term: w / norm for term, w in vector.items()}
    return vectors


def _cosine(a: dict[str, float], b: dict[str, float]) -> float:
    # Iterate the smaller vector; these are sparse dicts, not dense arrays.
    if len(a) > len(b):
        a, b = b, a
    return sum(weight * b.get(term, 0.0) for term, weight in a.items())


_VECTOR_CACHE: dict[int, dict[str, dict[str, float]]] = {}


def _vectors_for(df: pd.DataFrame) -> dict[str, dict[str, float]]:
    """
    Build the TF-IDF vectors once per dataframe.

    At 878 occupations and 17,590 tasks, tokenising the whole corpus takes
    long enough that doing it per request is not viable — and the agent calls
    this several times in a single run. `load_tasks_df` is itself cached and
    returns the same object every time, so identity is a sound cache key; the
    cache is cleared rather than grown when that object changes.
    """
    key = id(df)
    cached = _VECTOR_CACHE.get(key)
    if cached is None:
        _VECTOR_CACHE.clear()
        cached = _tfidf_vectors(occupation_task_profiles(df))
        _VECTOR_CACHE[key] = cached
    return cached


def overlap_map(df: pd.DataFrame, soc_code: str) -> dict[str, float]:
    """
    Task-text overlap of every occupation against one, as percentages.

    Separate from find_adjacent_occupations because the caller usually wants
    overlaps for a handful of known occupations, and scoring all 878 to get
    them would be absurd.
    """
    vectors = _vectors_for(df)
    if soc_code not in vectors:
        raise ValueError(f"No tasks found for SOC code {soc_code}")
    source = vectors[soc_code]
    return {
        other: round(_cosine(source, vector) * 100, 1)
        for other, vector in vectors.items()
        if other != soc_code
    }


def find_adjacent_occupations(
    df: pd.DataFrame, soc_code: str, limit: int = 4
) -> list[dict]:
    """
    Occupations whose task profile most resembles this one.

    Returns each neighbour with its authoritative resilience score and the
    delta against the starting occupation, so the caller can immediately see
    which moves are actually upward. Sorted by overlap, not by delta — a
    high-resilience job you share nothing with is not a career path.
    """
    overlaps = overlap_map(df, soc_code)
    source_score = score_occupation(df, soc_code).resilience_score

    # Rank first, score second. score_occupation filters the full task table,
    # so scoring every candidate before ranking would mean 878 scans of
    # 17,590 rows to return four results.
    ranked = sorted(
        ((code, pct) for code, pct in overlaps.items() if pct > 0),
        key=lambda pair: pair[1],
        reverse=True,
    )[:limit]

    neighbours = []
    for other_code, overlap_pct in ranked:
        other = score_occupation(df, other_code)
        neighbours.append(
            {
                "soc_code": other_code,
                "title": other.occupation_title,
                "overlap_pct": overlap_pct,
                "resilience_score": other.resilience_score,
                "resilience_delta": other.resilience_score - source_score,
            }
        )
    return neighbours


def compare_occupations(df: pd.DataFrame, soc_a: str, soc_b: str) -> dict:
    """
    What moving from A to B would actually require.

    The gap is expressed as concrete tasks from B that A does not already do,
    ranked by how resilient they are — because the point of the move is to
    land on work that is holding steady, not merely different work.
    """
    a = score_occupation(df, soc_a)
    b = score_occupation(df, soc_b)

    a_terms: set[str] = set()
    for task in a.all_tasks:
        a_terms.update(_tokens(task.task_description))

    gap_tasks = []
    shared_tasks = []
    for task in b.all_tasks:
        terms = set(_tokens(task.task_description))
        if not terms:
            continue
        familiarity = len(terms & a_terms) / len(terms)
        row = {
            "task_id": task.task_id,
            "task_description": task.task_description,
            "economic_index_label": task.economic_index_label,
            "eloundou_beta": task.eloundou_beta,
            "composite_exposure": task.composite_exposure,
            "familiarity": round(familiarity, 2),
        }
        # Below half the vocabulary in common, this is work you don't yet do.
        (shared_tasks if familiarity >= 0.5 else gap_tasks).append(row)

    gap_tasks.sort(key=lambda t: t["composite_exposure"])

    return {
        "from": {"soc_code": soc_a, "title": a.occupation_title,
                 "resilience_score": a.resilience_score},
        "to": {"soc_code": soc_b, "title": b.occupation_title,
               "resilience_score": b.resilience_score},
        "resilience_delta": b.resilience_score - a.resilience_score,
        "shared_tasks": shared_tasks,
        "gap_tasks": gap_tasks,
    }
