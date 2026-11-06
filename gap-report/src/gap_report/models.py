"""Pydantic data models shared across the pipeline."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field


class Source(BaseModel):
    """Where a fact came from. Required on every fact."""

    dataset: str                       # e.g. "Census 2021 TS007B (Nomis NM_2018_1)"
    url: str                           # API URL, download URL, or repo-relative file path
    retrieved: datetime | date         # when the raw data was fetched / file checked
    raw_file: str | None = None        # cached copy under data/raw/


class Fact(BaseModel):
    """A single number or claim the report may use. The report may cite nothing else."""

    id: str                            # stable key, used as {{fact:id}} in the report
    value: Any                         # machine value (number, string, list)
    display: str                       # exact text that appears in the report
    unit: str | None = None
    description: str
    source: Source | list[Source]
    derived_from: list[str] = Field(default_factory=list)  # ids of facts used to compute it


class Business(BaseModel):
    id: str                            # "<source>:<native id>"
    source: str                        # fsa | osm | street_walk | voa
    name: str | None
    raw_type: str | None               # source's own type label
    address: str | None
    postcode: str | None
    lat: float | None
    lon: float | None
    category: str | None = None
    category_method: str | None = None # rule | llm | manual


class VacantUnit(BaseModel):
    address: str
    postcode: str | None = None
    lat: float | None = None
    lon: float | None = None
    size_sqft: float | None = None
    rent_pa: float | None = None
    use_class: str | None = None
    features: str | None = None
    status: str | None = None
    source_url: str | None = None
    checked_date: date | None = None
    geocode_method: str | None = None  # manual | matched_address | postcode_centroid
