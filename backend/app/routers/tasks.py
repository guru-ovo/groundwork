from dataclasses import asdict
from fastapi import APIRouter, HTTPException

from app.config import load_tasks_df
from app.services.scoring import score_occupation

router = APIRouter()


@router.get("/tasks/{soc_code}")
def get_resilience(soc_code: str):
    df = load_tasks_df()
    try:
        result = score_occupation(df, soc_code)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return {
        "soc_code": result.soc_code,
        "occupation_title": result.occupation_title,
        "resilience_score": result.resilience_score,
        "aggregate_exposure": result.aggregate_exposure,
        "at_risk_tasks": [asdict(t) for t in result.at_risk_tasks],
        "resilient_tasks": [asdict(t) for t in result.resilient_tasks],
    }
