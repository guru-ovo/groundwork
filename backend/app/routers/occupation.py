from fastapi import APIRouter
from pydantic import BaseModel

from app.config import load_occupation_list
from app.services.featherless_client import resolve_occupation

router = APIRouter()


class ResolveRequest(BaseModel):
    title: str


@router.post("/resolve-occupation")
def resolve(req: ResolveRequest):
    candidates = load_occupation_list()
    result = resolve_occupation(req.title, candidates)
    return result
