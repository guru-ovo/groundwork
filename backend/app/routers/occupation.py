import logging

from fastapi import APIRouter
from pydantic import BaseModel

from app.config import load_occupation_list
from app.services.featherless_client import resolve_occupation
from app.services.matching import match_occupations

logger = logging.getLogger("groundwork")

router = APIRouter()

# Wide enough that the right answer is almost always inside it, small enough
# that the prompt stays cheap.
SHORTLIST_SIZE = 30


class ResolveRequest(BaseModel):
    title: str


@router.post("/resolve-occupation")
def resolve(req: ResolveRequest):
    """
    Map a free-text job title to candidate SOC codes.

    Tries the LLM first, since it handles phrasing no string matcher will
    ("I crunch numbers for a bank"). Falls back to deterministic matching on
    any failure — every stage after this one is pure computation, so an
    LLM outage should cost eloquence, not availability.
    """
    candidates = load_occupation_list()

    # The dataset is 878 occupations. Sending every title to the model would
    # be ~10k tokens of prompt per search, for a question that is mostly
    # string matching. Shortlist deterministically first, then let the model
    # do the part it is actually good at: telling which of 30 plausible
    # titles matches what the person meant.
    shortlist = match_occupations(req.title, candidates, limit=SHORTLIST_SIZE)["matches"]
    shortlisted = [{"soc_code": m["soc_code"], "title": m["title"]} for m in shortlist]

    try:
        result = resolve_occupation(req.title, shortlisted)
        matches = result.get("matches") or []
        if matches:
            # Guard against a model inventing a SOC code that isn't ours.
            valid_codes = {c["soc_code"] for c in candidates}
            matches = [m for m in matches if m.get("soc_code") in valid_codes]
        if matches:
            return {"matches": matches, "matched_by": "llm"}
        logger.warning("Stage 0 returned no usable matches; using fallback matcher")
    except Exception:
        logger.exception("Stage 0 LLM failed; using fallback matcher")

    return match_occupations(req.title, candidates)
