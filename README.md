# Groundwork

What's actually changing in your field — grounded in real data, not an AI's guess.

Groundwork breaks a job down into its real O*NET tasks, scores each task's
exposure to AI using two independent published sources (the Anthropic
Economic Index's real usage data, and Eloundou et al.'s theoretical
exposure measure), and generates a personalized skill roadmap that cites
the data behind every recommendation.

## Why this architecture

The exposure score is **pure computation — zero LLM calls**. An LLM only
enters the pipeline once, at the end, to explain and personalize an
already-grounded number. This is deliberate: it's the difference between
"an AI guessed your job is at risk" and "here's the real data on what's
already happening in this role."

## Architecture

```
free-text job title
      │
      ▼
[Stage 0] Occupation resolution ── small LLM ── matches to O*NET SOC code
      │
      ▼
[Stage 1] Task ingestion ── pulls real O*NET task list (no LLM)
      │
      ▼
[Stage 2] Grounded exposure scoring ── Economic Index label + Eloundou β (no LLM)
      │
      ▼
[Stage 3] Aggregation ── weighted by O*NET importance/frequency (no LLM)
      │
      ▼
[Stage 4] Roadmap generation ── strong LLM ── cites the data behind each item
      │
      ▼
  Dashboard
```

## Setup

### Backend
```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in your Featherless + O*NET credentials
uvicorn app.main:app --reload
```
API runs at `http://localhost:8000`. `/health` should return `{"status": "ok"}`.

The app ships with `app/data/mock_tasks_joined.csv` so it runs end-to-end
immediately, covering three sample occupations (Data Scientists, Software
Developers, Accountants and Auditors). Run `app/data/join_datasets.py`
(fill in its TODOs with real O*NET + Hugging Face access) to replace it
with your full target occupation list — then just update `TASKS_JOINED_CSV`
in `app/config.py`.

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Runs at `http://localhost:5173`.

## Data sources & attribution

- **O*NET** — U.S. Department of Labor occupational database. Licensed
  under CC BY 4.0. https://www.onetcenter.org/
- **Anthropic Economic Index** — real Claude usage mapped to O*NET tasks.
  https://huggingface.co/datasets/Anthropic/EconomicIndex
- **Eloundou, Manning, Mishkin & Rock (2023)**, "GPTs are GPTs: An Early
  Look at the Labor Market Impact Potential of Large Language Models" —
  task-level exposure (β) scores.

## What's a stretch vs. what's built

Built: occupation search, grounded per-task scoring, resilience dashboard,
personalized roadmap generation.

Not built (fill in over the hackathon): resume upload for automatic skill
extraction, live job-posting URL parsing, cross-occupation comparison.

## Honest limitation

The Economic Index measures observed AI usage patterns, not a certain
prediction of job loss. We say this explicitly in the product rather than
overselling the score.
