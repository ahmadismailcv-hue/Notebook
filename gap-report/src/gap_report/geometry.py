"""Street geometry: one centreline from start junction to end junction, cut into
fixed-length segments, all in British National Grid metres (EPSG:27700).

Dual-carriageway sections are mapped in OSM as two one-way ways. We keep the
two-way ways plus the northbound/eastbound one-way ways (whichever direction the
street's overall bearing runs), merge them, and clip at the configured junctions.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass

import duckdb

from gap_report.config import StreetConfig, settings
from gap_report.sources import osm

MAX_JOIN_M = 150  # roundabouts are unnamed in OSM, so the named ways stop short of them


def connect(path: str = ":memory:") -> duckdb.DuckDBPyConnection:
    con = duckdb.connect(path)
    con.load_extension("spatial")
    con.sql("SET geometry_always_xy = true")
    return con


@dataclass
class StreetGeometry:
    line_bng: list[tuple[float, float]]          # centreline, start -> end
    length_m: float
    segments: list[dict]                         # id, start_m, end_m, coords_bng
    start: dict
    end: dict
    osm_way_ids: list[int]
    osm: osm.OsmData
    joins: list[dict]                            # straight joins bridging OSM gaps, in extent


def _to_bng(con, pts):
    rows = con.execute(
        "SELECT ST_X(g), ST_Y(g) FROM (SELECT ST_Transform(ST_Point(x, y), 'EPSG:4326', "
        "'EPSG:27700') g FROM (SELECT unnest(?) x, unnest(?) y))",
        [[p[0] for p in pts], [p[1] for p in pts]]).fetchall()
    return [(r[0], r[1]) for r in rows]


def to_wgs84(con, pts):
    rows = con.execute(
        "SELECT ST_X(g), ST_Y(g) FROM (SELECT ST_Transform(ST_Point(x, y), 'EPSG:27700', "
        "'EPSG:4326') g FROM (SELECT unnest(?) x, unnest(?) y))",
        [[p[0] for p in pts], [p[1] for p in pts]]).fetchall()
    return [(round(r[0], 7), round(r[1], 7)) for r in rows]


def _cumlen(line):
    out = [0.0]
    for a, b in zip(line, line[1:]):
        out.append(out[-1] + math.dist(a, b))
    return out


def _locate(line, p):
    """Distance along line of the closest point to p."""
    cum = _cumlen(line); best = (float("inf"), 0.0)
    for i, (a, b) in enumerate(zip(line, line[1:])):
        dx, dy = b[0] - a[0], b[1] - a[1]; L2 = dx * dx + dy * dy or 1e-9
        t = max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2))
        q = (a[0] + t * dx, a[1] + t * dy); d = math.dist(p, q)
        if d < best[0]:
            best = (d, cum[i] + t * math.sqrt(L2))
    return best[1], best[0]


def _substring(line, s0, s1):
    cum = _cumlen(line); out = []
    for i, (a, b) in enumerate(zip(line, line[1:])):
        L = cum[i + 1] - cum[i]
        if cum[i + 1] < s0 or cum[i] > s1 or L == 0:
            continue
        def at(s):
            t = (s - cum[i]) / L
            return (a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]))
        p = at(max(s0, cum[i])); q = at(min(s1, cum[i + 1]))
        if not out or out[-1] != p:
            out.append(p)
        out.append(q)
    return out


def _end_point(data, way_nodes, cfg_point, label_refs):
    """Junction where a road with one of label_refs meets or passes closest to the street."""
    cands = [data.nodes[r] for w, (refs, t) in data.ways.items()
             if "highway" in t and set(t.get("ref", "").split(";")) & set(label_refs)
             for r in refs if r in data.nodes]
    if not cands:
        raise RuntimeError(f"No way with ref in {label_refs} near the street")
    best = min(((math.hypot((p[0] - q[0]) * 68_000, (p[1] - q[1]) * 111_320), q)
                for p in cands for q in way_nodes))
    return {"label": cfg_point.label, "refs": label_refs, "lon": best[1][0],
            "lat": best[1][1], "gap_m": round(best[0], 1)}


def build(cfg: StreetConfig, con=None) -> StreetGeometry:
    s = settings(); con = con or connect()
    city = cfg.local_authority.name
    bb = osm.find_street_bbox(cfg.osm.way_name, city)
    first = osm.fetch_tiles(osm.corridor_tiles(bb, 0))
    pts = [first.nodes[r] for refs, _ in osm.named_ways(first, cfg.osm.way_name).values()
           for r in refs if r in first.nodes]
    data = osm.fetch_tiles(osm.tiles_near(osm.corridor_tiles(bb, s.geometry.context_radius_m),
                                          pts, s.geometry.context_radius_m))
    ways = osm.named_ways(data, cfg.osm.way_name)
    # unnamed connector ways (junction approaches) carrying the street's road number
    refs_of_street = {t.get("ref") for _, t in ways.values() if t.get("ref")}
    for wid, (r, t) in data.ways.items():
        if ("highway" in t and "name" not in t and t.get("ref") in refs_of_street
                and t.get("junction") not in ("roundabout", "circular")):
            ways[wid] = (r, t)

    # choose one direction of one-way pairs: the direction of the street's main axis
    allpts = [data.nodes[r] for refs, _ in ways.values() for r in refs]
    lo = min(allpts, key=lambda p: p[1]); hi = max(allpts, key=lambda p: p[1])
    axis = (hi[0] - lo[0], hi[1] - lo[1])
    keep = {}
    for wid, (refs, t) in ways.items():
        if t.get("oneway") in ("yes", "1", "-1"):
            a, b = data.nodes[refs[0]], data.nodes[refs[-1]]
            fwd = (b[0] - a[0]) * axis[0] + (b[1] - a[1]) * axis[1] > 0
            if t.get("oneway") == "-1":
                fwd = not fwd
            if not fwd:
                continue
        keep[wid] = refs

    wkts = ["LINESTRING(" + ",".join(f"{data.nodes[r][0]} {data.nodes[r][1]}" for r in refs) + ")"
            for refs in keep.values()]
    merged = con.execute(
        "SELECT ST_AsGeoJSON(ST_LineMerge(ST_Union_Agg(ST_GeomFromText(w)))) "
        "FROM (SELECT unnest(?) w)", [wkts]).fetchone()[0]
    gj = json.loads(merged)
    parts = [gj["coordinates"]] if gj["type"] == "LineString" else gj["coordinates"]
    # Chain pieces in order along the street's axis. One-way pairs often don't share
    # nodes with the two-way sections, so LineMerge leaves gaps; we bridge gaps up to
    # MAX_JOIN_M with a straight join and record each one.
    parts_bng = [_to_bng(con, p) for p in parts]
    ax = _to_bng(con, [lo, hi]); ux, uy = ax[1][0] - ax[0][0], ax[1][1] - ax[0][1]
    proj = lambda q: (q[0] - ax[0][0]) * ux + (q[1] - ax[0][1]) * uy
    parts_bng = [p if proj(p[0]) <= proj(p[-1]) else p[::-1] for p in parts_bng]
    parts_bng.sort(key=lambda p: proj(p[0]))
    line, joins = list(parts_bng[0]), []
    for p in parts_bng[1:]:
        gap = math.dist(line[-1], p[0])
        if gap > 0:
            joins.append({"at_m": _cumlen(line)[-1], "gap_m": round(gap, 1)})
        line.extend(p if gap > 0 else p[1:])
    way_nodes = [data.nodes[r] for refs in keep.values() for r in refs]
    start = _end_point(data, way_nodes, cfg.osm.start_near, cfg.osm.start_refs)
    end = _end_point(data, way_nodes, cfg.osm.end_near, cfg.osm.end_refs)
    s0, d0 = _locate(line, _to_bng(con, [(start["lon"], start["lat"])])[0])
    s1, d1 = _locate(line, _to_bng(con, [(end["lon"], end["lat"])])[0])
    s0, s1 = sorted((s0, s1))
    line = _substring(line, s0, s1)
    length = _cumlen(line)[-1]
    joins = [{"at_m": round(j["at_m"] - s0, 1), "gap_m": j["gap_m"]} for j in joins
             if s0 <= j["at_m"] <= s1]
    big = [j for j in joins if j["gap_m"] > MAX_JOIN_M]
    if big:
        raise RuntimeError(f"Street line has breaks over {MAX_JOIN_M} m inside the extent: {big}")

    seg_len = s.geometry.segment_length_m
    n = math.ceil(length / seg_len)
    segments = []
    for i in range(n):
        a, b = i * seg_len, min((i + 1) * seg_len, length)
        segments.append({"id": i + 1, "start_m": round(a, 1), "end_m": round(b, 1),
                         "coords_bng": _substring(line, a, b)})
    return StreetGeometry(line, length, segments, start, end, sorted(keep), data, joins)


def write_geojson(con, g: StreetGeometry, path, buffer_m: float):
    """Centreline, segments and buffer as WGS84 GeoJSON, for checking in geojson.io."""
    def wkt(coords):
        return "LINESTRING(" + ",".join(f"{x} {y}" for x, y in coords) + ")"
    buf = con.execute(
        "SELECT ST_AsGeoJSON(ST_Transform(ST_Buffer(ST_GeomFromText(?), ?), "
        "'EPSG:27700', 'EPSG:4326'))", [wkt(g.line_bng), buffer_m]).fetchone()[0]
    feats = [{"type": "Feature", "properties": {"kind": "buffer", "buffer_m": buffer_m},
              "geometry": json.loads(buf)}]
    for sgm in g.segments:
        feats.append({"type": "Feature",
                      "properties": {"kind": "segment", "id": sgm["id"],
                                     "start_m": sgm["start_m"], "end_m": sgm["end_m"]},
                      "geometry": {"type": "LineString",
                                   "coordinates": to_wgs84(con, sgm["coords_bng"])}})
    for e, k in ((g.start, "start"), (g.end, "end")):
        feats.append({"type": "Feature", "properties": {"kind": k, **e},
                      "geometry": {"type": "Point", "coordinates": [e["lon"], e["lat"]]}})
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"type": "FeatureCollection", "features": feats}))
