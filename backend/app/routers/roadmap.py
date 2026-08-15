from dataclasses import asdict
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import load_tasks_df
from app.services.scoring import score_occupation
from app.services.featherless_client import generate_roadmap

router = APIRouter()


class RoadmapRequest(BaseModel):
    soc_code: str
    student_skills: list[str]


@router.post("/roadmap")
def roadmap(req: RoadmapRequest):
    df = load_tasks_df()
    try:
        resilience = score_occupation(df, req.soc_code)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    resilience_summary = {
        "resilience_score": resilience.resilience_score,
        "at_risk_tasks": [asdict(t) for t in resilience.at_risk_tasks],
        "resilient_tasks": [asdict(t) for t in resilience.resilient_tasks],
    }
    result = generate_roadmap(resilience.occupation_title, resilience_summary, req.student_skills)
    return result
