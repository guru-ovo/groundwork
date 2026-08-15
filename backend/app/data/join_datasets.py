"""
Groundwork — dataset join (Phase 2)

Run this locally, where you have real internet access, O*NET credentials,
and Hugging Face access. It produces tasks_joined.csv in the same shape as
mock_tasks_joined.csv, so nothing else in the app needs to change — just
flip TASKS_JOINED_CSV in app/config.py once this succeeds.

STEPS (fill in as you go — each is independently testable):

1. O*NET task data
   - Register free at https://services.onetcenter.org/
   - Either download the flat "Task Statements" + "Task Ratings" text files
     from https://www.onetcenter.org/database.html, OR call the Web
     Services API for each target SOC code.
   - You need, per task: soc_code, occupation_title, task_id,
     task_description, and the importance/frequency ratings.

2. Anthropic Economic Index
   - pip install datasets
   - from datasets import load_dataset
     ds = load_dataset("Anthropic/EconomicIndex")
   - Inspect the schema (`ds` prints its splits/columns) — find the field
     that maps to O*NET task/occupation identifiers and the field that
     classifies usage as automation vs. augmentation. Confirm the exact
     column names once you've loaded it; they aren't hardcoded below on
     purpose since the dataset schema should be checked directly rather
     than assumed.

3. Eloundou et al. task exposure (beta scores)
   - The paper "GPTs are GPTs" publishes a task-level exposure table
     mapped to O*NET tasks. Locate the released data table (check the
     paper's supplementary materials / associated GitHub) and load it
     as a DataFrame with at least: task_id (or task_description to
     fuzzy-match on), beta.

4. Join all three on SOC code / task ID (or fuzzy-match on task text where
   IDs don't align cleanly — expect to spend real time here, this is the
   step most likely to need manual cleanup).

5. Write the result to tasks_joined.csv with EXACTLY these columns so the
   rest of the app doesn't need to change:
     soc_code, occupation_title, task_id, task_description,
     onet_importance, onet_frequency, economic_index_label, eloundou_beta
"""

import pandas as pd

TARGET_SOC_CODES = [
    "15-2051.00",  # Data Scientists
    "15-1252.00",  # Software Developers
    "13-2011.00",  # Accountants and Auditors
    # add your remaining 10-12 target occupations here
]


def load_onet_tasks(soc_codes: list[str]) -> pd.DataFrame:
    """TODO: implement against O*NET flat files or Web Services API."""
    raise NotImplementedError("Fill in using the O*NET Task Statements + Task Ratings files")


def load_economic_index() -> pd.DataFrame:
    """TODO: implement against the Anthropic/EconomicIndex Hugging Face dataset."""
    raise NotImplementedError("Load via `datasets.load_dataset('Anthropic/EconomicIndex')`")


def load_eloundou_exposure() -> pd.DataFrame:
    """TODO: implement against the Eloundou et al. released exposure table."""
    raise NotImplementedError("Source the task-level beta scores from the paper's data release")


def build_joined_table() -> pd.DataFrame:
    onet_df = load_onet_tasks(TARGET_SOC_CODES)
    econ_df = load_economic_index()
    eloundou_df = load_eloundou_exposure()

    # TODO: the actual join logic depends on what identifier the three
    # datasets share (SOC code is the most likely common key; task-level
    # alignment may need fuzzy text matching on task_description).
    raise NotImplementedError("Join onet_df, econ_df, eloundou_df on a shared key")


if __name__ == "__main__":
    joined = build_joined_table()
    joined.to_csv("tasks_joined.csv", index=False)
    print(f"Wrote {len(joined)} rows to tasks_joined.csv")
