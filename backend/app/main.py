import time
from collections import defaultdict

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.routers import occupation, tasks, roadmap

app = FastAPI(title="Groundwork API")

app.add_middleware(
    CORSMiddleware,
    # Dev only. Before deploying, replace with your exact deployed
    # frontend URL — never "*" once you're sending credentials/keys
    # anywhere near the request path.
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Minimal rate limiting -------------------------------------------------
# A hackathon-scoped guardrail, not production-grade: caps requests per IP
# so a stray frontend loop (or a judge double-clicking) can't silently burn
# through your Featherless credit allocation mid-demo. Swap for slowapi or
# a proper gateway if this goes past the hackathon.
_request_log = defaultdict(list)
RATE_LIMIT = 30       # requests
RATE_WINDOW = 300     # seconds


@app.middleware("http")
async def rate_limit(request: Request, call_next):
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    _request_log[client_ip] = [t for t in _request_log[client_ip] if now - t < RATE_WINDOW]
    if len(_request_log[client_ip]) >= RATE_LIMIT:
        return JSONResponse(status_code=429, content={"detail": "Too many requests — slow down."})
    _request_log[client_ip].append(now)
    return await call_next(request)


# --- Generic error handling -------------------------------------------------
# Don't let FastAPI's default handler leak stack traces / internal paths to
# whoever is poking at your public demo URL, judges included.
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": "Something went wrong."})


app.include_router(occupation.router)
app.include_router(tasks.router)
app.include_router(roadmap.router)


@app.get("/health")
def health():
    return {"status": "ok"}
