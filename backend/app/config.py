from pathlib import Path
import pandas as pd

DATA_DIR = Path(__file__).parent / "data"

# Swap this path once join_datasets.py has produced the real joined table.
# Keeping it as a single swappable constant means nothing else in the app
# needs to change when mock data is replaced with real data.
TASKS_JOINED_CSV = DATA_DIR / "mock_tasks_joined.csv"


def load_tasks_df() -> pd.DataFrame:
    return pd.read_csv(TASKS_JOINED_CSV)


def load_occupation_list() -> list[dict]:
    """Distinct (soc_code, title) pairs — used as the candidate list for Stage 0 matching."""
    df = load_tasks_df()
    pairs = df[["soc_code", "occupation_title"]].drop_duplicates()
    return [
        {"soc_code": row.soc_code, "title": row.occupation_title}
        for row in pairs.itertuples()
    ]
