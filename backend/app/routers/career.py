import json
import logging
from typing import Literal

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.config import load_tasks_df
from app.services.career_agent import run_career_agent
from app.services.profile_analysis import analyse_answers
from app.services.interests import DIMENSION_PROMPTS, DIMENSIONS, interest_fit
from app.services.similarity import compare_occupations, find_adjacent_occupations

logger = logging.getLogger("groundwork")

router = APIRouter()


class CareerPlanRequest(BaseModel):
    """
    The questionnaire's answers.

    Everything past soc_code is optional, so the endpoint stays compatible
    with the simpler body that is already deployed.
    """

    soc_code: str
    skills: list[str] = []
    goal: str | None = None
    goal_type: Literal["adapt", "move", "change"] | None = None
    weekly_hours: float | None = Field(default=None, ge=0, le=80)
    budget: Literal["free", "low", "open"] | None = None
    work_values: list[str] = []
    # RIASEC self-ratings, 1-7 per dimension. Optional: without them the agent
    # simply loses the interest tool.
    interests: dict[str, float] = {}


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event)}\n\n"


@router.post("/career-plan/stream")
def career_plan_stream(req: CareerPlanRequest):
    """
    Stream the agent's reasoning, then its plan.

    The run takes 15-25 seconds because each step is a real model call over
    real tool output. Streaming rather than blocking is not decoration: it
    lets the interface show *what the agent is actually doing* — which
    occupations it looked at, which comparison it made — which is the only
    honest way to show that the plan came from the data rather than from the
    model's imagination.
    """
    df = load_tasks_df()

    if req.soc_code not in set(df["soc_code"].astype(str)):
        raise HTTPException(status_code=404, detail=f"Unknown SOC code {req.soc_code}")

    occupation_title = str(
        df.loc[df["soc_code"] == req.soc_code, "occupation_title"].iloc[0]
    )

    def events():
        yield _sse({"type": "start", "soc_code": req.soc_code})

        # Read the answers back as structure before planning. This is an
        # enhancement, never a requirement: if it returns nothing, the agent
        # still has every structured answer.
        yield _sse({"type": "phase", "label": "Reading your answers"})
        reading = analyse_answers(
            occupation_title=occupation_title,
            skills=req.skills,
            weekly_hours=req.weekly_hours,
            budget=req.budget,
            goal_type=req.goal_type,
            goal_note=req.goal,
            work_values=req.work_values,
        )
        if reading:
            yield _sse({"type": "analysis", "reading": reading})

        profile = {
            "goal_type": req.goal_type,
            "weekly_hours": req.weekly_hours,
            "budget": req.budget,
            "work_values": req.work_values or None,
            "interests": req.interests or None,
            "answer_reading": reading,
        }

        yield _sse({"type": "phase", "label": "Checking the data"})
        try:
            for event in run_career_agent(
                df, req.soc_code, req.skills, req.goal, profile
            ):
                yield _sse(event)
        except Exception as exc:
            logger.exception("Career agent stream failed")
            yield _sse({"type": "error", "message": str(exc)[:200]})
        yield _sse({"type": "done"})

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            # Render and most reverse proxies buffer responses by default,
            # which would hold every event until the run finished and defeat
            # the entire point of streaming.
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/adjacent/{soc_code}")
def adjacent(soc_code: str, limit: int = 4):
    """Occupation adjacency without the agent — pure computation, instant."""
    df = load_tasks_df()
    try:
        return {"neighbours": find_adjacent_occupations(df, soc_code, limit=limit)}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/compare/{soc_a}/{soc_b}")
def compare(soc_a: str, soc_b: str):
    """The task-level gap between two occupations."""
    df = load_tasks_df()
    try:
        return compare_occupations(df, soc_a, soc_b)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/interests/questions")
def interest_questions():
    """
    The six RIASEC prompts, served from the same constant the scorer uses.

    Keeping the questionnaire and the matcher on one source means a renamed
    dimension cannot silently stop matching.
    """
    return {
        "scale": {"min": 1, "max": 7,
                  "min_label": "Not for me", "max_label": "Very much me"},
        "dimensions": [
            {"key": d, "prompt": DIMENSION_PROMPTS[d]} for d in DIMENSIONS
        ],
    }
