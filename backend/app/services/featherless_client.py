"""
Thin wrapper around Featherless.ai's OpenAI-compatible /v1/chat/completions
endpoint. Two entrypoints matching the two places an LLM actually belongs
in this pipeline:

  - resolve_occupation(): cheap/small model, Stage 0 (title -> SOC code)
  - generate_roadmap():   strong model, Stage 4 (grounded synthesis)

NOTE: confirm the exact model identifier strings in your Featherless
dashboard before the hackathon build — the ones in .env.example are
placeholders for "a small instruction-tuned model" and "a top-tier open
model," swap in whatever slugs Featherless actually lists for those tiers.
"""

import os
import json
import requests
from dotenv import load_dotenv

load_dotenv()

def _env(name: str, default: str | None = None) -> str | None:
    """Trailing whitespace in a dashboard textarea is invisible and rides into
    the Authorization header, where it reads as a malformed token. Strip it."""
    value = os.getenv(name, default)
    return value.strip() if isinstance(value, str) else value


FEATHERLESS_API_KEY = _env("FEATHERLESS_API_KEY")
FEATHERLESS_BASE_URL = _env("FEATHERLESS_BASE_URL", "https://api.featherless.ai/v1").rstrip("/")
SMALL_MODEL = _env("FEATHERLESS_SMALL_MODEL")
STRONG_MODEL = _env("FEATHERLESS_STRONG_MODEL")


def chat_json(
    messages: list[dict],
    model: str | None = None,
    temperature: float = 0.2,
    timeout: int = 45,
    max_tokens: int = 2500,
) -> dict:
    """
    One JSON-mode completion over a full message list.

    The agent loop needs to carry accumulated tool observations forward, so
    it can't use the fixed system+user shape below. Everything else — the
    missing-key guard, keeping the error body — is shared.

    max_tokens is set explicitly and generously: a full three-phase plan runs
    well past the provider's default cap, and JSON mode truncated mid-object
    fails as a parse error that looks nothing like "the response was cut off".
    """
    model = model or STRONG_MODEL
    _require(model)

    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "response_format": {"type": "json_object"},
    }
    resp = requests.post(
        f"{FEATHERLESS_BASE_URL}/chat/completions",
        headers={
            "Authorization": f"Bearer {FEATHERLESS_API_KEY}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=timeout,
    )
    if not resp.ok:
        raise RuntimeError(
            f"Featherless {resp.status_code} for model={model}: {resp.text[:500]}"
        )

    body = resp.json()
    content = body["choices"][0]["message"]["content"]
    try:
        return _first_json_object(content)
    except ValueError as exc:
        finish = body["choices"][0].get("finish_reason")
        raise ValueError(
            f"Model returned unparseable JSON (finish_reason={finish}, "
            f"{len(content)} chars): {exc}"
        ) from exc


def _first_json_object(content: str) -> dict:
    """
    Take the first complete JSON object out of a completion.

    JSON mode is not a guarantee of *exactly one* object. Reasoning-style
    models routinely emit their working alongside the answer, or follow a
    valid object with a second one, and plain json.loads() rejects the whole
    response with "Extra data" — throwing away a perfectly good first object.
    raw_decode stops at the end of the first value instead.
    """
    text = content.strip()
    start = text.find("{")
    if start == -1:
        raise ValueError("no JSON object in response")

    decoder = json.JSONDecoder()
    try:
        value, _ = decoder.raw_decode(text[start:])
    except json.JSONDecodeError as exc:
        raise ValueError(str(exc)) from exc

    if not isinstance(value, dict):
        raise ValueError(f"expected an object, got {type(value).__name__}")
    return value


def _require(model: str | None) -> None:
    if not FEATHERLESS_API_KEY:
        raise RuntimeError("FEATHERLESS_API_KEY is not set")
    if not model:
        raise RuntimeError(
            "No model configured — check FEATHERLESS_SMALL_MODEL / FEATHERLESS_STRONG_MODEL"
        )


def _chat_completion(model: str, system_prompt: str, user_prompt: str, json_mode: bool = True) -> dict:
    headers = {
        "Authorization": f"Bearer {FEATHERLESS_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.2,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    if not FEATHERLESS_API_KEY:
        raise RuntimeError("FEATHERLESS_API_KEY is not set")
    if not model:
        raise RuntimeError(
            "No model configured — check FEATHERLESS_SMALL_MODEL / FEATHERLESS_STRONG_MODEL"
        )

    resp = requests.post(
        f"{FEATHERLESS_BASE_URL}/chat/completions", headers=headers, json=payload, timeout=30
    )
    # raise_for_status() drops the response body, which is exactly where
    # Featherless puts the reason (unknown model, bad key, unsupported
    # response_format). Keep it — it's the difference between a debuggable
    # log line and "500".
    if not resp.ok:
        raise RuntimeError(
            f"Featherless {resp.status_code} for model={model}: {resp.text[:500]}"
        )
    content = resp.json()["choices"][0]["message"]["content"]
    return json.loads(content)


def resolve_occupation(free_text_title: str, candidate_occupations: list[dict]) -> dict:
    """
    candidate_occupations: [{"soc_code": "...", "title": "..."}, ...]
    Returns: {"matches": [{"soc_code": "...", "title": "...", "confidence": "..."}]}
    """
    system_prompt = (
        "You match a free-text job title to the closest official occupation "
        "codes from a fixed candidate list. Return ONLY JSON: "
        '{"matches": [{"soc_code": "...", "title": "...", "confidence": "high|medium|low"}]}. '
        "Return up to 3 matches, best first. Never invent a soc_code not in the candidate list."
    )
    user_prompt = json.dumps(
        {"input_title": free_text_title, "candidates": candidate_occupations}
    )
    return _chat_completion(SMALL_MODEL, system_prompt, user_prompt)


def generate_roadmap(occupation_title: str, resilience_summary: dict, student_skills: list[str]) -> dict:
    """
    resilience_summary: the dict form of an OccupationResilience (see scoring.py)
    Returns: {"roadmap": [{"action": "...", "reason": "...", "data_source": "..."}]}
    """
    system_prompt = (
        "You are Groundwork's roadmap generator. You ONLY use the grounded exposure "
        "data provided — you never invent a risk level for a task. For every "
        "recommendation, cite the specific data point (economic_index_label or "
        "eloundou_beta) that justifies it. Return ONLY JSON: "
        '{"roadmap": [{"action": "...", "reason": "...", "data_source": "..."}]}. '
        "Return 3-5 ranked items, most impactful first."
    )
    user_prompt = json.dumps(
        {
            "occupation": occupation_title,
            "resilience_summary": resilience_summary,
            "student_skills": student_skills,
        }
    )
    return _chat_completion(STRONG_MODEL, system_prompt, user_prompt)
