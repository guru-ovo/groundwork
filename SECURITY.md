# Groundwork — security checklist

Ordered by actual risk in this specific situation, not a generic list.

## 1. Your repo must be public — treat that as the top risk
Devpost requires a public repo. `.gitignore` is already set up to exclude
`.env`, but that only protects you going forward:
- Before your first commit, double-check `git status` shows `.env` as
  untracked, not staged.
- If a key is *ever* accidentally committed, removing it in a later commit
  is not enough — it stays in git history. Rotate the key in your
  Featherless dashboard immediately and force-push a cleaned history, or
  start a fresh repo.
- Never paste real API keys into code comments, README examples, or your
  Devpost submission text — use `your_key_here` placeholders only, as in
  `.env.example`.

## 2. Never let the frontend touch Featherless directly
The frontend only ever calls your own backend (`localhost:8000`), never
Featherless's API directly — this is already how `api.js` is written.
Keep it that way: the moment a Featherless key ends up in frontend code,
it ships inside the JS bundle and is visible to anyone who opens dev tools
on your live demo.

## 3. Lock down CORS before you deploy
`main.py` currently only allows `http://localhost:5173`. If you deploy the
frontend (Vercel, Netlify, etc.) for the demo video or judging, update
`allow_origins` to that exact deployed URL — never `"*"`, especially once
any endpoint touches credentials.

## 4. Protect your Featherless credit budget
`main.py` now includes a basic per-IP rate limiter (30 requests / 5 min).
It's not production-grade, but it's enough to stop a stray frontend retry
loop or an over-eager judge from burning through your 25-credit allocation
mid-demo. If you're demoing live rather than from a recording, consider
tightening this further right before you present.

## 5. Don't leak internals in error responses
A generic exception handler is wired up so unexpected errors return
`{"detail": "Something went wrong."}` instead of a raw stack trace with
file paths. Keep this in place for anything a judge might poke at
directly (e.g. hitting `/tasks/invalid-code` in a browser).

## 6. Validate input, don't trust it
`ResolveRequest` and `RoadmapRequest` already use Pydantic models, so
malformed JSON gets rejected before it reaches your scoring logic. Keep
new endpoints on this pattern rather than reading raw request bodies.

## 7. Pin your dependencies
`requirements.txt` already pins exact versions. Do the same if you add
new packages — an unpinned dependency picking up a breaking change mid-
hackathon is a bad way to lose build time.
