"""
RIASEC interest matching — would this person actually want the job.

Everything else in Groundwork answers a capability question. Task overlap
says "you already do most of this work"; exposure says "this work is
changing". Neither says whether a person would tolerate the job for a
decade, and a career path someone abandons in six months is not a career
path.

O*NET publishes Holland/RIASEC occupational interest profiles for every
occupation on a 1-7 scale, so this stays inside the project's rule: the
match is computed from published measurements, not inferred by a model.

Six dimensions: realistic, investigative, artistic, social, enterprising,
conventional.
"""

import logging
import math
from functools import lru_cache

import pandas as pd

from app.config import DATA_DIR

logger = logging.getLogger("groundwork")

RIASEC_CSV = DATA_DIR / "riasec.csv"

DIMENSIONS = [
    "realistic",
    "investigative",
    "artistic",
    "social",
    "enterprising",
    "conventional",
]

# Plain-language prompts for the questionnaire. Deliberately about activities
# rather than identities: "I like figuring out why something broke" is a
# question people can answer honestly, where "I am an investigative person"
# invites them to answer as who they would like to be.
DIMENSION_PROMPTS = {
    "realistic": "Working with your hands, tools, machines, or outdoors",
    "investigative": "Figuring out why something works the way it does",
    "artistic": "Making something original, where there is no single right answer",
    "social": "Teaching, advising, or helping people directly",
    "enterprising": "Persuading people, leading a push, taking a risk on an idea",
    "conventional": "Bringing order to something messy, with clear rules and accuracy",
}


@lru_cache(maxsize=1)
def load_interests() -> pd.DataFrame | None:
    """RIASEC profiles per occupation, or None if the file is absent."""
    if not RIASEC_CSV.exists():
        logger.warning("riasec.csv not found; interest matching disabled")
        return None
    df = pd.read_csv(RIASEC_CSV, dtype={"soc_code": str})
    return df.set_index("soc_code")


def occupation_profile(soc_code: str) -> dict[str, float] | None:
    df = load_interests()
    if df is None or soc_code not in df.index:
        return None
    row = df.loc[soc_code]
    return {d: float(row[d]) for d in DIMENSIONS}


def _centred(vector: dict[str, float]) -> dict[str, float]:
    """
    Subtract the profile's own mean before comparing.

    Without this, matching is dominated by how enthusiastic a respondent is
    in general: someone who rates everything 6 looks like a strong match for
    every occupation, and someone who rates everything 2 matches nothing.
    Centring compares *shape* — which interests stand out relative to the
    rest — which is the thing RIASEC actually measures.
    """
    mean = sum(vector.values()) / len(vector)
    return {k: v - mean for k, v in vector.items()}


def interest_fit(user: dict[str, float], soc_code: str) -> float | None:
    """
    Correlation between a person's interest shape and an occupation's, 0-100.

    Returns None when the occupation has no published profile, so callers can
    omit the number rather than print a fabricated one.
    """
    occupation = occupation_profile(soc_code)
    if occupation is None or not user:
        return None

    a = _centred({d: float(user.get(d, 0.0)) for d in DIMENSIONS})
    b = _centred(occupation)

    numerator = sum(a[d] * b[d] for d in DIMENSIONS)
    norm_a = math.sqrt(sum(v * v for v in a.values()))
    norm_b = math.sqrt(sum(v * v for v in b.values()))
    if norm_a == 0 or norm_b == 0:
        return None

    correlation = numerator / (norm_a * norm_b)  # -1 … 1
    # Rescale to 0-100. A negative correlation is a real signal — it means
    # the person's interests run opposite to the job — and collapsing it to
    # zero would hide exactly the mismatches worth seeing.
    return round((correlation + 1) / 2 * 100, 1)


def rank_by_interest(user: dict[str, float], soc_codes: list[str]) -> list[dict]:
    """Score a set of occupations by interest fit, best first."""
    scored = []
    for code in soc_codes:
        fit = interest_fit(user, code)
        if fit is not None:
            scored.append({"soc_code": code, "interest_fit": fit})
    scored.sort(key=lambda item: item["interest_fit"], reverse=True)
    return scored


def top_dimensions(vector: dict[str, float], n: int = 3) -> list[str]:
    """The dimensions that stand out in a profile, strongest first."""
    centred = _centred({d: float(vector.get(d, 0.0)) for d in DIMENSIONS})
    return [d for d, _ in sorted(centred.items(), key=lambda kv: kv[1], reverse=True)[:n]]
