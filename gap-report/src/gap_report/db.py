"""DuckDB file per street: data/<slug>.duckdb. Geometries stored in EPSG:27700."""

from __future__ import annotations

from gap_report.config import ROOT, StreetConfig
from gap_report.geometry import connect


def db_path(cfg: StreetConfig):
    return ROOT / "data" / f"{cfg.slug}.duckdb"


def open_db(cfg: StreetConfig):
    return connect(str(db_path(cfg)))


def record_source(con, source_id: str, dataset: str, url: str, retrieved, raw_files: list[str]):
    con.execute("""CREATE TABLE IF NOT EXISTS sources (
        source_id VARCHAR PRIMARY KEY, dataset VARCHAR, url VARCHAR,
        retrieved TIMESTAMPTZ, raw_files VARCHAR[])""")
    con.execute("INSERT OR REPLACE INTO sources VALUES (?, ?, ?, ?, ?)",
                [source_id, dataset, url, retrieved, raw_files])
