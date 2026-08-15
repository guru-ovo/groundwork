# Task-Corpus Retrieval — Design

**Date:** 2026-08-15
**Status:** Proposed
**Origin:** Requested as "the same feature as `juanmanueldaza/fu7ur3pr00f`" — that
project's ChromaDB RAG memory. Scoped here to retrieval over the task corpus.

---

## Context

Groundwork's agent currently sees tasks only for occupations it has already
named. `get_occupation` needs a SOC code; `find_adjacent_occupations` needs a
starting SOC code. There is no way to ask *"what work in this dataset involves
judgment under uncertainty"* — the agent cannot search the corpus, only look
things up in it.

That is survivable with three occupations and sixteen tasks. It stops working
at the real O\*NET scale the project is aiming for (~900 occupations, ~19,000
task statements), for two separate reasons:

1. **Context.** The whole table cannot be put in a prompt.
2. **Reach.** Adjacency is computed from task-text similarity between whole
   occupations. A person whose interests match a handful of tasks scattered
   across twelve unrelated occupations is invisible to it.

Semantic retrieval over individual task statements fixes both.

**Licensing note:** `fu7ur3pr00f` is GPL-2.0. Nothing in this design derives
from its source; the capability is reimplemented from its README description.
No code is copied, so Groundwork's licensing is unaffected.

---

## Goals

- The agent can retrieve the most semantically relevant task statements for a
  free-text query, across the entire corpus.
- Retrieval degrades to a usable ranking when the embedding provider is down.
- No new runtime Python dependency, and no new hosted service.
- Retrieval decides *which* tasks the agent sees. It never produces a number.

## Non-goals

- Remembering users across sessions. Considered and rejected: a returning-user
  feature demos as a claim, not a moment, and no judge will return.
- Indexing uploaded CVs. That is the `/gather` feature, not this one.
- Replacing `find_adjacent_occupations`. Occupation-level adjacency and
  task-level retrieval answer different questions and both stay.

---

## Approach

**Chosen: a committed vector index, embedded offline, searched in-process.**

Task statements are embedded once by a build script and the resulting matrix is
committed alongside the CSV it was built from. At request time the backend
loads that matrix and computes a cosine against a single freshly embedded
query.

The corpus is static — it changes when the dataset is rebuilt, not when a user
does something. A version-controlled index is the honest shape for static data,
not a workaround: the index and the CSV it describes move together through git,
so they cannot silently disagree.

### Rejected alternatives

**ChromaDB, embedded** (what the original project uses). `chromadb` pulls
`onnxruntime` and `tokenizers` — several hundred MB of install and resident
memory against a 512MB Render instance. Worse, Render free instances have
ephemeral disk: the store would be wiped on every redeploy and every sleep,
so cross-session memory would appear to work in a demo and silently fail
afterwards.

**Supabase pgvector.** Strictly better than the chosen approach *once the
corpus outgrows RAM or changes at runtime*, and Supabase is already planned for
plan persistence. Rejected for now only because it puts an unprovisioned
service on the critical path of the agent's core loop. See Migration below —
this is where the design is expected to end up.

**Chroma Cloud.** Another account, another key, another network hop, no
capability that the two above lack.

---

## Components

### `backend/app/services/featherless_client.py` (modify)

Add:

```python
def embed(texts: list[str], model: str | None = None) -> list[list[float]]
```

POSTs to `/v1/embeddings` with the existing key. The endpoint is
OpenAI-compatible and confirmed present — it answers 401, not 404, without
credentials. Default model `Qwen/Qwen3-Embedding-0.6B`, overridable via
`FEATHERLESS_EMBED_MODEL`.

Batches input (64 per request) so a full-corpus build does not send one
enormous body. Reuses the existing error handling, which preserves the
Featherless response body — the thing that made every previous model failure
diagnosable.

### `backend/app/data/build_task_index.py` (new, offline)

Reads the joined CSV, embeds every `task_description`, writes
`backend/app/data/task_index.npz` containing:

| key | contents |
|---|---|
| `task_ids` | task ID per row, in matrix order |
| `soc_codes` | SOC code per row |
| `vectors` | float16 matrix, L2-normalised at build time |
| `model` | the embedding model used |
| `dim` | vector dimension, read from the API response — never hardcoded |
| `source_csv` | filename the index was built from |
| `built_at` | ISO timestamp |

Vectors are normalised during the build so a query-time search is a plain dot
product rather than a cosine with two norm computations per row.

Run by hand after rebuilding the dataset; the output is committed.

### `backend/app/services/retrieval.py` (new)

```python
def search_tasks(df, query: str, k: int = 8, soc_code: str | None = None) -> list[dict]
```

Loads the index once at module import and caches it. Embeds the query, takes
the dot product against the matrix, returns the top *k* rows joined back to the
dataframe so each result carries its `economic_index_label`, `eloundou_beta`
and `composite_exposure` — computed by `scoring.score_tasks`, exactly as
everywhere else. The optional `soc_code` filters to one occupation.

Also exposes `index_status() -> dict` so a missing or stale index is
observable rather than mysterious.

**Staleness:** if `source_csv` in the index does not match the configured
`TASKS_JOINED_CSV`, log a warning and fall back. An index built from a
different dataset produces confidently wrong retrieval, which is worse than no
retrieval.

### `backend/app/services/career_agent.py` (modify)

Register a sixth tool:

```
search_tasks {"query": str, "k": int} -> tasks ranked by relevance
```

with a system-prompt line telling the agent to use it when the person's own
words describe work that no occupation title captures. `_summarise` gains a
branch producing one readable line for the streamed timeline, e.g.
*"Closest work: 'Detect fraud through judgment-based anomaly review' (none, β 0.0)."*

---

## Data flow

```
build time (manual, offline)
  mock_tasks_joined.csv
    → embed each task_description  (Featherless /v1/embeddings)
    → L2-normalise
    → task_index.npz               (committed to git)

request time
  agent emits {"tool": "search_tasks", "args": {"query": "..."}}
    → embed(query)                 (one Featherless call, ~50ms)
    → dot product vs matrix        (numpy, in process)
    → top-k task IDs
    → join to dataframe, score via scoring.score_tasks
    → observation returned to the agent
```

---

## Error handling

| Failure | Behaviour |
|---|---|
| `task_index.npz` missing | `search_tasks` falls back to TF-IDF ranking from `similarity.py`; logs once at import |
| Index stale (source CSV changed) | Same fallback, warning names both filenames |
| Embedding call fails | Same fallback, for that request only |
| Query embeds to wrong dimension | Raise — a dimension mismatch means the index and the model disagree, and silently returning nonsense ranking is worse than an error the agent can report |

The fallback path matters more than the happy path. `similarity.py` already
computes TF-IDF over task text, so a degraded `search_tasks` still returns
genuinely relevant tasks — just ranked lexically instead of semantically. The
tool never dies, which means the agent never has to reason about a missing
capability.

---

## Testing

1. **Build assertions** — every task gets a vector; dimension is uniform;
   matrix row count equals CSV row count.
2. **Semantic smoke test** — the query *"explaining findings to non-technical
   people"* must return `T004` ("Present analysis and recommendations to
   non-technical stakeholders") in the top 3. This is the test that proves
   embeddings are doing something lexical matching cannot: the query shares
   almost no vocabulary with the task text.
3. **Fallback test** — with `FEATHERLESS_API_KEY` unset, `search_tasks` must
   still return results, and `index_status()` must report the degraded mode.
4. **Staleness test** — point `TASKS_JOINED_CSV` at a different file and
   confirm the warning fires and the fallback engages.
5. **Provenance test** — every returned task's `composite_exposure` must equal
   the value `scoring.score_tasks` produces for that row. Retrieval must not
   introduce a second source of numbers.

---

## Risks

**Index size at full scale.** 19,000 tasks × 1024 dims × float16 is roughly
39MB — large for a git repository, though within the instance's memory. Two
mitigations, in order of preference: Qwen3 embeddings support Matryoshka
truncation, so storing 256 dimensions instead of 1024 cuts this to ~10MB with
modest ranking loss; failing that, Git LFS. **This does not need deciding now**
— at the current corpus size the index is a few kilobytes. It needs deciding
before the real O\*NET join lands.

**Retrieval quality is unmeasured.** There is no labelled relevance set, so
"good retrieval" rests on the single smoke test above. Acceptable at this
scale; it would not be at 19,000 tasks.

---

## Migration to pgvector

The interface is the migration plan. `search_tasks(df, query, k, soc_code)` is
the only thing `career_agent.py` knows about. Moving to Supabase means
reimplementing that one function against an RPC and deleting the npz loader —
the agent, the tool schema, the streamed timeline and the fallback path are all
untouched.

Trigger for the move: the corpus exceeds what is comfortable to commit, or it
starts changing at runtime. Neither is true today.
