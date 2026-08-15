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


@dataclass
class TaskScore:
    task_id: str
    task_description: str
    economic_index_label: str
    eloundou_beta: float
    composite_exposure: float  # 0-1, higher = more exposed
    onet_importance: float
    onet_frequency: float


@dataclass
class OccupationResilience:
    soc_code: str
    occupation_title: str
    aggregate_exposure: float  # 0-1, importance/frequency-weighted
    resilience_score: int  # 0-100, inverse of exposure, for display
    at_risk_tasks: list
    resilient_tasks: list
    all_tasks: list


def score_tasks(tasks_df: pd.DataFrame) -> list[TaskScore]:
    """Compute a composite exposure score for every task row."""
    scores = []
    for _, row in tasks_df.iterrows():
        econ_weight = ECONOMIC_INDEX_WEIGHTS.get(
            str(row["economic_index_label"]).lower(), 0.0
        )
        composite = (econ_weight + float(row["eloundou_beta"])) / 2.0
        scores.append(
            TaskScore(
                task_id=row["task_id"],
                task_description=row["task_description"],
                economic_index_label=row["economic_index_label"],
                eloundou_beta=float(row["eloundou_beta"]),
                composite_exposure=round(composite, 3),
                onet_importance=float(row["onet_importance"]),
                onet_frequency=float(row["onet_frequency"]),
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

    return OccupationResilience(
        soc_code=soc_code,
        occupation_title=occupation_title,
        aggregate_exposure=round(weighted_exposure, 3),
        resilience_score=resilience_score,
        at_risk_tasks=at_risk,
        resilient_tasks=resilient,
        all_tasks=task_scores,
    )


def score_occupation(tasks_df: pd.DataFrame, soc_code: str) -> OccupationResilience:
    """Convenience entrypoint: filter the joined table to one occupation and score it."""
    occ_df = tasks_df[tasks_df["soc_code"] == soc_code]
    if occ_df.empty:
        raise ValueError(f"No tasks found for SOC code {soc_code}")
    occupation_title = occ_df.iloc[0]["occupation_title"]
    task_scores = score_tasks(occ_df)
    return aggregate_occupation(soc_code, occupation_title, task_scores)
