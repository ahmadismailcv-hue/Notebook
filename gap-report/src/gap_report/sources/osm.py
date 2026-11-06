"""OpenStreetMap via the main OSM API (api/0.6/map), tiled and cached.

Overpass and Geofabrik reset connections from this environment (checked 2026-11-06),
so we use the editing API sparingly: one cached call per ~0.01 deg tile, only tiles
that touch the corridor. Re-runs read data/raw/osm/ and make no calls.
Data (c) OpenStreetMap contributors, ODbL.
"""

from __future__ import annotations

import math
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import datetime

from gap_report.cache import Cached, fetch

API = "https://api.openstreetmap.org/api/0.6/map"
NOMINATIM = "https://nominatim.openstreetmap.org/search"
DATASET = "OpenStreetMap (api.openstreetmap.org/api/0.6/map), ODbL"
TILE_DEG = 0.01
POI_KEYS = ("shop", "amenity", "leisure", "healthcare", "office", "craft", "tourism")


@dataclass
class OsmData:
    nodes: dict[int, tuple[float, float]] = field(default_factory=dict)   # id -> (lon, lat)
    node_tags: dict[int, dict] = field(default_factory=dict)
    ways: dict[int, tuple[list[int], dict]] = field(default_factory=dict) # id -> (refs, tags)
    files: list[Cached] = field(default_factory=list)

    @property
    def retrieved(self) -> datetime:
        return min(f.retrieved for f in self.files)


def find_street_bbox(way_name: str, city: str) -> tuple[float, float, float, float]:
    """(min_lon, min_lat, max_lon, max_lat) of highway ways with this name, via Nominatim."""
    c = fetch("nominatim", NOMINATIM, params={"street": way_name, "city": city,
              "country": "UK", "format": "jsonv2", "limit": 50})
    hits = [r for r in c.json() if r.get("category") == "highway"]
    if not hits:
        raise RuntimeError(f"Nominatim found no highway named {way_name!r} in {city}")
    bb = [[float(x) for x in r["boundingbox"]] for r in hits]  # [minlat,maxlat,minlon,maxlon]
    return (min(b[2] for b in bb), min(b[0] for b in bb), max(b[3] for b in bb), max(b[1] for b in bb))


def corridor_tiles(bbox, pad_m: float) -> list[tuple[float, float, float, float]]:
    """Tiles of TILE_DEG covering bbox padded by pad_m, snapped to a fixed grid so
    cache keys are stable between runs."""
    min_lon, min_lat, max_lon, max_lat = bbox
    dlat = pad_m / 111_320
    dlon = pad_m / (111_320 * math.cos(math.radians((min_lat + max_lat) / 2)))
    lo_x = math.floor((min_lon - dlon) / TILE_DEG); hi_x = math.ceil((max_lon + dlon) / TILE_DEG)
    lo_y = math.floor((min_lat - dlat) / TILE_DEG); hi_y = math.ceil((max_lat + dlat) / TILE_DEG)
    return [(round(x * TILE_DEG, 6), round(y * TILE_DEG, 6),
             round((x + 1) * TILE_DEG, 6), round((y + 1) * TILE_DEG, 6))
            for x in range(lo_x, hi_x) for y in range(lo_y, hi_y)]


def fetch_tiles(tiles) -> OsmData:
    data = OsmData()
    for t in tiles:
        c = fetch("osm", API, params={"bbox": ",".join(f"{v:.6f}" for v in t)}, ext="xml.gz")
        data.files.append(c)
        root = ET.fromstring(c.bytes())
        for n in root.iter("node"):
            nid = int(n.get("id"))
            data.nodes[nid] = (float(n.get("lon")), float(n.get("lat")))
            tags = {t.get("k"): t.get("v") for t in n.iter("tag")}
            if tags:
                data.node_tags[nid] = tags
        for w in root.iter("way"):
            refs = [int(nd.get("ref")) for nd in w.iter("nd")]
            data.ways[int(w.get("id"))] = (refs, {t.get("k"): t.get("v") for t in w.iter("tag")})
    return data


def pois(data: OsmData) -> list[dict]:
    """Every node or closed-way feature with a POI key. Ways use their node centroid."""
    out = []
    for nid, tags in data.node_tags.items():
        if any(k in tags for k in POI_KEYS):
            lon, lat = data.nodes[nid]
            out.append({"osm_id": f"node/{nid}", "lon": lon, "lat": lat, "tags": tags})
    for wid, (refs, tags) in data.ways.items():
        if any(k in tags for k in POI_KEYS) and "highway" not in tags:
            pts = [data.nodes[r] for r in refs if r in data.nodes]
            if pts:
                out.append({"osm_id": f"way/{wid}", "lon": sum(p[0] for p in pts) / len(pts),
                            "lat": sum(p[1] for p in pts) / len(pts), "tags": tags})
    return out


def tiles_near(tiles, pts: list[tuple[float, float]], pad_m: float):
    """Keep tiles whose rectangle is within pad_m of any of pts (lon, lat)."""
    keep = []
    for t in tiles:
        mlat = (t[1] + t[3]) / 2
        kx = 111_320 * math.cos(math.radians(mlat)); ky = 111_320
        for lon, lat in pts:
            dx = max(t[0] - lon, 0, lon - t[2]) * kx
            dy = max(t[1] - lat, 0, lat - t[3]) * ky
            if math.hypot(dx, dy) <= pad_m:
                keep.append(t); break
    return keep


def named_ways(data: OsmData, name: str) -> dict[int, tuple[list[int], dict]]:
    return {w: v for w, v in data.ways.items()
            if v[1].get("name") == name and "highway" in v[1]}
