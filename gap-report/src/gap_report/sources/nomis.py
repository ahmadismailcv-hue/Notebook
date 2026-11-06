"""Nomis API (no key): Census 2021 topic summaries for LSOAs, the LA and the ward.

Dataset IDs confirmed 2026-11-06 via /api/v01/dataset/def.sdmx.json?search=TSxxx*.
TS007B (broad bands) is used instead of TS007 (single year) because it gives 0-15 directly.
"""

from __future__ import annotations

import csv
import io

from gap_report.cache import Cached, fetch

BASE = "https://www.nomisweb.co.uk/api/v01/dataset"
TABLES = {
    # key: (nomis id, category dimension, label)
    "TS001": ("NM_2021_1", "C2021_RESTYPE_3", "Number of usual residents"),
    "TS007B": ("NM_2018_1", "C2021_AGE_12A", "Age by broad age bands"),
    "TS021": ("NM_2041_1", "C2021_ETH_20", "Ethnic group"),
    # TS024 Main language (NM_2043_1) is blank below local-authority level (checked
    # 2026-11-06), so TS029 is used: it separates "main language is English" from not.
    "TS029": ("NM_2048_1", "C2021_ENGPRF_6", "Proficiency in English"),
    "TS030": ("NM_2049_1", "C2021_RELIGION_10", "Religion"),
    "TS045": ("NM_2063_1", "C2021_CARS_5", "Car or van availability"),
    "TS052": ("NM_2070_1", "C2021_OCCRAT_BEDROOMS_6", "Occupancy rating for bedrooms"),
}


def dataset_name(table: str) -> str:
    nid, _, label = TABLES[table]
    return f"Census 2021 {table} {label} (ONS via Nomis {nid})"


def fetch_table(table: str, geography: str) -> Cached:
    nid, dim, _ = TABLES[table]
    return fetch("nomis", f"{BASE}/{nid}.data.csv", ext="csv", params={
        "geography": geography, "measures": "20100",
        "select": f"geography_code,geography_name,geography_type,{dim}_name,obs_value"})


def rows(c: Cached, table: str) -> list[dict]:
    dim = TABLES[table][1]
    blank = [r for r in csv.DictReader(io.StringIO(c.text())) if r["OBS_VALUE"] == ""]
    if blank:
        raise ValueError(f"{table}: {len(blank)} blank values (e.g. {blank[0]['GEOGRAPHY_NAME']}); "
                         "table not published at this geography")
    return [{"table": table, "geography_code": r["GEOGRAPHY_CODE"],
             "geography_name": r["GEOGRAPHY_NAME"], "geography_type": r["GEOGRAPHY_TYPE"],
             "category": r[f"{dim}_NAME"], "value": float(r["OBS_VALUE"])}
            for r in csv.DictReader(io.StringIO(c.text()))]
