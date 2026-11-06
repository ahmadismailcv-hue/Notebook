"""postcodes.io (no key): reverse geocoding along the street and single lookups."""

from __future__ import annotations

import json

from gap_report.cache import Cached, fetch

BASE = "https://api.postcodes.io"
DATASET = "postcodes.io (ONS Postcode Directory)"


def reverse_bulk(points: list[tuple[float, float]], radius_m: int) -> list[Cached]:
    """points are (lon, lat). postcodes.io takes up to 100 per call, radius <= 2000 m."""
    out = []
    for i in range(0, len(points), 100):
        body = json.dumps({"geolocations": [
            {"longitude": round(lon, 6), "latitude": round(lat, 6), "radius": radius_m,
             "limit": 100} for lon, lat in points[i:i + 100]]})
        out.append(fetch("postcodes", f"{BASE}/postcodes", data=body, method="POST",
                         headers={"Content-Type": "application/json"}))
    return out


def lookup(postcode: str) -> Cached:
    return fetch("postcodes", f"{BASE}/postcodes/{postcode.replace(' ', '').upper()}")


def bulk_lookup(pcs: list[str]) -> dict[str, dict]:
    """postcode -> result for up to 100 per call; unknown/terminated postcodes are omitted."""
    out = {}
    pcs = sorted(set(pcs))
    for i in range(0, len(pcs), 100):
        c = fetch("postcodes", f"{BASE}/postcodes", method="POST",
                  data=json.dumps({"postcodes": pcs[i:i + 100]}),
                  headers={"Content-Type": "application/json"})
        for item in c.json()["result"]:
            if item["result"]:
                out[item["query"]] = item["result"]
    return out
