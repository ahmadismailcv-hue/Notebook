"""ONS Open Geography Portal (ArcGIS REST, no key): LSOA 2021 boundaries.

Layer: LSOA_2021_EW_BFE_V10_RUC (full-resolution, clipped to coastline, with
Rural-Urban classification). Checked 2026-11-06.
"""

from __future__ import annotations

from gap_report.cache import Cached, fetch

LSOA_URL = ("https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/"
            "LSOA_2021_EW_BFE_V10_RUC/FeatureServer/3/query")
LSOA_DATASET = "ONS Open Geography Portal: LSOA (Dec 2021) boundaries EW BFE V10 with RUC"


def lsoas_in_envelope(min_lon, min_lat, max_lon, max_lat) -> Cached:
    return fetch("ons_geo", LSOA_URL, params={
        "geometry": f"{min_lon:.5f},{min_lat:.5f},{max_lon:.5f},{max_lat:.5f}",
        "geometryType": "esriGeometryEnvelope", "inSR": "4326", "outSR": "4326",
        "spatialRel": "esriSpatialRelIntersects",
        "outFields": "LSOA21CD,LSOA21NM,RUC21NM", "returnGeometry": "true", "f": "geojson"})
