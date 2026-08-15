"""
Build the joined task table from the three real published sources.

Run this offline, commit the output, and point config.TASKS_JOINED_CSV at it.
Nothing in the serving path runs this.

    python -m app.data.join_datasets --out app/data/tasks_joined.csv

Sources, all public and all citable:

1. O*NET Database 29.0 (text)  — CC BY 4.0
   https://www.onetcenter.org/dl_files/database/db_29_0_text.zip
   Gives occupations, task statements, and the importance / frequency
   ratings that weight the aggregate.

2. Eloundou et al. (2023), "GPTs are GPTs"  — MIT licensed repo
   https://github.com/openai/GPTs-are-GPTs  (data/full_labelset.tsv)
   Gives the beta exposure measure per task, keyed on O*NET SOC + Task ID,
   so it joins exactly rather than by text.

3. Anthropic Economic Index (2025-03-27 release)
   https://huggingface.co/datasets/Anthropic/EconomicIndex
   Gives observed automation-vs-augmentation collaboration modes per task.
   Keyed on task text, so it joins on normalised lowercase text.

A note on coverage, because it determines what the numbers mean: the
Economic Index covers roughly one task in six. Those are real usage
observations and cannot be invented for the rest. Uncovered tasks are
labelled "unknown" rather than "none" — the two are completely different
claims, and conflating them would quietly bias every uncovered task toward
looking resilient. scoring.py handles "unknown" by falling back to the
Eloundou measure alone.
"""

import argparse
import csv
import sys
from pathlib import Path

import pandas as pd

# O*NET's frequency scale is a distribution over seven ordinal categories,
# not a single number. Collapse it to a 1-7 mean weighted by the reported
# percentage in each category.
FREQUENCY_CATEGORIES = [1, 2, 3, 4, 5, 6, 7]

# The Economic Index reports the share of observed conversations in each
# collaboration mode. Anthropic groups directive and feedback-loop modes as
# automation, and task-iteration / learning / validation as augmentation.
AUTOMATION_MODES = ["directive", "feedback_loop"]
AUGMENTATION_MODES = ["task_iteration", "learning", "validation"]


def load_onet(onet_dir: Path) -> pd.DataFrame:
    occupations = pd.read_csv(
        onet_dir / "Occupation Data.txt", sep="\t", dtype=str,
        quoting=csv.QUOTE_NONE,
    ).rename(columns={"O*NET-SOC Code": "soc_code", "Title": "occupation_title"})

    tasks = pd.read_csv(
        onet_dir / "Task Statements.txt", sep="\t", dtype=str,
        quoting=csv.QUOTE_NONE,
    ).rename(columns={
        "O*NET-SOC Code": "soc_code",
        "Task ID": "task_id",
        "Task": "task_description",
        "Task Type": "task_type",
    })

    ratings = pd.read_csv(
        onet_dir / "Task Ratings.txt", sep="\t", dtype=str,
        quoting=csv.QUOTE_NONE,
    ).rename(columns={
        "O*NET-SOC Code": "soc_code",
        "Task ID": "task_id",
        "Scale ID": "scale",
        "Category": "category",
        "Data Value": "value",
    })
    ratings["value"] = pd.to_numeric(ratings["value"], errors="coerce")

    importance = (
        ratings[ratings["scale"] == "IM"]
        .groupby(["soc_code", "task_id"], as_index=False)["value"]
        .mean()
        .rename(columns={"value": "onet_importance"})
    )

    freq = ratings[ratings["scale"] == "FT"].copy()
    freq["category"] = pd.to_numeric(freq["category"], errors="coerce")
    freq = freq[freq["category"].isin(FREQUENCY_CATEGORIES)]
    # Data Value is a percentage of incumbents reporting that category.
    freq["weighted"] = freq["category"] * freq["value"]
    frequency = (
        freq.groupby(["soc_code", "task_id"])
        .apply(lambda g: g["weighted"].sum() / g["value"].sum()
               if g["value"].sum() else float("nan"),
               include_groups=False)
        .reset_index(name="onet_frequency")
    )

    df = (
        tasks.merge(occupations[["soc_code", "occupation_title"]], on="soc_code")
        .merge(importance, on=["soc_code", "task_id"], how="left")
        .merge(frequency, on=["soc_code", "task_id"], how="left")
    )

    # 44 occupations have task statements but no incumbent ratings — O*NET
    # re-coded them in the 2019 SOC revision and has not surveyed them yet.
    # They are disproportionately the newest and most AI-relevant jobs:
    # Software Developers, Data Scientists, Penetration Testers.
    #
    # Rather than drop them or invent ratings, weight their tasks equally and
    # say so. Their exposure numbers are entirely real — only the relative
    # weighting between tasks is unavailable, and a uniform prior is the
    # honest stand-in for "we do not know which of these matters most".
    df["ratings_source"] = "onet_incumbent"
    unrated = df["onet_importance"].isna() | df["onet_frequency"].isna()
    df.loc[unrated, "ratings_source"] = "uniform_prior"
    df.loc[unrated, "onet_importance"] = 1.0
    df.loc[unrated, "onet_frequency"] = 1.0

    return df


def load_eloundou(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, sep="\t", dtype=str, quoting=csv.QUOTE_NONE)
    df = df.rename(columns={
        "O*NET-SOC Code": "soc_code",
        "Task ID": "task_id",
        "beta": "eloundou_beta",
    })
    df["eloundou_beta"] = pd.to_numeric(df["eloundou_beta"], errors="coerce")
    # Task ID arrives as a float string ("8823.0"); O*NET writes it as an
    # integer string. Normalise or nothing joins.
    df["task_id"] = (
        pd.to_numeric(df["task_id"], errors="coerce")
        .astype("Int64").astype(str)
    )
    return df[["soc_code", "task_id", "eloundou_beta"]].dropna(subset=["eloundou_beta"])


def load_economic_index(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    for column in AUTOMATION_MODES + AUGMENTATION_MODES:
        df[column] = pd.to_numeric(df[column], errors="coerce").fillna(0.0)

    df["automation_share"] = df[AUTOMATION_MODES].sum(axis=1)
    df["augmentation_share"] = df[AUGMENTATION_MODES].sum(axis=1)
    observed = df["automation_share"] + df["augmentation_share"]

    def label(row) -> str:
        total = row["automation_share"] + row["augmentation_share"]
        if total <= 0:
            return "none"
        return "automation" if row["automation_share"] > row["augmentation_share"] else "augmentation"

    df["economic_index_label"] = df.apply(label, axis=1)
    df["ei_observed_share"] = observed
    df["task_key"] = df["task_name"].str.strip().str.lower()
    return df[["task_key", "economic_index_label", "ei_observed_share"]].drop_duplicates("task_key")


def build(onet_dir: Path, eloundou: Path, econ_index: Path, min_tasks: int) -> pd.DataFrame:
    onet = load_onet(onet_dir)
    print(f"O*NET rated tasks: {len(onet):,} across {onet['soc_code'].nunique():,} occupations")

    beta = load_eloundou(eloundou)
    df = onet.merge(beta, on=["soc_code", "task_id"], how="inner")
    print(f"after Eloundou join:  {len(df):,} tasks "
          f"({df['soc_code'].nunique():,} occupations)")

    ei = load_economic_index(econ_index)
    df["task_key"] = df["task_description"].str.strip().str.lower()
    df = df.merge(ei, on="task_key", how="left")

    covered = df["economic_index_label"].notna().sum()
    print(f"Economic Index labels: {covered:,} of {len(df):,} tasks "
          f"({100 * covered / len(df):.1f}%)")

    # "unknown" is a different claim from "none". See the module docstring.
    df["economic_index_label"] = df["economic_index_label"].fillna("unknown")

    # An occupation with one or two rated tasks produces a meaningless
    # weighted aggregate. Drop them rather than publish a confident number
    # built on nothing.
    counts = df.groupby("soc_code")["task_id"].transform("size")
    df = df[counts >= min_tasks]

    df = df[[
        "soc_code", "occupation_title", "task_id", "task_description",
        "onet_importance", "onet_frequency", "economic_index_label",
        "eloundou_beta", "ratings_source",
    ]].copy()

    df["onet_importance"] = df["onet_importance"].round(2)
    df["onet_frequency"] = df["onet_frequency"].round(2)
    df["eloundou_beta"] = df["eloundou_beta"].round(3)

    return df.sort_values(["soc_code", "task_id"]).reset_index(drop=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--onet-dir", type=Path, required=True,
                        help="unzipped db_29_0_text directory")
    parser.add_argument("--eloundou", type=Path, required=True,
                        help="full_labelset.tsv from openai/GPTs-are-GPTs")
    parser.add_argument("--econ-index", type=Path, required=True,
                        help="automation_vs_augmentation_by_task.csv")
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--min-tasks", type=int, default=5)
    args = parser.parse_args()

    df = build(args.onet_dir, args.eloundou, args.econ_index, args.min_tasks)

    assert not df["soc_code"].isna().any(), "null SOC code"
    assert not df["task_description"].isna().any(), "null task description"
    assert df["eloundou_beta"].between(0, 1).all(), "beta outside 0-1"
    assert df["onet_importance"].between(1, 5).all(), "importance outside 1-5"
    assert df["onet_frequency"].between(1, 7).all(), "frequency outside 1-7"

    args.out.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(args.out, index=False)

    print(f"\nwrote {args.out}")
    print(f"  {len(df):,} tasks · {df['soc_code'].nunique():,} occupations "
          f"· {args.out.stat().st_size / 1e6:.1f} MB")
    print(f"  label mix: {df['economic_index_label'].value_counts().to_dict()}")
    uniform = df[df["ratings_source"] == "uniform_prior"]["soc_code"].nunique()
    print(f"  occupations weighted by uniform prior (O*NET has not rated them): {uniform}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
