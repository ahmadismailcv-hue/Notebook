"""Hand-maintained CSVs in data/manual/<slug>/: vacant units, street walk, events."""

from __future__ import annotations

import csv
from pathlib import Path


def read(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with open(path, newline="", encoding="utf-8") as f:
        return [{k: (v.strip() or None) if isinstance(v, str) else v for k, v in r.items()}
                for r in csv.DictReader(f) if any((v or "").strip() for v in r.values())]
