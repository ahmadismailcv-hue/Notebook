"""Load global settings and per-street config. Paths resolve from the project root."""

from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path

import yaml
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parents[2]
CONFIG_DIR = ROOT / "config"


class Models(BaseModel):
    classify: str
    report: str


class Geometry(BaseModel):
    crs_metric: str
    street_buffer_m: float
    segment_length_m: float
    context_radius_m: float


class Demand(BaseModel):
    catchment_radius_m: float


class CacheCfg(BaseModel):
    raw_dir: str
    offline: bool = False


class HttpCfg(BaseModel):
    timeout_s: float = 60
    user_agent: str


class Settings(BaseModel):
    models: Models
    geometry: Geometry
    demand: Demand
    cache: CacheCfg
    http: HttpCfg

    @property
    def raw_dir(self) -> Path:
        return ROOT / self.cache.raw_dir


class Point(BaseModel):
    label: str
    lat: float | None = None
    lon: float | None = None


class OsmCfg(BaseModel):
    way_name: str
    start_near: Point
    start_refs: list[str]
    end_near: Point
    end_refs: list[str]


class LocalAuthority(BaseModel):
    name: str
    fsa_api_id: int
    fsa_code: str
    ons_code: str
    nomis_id: int
    voa_ba_code: str


class Area(BaseModel):
    name: str
    ons_code: str


class Ward(BaseModel):
    name: str
    census_geography: str
    ons_code: str
    nomis_id: int


class StreetConfig(BaseModel):
    slug: str
    name: str
    aliases: list[str] = []
    osm: OsmCfg
    postcode_districts: list[str]
    local_authority: LocalAuthority
    benchmark: Area
    ward: Ward
    voa_street: str
    manual_dir: str

    @property
    def manual_path(self) -> Path:
        return ROOT / self.manual_dir

    @property
    def report_dir(self) -> Path:
        return ROOT / "reports" / self.slug


@lru_cache
def settings() -> Settings:
    return Settings.model_validate(yaml.safe_load((CONFIG_DIR / "settings.yaml").read_text()))


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def load_street(query: str) -> StreetConfig:
    """Find a street config by slug, name or alias. Raises if none matches."""
    wanted = slugify(query)
    for path in sorted((CONFIG_DIR / "streets").glob("*.yaml")):
        cfg = StreetConfig.model_validate(yaml.safe_load(path.read_text()))
        names = [cfg.slug, cfg.name, *cfg.aliases]
        if wanted in {slugify(n) for n in names}:
            return cfg
    known = [p.stem for p in (CONFIG_DIR / "streets").glob("*.yaml")]
    raise SystemExit(f"No street config matches {query!r}. Known: {known}. "
                     "Add config/streets/<slug>.yaml (see README).")
