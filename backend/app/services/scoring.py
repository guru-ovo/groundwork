"""
Groundwork — grounded exposure scoring.

This module deliberately contains ZERO LLM calls. Every number here comes
from a join between real data sources:
  - O*NET task importance/frequency ratings (public, CC BY 4.0)
  - Anthropic Economic Index automation/augmentation labels per task
  - Eloundou et al. (2023) task-level exposure (beta) scores

Keeping this pure-computation is a deliberate architecture choice, not a
limitation — it's what lets you tell a judge "this number is not a guess"
and mean it. The LLM only enters later, in roadmap.py, to explain and
personalize these already-grounded numbers.

economic_index_label -> numeric weight:
    "automation"   -> 1.0  (task is predominantly being automated end-to-end)
    "augmentation" -> 0.5  (task shows AI usage, but human stays in the loop)
    "none"         -> 0.0  (task shows minimal/no observed AI usage)

Composite task exposure = average of the Economic Index weight and the
Eloundou beta score, so a task only scores high if BOTH the observed-usage
data and the independent theoretical-capability measure agree.
"""

from dataclasses import dataclass
import pandas as pd

ECONOMIC_INDEX_WEIGHTS = {
    "automation": 1.0,
    "augmentation": 0.5,
    "none": 0.0,
}

# The Economic Index observes real Claude usage, and it does not cover every
# O*NET task — roughly one in six at the 2025-03-27 release. An unobserved
# task is labelled "unknown", which is emphatically NOT "none": "none" means
# usage was measured and was minimal, "unknown" means nothing was measured.
#
# Treating them the same would score 80% of the corpus as fully resilient on
# the observed-usage half of the composite, which is the single easiest way
# to make this product confidently wrong.
UNKNOWN_LABEL = "unknown"


@dataclass
class TaskScore:
    task_id: str
    task_description: str
    economic_index_label: str
    eloundou_beta: float
    composite_exposure: float  # 0-1, higher = more exposed
    onet_importance: float
    onet_frequency: float
    has_economic_index: bool  # False when only the Eloundou measure applies


@dataclass
class OccupationResilience:
    soc_code: str
    occupation_title: str
    aggregate_exposure: float  # 0-1, importance/frequency-weighted
    resilience_score: int  # 0-100, inverse of exposure, for display
    at_risk_tasks: list
    resilient_tasks: list
    all_tasks: list
    # Share of this occupation's tasks with real observed-usage data behind
    # them. Surfaced rather than hidden: a score built on 10% coverage
    # deserves less confidence than one built on 90%, and the reader is
    # entitled to know which they are looking at.
    economic_index_coverage: float


def score_tasks(tasks_df: pd.DataFrame) -> list[TaskScore]:
    """Compute a composite exposure score for every task row."""
    scores = []
    for _, row in tasks_df.iterrows():
        label = str(row["economic_index_label"]).lower()
        beta = float(row["eloundou_beta"])
        has_ei = label in ECONOMIC_INDEX_WEIGHTS

        if has_ei:
            # Both measures agree on a scale, so average them: a task scores
            # high only when observed usage and theoretical capability concur.
            composite = (ECONOMIC_INDEX_WEIGHTS[label] + beta) / 2.0
        else:
            # No observation exists. Fall back to the measure we do have
            # rather than averaging against a zero we cannot justify.
            composite = beta

        scores.append(
            TaskScore(
                task_id=row["task_id"],
                task_description=row["task_description"],
                economic_index_label=row["economic_index_label"],
                eloundou_beta=beta,
                composite_exposure=round(composite, 3),
                onet_importance=float(row["onet_importance"]),
                onet_frequency=float(row["onet_frequency"]),
                has_economic_index=has_ei,
            )
        )
    return scores


def aggregate_occupation(
    soc_code: str, occupation_title: str, task_scores: list[TaskScore]
) -> OccupationResilience:
    """
    Roll per-task scores up into one occupation-level picture, weighted by
    how important and how frequent each task actually is (O*NET ratings) —
    a rarely-performed task shouldn't skew the overall picture as much as
    a core daily one.
    """
    total_weight = sum(t.onet_importance * t.onet_frequency for t in task_scores)
    if total_weight == 0:
        weighted_exposure = 0.0
    else:
        weighted_exposure = sum(
            t.composite_exposure * t.onet_importance * t.onet_frequency
            for t in task_scores
        ) / total_weight

    resilience_score = round((1 - weighted_exposure) * 100)

    # simple split for the UI's at-risk / resilient buckets
    at_risk = sorted(
        [t for t in task_scores if t.composite_exposure >= 0.5],
        key=lambda t: t.composite_exposure,
        reverse=True,
    )
    resilient = sorted(
        [t for t in task_scores if t.composite_exposure < 0.5],
        key=lambda t: t.composite_exposure,
    )

    covered = sum(1 for t in task_scores if t.has_economic_index)

    return OccupationResilience(
        soc_code=soc_code,
        occupation_title=occupation_title,
        aggregate_exposure=round(weighted_exposure, 3),
        resilience_score=resilience_score,
        at_risk_tasks=at_risk,
        resilient_tasks=resilient,
        all_tasks=task_scores,
        economic_index_coverage=round(covered / len(task_scores), 3) if task_scores else 0.0,
    )


def score_occupation(tasks_df: pd.DataFrame, soc_code: str) -> OccupationResilience:
    """Convenience entrypoint: filter the joined table to one occupation and score it."""
    occ_df = tasks_df[tasks_df["soc_code"] == soc_code]
    if occ_df.empty:
        raise ValueError(f"No tasks found for SOC code {soc_code}")
    occupation_title = occ_df.iloc[0]["occupation_title"]
    task_scores = score_tasks(occ_df)
    return aggregate_occupation(soc_code, occupation_title, task_scores)
