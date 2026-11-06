"""Stage 4: supply metrics (what is on the street) and demand metrics (who lives nearby).

Supply: outlets on the street by category, per 100 m, share; per-segment counts;
counts within the context radius; nearest distance from each vacant unit to each
category. Outlets matched to a closure in events.csv are removed from all counts.
Demand: catchment vs Coventry (and the 2022 ward) for each metric in demand_metrics.yaml.
"""

from __future__ import annotations

import yaml

from gap_report.address import house_numbers
from gap_report.classify.rules import categories
from gap_report.config import CONFIG_DIR, StreetConfig, settings
from gap_report.db import open_db

PER = 100.0


def _apply_events(con, street: str) -> list[dict]:
    """Mark outlets closed when an event names the same house number and a similar name."""
    from gap_report.stages.classify_stage import _similar
    con.execute("ALTER TABLE outlets ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'open'")
    con.execute("UPDATE outlets SET status = 'open'")
    matched = []
    from gap_report.sources import postcodes
    events = con.execute("SELECT address, name, event, event_date, postcode FROM events").fetchall()
    for addr, name, event, d, pc in events:
        if not event.endswith("closed"):
            continue
        nums = set(house_numbers(addr))
        ev_xy = None
        if pc:
            r = postcodes.lookup(pc).json()["result"]
            ev_xy = (r["longitude"], r["latitude"])
        cands = con.execute(
            "SELECT outlet_id, name, address, ST_Distance(geom, ST_Transform(ST_Point(?, ?), 'EPSG:4326', 'EPSG:27700')) "
            "FROM outlets WHERE in_street", list(ev_xy or (0.0, 0.0))).fetchall()
        # same name AND (same house number, or no number on the outlet but within 200 m of the event postcode)
        hits = [o for o in cands if _similar(o[1], name) and (
                (nums and nums & set(house_numbers(o[2]))) or
                (not house_numbers(o[2]) and ev_xy and o[3] <= 200))]
        for oid, oname, *_ in hits:
            con.execute("UPDATE outlets SET status = 'closed' WHERE outlet_id = ?", [oid])
        matched.append({"event": f"{name} {event} {d}", "outlets_marked_closed": [h[1] for h in hits]})
    return matched


def supply(con, cfg: StreetConfig) -> dict:
    s = settings()
    length = con.execute("SELECT length_m FROM street_line").fetchone()[0]
    cats = list(categories())
    con.execute("CREATE OR REPLACE TEMP TABLE cats AS SELECT unnest(?) AS category", [cats])
    con.execute(f"""CREATE OR REPLACE TABLE supply_category AS
        WITH open AS (SELECT * FROM outlets WHERE status = 'open'),
        tot AS (SELECT count(*) n FROM open WHERE in_street AND category <> 'unclassified')
        SELECT c.category,
               count(o.outlet_id) FILTER (WHERE o.in_street) AS on_street,
               count(o.outlet_id) FILTER (WHERE o.in_street) / ({length} / {PER}) AS per_100m,
               count(o.outlet_id) FILTER (WHERE o.in_street) / (SELECT n FROM tot) AS share_of_street,
               count(o.outlet_id) FILTER (WHERE o.dist_to_line_m <= {s.demand.catchment_radius_m}) AS within_catchment_radius
        FROM cats c LEFT JOIN open o USING (category) GROUP BY c.category ORDER BY on_street DESC, c.category""")
    con.execute("""CREATE OR REPLACE TABLE supply_segment AS
        SELECT segment_id, category, count(*) n FROM outlets
        WHERE status = 'open' AND in_street GROUP BY ALL ORDER BY ALL""")
    # nearest open outlet of each category to each vacant unit (searches the whole context radius)
    con.execute("""CREATE OR REPLACE TABLE unit_nearest AS
        SELECT v.address, c.category,
               min(ST_Distance(v.geom, o.geom)) AS nearest_m,
               arg_min(o.name, ST_Distance(v.geom, o.geom)) AS nearest_name
        FROM vacant_units v CROSS JOIN cats c
        LEFT JOIN outlets o ON o.category = c.category AND o.status = 'open'
        WHERE v.geom IS NOT NULL GROUP BY ALL ORDER BY ALL""")
    return {
        "street_length_m": round(length, 1),
        "open_outlets_on_street": con.execute(
            "SELECT count(*) FROM outlets WHERE in_street AND status='open'").fetchone()[0],
        "closed_by_events": con.execute(
            "SELECT list(name) FROM outlets WHERE status='closed'").fetchone()[0],
        "top_categories": con.execute(
            "SELECT category, on_street, round(per_100m, 2), round(share_of_street * 100, 1) "
            "FROM supply_category WHERE on_street > 0 ORDER BY on_street DESC LIMIT 12").fetchall(),
        "absent_on_street_but_within_800m": con.execute(
            "SELECT category, within_catchment_radius FROM supply_category "
            "WHERE on_street = 0 ORDER BY within_catchment_radius DESC").fetchall(),
        "vacant_units_with_distances": con.execute("SELECT count(DISTINCT address) FROM unit_nearest").fetchone()[0],
    }


def demand(con, cfg: StreetConfig) -> dict:
    spec = yaml.safe_load((CONFIG_DIR / "demand_metrics.yaml").read_text())
    la, ward = cfg.local_authority.ons_code, cfg.ward.ons_code
    con.execute("""CREATE OR REPLACE TEMP TABLE census_areas AS
        SELECT 'catchment' AS area, c.tbl, c.category, sum(c.value) AS value
          FROM census c JOIN catchment_lsoa l ON l.lsoa21cd = c.geography_code GROUP BY ALL
        UNION ALL SELECT 'benchmark', tbl, category, value FROM census WHERE geography_code = ?
        UNION ALL SELECT 'ward', tbl, category, value FROM census WHERE geography_code = ?""", [la, ward])
    rows = []
    for mid, m in spec["census"].items():
        vals = {}
        for area in ("catchment", "ward", "benchmark"):
            num = con.execute("SELECT sum(value) FROM census_areas WHERE area=? AND tbl=? AND category IN "
                              "(SELECT unnest(?))", [area, m["table"], m["numerator"]]).fetchone()[0]
            if m.get("kind") == "count":
                vals[area] = (num, None, num)
            else:
                den = con.execute("SELECT value FROM census_areas WHERE area=? AND tbl=? AND category=?",
                                  [area, m["table"], m["denominator"]]).fetchone()[0]
                vals[area] = (num, den, num / den)
        rows.append([mid, m.get("label", mid), m["table"], m.get("kind", "share"),
                     *vals["catchment"], *vals["ward"], *vals["benchmark"],
                     None if m.get("kind") == "count" else vals["catchment"][2] / vals["benchmark"][2]])
    for mid, m in spec["imd"].items():
        col = f'"{m["column"]}"'
        pop = f'"{m.get("weight", "Total population: mid 2022")}"'
        loc = con.execute(f"SELECT sum({col} * {pop}) / sum({pop}) FROM imd JOIN catchment_lsoa l "
                          f"ON l.lsoa21cd = imd.\"LSOA code (2021)\"").fetchone()[0]
        ben = con.execute(f"SELECT sum({col} * {pop}) / sum({pop}) FROM imd").fetchone()[0]
        rows.append([mid, m["label"], "IoD2025", "pop_weighted_mean", None, None, loc,
                     None, None, None, None, None, ben, loc / ben])
    dec = '"Index of Multiple Deprivation (IMD) Decile (where 1 is most deprived 10% of LSOAs)"'
    loc_n, loc_d1 = con.execute(f"SELECT count(*), count(*) FILTER (WHERE {dec} = 1) FROM imd JOIN catchment_lsoa l "
                                f"ON l.lsoa21cd = imd.\"LSOA code (2021)\"").fetchone()
    ben_n, ben_d1 = con.execute(f"SELECT count(*), count(*) FILTER (WHERE {dec} = 1) FROM imd").fetchone()
    rows.append(["imd_decile1_share", "LSOAs in England's most deprived 10% (IMD 2025)", "IoD2025", "share",
                 loc_d1, loc_n, loc_d1 / loc_n, None, None, None, ben_d1, ben_n, ben_d1 / ben_n,
                 (loc_d1 / loc_n) / (ben_d1 / ben_n)])
    con.execute("""CREATE OR REPLACE TABLE demand_metrics (metric VARCHAR, label VARCHAR, source_table VARCHAR,
        kind VARCHAR, catchment_num DOUBLE, catchment_den DOUBLE, catchment_value DOUBLE,
        ward_num DOUBLE, ward_den DOUBLE, ward_value DOUBLE,
        benchmark_num DOUBLE, benchmark_den DOUBLE, benchmark_value DOUBLE, ratio_to_benchmark DOUBLE)""")
    con.executemany("INSERT INTO demand_metrics VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)", rows)

    def fmt(v, kind):
        if v is None:
            return None
        return f"{v:,.0f}" if kind == "count" else (f"{v:.1f}" if kind == "pop_weighted_mean" and v > 1 else f"{v * 100:.1f}%")
    table = [(r[0], fmt(r[6], r[3]), fmt(r[9], r[3]), fmt(r[12], r[3]), None if r[13] is None else round(r[13], 2))
             for r in rows]
    return {"catchment_lsoas": con.execute("SELECT count(*) FROM catchment_lsoa").fetchone()[0],
            "metrics (catchment, ward_2022, coventry, ratio)": table}


def run(cfg: StreetConfig) -> dict:
    con = open_db(cfg)
    out = {"events": _apply_events(con, cfg.osm.way_name)}
    out |= supply(con, cfg)
    out |= demand(con, cfg)
    con.close()
    return out
