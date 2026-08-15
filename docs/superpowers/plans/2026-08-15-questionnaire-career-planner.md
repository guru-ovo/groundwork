# Questionnaire-Driven Career Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Groundwork's single search box with a multi-step questionnaire that collects role, skills, available time, budget and goal, then drives the streaming career agent and persists both answers and generated plan to Supabase.

**Architecture:** A client-side questionnaire (`frontend/src/questionnaire/`) holds answers in one state object defined by a single schema module. On submit it POSTs the full profile to the existing SSE endpoint `POST /career-plan/stream`, which threads the new constraints into the agent's prompt. Answers plus the resulting plan are written to one Supabase `plans` table under an anonymous session, and readable by URL at `/plan/:id`.

**Tech Stack:** React 18 + Vite (plain CSS), FastAPI + pandas, Featherless.ai (OpenAI-compatible), Supabase (Postgres + anonymous auth), vitest + @testing-library/react, pytest.

**Spec:** This document. Requirements were fixed by the user on 2026-08-15:
questionnaire *replaces* the search box (it is the entry point, not a
follow-up), and Supabase *is* in scope for persistence.

## Global Constraints

- **The LLM never produces a number.** Every resilience score, overlap percentage and exposure value comes from `backend/app/services/scoring.py` / `similarity.py`. `_attach_authoritative_scores()` in `career_agent.py` overwrites anything the model emits. No task may weaken this.
- **Deadline: Sunday 2026-08-16, 18:00 CST.** Tasks are ordered so the deployed demo works after every commit.
- **No new runtime Python dependencies.** Render runs a free instance; `backend/requirements.txt` stays as-is. Test-only deps go in `backend/requirements-dev.txt`.
- **Vite bakes env vars at build time.** All `VITE_*` values live in `frontend/.env.production`, committed. They are not secrets.
- **Supabase RLS must be enabled before any row is written.** The anon key is publishable by design; RLS is the only thing protecting rows.
- **Python 3.12.6** on Render (pinned in `render.yaml`; pandas 2.2.2 has no 3.13 wheels).
- **Existing endpoints must keep working:** `POST /resolve-occupation`, `GET /tasks/{soc_code}`, `POST /roadmap`, `POST /career-plan/stream`, `GET /adjacent/{soc}`, `GET /compare/{a}/{b}`.
- **Copy rule:** no "AI-powered", no sparkle/robot iconography, no exclamation marks in UI copy.

---

## File Structure

**Create:**

| Path | Responsibility |
|---|---|
| `backend/requirements-dev.txt` | pytest + httpx, test-only |
| `backend/tests/test_matching.py` | deterministic matcher behaviour |
| `backend/tests/test_career_request.py` | request model + prompt threading |
| `frontend/vitest.config.js` | vitest + jsdom config |
| `frontend/src/questionnaire/schema.js` | single source of truth: steps, options, validation |
| `frontend/src/questionnaire/schema.test.js` | validation unit tests |
| `frontend/src/questionnaire/QuestionnaireFlow.jsx` | step orchestration, answer state |
| `frontend/src/questionnaire/steps/RoleStep.jsx` | title input + occupation match selection |
| `frontend/src/questionnaire/steps/SkillsStep.jsx` | skill chips |
| `frontend/src/questionnaire/steps/TimeStep.jsx` | hours + budget |
| `frontend/src/questionnaire/steps/GoalStep.jsx` | goal type + free-text note |
| `frontend/src/questionnaire/steps/ReviewStep.jsx` | summary + submit |
| `frontend/src/questionnaire/Questionnaire.css` | questionnaire styles |
| `frontend/src/lib/sse.js` | chunk→event parser for the stream |
| `frontend/src/lib/sse.test.js` | parser unit tests |
| `frontend/src/lib/supabase.js` | client, anonymous session, save/load |
| `frontend/src/hooks/usePlanStream.js` | drives the SSE request, exposes steps + plan |
| `frontend/src/components/AgentTimeline.jsx` | streamed agent steps |
| `frontend/src/components/PlanPhases.jsx` | phased milestones with citations |
| `supabase/schema.sql` | table + RLS policies, committed for reproducibility |

**Modify:**

| Path | Change |
|---|---|
| `backend/app/routers/career.py:14-18` | extend `CareerPlanRequest` with profile fields |
| `backend/app/services/career_agent.py:118-127` | thread constraints into `_build_user_prompt` |
| `backend/app/services/career_agent.py:85-116` | add constraint rules to `SYSTEM_PROMPT` |
| `frontend/src/App.jsx` | render `QuestionnaireFlow` instead of the search form |
| `frontend/src/api.js` | add `streamCareerPlan()` |
| `frontend/package.json` | add vitest, testing-library, jsdom, `@supabase/supabase-js` |
| `frontend/.env.production` | add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |

---

## Task 1: Test infrastructure

**Files:**
- Create: `backend/requirements-dev.txt`, `backend/tests/__init__.py`, `backend/tests/test_matching.py`
- Create: `frontend/vitest.config.js`
- Modify: `frontend/package.json`

**Interfaces:**
- Consumes: `app.services.matching.match_occupations(free_text_title, candidates, limit=3)` — already exists.
- Produces: `pytest` runnable from `backend/`, `npm test` runnable from `frontend/`.

- [ ] **Step 1: Create the backend dev requirements**

```text
# Test-only. Kept out of requirements.txt so Render's build stays small.
-r requirements.txt
pytest==8.3.2
httpx==0.27.2
```

Write to `backend/requirements-dev.txt`.

- [ ] **Step 2: Install them**

```bash
cd backend && pip install -r requirements-dev.txt
```

- [ ] **Step 3: Write the failing test**

Create `backend/tests/__init__.py` (empty file) and `backend/tests/test_matching.py`:

```python
"""The deterministic matcher is the floor under Stage 0 — it must never
raise, and it must always return at least one candidate, because every
downstream stage needs a SOC code."""

import pytest

from app.config import load_occupation_list
from app.services.matching import match_occupations


@pytest.fixture
def candidates():
    return load_occupation_list()


def test_exact_title_matches_high_confidence(candidates):
    result = match_occupations("data scientist", candidates)
    assert result["matches"][0]["title"] == "Data Scientists"
    assert result["matches"][0]["confidence"] == "high"


def test_seniority_words_are_ignored(candidates):
    senior = match_occupations("senior data scientist", candidates)
    plain = match_occupations("data scientist", candidates)
    assert senior["matches"][0]["soc_code"] == plain["matches"][0]["soc_code"]


def test_nonsense_input_still_returns_candidates(candidates):
    result = match_occupations("underwater basket weaver", candidates)
    assert len(result["matches"]) >= 1
    assert result["matched_by"] == "fallback"


def test_empty_input_does_not_raise(candidates):
    result = match_occupations("", candidates)
    assert len(result["matches"]) >= 1


def test_every_returned_code_is_real(candidates):
    valid = {c["soc_code"] for c in candidates}
    result = match_occupations("software engineer", candidates)
    assert all(m["soc_code"] in valid for m in result["matches"])
```

- [ ] **Step 4: Run it — expect PASS**

```bash
cd backend && python -m pytest tests/test_matching.py -v
```

Expected: 5 passed. These characterise behaviour that already exists; if any
fail, `matching.py` has a bug — fix `matching.py`, not the test.

- [ ] **Step 5: Add frontend test tooling**

```bash
cd frontend && npm install -D vitest@2.1.1 jsdom@25.0.0 @testing-library/react@16.0.1 @testing-library/jest-dom@6.5.0
```

Then add to `frontend/package.json` `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Create the vitest config**

Write `frontend/vitest.config.js`:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
```

- [ ] **Step 7: Commit**

```bash
git add backend/requirements-dev.txt backend/tests frontend/vitest.config.js frontend/package.json frontend/package-lock.json
git commit -m "test: add pytest and vitest harnesses"
```

---

## Task 2: Questionnaire schema

The schema is the contract every other frontend task reads. It exists as one
module so a question's options, its validation and its display order can never
drift apart.

**Files:**
- Create: `frontend/src/questionnaire/schema.js`
- Test: `frontend/src/questionnaire/schema.test.js`

**Interfaces:**
- Produces:
  - `STEP_IDS: string[]` — `['role','skills','time','goal','review']`
  - `GOAL_OPTIONS`, `HOURS_OPTIONS`, `BUDGET_OPTIONS` — `{value, label, ...}[]`
  - `emptyAnswers(): Answers`
  - `validateStep(stepId, answers): string[]` — human-readable errors, empty when valid
  - `isStepComplete(stepId, answers): boolean`
  - `toRequestPayload(answers): object` — the exact body posted to `/career-plan/stream`
  - `Answers` shape: `{ title, socCode, occupationTitle, skills: string[], hours, budget, goalType, goalNote }`

- [ ] **Step 1: Write the failing test**

Write `frontend/src/questionnaire/schema.test.js`:

```js
import { describe, it, expect } from 'vitest'
import {
  STEP_IDS,
  HOURS_OPTIONS,
  emptyAnswers,
  validateStep,
  isStepComplete,
  toRequestPayload,
} from './schema'

describe('emptyAnswers', () => {
  it('starts with no step complete except optional ones', () => {
    const a = emptyAnswers()
    expect(isStepComplete('role', a)).toBe(false)
    expect(isStepComplete('skills', a)).toBe(false)
  })
})

describe('validateStep', () => {
  it('requires an occupation to be selected, not just typed', () => {
    const a = { ...emptyAnswers(), title: 'data analyst' }
    expect(validateStep('role', a)).toContain('Choose the closest occupation.')
  })

  it('accepts a selected occupation', () => {
    const a = { ...emptyAnswers(), title: 'data analyst', socCode: '15-2051.00', occupationTitle: 'Data Scientists' }
    expect(validateStep('role', a)).toEqual([])
  })

  it('requires at least one skill', () => {
    expect(validateStep('skills', emptyAnswers())).toContain('Add at least one thing you can already do.')
  })

  it('rejects an unknown hours value', () => {
    const a = { ...emptyAnswers(), hours: 'sometimes', budget: 'free' }
    expect(validateStep('time', a).length).toBeGreaterThan(0)
  })

  it('accepts known hours and budget values', () => {
    const a = { ...emptyAnswers(), hours: HOURS_OPTIONS[0].value, budget: 'free' }
    expect(validateStep('time', a)).toEqual([])
  })

  it('treats the goal note as optional', () => {
    const a = { ...emptyAnswers(), goalType: 'move' }
    expect(validateStep('goal', a)).toEqual([])
  })
})

describe('toRequestPayload', () => {
  it('converts answers into the API body, mapping hours to a number', () => {
    const a = {
      ...emptyAnswers(),
      socCode: '15-2051.00',
      skills: ['SQL', 'Excel'],
      hours: '2to5',
      budget: 'free',
      goalType: 'move',
      goalNote: 'somewhere less repetitive',
    }
    expect(toRequestPayload(a)).toEqual({
      soc_code: '15-2051.00',
      skills: ['SQL', 'Excel'],
      goal_type: 'move',
      goal: 'somewhere less repetitive',
      weekly_hours: 3.5,
      budget: 'free',
    })
  })

  it('omits an empty goal note rather than sending an empty string', () => {
    const a = { ...emptyAnswers(), socCode: '15-2051.00', skills: ['SQL'], hours: 'lt2', budget: 'free', goalType: 'adapt' }
    expect(toRequestPayload(a).goal).toBeNull()
  })
})

describe('STEP_IDS', () => {
  it('ends with review', () => {
    expect(STEP_IDS[STEP_IDS.length - 1]).toBe('review')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd frontend && npm test -- schema
```

Expected: FAIL — `Failed to resolve import "./schema"`.

- [ ] **Step 3: Write the implementation**

Write `frontend/src/questionnaire/schema.js`:

```js
/**
 * The questionnaire contract.
 *
 * Every step's options, its validation and its position live here so they
 * cannot drift apart. Components render from this module; they never define
 * their own option lists.
 */

export const STEP_IDS = ['role', 'skills', 'time', 'goal', 'review']

export const STEP_TITLES = {
  role: 'What do you do now?',
  skills: 'What can you already do?',
  time: 'How much can you invest?',
  goal: 'Where do you want this to go?',
  review: 'Check this over',
}

// weeklyHours is the midpoint of each band. The agent is told to size
// milestones against it, so a person with two hours a week is not handed a
// plan that assumes ten.
export const HOURS_OPTIONS = [
  { value: 'lt2', label: 'Under 2 hours a week', weeklyHours: 1 },
  { value: '2to5', label: '2 to 5 hours a week', weeklyHours: 3.5 },
  { value: '5to10', label: '5 to 10 hours a week', weeklyHours: 7.5 },
  { value: 'gt10', label: 'More than 10 hours a week', weeklyHours: 12 },
]

export const BUDGET_OPTIONS = [
  { value: 'free', label: 'Free resources only' },
  { value: 'low', label: 'Up to $100' },
  { value: 'open', label: 'Cost is not the constraint' },
]

export const GOAL_OPTIONS = [
  { value: 'adapt', label: 'Stay in this field and adapt' },
  { value: 'move', label: 'Move to a related role' },
  { value: 'change', label: 'Change fields entirely' },
]

export function emptyAnswers() {
  return {
    title: '',
    socCode: '',
    occupationTitle: '',
    skills: [],
    hours: '',
    budget: '',
    goalType: '',
    goalNote: '',
  }
}

const HOURS_VALUES = new Set(HOURS_OPTIONS.map((o) => o.value))
const BUDGET_VALUES = new Set(BUDGET_OPTIONS.map((o) => o.value))
const GOAL_VALUES = new Set(GOAL_OPTIONS.map((o) => o.value))

export function validateStep(stepId, answers) {
  const errors = []

  if (stepId === 'role') {
    if (!answers.title.trim()) errors.push('Enter your job title.')
    else if (!answers.socCode) errors.push('Choose the closest occupation.')
  }

  if (stepId === 'skills') {
    if (answers.skills.length === 0) {
      errors.push('Add at least one thing you can already do.')
    }
  }

  if (stepId === 'time') {
    if (!HOURS_VALUES.has(answers.hours)) errors.push('Choose how much time you have.')
    if (!BUDGET_VALUES.has(answers.budget)) errors.push('Choose a budget.')
  }

  if (stepId === 'goal') {
    if (!GOAL_VALUES.has(answers.goalType)) errors.push('Choose a direction.')
  }

  return errors
}

export function isStepComplete(stepId, answers) {
  return validateStep(stepId, answers).length === 0
}

export function toRequestPayload(answers) {
  const hours = HOURS_OPTIONS.find((o) => o.value === answers.hours)
  const note = answers.goalNote.trim()
  return {
    soc_code: answers.socCode,
    skills: answers.skills,
    goal_type: answers.goalType || null,
    goal: note || null,
    weekly_hours: hours ? hours.weeklyHours : null,
    budget: answers.budget || null,
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd frontend && npm test -- schema
```

Expected: 9 passed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/questionnaire/schema.js frontend/src/questionnaire/schema.test.js
git commit -m "feat: add questionnaire schema and validation"
```

---

## Task 3: Backend accepts the profile

**Files:**
- Modify: `backend/app/routers/career.py:14-18`
- Modify: `backend/app/services/career_agent.py` (`SYSTEM_PROMPT`, `_build_user_prompt`, `run_career_agent`)
- Test: `backend/tests/test_career_request.py`

**Interfaces:**
- Consumes: `toRequestPayload()` output from Task 2 — keys `soc_code`, `skills`, `goal_type`, `goal`, `weekly_hours`, `budget`.
- Produces: `run_career_agent(df, soc_code, skills, goal=None, profile=None, max_steps=5)` where `profile` is `{"goal_type","weekly_hours","budget"}`.

- [ ] **Step 1: Write the failing test**

Write `backend/tests/test_career_request.py`:

```python
"""The questionnaire's extra answers are worthless unless they reach the
model. These tests pin the request shape and prove the constraints are
actually threaded into the prompt."""

import json

import pandas as pd
import pytest

from app.config import load_tasks_df
from app.routers.career import CareerPlanRequest
from app.services.career_agent import _build_user_prompt


def test_request_accepts_full_questionnaire_payload():
    req = CareerPlanRequest(
        soc_code="15-2051.00",
        skills=["SQL", "Excel"],
        goal="somewhere less repetitive",
        goal_type="move",
        weekly_hours=3.5,
        budget="free",
    )
    assert req.weekly_hours == 3.5
    assert req.goal_type == "move"


def test_request_still_accepts_the_minimal_body():
    """The old two-field body must keep working — /career-plan/stream is
    already deployed and the roadmap page still posts it."""
    req = CareerPlanRequest(soc_code="15-2051.00")
    assert req.skills == []
    assert req.weekly_hours is None


def test_invalid_goal_type_is_rejected():
    with pytest.raises(Exception):
        CareerPlanRequest(soc_code="15-2051.00", goal_type="teleport")


def test_prompt_contains_the_time_budget():
    prompt = _build_user_prompt(
        occupation={"title": "Data Scientists", "resilience_score": 42},
        skills=["SQL"],
        goal="less repetitive work",
        profile={"goal_type": "move", "weekly_hours": 3.5, "budget": "free"},
    )
    parsed = json.loads(prompt)
    assert parsed["constraints"]["weekly_hours"] == 3.5
    assert parsed["constraints"]["budget"] == "free"
    assert parsed["constraints"]["goal_type"] == "move"


def test_prompt_without_profile_omits_constraints():
    prompt = _build_user_prompt(
        occupation={"title": "Data Scientists"}, skills=[], goal=None, profile=None
    )
    parsed = json.loads(prompt)
    assert parsed["constraints"] == {}
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd backend && python -m pytest tests/test_career_request.py -v
```

Expected: FAIL — `CareerPlanRequest` has no field `goal_type`; `_build_user_prompt()` takes 3 positional args.

- [ ] **Step 3: Widen the request model**

In `backend/app/routers/career.py`, replace the `CareerPlanRequest` class with:

```python
class CareerPlanRequest(BaseModel):
    """
    The questionnaire's answers.

    Everything past soc_code is optional so the endpoint stays compatible
    with the simpler body already deployed.
    """

    soc_code: str
    skills: list[str] = []
    goal: str | None = None
    goal_type: Literal["adapt", "move", "change"] | None = None
    weekly_hours: float | None = Field(default=None, ge=0, le=80)
    budget: Literal["free", "low", "open"] | None = None
```

Update the imports at the top of that file:

```python
from typing import Literal

from pydantic import BaseModel, Field
```

- [ ] **Step 4: Thread the profile into the prompt**

In `backend/app/services/career_agent.py`, replace `_build_user_prompt` with:

```python
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
```

- [ ] **Step 5: Teach the agent to respect the constraints**

In `backend/app/services/career_agent.py`, inside `SYSTEM_PROMPT`, replace the
"Rules for the plan:" block with:

```text
Rules for the plan:
- path starts with the person's current occupation and ends at the destination.
- Every milestone cites specific task IDs in data_source. No citation, no milestone.
- 2-3 milestones per window. Concrete actions, not "learn AI".
- Take the person's existing skills into account: do not tell them to learn
  what they already listed.
- Investigate before concluding. Use at least two tools.
- Respect constraints.weekly_hours: size every milestone to fit that budget.
  Someone with 1 hour a week gets a different plan from someone with 12, not
  the same plan with a longer deadline.
- Respect constraints.budget: "free" means free resources only; never
  recommend a paid course to someone who said free.
- Respect constraints.goal_type: "adapt" stays in the current occupation and
  the path has one node; "move" targets an adjacent occupation; "change"
  targets the most resilient reachable occupation even at lower overlap.
```

- [ ] **Step 6: Pass the profile through the agent**

In `backend/app/services/career_agent.py`, change the `run_career_agent`
signature and its prompt construction:

```python
def run_career_agent(
    df: pd.DataFrame,
    soc_code: str,
    skills: list[str],
    goal: str | None = None,
    profile: dict | None = None,
    max_steps: int = MAX_STEPS,
) -> Iterator[dict]:
```

and inside it:

```python
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": _build_user_prompt(occupation, skills, goal, profile)},
    ]
```

- [ ] **Step 7: Pass it from the router**

In `backend/app/routers/career.py`, inside `events()`:

```python
        profile = {
            "goal_type": req.goal_type,
            "weekly_hours": req.weekly_hours,
            "budget": req.budget,
        }
        try:
            for event in run_career_agent(df, req.soc_code, req.skills, req.goal, profile):
                yield _sse(event)
```

- [ ] **Step 8: Run the tests to verify they pass**

```bash
cd backend && python -m pytest tests/ -v
```

Expected: 10 passed.

- [ ] **Step 9: Verify the deployed contract still accepts the old body**

```bash
cd backend && python -c "
from fastapi.testclient import TestClient
from app.main import app
c = TestClient(app, raise_server_exceptions=False)
r = c.post('/career-plan/stream', json={'soc_code':'15-2051.00'})
print('minimal body:', r.status_code)
"
```

Expected: `200`.

- [ ] **Step 10: Commit**

```bash
git add backend/app/routers/career.py backend/app/services/career_agent.py backend/tests/test_career_request.py
git commit -m "feat: accept questionnaire constraints and thread them into the agent"
```

---

## Task 4: SSE parser

Extracted from the hook so the fiddly part — chunk boundaries falling
mid-event — is unit-testable without a network.

**Files:**
- Create: `frontend/src/lib/sse.js`
- Test: `frontend/src/lib/sse.test.js`

**Interfaces:**
- Produces: `createSSEParser(onEvent): (chunk: string) => void`

- [ ] **Step 1: Write the failing test**

Write `frontend/src/lib/sse.test.js`:

```js
import { describe, it, expect, vi } from 'vitest'
import { createSSEParser } from './sse'

describe('createSSEParser', () => {
  it('emits one event per data frame', () => {
    const seen = []
    const push = createSSEParser((e) => seen.push(e))
    push('data: {"type":"start"}\n\ndata: {"type":"done"}\n\n')
    expect(seen).toEqual([{ type: 'start' }, { type: 'done' }])
  })

  it('handles a frame split across two chunks', () => {
    const seen = []
    const push = createSSEParser((e) => seen.push(e))
    push('data: {"type":"ste')
    expect(seen).toEqual([])
    push('p","n":1}\n\n')
    expect(seen).toEqual([{ type: 'step', n: 1 }])
  })

  it('ignores heartbeat comments', () => {
    const seen = []
    const push = createSSEParser((e) => seen.push(e))
    push(': keep-alive\n\ndata: {"type":"done"}\n\n')
    expect(seen).toEqual([{ type: 'done' }])
  })

  it('skips malformed JSON without throwing', () => {
    const seen = []
    const push = createSSEParser((e) => seen.push(e))
    expect(() => push('data: {oops\n\ndata: {"type":"done"}\n\n')).not.toThrow()
    expect(seen).toEqual([{ type: 'done' }])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd frontend && npm test -- sse
```

Expected: FAIL — cannot resolve `./sse`.

- [ ] **Step 3: Write the implementation**

Write `frontend/src/lib/sse.js`:

```js
/**
 * Minimal server-sent-events parser.
 *
 * EventSource can't be used here: it is GET-only and the plan request needs
 * a body. So we read the fetch stream ourselves, which means handling the
 * case where a chunk boundary lands in the middle of an event — hence the
 * buffer.
 */
export function createSSEParser(onEvent) {
  let buffer = ''

  return function push(chunk) {
    buffer += chunk
    let boundary
    while ((boundary = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)
      for (const line of frame.split('\n')) {
        if (!line.startsWith('data: ')) continue // ':' comments are heartbeats
        try {
          onEvent(JSON.parse(line.slice(6)))
        } catch {
          // A malformed frame must not kill the stream — the next event may
          // be the plan itself.
        }
      }
    }
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd frontend && npm test -- sse
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/sse.js frontend/src/lib/sse.test.js
git commit -m "feat: add SSE parser for the plan stream"
```

---

## Task 5: Plan stream hook and API call

**Files:**
- Modify: `frontend/src/api.js`
- Create: `frontend/src/hooks/usePlanStream.js`

**Interfaces:**
- Consumes: `createSSEParser` (Task 4), `toRequestPayload` (Task 2).
- Produces: `usePlanStream()` returning `{ steps, plan, status, error, start, reset }` where `status` is `'idle' | 'running' | 'done' | 'error'` and `start(payload)` takes the object from `toRequestPayload`.

- [ ] **Step 1: Add the streaming call to the API module**

Append to `frontend/src/api.js`:

```js
/**
 * POST the questionnaire and read the agent's events as they arrive.
 *
 * Uses fetch rather than EventSource because EventSource is GET-only and
 * this request carries a body. onEvent is called once per event; the
 * returned promise resolves when the stream closes.
 */
export async function streamCareerPlan(payload, onEvent, signal) {
  const res = await fetch(`${BASE_URL}/career-plan/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  })
  if (!res.ok || !res.body) throw new Error('Could not start the planner')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  const { createSSEParser } = await import('./lib/sse')
  const push = createSSEParser(onEvent)

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    push(decoder.decode(value, { stream: true }))
  }
}
```

- [ ] **Step 2: Write the hook**

Write `frontend/src/hooks/usePlanStream.js`:

```js
import { useCallback, useRef, useState } from 'react'
import { streamCareerPlan } from '../api'

/**
 * Drives one agent run.
 *
 * Steps accumulate as they arrive so the interface can show the agent
 * working rather than a spinner — the run takes 15-25 seconds because each
 * step is a real model call over real tool output.
 */
export function usePlanStream() {
  const [steps, setSteps] = useState([])
  const [plan, setPlan] = useState(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const abortRef = useRef(null)

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setSteps([])
    setPlan(null)
    setError(null)
    setStatus('idle')
  }, [])

  const start = useCallback(async (payload) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setSteps([])
    setPlan(null)
    setError(null)
    setStatus('running')

    try {
      await streamCareerPlan(
        payload,
        (event) => {
          if (event.type === 'step') setSteps((prev) => [...prev, event])
          else if (event.type === 'final') setPlan(event.plan)
          else if (event.type === 'error') setError(event.message)
        },
        controller.signal,
      )
      setStatus((prev) => (prev === 'running' ? 'done' : prev))
    } catch (err) {
      if (err.name === 'AbortError') return
      setError('The planner could not be reached. It may be waking up.')
      setStatus('error')
    }
  }, [])

  return { steps, plan, status, error, start, reset }
}
```

- [ ] **Step 3: Verify against the live backend**

```bash
cd backend && python -c "
from fastapi.testclient import TestClient
from app.main import app
import json
c = TestClient(app, raise_server_exceptions=False)
with c.stream('POST','/career-plan/stream', json={'soc_code':'15-2051.00','skills':['SQL'],'weekly_hours':3.5,'budget':'free','goal_type':'move'}) as r:
    for line in r.iter_lines():
        if line.startswith('data: '):
            print(json.loads(line[6:])['type'])
"
```

Expected: `start`, one or more `step`, `final`, `done`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api.js frontend/src/hooks/usePlanStream.js
git commit -m "feat: stream the career plan from the questionnaire"
```

---

## Task 6: Questionnaire flow and steps

**Files:**
- Create: `frontend/src/questionnaire/QuestionnaireFlow.jsx`
- Create: `frontend/src/questionnaire/steps/RoleStep.jsx`, `SkillsStep.jsx`, `TimeStep.jsx`, `GoalStep.jsx`, `ReviewStep.jsx`
- Create: `frontend/src/questionnaire/Questionnaire.css`

**Interfaces:**
- Consumes: everything exported by `schema.js` (Task 2); `resolveOccupation` from `../api`.
- Produces: `<QuestionnaireFlow onSubmit={(payload, answers) => void} />`

- [ ] **Step 1: Write the flow container**

Write `frontend/src/questionnaire/QuestionnaireFlow.jsx`:

```jsx
import { useState } from 'react'
import {
  STEP_IDS,
  STEP_TITLES,
  emptyAnswers,
  validateStep,
  toRequestPayload,
} from './schema'
import RoleStep from './steps/RoleStep'
import SkillsStep from './steps/SkillsStep'
import TimeStep from './steps/TimeStep'
import GoalStep from './steps/GoalStep'
import ReviewStep from './steps/ReviewStep'
import './Questionnaire.css'

const STEP_COMPONENTS = {
  role: RoleStep,
  skills: SkillsStep,
  time: TimeStep,
  goal: GoalStep,
  review: ReviewStep,
}

export default function QuestionnaireFlow({ onSubmit }) {
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState(emptyAnswers)
  const [showErrors, setShowErrors] = useState(false)

  const stepId = STEP_IDS[index]
  const StepComponent = STEP_COMPONENTS[stepId]
  const errors = validateStep(stepId, answers)
  const isLast = index === STEP_IDS.length - 1

  function update(patch) {
    setAnswers((prev) => ({ ...prev, ...patch }))
    setShowErrors(false)
  }

  function next() {
    if (errors.length > 0) {
      setShowErrors(true)
      return
    }
    if (isLast) onSubmit(toRequestPayload(answers), answers)
    else setIndex((i) => i + 1)
  }

  return (
    <section className="qn" aria-labelledby="qn-title">
      <ol className="qn__progress" aria-label="Progress">
        {STEP_IDS.map((id, i) => (
          <li
            key={id}
            className={
              'qn__tick' +
              (i === index ? ' qn__tick--current' : '') +
              (i < index ? ' qn__tick--done' : '')
            }
            aria-current={i === index ? 'step' : undefined}
          >
            <span className="qn__tick-label">{STEP_TITLES[id]}</span>
          </li>
        ))}
      </ol>

      <h2 id="qn-title" className="qn__title">{STEP_TITLES[stepId]}</h2>

      <StepComponent answers={answers} update={update} onAdvance={next} />

      {showErrors && errors.length > 0 && (
        <ul className="qn__errors" role="alert">
          {errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}

      <div className="qn__nav">
        <button
          type="button"
          className="qn__back"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
        >
          Back
        </button>
        <button type="button" onClick={next}>
          {isLast ? 'Build my plan' : 'Continue'}
        </button>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Write the role step**

Write `frontend/src/questionnaire/steps/RoleStep.jsx`:

```jsx
import { useState } from 'react'
import { resolveOccupation } from '../../api'

export default function RoleStep({ answers, update }) {
  const [matches, setMatches] = useState([])
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  async function search(e) {
    e.preventDefault()
    if (!answers.title.trim()) return
    setBusy(true)
    setFailed(false)
    try {
      const result = await resolveOccupation(answers.title)
      setMatches(result.matches || [])
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="qn__step">
      <form onSubmit={search} className="qn__inline">
        <label className="qn__label" htmlFor="qn-title-input">Your job title</label>
        <div className="qn__row">
          <input
            id="qn-title-input"
            value={answers.title}
            onChange={(e) => { update({ title: e.target.value, socCode: '' }); setMatches([]) }}
            placeholder="e.g. Junior Data Analyst"
          />
          <button type="submit" disabled={busy}>{busy ? 'Matching' : 'Find'}</button>
        </div>
      </form>

      {failed && <p className="qn__hint">Matching is unavailable right now. Try again in a moment.</p>}

      {matches.length > 0 && (
        <ul className="qn__choices">
          {matches.map((m) => (
            <li key={m.soc_code}>
              <button
                type="button"
                className={'qn__choice' + (answers.socCode === m.soc_code ? ' qn__choice--on' : '')}
                aria-pressed={answers.socCode === m.soc_code}
                onClick={() => update({ socCode: m.soc_code, occupationTitle: m.title })}
              >
                <span>{m.title}</span>
                <span className="qn__meta">{m.soc_code} · {m.confidence} confidence</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Write the skills step**

Write `frontend/src/questionnaire/steps/SkillsStep.jsx`:

```jsx
import { useState } from 'react'

export default function SkillsStep({ answers, update }) {
  const [draft, setDraft] = useState('')

  function add(e) {
    e.preventDefault()
    const value = draft.trim()
    if (!value) return
    if (answers.skills.some((s) => s.toLowerCase() === value.toLowerCase())) {
      setDraft('')
      return
    }
    update({ skills: [...answers.skills, value] })
    setDraft('')
  }

  function remove(skill) {
    update({ skills: answers.skills.filter((s) => s !== skill) })
  }

  return (
    <div className="qn__step">
      <p className="qn__hint">
        List what you can do today. The planner will not tell you to learn
        something you already have.
      </p>
      <form onSubmit={add} className="qn__row">
        <label className="qn__sr" htmlFor="qn-skill-input">Add a skill</label>
        <input
          id="qn-skill-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="e.g. SQL"
        />
        <button type="submit">Add</button>
      </form>

      <ul className="qn__chips">
        {answers.skills.map((skill) => (
          <li key={skill}>
            <button type="button" className="qn__chip" onClick={() => remove(skill)}>
              {skill}<span aria-hidden="true"> ×</span>
              <span className="qn__sr"> (remove)</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 4: Write the time step**

Write `frontend/src/questionnaire/steps/TimeStep.jsx`:

```jsx
import { HOURS_OPTIONS, BUDGET_OPTIONS } from '../schema'

function RadioGroup({ legend, name, options, value, onChange }) {
  return (
    <fieldset className="qn__fieldset">
      <legend className="qn__label">{legend}</legend>
      {options.map((option) => (
        <label key={option.value} className="qn__radio">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  )
}

export default function TimeStep({ answers, update }) {
  return (
    <div className="qn__step">
      <RadioGroup
        legend="Time you can give this"
        name="hours"
        options={HOURS_OPTIONS}
        value={answers.hours}
        onChange={(hours) => update({ hours })}
      />
      <RadioGroup
        legend="Budget"
        name="budget"
        options={BUDGET_OPTIONS}
        value={answers.budget}
        onChange={(budget) => update({ budget })}
      />
    </div>
  )
}
```

- [ ] **Step 5: Write the goal step**

Write `frontend/src/questionnaire/steps/GoalStep.jsx`:

```jsx
import { GOAL_OPTIONS } from '../schema'

export default function GoalStep({ answers, update }) {
  return (
    <div className="qn__step">
      <fieldset className="qn__fieldset">
        <legend className="qn__label">Direction</legend>
        {GOAL_OPTIONS.map((option) => (
          <label key={option.value} className="qn__radio">
            <input
              type="radio"
              name="goalType"
              value={option.value}
              checked={answers.goalType === option.value}
              onChange={() => update({ goalType: option.value })}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>

      <label className="qn__label" htmlFor="qn-goal-note">
        Anything else worth knowing (optional)
      </label>
      <textarea
        id="qn-goal-note"
        rows={3}
        value={answers.goalNote}
        onChange={(e) => update({ goalNote: e.target.value })}
        placeholder="e.g. I want to stop doing repetitive reporting"
      />
    </div>
  )
}
```

- [ ] **Step 6: Write the review step**

Write `frontend/src/questionnaire/steps/ReviewStep.jsx`:

```jsx
import { HOURS_OPTIONS, BUDGET_OPTIONS, GOAL_OPTIONS } from '../schema'

function labelFor(options, value) {
  return options.find((o) => o.value === value)?.label ?? 'Not set'
}

export default function ReviewStep({ answers }) {
  return (
    <div className="qn__step">
      <dl className="qn__review">
        <dt>Role</dt>
        <dd>{answers.occupationTitle || 'Not set'} <span className="qn__meta">{answers.socCode}</span></dd>
        <dt>Skills</dt>
        <dd>{answers.skills.length ? answers.skills.join(', ') : 'None listed'}</dd>
        <dt>Time</dt>
        <dd>{labelFor(HOURS_OPTIONS, answers.hours)}</dd>
        <dt>Budget</dt>
        <dd>{labelFor(BUDGET_OPTIONS, answers.budget)}</dd>
        <dt>Direction</dt>
        <dd>{labelFor(GOAL_OPTIONS, answers.goalType)}</dd>
        {answers.goalNote.trim() && (<><dt>Notes</dt><dd>{answers.goalNote}</dd></>)}
      </dl>
    </div>
  )
}
```

- [ ] **Step 7: Write the stylesheet**

Write `frontend/src/questionnaire/Questionnaire.css`:

```css
.qn { display: flex; flex-direction: column; gap: 20px; max-width: 640px; }

.qn__progress {
  display: flex; gap: 6px; list-style: none; padding: 0; margin: 0;
}
.qn__tick {
  flex: 1; height: 3px; background: var(--rule); border-radius: 2px;
  transition: background 240ms ease;
}
.qn__tick--done { background: var(--moss); }
.qn__tick--current { background: var(--amber); }
.qn__tick-label {
  position: absolute; width: 1px; height: 1px; overflow: hidden;
  clip-path: inset(50%); white-space: nowrap;
}

.qn__title {
  font-family: var(--display); font-size: 28px; font-weight: 600; margin: 0;
}

.qn__step { display: flex; flex-direction: column; gap: 16px; }
.qn__row { display: flex; gap: 8px; }
.qn__row input, .qn textarea { flex: 1; }

.qn textarea {
  background: var(--paper); border: 1px solid var(--rule); color: var(--ink);
  padding: 12px 14px; border-radius: 6px; font: inherit; font-size: 15px;
  resize: vertical;
}

.qn__label { font-size: 13px; color: var(--ink-dim); }
.qn__hint { font-size: 14px; color: var(--ink-dim); margin: 0; line-height: 1.5; }
.qn__meta { color: var(--ink-dim); font-size: 13px; }

.qn__fieldset { border: 0; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
.qn__radio { display: flex; align-items: center; gap: 10px; font-size: 15px; cursor: pointer; }

.qn__choices, .qn__chips { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
.qn__chips { flex-direction: row; flex-wrap: wrap; }

.qn__choice {
  width: 100%; display: flex; justify-content: space-between; align-items: center;
  background: var(--paper); color: var(--ink); border: 1px solid var(--rule);
  text-align: left; transition: border-color 160ms ease;
}
.qn__choice--on { border-color: var(--moss); }

.qn__chip { background: var(--paper); color: var(--ink); border: 1px solid var(--rule); padding: 6px 12px; font-size: 14px; }

.qn__errors { list-style: none; padding: 0; margin: 0; color: var(--clay); font-size: 14px; }

.qn__nav { display: flex; gap: 8px; justify-content: space-between; }
.qn__back { background: transparent; color: var(--ink-dim); border: 1px solid var(--rule); }
.qn__back:disabled { opacity: 0.4; cursor: not-allowed; }

.qn__review { display: grid; grid-template-columns: 120px 1fr; gap: 8px 16px; margin: 0; }
.qn__review dt { color: var(--ink-dim); font-size: 13px; }
.qn__review dd { margin: 0; font-size: 15px; }

.qn__sr {
  position: absolute; width: 1px; height: 1px; overflow: hidden;
  clip-path: inset(50%); white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .qn__tick { transition: none; }
  .qn__choice { transition: none; }
}
```

- [ ] **Step 8: Verify it renders**

```bash
cd frontend && npm run dev
```

Open http://localhost:5173, click through all five steps. Confirm: Continue is
blocked with a visible error until each step is valid, Back works, and the
review page shows what you entered.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/questionnaire
git commit -m "feat: add the multi-step questionnaire"
```

---

## Task 7: Agent timeline and plan display

**Files:**
- Create: `frontend/src/components/AgentTimeline.jsx`, `frontend/src/components/PlanPhases.jsx`
- Modify: `frontend/src/App.jsx`

**Interfaces:**
- Consumes: `usePlanStream()` (Task 5), `QuestionnaireFlow` (Task 6).
- Produces: the assembled page.

- [ ] **Step 1: Write the timeline**

Write `frontend/src/components/AgentTimeline.jsx`:

```jsx
/**
 * The agent's steps as they arrive.
 *
 * This is not a loading state dressed up. Each row is a real query against
 * the grounded dataset, and showing them is the only honest way to
 * demonstrate that the plan came from the data rather than from the model.
 */
export default function AgentTimeline({ steps, running }) {
  if (steps.length === 0 && !running) return null

  return (
    <section className="timeline" aria-live="polite">
      <h3 className="timeline__heading">Working through the data</h3>
      <ol className="timeline__list">
        {steps.map((step) => (
          <li key={step.n} className="timeline__item">
            <p className="timeline__thought">{step.thought}</p>
            <p className="timeline__obs">
              <span className="timeline__tool">{step.tool}</span>
              {step.observation}
            </p>
          </li>
        ))}
        {running && (
          <li className="timeline__item timeline__item--pending">
            <p className="timeline__thought">Thinking…</p>
          </li>
        )}
      </ol>
    </section>
  )
}
```

- [ ] **Step 2: Write the plan display**

Write `frontend/src/components/PlanPhases.jsx`:

```jsx
export default function PlanPhases({ plan }) {
  if (!plan) return null

  return (
    <section className="plan">
      <h3 className="plan__heading">Your plan</h3>
      <p className="plan__summary">{plan.summary}</p>

      {plan.path?.length > 0 && (
        <ol className="plan__path">
          {plan.path.map((node) => (
            <li key={node.soc_code} className="plan__node">
              <span className="plan__score">{node.resilience_score}</span>
              <span className="plan__node-title">{node.title}</span>
              {!node.is_current && (
                <span className="plan__overlap">{node.overlap_pct}% task overlap</span>
              )}
            </li>
          ))}
        </ol>
      )}

      {plan.phases?.map((phase) => (
        <div key={phase.window} className="plan__phase">
          <h4 className="plan__window">{phase.window}</h4>
          <ul className="plan__milestones">
            {phase.milestones.map((m) => (
              <li key={m.action}>
                <p className="plan__action">{m.action}</p>
                <p className="plan__reason">{m.reason}</p>
                <p className="plan__source">{m.data_source}</p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
```

- [ ] **Step 3: Rewire App.jsx**

Replace `frontend/src/App.jsx` with:

```jsx
import { useState } from 'react'
import QuestionnaireFlow from './questionnaire/QuestionnaireFlow'
import AgentTimeline from './components/AgentTimeline'
import PlanPhases from './components/PlanPhases'
import Logo from './components/Logo'
import { usePlanStream } from './hooks/usePlanStream'

export default function App() {
  const { steps, plan, status, error, start, reset } = usePlanStream()
  const [answers, setAnswers] = useState(null)

  function handleSubmit(payload, submitted) {
    setAnswers(submitted)
    start(payload)
  }

  function startOver() {
    setAnswers(null)
    reset()
  }

  return (
    <div className="app">
      <header className="app__header">
        <span className="app__eyebrow app__eyebrow--brand">
          <Logo size={18} /> Groundwork
        </span>
        <h1>What's actually changing in your field</h1>
        <p className="app__sub">
          Grounded in real O*NET task data, the Anthropic Economic Index, and
          Eloundou et al. exposure research — not a guess.
        </p>
      </header>

      {status === 'idle' && <QuestionnaireFlow onSubmit={handleSubmit} />}

      {status !== 'idle' && (
        <section className="results">
          {answers && (
            <p className="status">
              {answers.occupationTitle} · {answers.skills.length} skills listed
            </p>
          )}
          <AgentTimeline steps={steps} running={status === 'running'} />
          <PlanPhases plan={plan} />
          {error && <p className="status status--error">{error}</p>}
          {status !== 'running' && (
            <button type="button" onClick={startOver}>Start over</button>
          )}
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Add the styles**

Append to `frontend/src/App.css`:

```css
.timeline { display: flex; flex-direction: column; gap: 12px; }
.timeline__heading, .plan__heading {
  font-family: var(--display); font-size: 20px; font-weight: 600; margin: 0;
}
.timeline__list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 14px; }
.timeline__item {
  padding-left: 16px; border-left: 2px solid var(--moss);
  animation: step-in 320ms ease both;
}
.timeline__item--pending { border-left-color: var(--rule); }
.timeline__thought { margin: 0 0 4px; font-size: 15px; }
.timeline__obs { margin: 0; font-size: 13px; color: var(--ink-dim); }
.timeline__tool {
  display: inline-block; margin-right: 8px; padding: 1px 6px;
  border: 1px solid var(--rule); border-radius: 4px; font-size: 12px; color: var(--amber);
}

@keyframes step-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: none; }
}

.plan { display: flex; flex-direction: column; gap: 20px; }
.plan__summary { margin: 0; color: var(--ink-dim); font-size: 15px; line-height: 1.5; }
.plan__path { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
.plan__node { display: flex; align-items: baseline; gap: 12px; }
.plan__score { font-family: var(--display); font-size: 22px; color: var(--moss); }
.plan__node-title { font-size: 16px; }
.plan__overlap { font-size: 13px; color: var(--ink-dim); }
.plan__window {
  font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--ink-dim); margin: 0 0 10px;
}
.plan__milestones { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 16px; }
.plan__action { margin: 0 0 4px; font-weight: 600; font-size: 15px; }
.plan__reason { margin: 0 0 4px; color: var(--ink-dim); font-size: 14px; line-height: 1.4; }
.plan__source { margin: 0; font-size: 12px; color: var(--amber); }

@media (prefers-reduced-motion: reduce) {
  .timeline__item { animation: none; }
}
```

- [ ] **Step 5: Verify end to end locally**

Run the backend and frontend together:

```bash
cd backend && uvicorn app.main:app --reload --port 8000
```

```bash
cd frontend && npm run dev
```

Complete the questionnaire. Expected: steps appear one at a time over roughly
15-25 seconds, then a plan with phases whose milestones each show a `T###`
citation.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.jsx frontend/src/App.css frontend/src/components
git commit -m "feat: show streamed agent steps and the phased plan"
```

---

## Task 8: Supabase persistence

**Files:**
- Create: `supabase/schema.sql`, `frontend/src/lib/supabase.js`
- Modify: `frontend/.env.production`, `frontend/package.json`, `frontend/src/App.jsx`

**Interfaces:**
- Produces:
  - `ensureSession(): Promise<Session>`
  - `savePlan({ socCode, occupationTitle, answers, plan, steps }): Promise<string>` — returns the row id
  - `loadPlan(id): Promise<Row | null>`

- [ ] **Step 1: Create the Supabase project and enable anonymous sign-in**

In the Supabase dashboard: create a project, then **Authentication → Providers →
Anonymous sign-ins → enable**. Without this, `signInAnonymously()` returns a
422 and nothing saves.

- [ ] **Step 2: Write and run the schema**

Write `supabase/schema.sql`:

```sql
-- One row per generated plan, carrying the questionnaire answers that
-- produced it. Kept in the repo so the database is reproducible.

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  soc_code text not null,
  occupation_title text not null,
  answers jsonb not null default '{}'::jsonb,
  plan jsonb,
  steps jsonb,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

-- RLS is the only thing protecting these rows: the anon key is publishable
-- by design and ships inside the JS bundle.
alter table public.plans enable row level security;

drop policy if exists "owner_full_access" on public.plans;
create policy "owner_full_access" on public.plans
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "public_read_shared" on public.plans;
create policy "public_read_shared" on public.plans
  for select
  using (is_public);

create index if not exists plans_user_created_idx
  on public.plans (user_id, created_at desc);
```

Paste it into the Supabase SQL editor and run it.

- [ ] **Step 3: Install the client and add config**

```bash
cd frontend && npm install @supabase/supabase-js@2.45.4
```

Append to `frontend/.env.production` (values from Supabase → Project Settings →
API):

```text
# Publishable by design — the anon key is safe in the bundle *because* RLS is
# enabled on every table. See supabase/schema.sql.
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

Create `frontend/.env.local` with the same two values for local development.
`.env.local` is already covered by `.gitignore`.

- [ ] **Step 4: Write the client module**

Write `frontend/src/lib/supabase.js`:

```js
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Persistence is optional: if the project isn't configured, the planner must
// still work. Every function below degrades to a no-op rather than throwing.
export const isConfigured = Boolean(url && anonKey)

export const supabase = isConfigured ? createClient(url, anonKey) : null

/**
 * Anonymous sign-in, so a visitor gets a real user_id — and therefore row
 * level security — without being asked to create an account. Judges will not
 * sign up to try a demo.
 */
export async function ensureSession() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  if (data.session) return data.session
  const { data: created, error } = await supabase.auth.signInAnonymously()
  if (error) {
    console.warn('Anonymous sign-in failed; plans will not be saved.', error.message)
    return null
  }
  return created.session
}

export async function savePlan({ socCode, occupationTitle, answers, plan, steps }) {
  if (!supabase) return null
  const session = await ensureSession()
  if (!session) return null

  const { data, error } = await supabase
    .from('plans')
    .insert({
      user_id: session.user.id,
      soc_code: socCode,
      occupation_title: occupationTitle,
      answers,
      plan,
      steps,
    })
    .select('id')
    .single()

  if (error) {
    console.warn('Could not save plan:', error.message)
    return null
  }
  return data.id
}

export async function loadPlan(id) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('plans')
    .select('id, soc_code, occupation_title, answers, plan, steps, created_at')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.warn('Could not load plan:', error.message)
    return null
  }
  return data
}
```

- [ ] **Step 5: Save on completion and offer the link**

In `frontend/src/App.jsx`, add the imports:

```jsx
import { useEffect } from 'react'
import { savePlan } from './lib/supabase'
```

and inside `App`, add state and an effect that saves once the plan lands:

```jsx
  const [shareId, setShareId] = useState(null)

  useEffect(() => {
    if (!plan || !answers || shareId) return
    savePlan({
      socCode: answers.socCode,
      occupationTitle: answers.occupationTitle,
      answers,
      plan,
      steps,
    }).then(setShareId)
  }, [plan, answers, steps, shareId])
```

Then render the link after `<PlanPhases plan={plan} />`:

```jsx
          {shareId && (
            <p className="status">
              Shareable link:{' '}
              <a href={`${window.location.origin}/plan/${shareId}`}>
                /plan/{shareId.slice(0, 8)}
              </a>
            </p>
          )}
```

Reset `shareId` inside `startOver`:

```jsx
  function startOver() {
    setAnswers(null)
    setShareId(null)
    reset()
  }
```

- [ ] **Step 6: Verify RLS actually protects rows**

In the Supabase SQL editor:

```sql
-- Must return 0 rows: anon has no session, and these rows are only readable
-- when is_public is true.
set role anon;
select count(*) from public.plans where is_public = false;
reset role;
```

Then in the browser: complete the questionnaire, confirm a row appears in
**Table Editor → plans** with your answers in the `answers` column.

- [ ] **Step 7: Commit**

```bash
git add supabase/schema.sql frontend/src/lib/supabase.js frontend/.env.production frontend/src/App.jsx frontend/package.json frontend/package-lock.json
git commit -m "feat: persist questionnaire answers and plans to Supabase"
```

---

## Task 9: Shared plan route

**Files:**
- Modify: `frontend/src/main.jsx`, `frontend/src/App.jsx`, `frontend/package.json`
- Create: `frontend/src/SharedPlan.jsx`

**Interfaces:**
- Consumes: `loadPlan(id)` (Task 8), `PlanPhases` (Task 7).

- [ ] **Step 1: Install the router**

```bash
cd frontend && npm install react-router-dom@6.26.2
```

- [ ] **Step 2: Write the shared view**

Write `frontend/src/SharedPlan.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import PlanPhases from './components/PlanPhases'
import Logo from './components/Logo'
import { loadPlan } from './lib/supabase'

export default function SharedPlan() {
  const { id } = useParams()
  const [row, setRow] = useState(null)
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    loadPlan(id).then((result) => {
      setRow(result)
      setStatus(result ? 'ready' : 'missing')
    })
  }, [id])

  return (
    <div className="app">
      <header className="app__header">
        <span className="app__eyebrow app__eyebrow--brand">
          <Logo size={18} /> Groundwork
        </span>
        <h1>{row ? row.occupation_title : 'Shared plan'}</h1>
      </header>

      {status === 'loading' && <p className="status">Loading…</p>}
      {status === 'missing' && (
        <p className="status status--error">
          That plan is not available. It may have been made private.
        </p>
      )}
      {status === 'ready' && <PlanPhases plan={row.plan} />}
    </div>
  )
}
```

- [ ] **Step 3: Add routing**

Replace `frontend/src/main.jsx` with:

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App'
import SharedPlan from './SharedPlan'
import './App.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/plan/:id" element={<SharedPlan />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
```

Note: `frontend/vercel.json` already rewrites all paths to `/index.html`, so
`/plan/:id` will not 404 on a hard refresh.

- [ ] **Step 4: Verify**

```bash
cd frontend && npm run dev
```

Generate a plan, copy the share link, open it in a private window (which has no
session). Expected: the plan renders, because `public_read_shared` allows it.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/main.jsx frontend/src/SharedPlan.jsx frontend/package.json frontend/package-lock.json
git commit -m "feat: add shareable plan route"
```

---

## Task 10: Full-stack verification

- [ ] **Step 1: Run every test**

```bash
cd backend && python -m pytest tests/ -v
cd ../frontend && npm test
```

Expected: all pass.

- [ ] **Step 2: Confirm the fallback still holds**

```bash
cd backend && FEATHERLESS_API_KEY= python -c "
from fastapi.testclient import TestClient
from app.main import app
import json, logging
logging.disable(logging.CRITICAL)
c = TestClient(app, raise_server_exceptions=False)
print('resolve:', c.post('/resolve-occupation', json={'title':'data analyst'}).json()['matched_by'])
with c.stream('POST','/career-plan/stream', json={'soc_code':'15-2051.00','skills':['SQL']}) as r:
    for line in r.iter_lines():
        if line.startswith('data: '):
            e = json.loads(line[6:])
            if e['type'] == 'final':
                print('plan by:', e['plan']['generated_by'], '| phases:', len(e['plan']['phases']))
"
```

Expected: `resolve: fallback`, `plan by: computation`, at least 2 phases. A
questionnaire that produces nothing when Featherless is down is a failed demo.

- [ ] **Step 3: Deploy and verify live**

```bash
git push origin main
```

Wait for both deploys, then check the deployed frontend bundle points at the
right backend:

```bash
curl -s https://groundwork-orcin-three.vercel.app/ | grep -o '/assets/index-[^"]*\.js'
```

Fetch that bundle and confirm it contains `groundwork-api-92jh.onrender.com`.

- [ ] **Step 4: Walk the deployed flow**

Complete the questionnaire on the live site. Confirm: steps stream in, the plan
renders with `T###` citations, a share link appears, and the share link opens in
a private window.

- [ ] **Step 5: Warm the instance before demoing**

Render free instances sleep after 15 minutes and cold-start in roughly 25
seconds. Load the site once shortly before recording or presenting.

---

## Self-Review

**Spec coverage.** Questionnaire replaces the search box — Task 6 builds it,
Task 7 renders it in place of the old form in `App.jsx`. It collects role
(Task 6 Step 2), skills (Step 3), time and budget (Step 4), goal (Step 5).
Answers drive the agent — Task 3 threads them into the prompt and the system
rules. Supabase persists answers and plan — Task 8. Sharing — Task 9.

**Placeholders.** None: every code step contains complete content, every test
step contains real assertions, and every command is runnable as written.

**Type consistency.** `toRequestPayload()` (Task 2) emits `soc_code`, `skills`,
`goal_type`, `goal`, `weekly_hours`, `budget`; `CareerPlanRequest` (Task 3)
declares exactly those fields. `usePlanStream().start()` (Task 5) takes that
same object. `savePlan()` (Task 8) takes `{socCode, occupationTitle, answers,
plan, steps}` and `App.jsx` passes exactly those. `run_career_agent`'s new
`profile` parameter matches the dict built in `career.py`.

**Known gap, flagged not fixed:** with three occupations in the dataset,
`goal_type: "change"` has almost nowhere to send anyone. The questionnaire is
correct; the data is thin. Expanding `mock_tasks_joined.csv` via
`join_datasets.py` is out of scope for this plan.
