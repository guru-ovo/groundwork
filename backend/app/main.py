import logging
import os
import time
from collections import defaultdict

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.routers import career, occupation, tasks, roadmap

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("groundwork")

app = FastAPI(title="Groundwork API")

# Exact origins, comma-separated, via ALLOWED_ORIGINS — set this on Render to
# your Vercel URL. Still never "*": the rate limiter is per-IP and the
# Featherless key is on this side of the wire.
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]

# Vercel gives every branch and every deploy its own preview subdomain, so the
# preview URLs can't be enumerated ahead of time — match them by pattern.
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Minimal rate limiting -------------------------------------------------
# A hackathon-scoped guardrail, not production-grade: caps requests per IP
# so a stray frontend loop (or a judge double-clicking) can't silently burn
# through your Featherless credit allocation mid-demo. Swap for slowapi or
# a proper gateway if this goes past the hackathon.
_request_log = defaultdict(list)
RATE_LIMIT = 120      # requests — raised for judging: one visitor exploring an
                      # occupation plus a single agent run is already a dozen,
                      # and several judges can share an institutional NAT'd IP.
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
# whoever is poking at your public demo URL, judges included. But DO log the
# traceback server-side — registering this handler stops uvicorn from printing
# one, so without this the platform logs show an access line and nothing else,
# and a 500 becomes undebuggable.
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Something went wrong."})


app.include_router(occupation.router)
app.include_router(tasks.router)
app.include_router(roadmap.router)
app.include_router(career.router)


@app.get("/health")
def health():
    return {"status": "ok"}
