"""
Reading what the questionnaire answers actually mean.

The questionnaire collects structured answers plus free text. Structured
answers are usable as-is; free text is not — "I'm sick of building the same
dashboards every week" carries a real constraint that no radio button
captured.

This module runs one cheap LLM call over the whole answer set and returns a
structured reading of it: what the person is actually asking for, which
strengths they implied without listing, and what would make a plan wrong for
them. That reading is then fed to the career agent as context.

Note what this does NOT do: it never scores anything, never names an
occupation, and never touches the exposure data. It interprets the human's
own words back into structure. Every number in the final plan still comes
from scoring.py. If this call fails, planning continues without it — the
structured answers alone are enough.
"""

import json
import logging

from app.services.featherless_client import chat_json, SMALL_MODEL, STRONG_MODEL

logger = logging.getLogger("groundwork")

# gpt-oss models reason before they answer, and the reasoning is billed
# against the same budget as the reply. At 700 the whole allowance was being
# spent thinking, and the call returned finish_reason=length with zero
# content characters — which reads like a broken model rather than a cap set
# too low. The reading itself is a few hundred tokens; the headroom is for
# the reasoning in front of it.
ANALYSIS_MAX_TOKENS = 2000

# O*NET's Work Importance Locator scores six work values. Using the same
# framework as the task data keeps the whole product citable to one source.
WORK_VALUES = {
    "achievement": "Achievement — using your abilities, seeing results",
    "independence": "Independence — deciding how you work, on your own",
    "recognition": "Recognition — advancement, status, being seen to lead",
    "relationships": "Relationships — colleagues, service, no conflict with values",
    "support": "Support — a manager and organisation that back you up",
    "conditions": "Working conditions — security, pay, comfort, variety",
}

SYSTEM_PROMPT = """You read a person's career questionnaire and restate it as structure.

You do NOT give advice, name occupations, score anything, or predict outcomes.
You restate what they told you, and make explicit what was implicit.

Return ONLY this JSON:
{"reading": "<2 sentences, second person, what they are actually asking for>",
 "implied_strengths": ["<capability their answers imply but they did not list>"],
 "hard_constraints": ["<something a plan must not violate, in plain words>"],
 "watch_outs": ["<a way a generic plan would fail this specific person>"]}

Rules:
- 1-3 items per list. Fewer is better than padded.
- implied_strengths must not repeat anything already in their listed skills.
- hard_constraints must be grounded in what they actually said — time budget,
  money budget, stated direction, free text. Never invent one.
- Plain language. No jargon, no hype, no exclamation marks."""


def analyse_answers(
    occupation_title: str,
    skills: list[str],
    weekly_hours: float | None,
    budget: str | None,
    goal_type: str | None,
    goal_note: str | None,
    work_values: list[str] | None = None,
) -> dict | None:
    """
    Interpret the questionnaire. Returns None if the model is unavailable —
    callers must treat the reading as an enhancement, never a requirement.
    """
    payload = {
        "current_occupation": occupation_title,
        "skills_they_listed": skills,
        "hours_per_week_available": weekly_hours,
        "budget": budget,
        "stated_direction": goal_type,
        "their_own_words": goal_note or "",
        "work_values_chosen": [WORK_VALUES.get(v, v) for v in (work_values or [])],
    }

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": json.dumps(payload)},
    ]

    # Try the cheap model first, then the strong one. Not every model in
    # Featherless's catalogue honours response_format, and this reading is
    # the first thing the user sees — worth a second attempt at ~$0.0005
    # before giving up on it.
    result = None
    for model in (SMALL_MODEL, STRONG_MODEL):
        if not model:
            continue
        try:
            result = chat_json(messages, model=model, max_tokens=ANALYSIS_MAX_TOKENS)
            break
        except Exception as exc:
            logger.warning("Answer analysis failed on %s: %s", model, str(exc)[:200])

    if result is None:
        logger.warning("Answer analysis unavailable; continuing without it")
        return None

    def clean_list(key: str) -> list[str]:
        value = result.get(key) or []
        if not isinstance(value, list):
            return []
        return [str(item)[:200] for item in value[:3] if str(item).strip()]

    return {
        "reading": str(result.get("reading", ""))[:500],
        "implied_strengths": clean_list("implied_strengths"),
        "hard_constraints": clean_list("hard_constraints"),
        "watch_outs": clean_list("watch_outs"),
    }
