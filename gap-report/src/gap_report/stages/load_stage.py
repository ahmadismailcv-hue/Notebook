"""Stage 2: load every source into DuckDB, linked to the street geometry.

Tables written: businesses, osm_addresses, census, catchment_lsoa, imd,
vacant_units, events, street_walk, voa (if the file is present), sources.
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone

from gap_report.address import house_numbers, norm_postcode
from gap_report.config import StreetConfig, settings
from gap_report.db import bulk_create, open_db, record_source
from gap_report.sources import fsa, imd, manual, nomis, ons_geo, osm, postcodes, voa

POINT = "ST_Transform(ST_Point(?, ?), 'EPSG:4326', 'EPSG:27700')"


def _street_number_re(street: str):
    return re.compile(rf"(\d+[a-z]?(?:\s*-\s*\d+[a-z]?)?)\s*,?\s+{re.escape(street)}\b", re.I)


def _bbox(con, pad_m):
    return con.execute(f"""SELECT ST_XMin(g), ST_YMin(g), ST_XMax(g), ST_YMax(g) FROM (
        SELECT ST_Transform(ST_Buffer(geom, {pad_m}), 'EPSG:27700', 'EPSG:4326') g FROM street_line)""").fetchone()


def _link(con, table: str):
    """Add distance to line, nearest segment and in_street flag to a table with geom."""
    buf = settings().geometry.street_buffer_m
    con.execute(f"""CREATE OR REPLACE TABLE {table} AS
        WITH t AS (SELECT row_number() OVER () AS _rid, * FROM {table}),
        near AS (SELECT t._rid, arg_min(s.id, ST_Distance(t.geom, s.geom)) seg
                 FROM t, segments s WHERE t.geom IS NOT NULL GROUP BY t._rid)
        SELECT t.* EXCLUDE (_rid), ST_Distance(t.geom, l.geom) AS dist_to_line_m,
               CASE WHEN ST_Distance(t.geom, l.geom) <= {buf} THEN near.seg END AS segment_id,
               coalesce(ST_Distance(t.geom, l.geom) <= {buf}, false) AS in_street
        FROM t LEFT JOIN near USING (_rid), street_line l ORDER BY t._rid""")


class Geocoder:
    """Manual lat/lon > OSM address point > FSA address > postcode centroid."""

    def __init__(self, con, street: str):
        self.street = street
        self.osm = {}
        for hn, x, y in con.execute("SELECT housenumber, ST_X(geom), ST_Y(geom) FROM osm_addresses").fetchall():
            for n in house_numbers(hn):
                self.osm.setdefault(n, (x, y))
        self.fsa = {}
        rx = _street_number_re(street)
        for addr, x, y in con.execute(
                "SELECT address, ST_X(geom), ST_Y(geom) FROM businesses WHERE source='fsa' AND geocode='fsa'").fetchall():
            m = rx.search(addr or "")
            if m:
                for n in house_numbers(m.group(1)):
                    self.fsa.setdefault(n, (x, y))
        self.con = con

    def __call__(self, address, postcode, lat, lon):
        if lat and lon:
            x, y = self.con.execute(f"SELECT ST_X(g), ST_Y(g) FROM (SELECT {POINT} g)", [float(lon), float(lat)]).fetchone()
            return x, y, "manual"
        nums = house_numbers(address)
        for n in nums:
            if n in self.osm:
                return (*self.osm[n], "osm_address")
        for n in nums:
            if n in self.fsa:
                return (*self.fsa[n], "fsa_address")
        pc = norm_postcode(postcode)
        if pc:
            try:
                r = postcodes.lookup(pc).json()["result"]
                x, y = self.con.execute(f"SELECT ST_X(g), ST_Y(g) FROM (SELECT {POINT} g)",
                                        [r["longitude"], r["latitude"]]).fetchone()
                return x, y, "postcode_centroid"
            except Exception:
                pass
        return None, None, "not_geocoded"


def run(cfg: StreetConfig) -> dict:
    s = settings()
    con = open_db(cfg)
    street = cfg.osm.way_name
    out: dict = {}

    # ---------- OSM POIs and addresses (from the geometry stage's cached tiles)
    osm_files = con.execute("SELECT raw_files FROM sources WHERE source_id='osm'").fetchone()[0]
    data = osm.load_cached(osm_files)
    BIZ = {"id": "VARCHAR", "source": "VARCHAR", "name": "VARCHAR", "raw_type": "VARCHAR",
           "address": "VARCHAR", "postcode": "VARCHAR", "geocode": "VARCHAR", "extra": "JSON"}
    biz = []
    for p in osm.pois(data):
        t = p["tags"]
        biz.append({"id": f"osm:{p['osm_id']}", "source": "osm", "name": t.get("name"),
                    "raw_type": ";".join(f"{k}={t[k]}" for k in osm.POI_KEYS if k in t),
                    "address": " ".join(x for x in (t.get("addr:housenumber"), t.get("addr:street")) if x) or None,
                    "postcode": norm_postcode(t.get("addr:postcode")), "geocode": "osm",
                    "extra": json.dumps(t), "lon": p["lon"], "lat": p["lat"]})
    bulk_create(con, "osm_addresses", osm.addresses(data, street),
                {"osm_id": "VARCHAR", "housenumber": "VARCHAR", "name": "VARCHAR"})

    # ---------- FSA
    c = fsa.download(cfg.local_authority.fsa_code)
    rows = fsa.parse(c)
    # FSA rows lacking coordinates elsewhere in the city: postcode centroid, flagged
    n_nocoord = sum(1 for r in rows if not r["lat"])
    missing = [norm_postcode(r["postcode"]) for r in rows if not r["lat"] and r["postcode"]]
    centroids = postcodes.bulk_lookup([m for m in missing if m])
    for r in rows:
        geocode = "fsa"
        if not r["lat"] and r["address"] and street.lower() in r["address"].lower():
            geocode = None  # on our street: geocode by address below, more precise than postcode
        elif not r["lat"]:
            pc = centroids.get(norm_postcode(r["postcode"]) or "")
            if pc:
                r["lon"], r["lat"], geocode = pc["longitude"], pc["latitude"], "postcode_centroid"
            else:
                geocode = None
        biz.append({"id": f"fsa:{r['fhrsid']}", "source": "fsa", "name": r["name"], "raw_type": r["type"],
                    "address": r["address"], "postcode": norm_postcode(r["postcode"]), "geocode": geocode,
                    "extra": json.dumps({"fhrsid": r["fhrsid"], "rating": r["rating"],
                                         "rating_date": r["rating_date"], "type_id": r["type_id"]}),
                    "lon": r["lon"], "lat": r["lat"]})
    bulk_create(con, "businesses", biz, BIZ)
    record_source(con, "fsa", fsa.DATASET, c.url, c.retrieved, [c.rel_path])
    out["fsa_establishments_coventry"] = len(rows)
    out["fsa_without_coords"] = n_nocoord
    out["fsa_geocoded_by_postcode_centroid"] = sum(1 for b in biz if b["geocode"] == "postcode_centroid")

    # FSA rows on this street without coordinates: geocode from address/postcode
    geo = Geocoder(con, street)
    rx = _street_number_re(street)
    fixed = 0
    for bid, addr, pc in con.execute(
            "SELECT id, address, postcode FROM businesses WHERE source='fsa' AND geom IS NULL").fetchall():
        if addr and street.lower() in addr.lower():
            m = rx.search(addr)
            x, y, how = geo(m.group(1) if m else addr, pc, None, None)
            if x is not None:
                con.execute("UPDATE businesses SET geom = ST_Point(?, ?), geocode = ? WHERE id = ?", [x, y, how, bid])
                fixed += 1
    out["fsa_on_street_geocoded_from_address"] = fixed

    # ---------- Street walk (manual)
    walk = manual.read(cfg.manual_path / "street_walk.csv")
    for i, r in enumerate(walk):
        x, y, how = geo(r.get("address"), r.get("postcode"), r.get("lat"), r.get("lon"))
        con.execute("INSERT INTO businesses VALUES (?, 'street_walk', ?, ?, ?, ?, ?, ?, " +
                    ("ST_Point(?, ?))" if x is not None else "NULL)"),
                    [f"walk:{i + 1}", r.get("name"), r.get("use"), r.get("address"), norm_postcode(r.get("postcode")),
                     how, json.dumps(r), *([x, y] if x is not None else [])])
    record_source(con, "street_walk", "Street walk survey (manual)", str(cfg.manual_path / "street_walk.csv"),
                  datetime.now(timezone.utc), [])

    # keep only businesses within the context radius
    con.execute(f"""DELETE FROM businesses WHERE geom IS NULL OR
        ST_Distance(geom, (SELECT geom FROM street_line)) > {s.geometry.context_radius_m}""")
    _link(con, "businesses")
    out["businesses_within_context_radius"] = con.execute(
        "SELECT source, count(*) FROM businesses GROUP BY 1 ORDER BY 1").fetchall()
    out["businesses_in_street_buffer"] = con.execute(
        "SELECT source, count(*) FROM businesses WHERE in_street GROUP BY 1 ORDER BY 1").fetchall()

    # ---------- Catchment: LSOAs by population-weighted centroid
    c = ons_geo.pwc_in_envelope(*_bbox(con, s.demand.catchment_radius_m + 200))
    con.execute("CREATE OR REPLACE TABLE lsoa_pwc (lsoa21cd VARCHAR, name VARCHAR, geom GEOMETRY)")
    for f in c.json()["features"]:
        p = f["properties"]; lon, lat = f["geometry"]["coordinates"]
        code = p.get("LSOA21CD") or p.get("lsoa21cd")
        con.execute(f"INSERT INTO lsoa_pwc VALUES (?, ?, {POINT})", [code, p.get("LSOA21NM") or p.get("lsoa21nm"), lon, lat])
    record_source(con, "ons_pwc", ons_geo.PWC_DATASET, c.url, c.retrieved, [c.rel_path])
    con.execute(f"""CREATE OR REPLACE TABLE catchment_lsoa AS
        SELECT p.lsoa21cd, p.name, ST_Distance(p.geom, l.geom) AS pwc_dist_m
        FROM lsoa_pwc p, street_line l WHERE ST_Distance(p.geom, l.geom) <= {s.demand.catchment_radius_m}
        ORDER BY 1""")
    out["catchment_lsoas"] = con.execute("SELECT count(*) FROM catchment_lsoa").fetchone()[0]

    # ---------- Census via Nomis: all Coventry LSOAs, Coventry LA, and the 2022 ward
    la, ward = cfg.local_authority.nomis_id, cfg.ward.nomis_id
    geog = f"{la}TYPE151,{la},{ward}"
    con.execute("""CREATE OR REPLACE TABLE census (tbl VARCHAR, geography_code VARCHAR, geography_name VARCHAR,
                   geography_type VARCHAR, category VARCHAR, value DOUBLE)""")
    for t in nomis.TABLES:
        c = nomis.fetch_table(t, geog)
        rs = nomis.rows(c, t)
        con.executemany("INSERT INTO census VALUES (?, ?, ?, ?, ?, ?)",
                        [[r["table"], r["geography_code"], r["geography_name"], r["geography_type"],
                          r["category"], r["value"]] for r in rs])
        record_source(con, f"census_{t}", nomis.dataset_name(t), c.url, c.retrieved, [c.rel_path])
    out["census_rows"] = con.execute("SELECT tbl, count(*) FROM census GROUP BY 1 ORDER BY 1").fetchall()
    out["ward_population_2021"] = con.execute(
        "SELECT geography_name, value FROM census WHERE tbl='TS001' AND geography_code=? "
        "AND category LIKE 'Total%'", [cfg.ward.ons_code]).fetchall()

    # ---------- IoD 2025
    c = imd.download()
    con.execute(f"""CREATE OR REPLACE TABLE imd AS SELECT * FROM read_csv('{c.path}', header=true)
                    WHERE "Local Authority District code (2024)" = ?""", [cfg.local_authority.ons_code])
    record_source(con, "imd2025", imd.DATASET, imd.URL, c.retrieved, [c.rel_path])
    out["imd_lsoas_in_la"] = con.execute("SELECT count(*) FROM imd").fetchone()[0]

    # ---------- Manual: vacant units and events
    con.execute("""CREATE OR REPLACE TABLE vacant_units (address VARCHAR, postcode VARCHAR, size_sqft DOUBLE,
        rent_pa DOUBLE, use_class VARCHAR, features VARCHAR, status VARCHAR, source_url VARCHAR,
        checked_date DATE, geocode VARCHAR, geom GEOMETRY)""")
    for r in manual.read(cfg.manual_path / "vacant_units.csv"):
        x, y, how = geo(r.get("address"), r.get("postcode"), r.get("lat"), r.get("lon"))
        con.execute("INSERT INTO vacant_units VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, " +
                    ("ST_Point(?, ?))" if x is not None else "NULL)"),
                    [r["address"], norm_postcode(r.get("postcode")), r.get("size_sqft"), r.get("rent_pa"),
                     r.get("use_class"), r.get("features"), r.get("status"), r.get("source_url"),
                     r.get("checked_date"), how, *([x, y] if x is not None else [])])
    _link(con, "vacant_units")
    out["vacant_units"] = con.execute("SELECT count(*) FROM vacant_units").fetchone()[0]

    con.execute("""CREATE OR REPLACE TABLE events (address VARCHAR, postcode VARCHAR, name VARCHAR, event VARCHAR,
        event_date DATE, source VARCHAR, source_url VARCHAR, checked_date DATE)""")
    for r in manual.read(cfg.manual_path / "events.csv"):
        con.execute("INSERT INTO events VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    [r["address"], norm_postcode(r.get("postcode")), r.get("name"), r["event"], r["event_date"],
                     r.get("source"), r.get("source_url"), r.get("checked_date")])
    out["events"] = con.execute("SELECT name, event, event_date FROM events").fetchall()

    # ---------- VOA (optional, manual download)
    f = voa.find_file(cfg.manual_path.parents[1] / "raw" / "voa")
    if f:
        rs, mtime = voa.load(f, cfg.local_authority.voa_ba_code, cfg.voa_street)
        con.execute("""CREATE OR REPLACE TABLE voa (uarn VARCHAR, number_or_name VARCHAR, full_address VARCHAR,
            postcode VARCHAR, pdesc_code VARCHAR, pdesc_text VARCHAR, scat_code VARCHAR, rateable_value DOUBLE,
            firm_name VARCHAR)""")
        con.executemany("INSERT INTO voa VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        [[r["uarn"], r["number_or_name"], r["full_address"], r["postcode"], r["pdesc_code"],
                          r["pdesc_text"], r["scat_code"], r["rateable_value"], r["firm_name"]] for r in rs])
        record_source(con, "voa", voa.DATASET, voa.PAGE, mtime, [str(f.name)])
        out["voa_entries_on_street"] = len(rs)
    else:
        out["voa"] = f"not loaded: put {voa.EXPECTED} in data/raw/voa/"
    con.close()
    return out
