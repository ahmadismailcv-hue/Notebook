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


def bulk_create(con, table: str, rows: list[dict], columns: dict[str, str], geom_from_lonlat: bool = True):
    """Create `table` from dicts in one statement. columns maps name -> DuckDB type.
    If geom_from_lonlat, rows carry 'lon'/'lat' (WGS84) and a BNG 'geom' column is added."""
    import json
    import tempfile
    cols = dict(columns)
    if geom_from_lonlat:
        cols |= {"lon": "DOUBLE", "lat": "DOUBLE"}
    with tempfile.NamedTemporaryFile("w", suffix=".ndjson", delete=False) as f:
        for r in rows:
            f.write(json.dumps({k: r.get(k) for k in cols}, default=str) + "\n")
        path = f.name
    spec = ", ".join(f"'{k}': '{v}'" for k, v in cols.items())
    names = ", ".join(columns)
    geom = (", CASE WHEN lon IS NOT NULL AND lat IS NOT NULL THEN ST_Transform(ST_Point(lon, lat), "
            "'EPSG:4326', 'EPSG:27700') END AS geom") if geom_from_lonlat else ""
    con.execute(f"CREATE OR REPLACE TABLE {table} AS SELECT {names}{geom} "
                f"FROM read_json('{path}', format='newline_delimited', columns={{{spec}}})")
    import os
    os.unlink(path)
