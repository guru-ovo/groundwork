# Groundwork

**What's actually changing in your field — grounded in real data, not an AI's guess.**

Groundwork breaks a job into its real O\*NET tasks, scores each task's exposure
to AI against two independent published sources, and builds a personalised plan
where every milestone cites the figure that justifies it.

The distinguishing claim is narrow and checkable:

> **The score is computed. Only the explanation is written.**
> Zero language-model calls take place inside the number.

Most "will AI take my job" tools are one prompt in a trench coat: a title goes
to a model, a score comes back, and nothing about it can be audited. Groundwork
runs four stages and exactly one of them touches a model — at the end, to put
arithmetic into sentences.

---

## Contents

- [How the score is computed](#how-the-score-is-computed)
- [Why you can believe it](#why-you-can-believe-it-enforcement-not-assurance)
- [Honest limitations](#honest-limitations)
- [Quick start](#quick-start)
- [Demo path](#demo-path)
- [API](#api)
- [Project structure](#project-structure)
- [Data sources and attribution](#data-sources-and-attribution)

---

## The pipeline

```
free-text job title
      │
      ▼
[Stage 0] Resolve      small LLM   title → one O*NET occupation
      │                            the only place a guess is allowed
      ▼
[Stage 1] Decompose    no LLM      pull the real task list + O*NET ratings
      │
      ▼
[Stage 2] Score        no LLM      blend two exposure measures per task
      │
      ▼
[Stage 3] Aggregate    no LLM      weight by importance × frequency
      │
      ▼
[Stage 4] Explain      strong LLM  write the plan; every milestone cites a task
      │
      ▼
   Report
```

Stage 0 has a deterministic fallback with no network I/O, so an LLM outage
costs eloquence, not availability. Stages 1–3 are pure pandas. If the model is
unreachable, Groundwork still answers "what is changing in my field" — it just
says it less gracefully.

---

## How the score is computed

Every task carries two **independent** measures:

| Measure | What it is | Values |
| --- | --- | --- |
| **Economic Index label** | Anthropic Economic Index — AI use that has **actually been observed** | `automation` → 1.0 · `augmentation` → 0.5 · `none` → 0.0 · `unknown` → *not counted* |
| **Eloundou β** | Published **theoretical** exposure coefficient (Eloundou et al. 2023) | `0.0` · `0.5` · `1.0` |

**Per task:**

```
observed?  composite = (economic_index_weight + β) / 2
otherwise  composite = β
```

Averaging means a task scores high only when **both** the observed-usage data
and the independent theoretical measure agree. Where usage was never observed,
β carries the task alone — rather than being averaged against a zero we cannot
justify.

**Per occupation:**

```
aggregate  = Σ(composite × importance × frequency) ÷ Σ(importance × frequency)
resilience = round((1 − aggregate) × 100)
```

Importance (1–5) and frequency (1–7) come from O\*NET's incumbent survey. A task
performed yearly should not move the score as much as one performed daily.

**Worked example** — Human Resources Specialists, four real rows:

| Task | β | Economic Index | Arithmetic | Exposure |
| --- | --- | --- | --- | --- |
| Contact job applicants about application status | 1.0 | `automation` (1.0) | (1.0 + 1.0) / 2 | **1.00** |
| Interpret and explain HR policies and regulations | 1.0 | `augmentation` (0.5) | (0.5 + 1.0) / 2 | **0.75** |
| Inform applicants of duties, compensation, benefits | 1.0 | `none` (0.0) | (0.0 + 1.0) / 2 | **0.50** |
| Address employee relations issues, e.g. harassment allegations | 0.0 | `none` (0.0) | (0.0 + 0.0) / 2 | **0.00** |

The last row is the strongest kind of evidence in the dataset: theoretically
not doable **and** measured as not happening. Two independent sources, same
answer.

The third row is the interesting one — theoretically fully automatable, but
observation says almost nobody does it that way. The sources disagree, so the
score lands between them. Neither is allowed to win outright.

### `none` is not `unknown`

This distinction is enforced in code and it matters more than any other design
decision here:

- **`none`** — it was measured, and usage was minimal. That is **evidence**.
- **`unknown`** — nothing was measured. That is the **absence** of evidence.

Roughly 81% of task rows are `unknown`. Treating them as `none` would score
most of the corpus as fully resilient on the observed-usage half of the
composite — the single easiest way to make this product confidently wrong. In
the UI they read as *"not observed"*, never as a measurement.

---

## Why you can believe it: enforcement, not assurance

A prompt is a request. These are guarantees:

**Every figure is recomputed, never trusted.** `_attach_authoritative_scores()`
throws away whatever the model wrote in any numeric field and substitutes the
computed value. The agent can hallucinate a resilience score; it cannot get one
onto the page.

**Every milestone must cite a task that exists.** `_enforce_citations()` parses
the citation, checks the task id against the dataset, and drops milestones that
cite nothing or cite something invented. If nothing survives, the run falls back
to the computed plan — an ungrounded plan is worse than a plain one.

**A destination may never score worse than where you are.** Interest fit is a
tie-breaker between destinations that already score at least as high, never a
reason to accept more exposure. If nothing adjacent scores higher, the report
says so and reshapes the role instead of moving it.

**The summary may not restate counts.** The computed lede prints the task split
directly above it. A model recalling that figure slightly wrong would sit next
to the true one and contradict it, so it is told to describe the approach
instead.

**The score never depends on the model.** It is fetched in parallel with the
agent run and rendered the moment it lands. When plan generation fails the page
says *"Your score survived. The plan didn't."* and keeps the number, the task
breakdown and the full table — because none of them ever needed the model.

---

## Honest limitations

Stated here for the same reason they are stated in the product itself.

**Coverage is thin, and the app says so on every report.**

| | |
| --- | --- |
| Occupations | **922** |
| Scored task rows | **18,747** |
| Rows with observed-usage data | **3,473** (18.5%) |
| Mean per-occupation coverage | **17.7%** |
| Median per-occupation coverage | **11.8%** |
| Occupations with **0%** coverage | **232** |
| Occupations O\*NET has not surveyed | **44** (tasks weighted equally; flagged in the UI) |

Every report shows its own coverage figure and whether its task weights are
real or estimated. A score built on 4% coverage deserves less confidence than
one built on 80%, and the reader is entitled to know which they are looking at.

**This is a measurement of the present, not a forecast.** The Economic Index
observes AI usage that has already happened. It is not a prediction of job loss,
and the product refuses to present it as one — including in the model's own
output, which is instructed never to predict job loss.

**β is coarse.** The Eloundou coefficient takes three values (0, 0.5, 1.0), so
per-task exposure is granular only to 0.25 steps.

**Stage 0 can mis-resolve an unusual title.** Which is why the match is never
hidden or auto-advanced past: three candidates with confidence figures are
shown, and the user picks. The whole measurement hangs on that choice.

---

## Quick start

Built and tested on Python 3.14 and Node 24. Python 3.11+ and Node 18+ should
work, but are not what this was verified against.

### Backend

```bash
cd backend
python3 -m venv venv && ./venv/bin/pip install -r requirements.txt
cp .env.example .env        # then add your Featherless key
./venv/bin/uvicorn app.main:app --port 8000
```

`http://localhost:8000/health` should return `{"status": "ok"}`.
(`http://localhost:8000/` returns 404 by design — the API has no root route.)

### Frontend

```bash
cd frontend
npm install
npm run dev
```

`http://localhost:5173` — landing page. `/start` — the product.

> The dev server uses `strictPort`, so it refuses to start if 5173 is taken
> rather than silently moving to 5174. That is deliberate: the backend allows
> exactly one dev origin, and a silent port change makes every request fail CORS
> preflight in a way that looks like a broken backend.

### Without an API key

Everything except the written plan still works. Stage 0 falls back to a
deterministic matcher, and the agent produces a computed plan with real
citations. You lose the prose, not the product.

To verify a key is live:

```bash
curl -s -N -m 120 -X POST http://localhost:8000/career-plan/stream \
  -H 'Content-Type: application/json' \
  -d '{"soc_code":"13-1071.00","skills":["recruiting"],"goal_type":"move","weekly_hours":7.5,"budget":"free"}' \
  | grep -o '"generated_by": "[a-z]*"'
```

`"agent"` means the model wrote it. `"computation"` means it fell back.

---

## Demo path

**Type `human resources specialist`.** It has the highest observed-usage
coverage of any widely recognised occupation in the dataset, and the clearest
story.

| | |
| --- | --- |
| Resilience | **44** |
| Coverage | **58%** |
| Task weighting | O\*NET incumbent (real survey data) |
| Split | 20 under pressure / 6 holding |
| Path | always **upward** — observed runs give Compensation & Benefits Specialists (55) or HR Managers (53) |

The destination varies between runs because the agent chooses it, but it can no
longer go *down*: a hard rule forbids a destination scoring below where the
person already is.

The line worth saying out loud, and it is computed rather than written:

> Contacting applicants about their application status scores **1.00** —
> `automation`, β 1.00. Addressing harassment allegations scores **0.00** —
> `none`, β 0.00.
>
> **AI already sends the rejection email. It cannot sit in the room when
> someone reports harassment.**

Two alternatives, for different arguments:

- **`lawyer`** — the most dramatic split (0.75 drafting briefs vs 0.00
  representing clients in court), but 24% coverage, and nothing adjacent scores
  higher, so the report honestly says the role should be reshaped rather than
  left.
- **`driver`** — 9% coverage, printed plainly on screen. Use it to show the
  honesty mechanism working rather than the score.

Avoid **Data Scientists**: 0% coverage and zero holding tasks, so the report is
correct but looks broken.

---

## API

All read endpoints are pure computation and answer in milliseconds.

| Method | Path | LLM | Returns |
| --- | --- | --- | --- |
| `GET` | `/health` | — | `{"status": "ok"}` |
| `POST` | `/resolve-occupation` | small (with fallback) | ≤3 candidate SOC codes with confidence |
| `GET` | `/tasks/{soc_code}` | no | score, coverage, per-task breakdown |
| `GET` | `/adjacent/{soc_code}?limit=` | no | nearest occupations by task overlap |
| `GET` | `/compare/{soc_a}/{soc_b}` | no | shared tasks and the gap |
| `GET` | `/interests/questions` | no | the six RIASEC prompts |
| `POST` | `/career-plan/stream` | strong | SSE: analysis → steps → final plan |
| `POST` | `/roadmap` | strong | legacy single-shot roadmap (not used by the UI) |

Guardrails in `main.py`: exact-origin CORS plus a `*.vercel.app` preview regex
(never `*`), a per-IP rate limit of 120 requests / 300s, and an exception
handler that logs the traceback server-side while returning a generic message.

---

## Project structure

```
backend/app/
  main.py                  CORS, rate limiting, error handling
  config.py                the joined table, parsed once and cached
  data/tasks_joined.csv    O*NET 29.0 ⋈ Economic Index ⋈ Eloundou β
  routers/                 occupation · tasks · career · roadmap
  services/
    scoring.py             the score. zero LLM calls, by design
    similarity.py          task overlap, adjacency, gap analysis
    interests.py           RIASEC fit against O*NET profiles
    matching.py            deterministic Stage 0 fallback, no network I/O
    career_agent.py        the agent loop, its tools and its guardrails
    profile_analysis.py    reads free text back into structure
    featherless_client.py  streaming JSON completions + failure recovery

frontend/src/
  landing/                 marketing page (light "Paper" surface)
  questionnaire/           7-step split shell + live match panel
  components/              gauge · timeline · report · table · states
  hooks/                   plan stream · surface · motion gate
  lib/printPlan.js         PDF export via the print pipeline
  App.css                  all design tokens, both surfaces
```

### Two surfaces, one token set

`:root` carries the dark product palette; `html[data-surface="paper"]` re-points
the same semantic names at the light landing palette. Components read `--bg`,
`--ink`, `--rule` and never learn which surface they are on. Switching at the
document root — rather than on a wrapper — is what makes "never mix the two
within one surface" structural instead of a thing to remember.

### Motion is additive

Entrance animations are gated behind a class added inside a real
`requestAnimationFrame`. If no frame ever runs — reduced motion, a print, a
background tab — content renders in its finished state rather than stranded at
`opacity: 0`. The score gauge follows the same rule: it writes its true value
first and only then rewinds to animate.

---

## Data sources and attribution

- **O\*NET 29.0** — U.S. Department of Labor, Employment and Training
  Administration. Used under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
  <https://www.onetcenter.org/>
- **Anthropic Economic Index** — observed Claude usage mapped to O\*NET tasks.
  <https://huggingface.co/datasets/Anthropic/EconomicIndex>
- **Eloundou, Manning, Mishkin & Rock (2023)** — *GPTs are GPTs: An Early Look
  at the Labor Market Impact Potential of Large Language Models.*
  <https://arxiv.org/abs/2303.10130>

O\*NET is a registered trademark of the U.S. Department of Labor. Groundwork is
not affiliated with or endorsed by the Department of Labor, Anthropic, or the
authors of the exposure research.

`app/data/join_datasets.py` documents how the joined table is built.

---

## Built / not built

**Built.** Landing page; occupation resolution with a deterministic fallback;
grounded per-task scoring; the confidence panel; a 7-step questionnaire with a
live match panel; a streaming agent whose citations are enforced; the results
report; a sortable task-breakdown table; empty, loading and error states; PDF
export.

**Not built.** Résumé upload for skill extraction; live job-posting URL parsing;
cross-occupation comparison in the UI (the `/compare` endpoint exists and works,
but nothing renders it yet); persistence of any kind — there is no account and
no database, and the questionnaire lives in your session.

---

## Licence

Source code is [MIT](LICENSE).

The bundled dataset is **not** covered by that licence — it is derived from the
three sources above and keeps their terms. O\*NET is CC BY 4.0, and that
attribution requirement is satisfied in the site footer, in this file, and in
`LICENSE`. Redistributing this repository does not relicense the data.

See [`SECURITY.md`](SECURITY.md) for the deployment checklist — API-key
handling, CORS, and rate limiting, ordered by actual risk rather than as a
generic list.
