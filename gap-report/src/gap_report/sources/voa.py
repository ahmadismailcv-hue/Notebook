"""VOA non-domestic rating list. Downloaded manually into data/raw/voa/ (not committed).

Free, no registration, but under the VOA's *restricted* licence, not OGL: we use it
locally, cite it, and do not redistribute the raw file.
List entries are '*'-delimited, no header; field order per the VOA "Compiled Rating
List and Summary Valuation Data Specification" (items 1-28).
"""

from __future__ import annotations

import io
import zipfile
from datetime import datetime, timezone
from pathlib import Path

DATASET = "VOA non-domestic rating list 2026, list entries (VOA restricted licence)"
PAGE = "https://voaratinglists.blob.core.windows.net/html/rlidata.htm"
EXPECTED = "uk-englandwales-ndr-2026-listentries-compiled-epoch-*-baseline-csv.zip"
FIELDS = ["entry_no", "ba_code", "community_code", "ba_ref", "pdesc_code", "pdesc_text",
          "uarn", "full_address", "firm_name", "number_or_name", "street", "town",
          "postal_district", "county", "postcode", "effective_date", "composite",
          "rateable_value", "appeal_code", "assessment_ref", "list_alteration_date",
          "scat_code", "sub_street_3", "sub_street_2", "sub_street_1", "case_number",
          "current_from", "current_to"]


def find_file(voa_dir: Path) -> Path | None:
    files = sorted(voa_dir.glob(EXPECTED))
    return files[-1] if files else None


def load(path: Path, ba_code: str, street: str) -> tuple[list[dict], datetime]:
    """Current entries for one street in one billing authority. Skips proxy (deleted) rows."""
    out, street_u = [], street.upper()
    with zipfile.ZipFile(path) as z:
        names = [n for n in z.namelist() if "historic" not in n.lower() and n.lower().endswith((".csv", ".txt"))]
        with z.open(names[0]) as f:
            for line in io.TextIOWrapper(f, encoding="latin-1"):
                parts = line.rstrip("\r\n").split("*")
                if len(parts) < 22 or parts[1].strip() != ba_code:
                    continue
                r = dict(zip(FIELDS, (p.strip() for p in parts)))
                if r["street"].upper() != street_u or not r["rateable_value"]:
                    continue
                r["rateable_value"] = float(r["rateable_value"])
                out.append(r)
    mtime = datetime.fromtimestamp(path.stat().st_mtime, timezone.utc)
    return out, mtime
