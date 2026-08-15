from functools import lru_cache
from pathlib import Path
import pandas as pd

DATA_DIR = Path(__file__).parent / "data"

# The real joined table: O*NET 29.0 task statements and ratings, Eloundou et
# al. beta exposure, and Anthropic Economic Index usage labels. Built by
# app/data/join_datasets.py. The mock file is kept for reference.
TASKS_JOINED_CSV = DATA_DIR / "tasks_joined.csv"


@lru_cache(maxsize=1)
def load_tasks_df() -> pd.DataFrame:
    """
    The joined task table, parsed once.

    Cached because this is now 3.1MB and every request touches it — re-reading
    and re-parsing per request cost more than everything else in the pipeline
    combined. Callers treat the result as read-only; nothing in the codebase
    mutates it.
    """
    df = pd.read_csv(TASKS_JOINED_CSV, dtype={"soc_code": str, "task_id": str})
    return df


def load_occupation_list() -> list[dict]:
    """Distinct (soc_code, title) pairs — used as the candidate list for Stage 0 matching."""
    df = load_tasks_df()
    pairs = df[["soc_code", "occupation_title"]].drop_duplicates()
    return [
        {"soc_code": row.soc_code, "title": row.occupation_title}
        for row in pairs.itertuples()
    ]
