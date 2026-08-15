import json
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.config import load_tasks_df
from app.services.career_agent import run_career_agent
from app.services.similarity import compare_occupations, find_adjacent_occupations

logger = logging.getLogger("groundwork")

router = APIRouter()


class CareerPlanRequest(BaseModel):
    soc_code: str
    skills: list[str] = []
    goal: str | None = None


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

    def events():
        yield _sse({"type": "start", "soc_code": req.soc_code})
        try:
            for event in run_career_agent(df, req.soc_code, req.skills, req.goal):
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
