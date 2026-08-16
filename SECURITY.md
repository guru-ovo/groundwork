# Groundwork — security checklist

Ordered by actual risk in this specific situation, not a generic list. Each
item states what the code does now, so this file can be checked against
`backend/app/main.py` rather than taken on trust.

## 1. The API key is the only real secret — protect it accordingly

The repo is currently **private**. If you make it public (Devpost and most
hackathons require it), this becomes the top risk overnight.

- `.gitignore` excludes `.env`, and the key has never been committed —
  verified with `git log -S` across all branches.
- If a key is *ever* committed, deleting it in a later commit is not enough:
  it stays in git history forever. **Rotate the key in the Featherless
  dashboard immediately**, then either rewrite history or start a fresh repo.
- Never paste a real key into code comments, README examples, issue threads,
  or submission text. Use `your_key_here`, as `.env.example` does.
- The key is read **server-side only**, via `os.getenv` in
  `services/featherless_client.py`. It is never sent to the browser.

## 2. Never let the frontend touch Featherless directly

`frontend/src/api.js` only ever calls this project's own backend. Keep it that
way. The moment a Featherless key reaches frontend code it ships inside the JS
bundle, and anyone can read it from dev tools on the live demo.

## 3. CORS is an allow-list, never `*`

`main.py` allows:

- the exact origins in `ALLOWED_ORIGINS` (defaults to `http://localhost:5173`)
- plus `https://.*\.vercel\.app` by regex, so Vercel preview deployments work

Note the consequence: `http://127.0.0.1:5173` is **not** the same origin as
`http://localhost:5173` and will be rejected. If preflight starts failing with
a 400, check the origin the browser is actually sending before suspecting the
backend.

Set `ALLOWED_ORIGINS` on the deployed backend to the production frontend URL.
Never `*` — the regex above is already the widest this should ever be.

## 4. Protect the credit budget

`main.py` rate-limits per IP: **`RATE_LIMIT = 120` requests per
`RATE_WINDOW = 300` seconds**. Deliberately loose so one judge exploring the
app is not cut off mid-session.

It is in-memory and per-process, so it resets on restart and does not hold
across replicas — enough to stop a frontend retry loop or an over-eager
visitor, not a real defence against a determined one.

If you demo live rather than from a recording, note that several full takes
plus reloads can approach this limit, and every occupation search is now a
real API call.

## 5. Don't leak internals in error responses

An `@app.exception_handler(Exception)` logs the full traceback server-side and
returns `{"detail": "Something went wrong."}` to the caller. Keep it: `/tasks/`
and `/adjacent/` are the endpoints a curious judge is most likely to hit
directly with a malformed code.

## 6. Validate input, don't trust it

All three POST endpoints take Pydantic models — `ResolveRequest`,
`RoadmapRequest`, `CareerPlanRequest` — so malformed JSON is rejected with a
422 before it reaches the scoring logic. Bounds are declared where they
matter, e.g. `weekly_hours: float | None = Field(default=None, ge=0, le=80)`.

Keep new endpoints on this pattern rather than reading raw request bodies.

## 7. Treat model output as untrusted input

The agent's output is rendered to a person making decisions about their
livelihood, so it is validated the same way user input would be:

- `_attach_authoritative_scores()` discards every number the model wrote and
  substitutes the computed one.
- `_enforce_citations()` drops any milestone citing a task id that does not
  exist in the dataset; if none survive, the run falls back to the computed
  plan.
- Text fields are length-capped before they reach the response.

This is an integrity control, not decoration: without it a model can put a
fabricated figure in front of someone as though it were measured.

## 8. Pin your dependencies

`requirements.txt` pins exact versions. Do the same for anything new — an
unpinned dependency taking a breaking change mid-hackathon is a bad way to
lose build time.

---

**Not covered, because the product does not do it:** there is no account
system, no session store, no database, and no analytics. Questionnaire answers
live in browser memory for the length of the visit and are never persisted, so
there is no user data at rest to protect or to delete.
