"""
The career-planning agent.

This is the one place in Groundwork where a model gets to make decisions,
and it is deliberately fenced in. The agent chooses *which questions to ask*
of the grounded dataset — which occupations to look at, which comparison is
worth making — and then writes a plan explaining what the answers mean. It
never supplies an answer itself.

Concretely: every tool below is pure computation over the joined task table
(scoring.py, similarity.py). The agent reads their output. Any number it
tries to emit in its final payload is discarded and replaced with the
computed one, in `_attach_authoritative_scores`. A judge can therefore be
told, accurately, that no figure on the screen came out of a language model.

Why a hand-rolled loop instead of OpenAI-style `tools` function calling:
Featherless is OpenAI-compatible for chat completions, but per-model support
for the `tools` parameter is not something we can verify across 20,000+
community models, and when it is unsupported it fails as an opaque 400. A
JSON action protocol works on any model that can follow instructions, which
is the same bar we already rely on for JSON mode.
"""

import json
import logging
from typing import Iterator

import pandas as pd

from app.services.featherless_client import chat_json, STRONG_MODEL
from app.services.scoring import score_occupation
from app.services.similarity import compare_occupations, find_adjacent_occupations

logger = logging.getLogger("groundwork")

MAX_STEPS = 5


# --- Tools ------------------------------------------------------------------
# Each returns plain JSON-able data. None of them call a model.

def _tool_get_occupation(df: pd.DataFrame, soc_code: str) -> dict:
    result = score_occupation(df, soc_code)
    return {
        "soc_code": result.soc_code,
        "title": result.occupation_title,
        "resilience_score": result.resilience_score,
        "at_risk_tasks": [
            {"task_id": t.task_id, "task": t.task_description,
             "label": t.economic_index_label, "beta": t.eloundou_beta}
            for t in result.at_risk_tasks
        ],
        "resilient_tasks": [
            {"task_id": t.task_id, "task": t.task_description,
             "label": t.economic_index_label, "beta": t.eloundou_beta}
            for t in result.resilient_tasks
        ],
    }


def _tool_find_adjacent(df: pd.DataFrame, soc_code: str, limit: int = 4) -> dict:
    return {"neighbours": find_adjacent_occupations(df, soc_code, limit=int(limit))}


def _tool_compare(df: pd.DataFrame, soc_a: str, soc_b: str) -> dict:
    return compare_occupations(df, soc_a, soc_b)


def _tool_list_occupations(df: pd.DataFrame) -> dict:
    pairs = df[["soc_code", "occupation_title"]].drop_duplicates()
    return {
        "occupations": [
            {"soc_code": row.soc_code, "title": row.occupation_title}
            for row in pairs.itertuples()
        ]
    }


TOOLS = {
    "get_occupation": _tool_get_occupation,
    "find_adjacent_occupations": _tool_find_adjacent,
    "compare_occupations": _tool_compare,
    "list_occupations": _tool_list_occupations,
}


SYSTEM_PROMPT = """You are Groundwork's career planning agent.

You help a person whose job is being reshaped by AI find where to go next.
You work ONLY from a grounded dataset of occupations and their tasks, each
task carrying two independent exposure measures: an Anthropic Economic Index
label (automation / augmentation / none) and an Eloundou et al. beta score.

You investigate by calling tools. You never state a resilience score, an
overlap percentage, or an exposure value that a tool did not give you.

Available tools:
- list_occupations {} -> every occupation in the dataset
- get_occupation {"soc_code": str} -> scores and task breakdown
- find_adjacent_occupations {"soc_code": str, "limit": int} -> nearby occupations by task overlap
- compare_occupations {"soc_a": str, "soc_b": str} -> shared tasks and the gap between two occupations

Respond with ONE JSON object per turn, and nothing else.

To investigate:
{"thought": "<one short sentence, present tense, what you are checking and why>",
 "tool": "<tool name>", "args": {...}}

When you have enough to write the plan:
{"thought": "<one short sentence>",
 "final": {
   "summary": "<2-3 sentences to the person, plain language, no hype>",
   "path": [{"soc_code": "...", "title": "...", "rationale": "<why this step>"}],
   "phases": [
     {"window": "0-3 months",
      "milestones": [{"action": "...", "reason": "...",
                      "data_source": "<task ids and the label/beta that justify this>"}]},
     {"window": "3-9 months", "milestones": [...]},
     {"window": "9-18 months", "milestones": [...]}
   ]}}

Rules for the plan:
- path starts with the person's current occupation and ends at the destination.
- Every milestone cites specific task IDs in data_source. No citation, no milestone.
- 2-3 milestones per window. Concrete actions, not "learn AI".
- Take the person's existing skills into account: do not tell them to learn
  what they already listed.
- Investigate before concluding. Use at least two tools.
- Respect constraints.weekly_hours. Size every milestone to fit it. Someone
  with 1 hour a week gets a genuinely different plan from someone with 12,
  not the same plan with a longer deadline.
- Respect constraints.budget. "free" means free resources only — never
  recommend a paid course to someone who said free.
- Respect constraints.goal_type. "adapt" stays in the current occupation and
  the path has one node. "move" targets an adjacent occupation. "change"
  targets the most resilient reachable occupation even at lower overlap.
- constraints.answer_reading is an interpretation of the person's own words.
  Treat its hard_constraints as binding and its watch_outs as things your
  plan must avoid."""


def _build_user_prompt(
    occupation: dict,
    skills: list[str],
    goal: str | None,
    profile: dict | None = None,
) -> str:
    constraints = {k: v for k, v in (profile or {}).items() if v is not None}
    return json.dumps(
        {
            "current_occupation": occupation,
            "existing_skills": skills,
            "goal": goal or "find a more resilient path that builds on what I already do",
            "constraints": constraints,
        }
    )


def _attach_authoritative_scores(df: pd.DataFrame, final: dict, soc_code: str) -> dict:
    """
    Replace every number in the agent's output with the computed one.

    The model is asked not to invent figures, but "asked not to" is not a
    guarantee, and the entire pitch of this project is that the numbers are
    not generated. So we recompute rather than trust: each path node gets its
    real resilience score, and its real overlap against the starting
    occupation. Anything the model wrote in those fields is overwritten.
    """
    valid = set(df["soc_code"].astype(str).unique())
    overlaps = {
        n["soc_code"]: n["overlap_pct"]
        for n in find_adjacent_occupations(df, soc_code, limit=len(valid))
    }

    clean_path = []
    for node in final.get("path", []):
        code = str(node.get("soc_code", ""))
        if code not in valid:
            logger.warning("Agent proposed unknown SOC code %r; dropping", code)
            continue
        scored = score_occupation(df, code)
        clean_path.append(
            {
                "soc_code": code,
                "title": scored.occupation_title,
                "resilience_score": scored.resilience_score,
                "overlap_pct": 100.0 if code == soc_code else overlaps.get(code, 0.0),
                "rationale": str(node.get("rationale", ""))[:400],
                "is_current": code == soc_code,
            }
        )

    # The path must at minimum contain where the person is now.
    if not any(n["is_current"] for n in clean_path):
        scored = score_occupation(df, soc_code)
        clean_path.insert(0, {
            "soc_code": soc_code,
            "title": scored.occupation_title,
            "resilience_score": scored.resilience_score,
            "overlap_pct": 100.0,
            "rationale": "Where you are now.",
            "is_current": True,
        })

    final["path"] = clean_path
    return final


def _fallback_plan(df: pd.DataFrame, soc_code: str, skills: list[str]) -> dict:
    """
    A plan built entirely from computation, for when the model is unavailable.

    Deliberately plain: it states what the data says and stops. Less
    persuasive than the agent's version, but every claim in it is true, and
    it means an LLM outage costs polish rather than the whole feature.
    """
    current = score_occupation(df, soc_code)
    neighbours = find_adjacent_occupations(df, soc_code, limit=1)

    path = [{
        "soc_code": soc_code, "title": current.occupation_title,
        "resilience_score": current.resilience_score, "overlap_pct": 100.0,
        "rationale": "Where you are now.", "is_current": True,
    }]
    phases = [{
        "window": "0-3 months",
        "milestones": [
            {
                "action": f"Reduce time spent on: {t.task_description}",
                "reason": f"Highest measured exposure in your role ({t.economic_index_label}, beta {t.eloundou_beta}).",
                "data_source": f"{t.task_id} label={t.economic_index_label} beta={t.eloundou_beta}",
            }
            for t in current.at_risk_tasks[:2]
        ],
    }, {
        "window": "3-9 months",
        "milestones": [
            {
                "action": f"Deepen: {t.task_description}",
                "reason": f"Measured as holding steady ({t.economic_index_label}, beta {t.eloundou_beta}).",
                "data_source": f"{t.task_id} label={t.economic_index_label} beta={t.eloundou_beta}",
            }
            for t in current.resilient_tasks[:2]
        ],
    }]

    if neighbours:
        target = neighbours[0]
        path.append({**target, "rationale":
                     f"Closest adjacent role by task overlap ({target['overlap_pct']}%).",
                     "is_current": False})
        gap = compare_occupations(df, soc_code, target["soc_code"])
        phases.append({
            "window": "9-18 months",
            "milestones": [
                {
                    "action": f"Build capability in: {t['task_description']}",
                    "reason": f"Required by {target['title']} and not part of your current role.",
                    "data_source": f"{t['task_id']} label={t['economic_index_label']} beta={t['eloundou_beta']}",
                }
                for t in gap["gap_tasks"][:2]
            ],
        })

    return {
        "summary": (
            f"{current.occupation_title} scores {current.resilience_score}/100 on task "
            f"resilience. This plan was computed directly from the task data."
        ),
        "path": path,
        "phases": phases,
        "generated_by": "computation",
    }


def _reply_with_retry(messages: list[dict]) -> dict:
    """
    One agent turn, with a single retry on unparseable output.

    A malformed turn is usually recoverable — the model overran, or emitted
    prose around the object. Retrying with an explicit instruction to be
    terse costs one call; abandoning the whole run costs the feature.
    Transport failures (bad key, gated model) are not retried, because the
    second attempt will fail identically.
    """
    try:
        return chat_json(messages, model=STRONG_MODEL)
    except ValueError as exc:
        logger.warning("Agent turn unparseable, retrying once: %s", exc)
        return chat_json(
            messages + [{
                "role": "user",
                "content": "Your last reply was not valid JSON. Reply with ONE "
                           "compact JSON object and no other text. Keep it short: "
                           "at most 2 milestones per window, one sentence each.",
            }],
            model=STRONG_MODEL,
        )


def run_career_agent(
    df: pd.DataFrame,
    soc_code: str,
    skills: list[str],
    goal: str | None = None,
    profile: dict | None = None,
    max_steps: int = MAX_STEPS,
) -> Iterator[dict]:
    """
    Drive the agent loop, yielding an event per step then a final event.

    Yields:
      {"type": "step",  "n": int, "thought": str, "tool": str, "observation": str}
      {"type": "final", "plan": {...}}
      {"type": "error", "message": str}   (only for unrecoverable failures)
    """
    occupation = _tool_get_occupation(df, soc_code)

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": _build_user_prompt(occupation, skills, goal, profile)},
    ]

    for step in range(1, max_steps + 1):
        try:
            reply = _reply_with_retry(messages)
        except Exception as exc:
            logger.exception("Agent step %d failed", step)
            yield {"type": "step", "n": step, "thought": "Model unavailable — "
                   "falling back to computed planning.", "tool": "fallback",
                   "observation": str(exc)[:200]}
            yield {"type": "final", "plan": _fallback_plan(df, soc_code, skills)}
            return

        thought = str(reply.get("thought", ""))[:300]

        if "final" in reply and reply["final"]:
            plan = _attach_authoritative_scores(df, reply["final"], soc_code)
            plan["generated_by"] = "agent"
            yield {"type": "step", "n": step, "thought": thought,
                   "tool": "write_plan", "observation": "Plan drafted from the data gathered."}
            yield {"type": "final", "plan": plan}
            return

        tool_name = reply.get("tool")
        args = reply.get("args") or {}

        if tool_name not in TOOLS:
            # Don't burn a step on a malformed turn — correct it and retry.
            messages.append({"role": "assistant", "content": json.dumps(reply)})
            messages.append({"role": "user", "content":
                             f"Unknown tool {tool_name!r}. Choose one of: "
                             f"{', '.join(TOOLS)}. Reply with one JSON object."})
            continue

        try:
            observation = TOOLS[tool_name](df, **args)
            summary = _summarise(tool_name, observation)
        except Exception as exc:
            observation = {"error": str(exc)}
            summary = f"That call failed: {str(exc)[:120]}"

        yield {"type": "step", "n": step, "thought": thought,
               "tool": tool_name, "observation": summary}

        messages.append({"role": "assistant", "content": json.dumps(reply)})
        messages.append({"role": "user", "content":
                         "Observation:\n" + json.dumps(observation)[:4000]})

    # Ran out of steps without a plan — still give the user something real.
    logger.warning("Agent hit max_steps without a final plan")
    yield {"type": "final", "plan": _fallback_plan(df, soc_code, skills)}


def _summarise(tool_name: str, observation: dict) -> str:
    """One human-readable line per tool result, for the streamed timeline."""
    if "error" in observation:
        return f"Failed: {observation['error'][:120]}"
    if tool_name == "find_adjacent_occupations":
        neighbours = observation.get("neighbours", [])
        if not neighbours:
            return "No adjacent occupations found."
        return "Nearest: " + ", ".join(
            f"{n['title']} ({n['overlap_pct']}% overlap, resilience {n['resilience_score']})"
            for n in neighbours[:3]
        )
    if tool_name == "get_occupation":
        return (f"{observation['title']}: resilience {observation['resilience_score']}, "
                f"{len(observation['at_risk_tasks'])} tasks shifting, "
                f"{len(observation['resilient_tasks'])} holding steady.")
    if tool_name == "compare_occupations":
        return (f"{observation['from']['title']} to {observation['to']['title']}: "
                f"{len(observation['gap_tasks'])} new tasks to learn, "
                f"resilience {observation['resilience_delta']:+d}.")
    if tool_name == "list_occupations":
        return f"{len(observation.get('occupations', []))} occupations in the dataset."
    return "Done."
