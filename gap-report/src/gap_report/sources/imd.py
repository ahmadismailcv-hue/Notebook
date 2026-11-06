"""English Indices of Deprivation 2025 (MHCLG, published 2025-10-30), File 7 CSV.

Ranks: 1 = most deprived of 33,755 LSOAs (2021 boundaries). Licence: OGL v3.
"""

from __future__ import annotations

import csv
import io

from gap_report.cache import Cached, fetch

URL = ("https://assets.publishing.service.gov.uk/media/691ded56d140bbbaa59a2a7d/"
       "File_7_IoD2025_All_Ranks_Scores_Deciles_Population_Denominators.csv")
PAGE = "https://www.gov.uk/government/statistics/english-indices-of-deprivation-2025"
DATASET = "English Indices of Deprivation 2025, File 7 (MHCLG, OGL v3)"


def download() -> Cached:
    return fetch("imd", URL, ext="csv.gz")


def rows(c: Cached, la_code: str) -> tuple[list[str], list[dict]]:
    text = c.text().lstrip("﻿")
    reader = csv.DictReader(io.StringIO(text))
    la_col = next(h for h in reader.fieldnames if h.startswith("Local Authority District code"))
    return reader.fieldnames, [r for r in reader if r[la_col] == la_code]
