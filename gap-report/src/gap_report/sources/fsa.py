"""Food Standards Agency food hygiene ratings: open-data XML per local authority (no key).

File: https://ratings.food.gov.uk/api/open-data-files/FHRS<code>en-GB.xml
Licence: Open Government Licence v3.
"""

from __future__ import annotations

import xml.etree.ElementTree as ET

from gap_report.cache import Cached, fetch

URL = "https://ratings.food.gov.uk/api/open-data-files/FHRS{code}en-GB.xml"
DATASET = "Food Standards Agency, Food Hygiene Rating Scheme open data (OGL v3)"


def download(code: str) -> Cached:
    return fetch("fsa", URL.format(code=code), ext="xml.gz")


def parse(c: Cached) -> list[dict]:
    root = ET.fromstring(c.bytes())
    out = []
    for e in root.iter("EstablishmentDetail"):
        g = lambda tag: (e.findtext(tag) or "").strip() or None
        lat, lon = e.findtext("Geocode/Latitude"), e.findtext("Geocode/Longitude")
        addr = ", ".join(x for x in (g("AddressLine1"), g("AddressLine2"), g("AddressLine3"),
                                     g("AddressLine4")) if x)
        out.append({"fhrsid": g("FHRSID"), "name": g("BusinessName"), "type": g("BusinessType"),
                    "type_id": g("BusinessTypeID"), "address": addr or None,
                    "postcode": g("PostCode"), "rating": g("RatingValue"),
                    "rating_date": g("RatingDate"),
                    "lat": float(lat) if lat else None, "lon": float(lon) if lon else None})
    return out
