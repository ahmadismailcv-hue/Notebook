"""Stage 1: street line, segments, buffer, and the postcodes/LSOAs it touches."""

from __future__ import annotations

import json
import math

from gap_report import geometry as G
from gap_report.config import StreetConfig, settings
from gap_report.db import open_db, record_source
from gap_report.sources import ons_geo, osm, postcodes


def _wkt(coords):
    return "LINESTRING(" + ",".join(f"{x} {y}" for x, y in coords) + ")"


def run(cfg: StreetConfig) -> dict:
    s = settings()
    con = open_db(cfg)
    g = G.build(cfg, con)
    buf = s.geometry.street_buffer_m

    con.execute("CREATE OR REPLACE TABLE street_line AS SELECT ST_GeomFromText(?) geom, ? length_m",
                [_wkt(g.line_bng), g.length_m])
    con.execute("CREATE OR REPLACE TABLE segments (id INT, start_m DOUBLE, end_m DOUBLE, geom GEOMETRY)")
    for sg in g.segments:
        con.execute("INSERT INTO segments VALUES (?, ?, ?, ST_GeomFromText(?))",
                    [sg["id"], sg["start_m"], sg["end_m"], _wkt(sg["coords_bng"])])
    con.execute("CREATE OR REPLACE TABLE street_buffer AS SELECT ST_Buffer(geom, ?) geom FROM street_line", [buf])
    con.execute("CREATE OR REPLACE TABLE context_buffer AS SELECT ST_Buffer(geom, ?) geom FROM street_line",
                [s.geometry.context_radius_m])
    record_source(con, "osm", osm.DATASET, osm.API, g.osm.retrieved, [f.rel_path for f in g.osm.files])

    # LSOAs intersecting the street buffer, with the share of each LSOA's area inside it
    wgs = G.to_wgs84(con, g.line_bng)
    pad = s.geometry.context_radius_m / 111_320
    lons, lats = [p[0] for p in wgs], [p[1] for p in wgs]
    c = ons_geo.lsoas_in_envelope(min(lons) - pad * 1.6, min(lats) - pad, max(lons) + pad * 1.6, max(lats) + pad)
    feats = c.json()["features"]
    con.execute("CREATE OR REPLACE TABLE lsoa (lsoa21cd VARCHAR, name VARCHAR, ruc VARCHAR, geom GEOMETRY)")
    for f in feats:
        p = f["properties"]
        con.execute("INSERT INTO lsoa VALUES (?, ?, ?, ST_Transform(ST_GeomFromGeoJSON(?), 'EPSG:4326', 'EPSG:27700'))",
                    [p["LSOA21CD"], p["LSOA21NM"], p["RUC21NM"], json.dumps(f["geometry"])])
    record_source(con, "ons_lsoa", ons_geo.LSOA_DATASET, c.url, c.retrieved, [c.rel_path])
    con.execute("""CREATE OR REPLACE TABLE street_lsoa AS
        SELECT l.lsoa21cd, l.name,
               ST_Area(ST_Intersection(l.geom, b.geom)) / ST_Area(l.geom) AS area_share_in_buffer,
               ST_Distance(l.geom, s.geom) AS dist_to_line_m
        FROM lsoa l, street_buffer b, street_line s
        WHERE ST_Intersects(l.geom, b.geom) ORDER BY 1""")

    # postcodes within the buffer: reverse geocode every 50 m along the line
    pts, step = [], 50.0
    for i in range(int(g.length_m // step) + 1):
        pts.append(G._substring(g.line_bng, i * step, i * step + 0.1)[0])
    cached = postcodes.reverse_bulk(G.to_wgs84(con, pts), radius_m=int(buf) + 50)
    rows = {}
    for cch in cached:
        for item in cch.json()["result"]:
            for r in item["result"] or []:
                rows[r["postcode"]] = r
    con.execute("""CREATE OR REPLACE TABLE postcodes (postcode VARCHAR, lsoa21cd VARCHAR,
                   ward VARCHAR, ward_code VARCHAR, msoa21cd VARCHAR, geom GEOMETRY)""")
    for r in rows.values():
        con.execute("""INSERT INTO postcodes VALUES (?, ?, ?, ?, ?,
                       ST_Transform(ST_Point(?, ?), 'EPSG:4326', 'EPSG:27700'))""",
                    [r["postcode"], r["codes"].get("lsoa21") or r["codes"].get("lsoa"),
                     r["admin_ward"], r["codes"]["admin_ward"],
                     r["codes"].get("msoa21") or r["codes"].get("msoa"), r["longitude"], r["latitude"]])
    con.execute("""DELETE FROM postcodes WHERE ST_Distance(geom, (SELECT geom FROM street_line)) > ?""", [buf])
    # Many postcodes on one exact point are PO boxes / large users, not addresses.
    con.execute("""CREATE OR REPLACE TABLE postcodes AS SELECT *,
        count(*) OVER (PARTITION BY ST_AsText(geom)) >= 5 AS stacked FROM postcodes""")
    record_source(con, "postcodes_reverse", postcodes.DATASET, postcodes.BASE + "/postcodes",
                  min(x.retrieved for x in cached), [x.rel_path for x in cached])

    G.write_geojson(con, g, cfg.report_dir / "street.geojson", buf)
    summary = {
        "length_m": round(g.length_m, 1), "segments": len(g.segments),
        "start": g.start, "end": g.end, "joins": g.joins, "osm_tiles": len(g.osm.files),
        "lsoas_touching_buffer": con.execute("SELECT count(*) FROM street_lsoa").fetchone()[0],
        "postcodes_in_buffer": con.execute("SELECT count(*) FROM postcodes WHERE NOT stacked").fetchone()[0],
        "stacked_postcodes_excluded": con.execute("SELECT count(*) FROM postcodes WHERE stacked").fetchone()[0],
        "postcode_districts": [r[0] for r in con.execute(
            "SELECT DISTINCT split_part(postcode,' ',1)||' '||left(split_part(postcode,' ',2),1) d "
            "FROM postcodes WHERE NOT stacked ORDER BY 1").fetchall()],
        "lsoas": con.execute("SELECT lsoa21cd, name, round(area_share_in_buffer * 100, 1) "
                             "FROM street_lsoa ORDER BY 3 DESC").fetchall(),
        "wards": con.execute("SELECT ward, ward_code, count(*) n FROM postcodes WHERE NOT stacked GROUP BY ALL ORDER BY n DESC").fetchall(),
    }
    con.close()
    return summary
