"""Rule-based classification. Returns (category, method, rule) or None for LLM leftovers."""

from __future__ import annotations

import re
from functools import lru_cache

import yaml

from gap_report.config import CONFIG_DIR


@lru_cache
def load() -> dict:
    cfg = yaml.safe_load((CONFIG_DIR / "categories.yaml").read_text())
    cfg["_name_rules"] = [(re.compile(p, re.I), c) for p, c in cfg["name_rules"]]
    cfg["_osm"] = {tag: c for c, tags in cfg["osm_tags"].items() for tag in tags}
    cfg["_fsa"] = {t: c for c, ts in cfg["fsa_types"].items() for t in ts}
    unknown = ({c for _, c in cfg["name_rules"]} | set(cfg["osm_tags"]) | set(cfg["fsa_types"])) - set(cfg["categories"])
    if unknown:
        raise ValueError(f"categories.yaml rules use undefined categories: {unknown}")
    return cfg


def categories() -> dict[str, str]:
    return load()["categories"]


def classify(source: str, name: str | None, raw_type: str | None):
    cfg = load()
    if source == "osm" and raw_type in cfg["exclude"]["osm_tags"]:
        return "_excluded", "rule", f"exclude:{raw_type}"
    if source == "fsa" and raw_type in cfg["exclude"]["fsa_types"]:
        return "_excluded", "rule", f"exclude:{raw_type}"
    if name:
        for rx, cat in cfg["_name_rules"]:
            if rx.search(name):
                return cat, "rule", f"name:{rx.pattern}"
    if source == "osm" and raw_type in cfg["_osm"]:
        return cfg["_osm"][raw_type], "rule", f"osm:{raw_type}"
    if source == "fsa" and raw_type in cfg["_fsa"]:
        return cfg["_fsa"][raw_type], "rule", f"fsa:{raw_type}"
    if source == "street_walk" and raw_type in cfg["categories"]:
        return raw_type, "manual", "street_walk.use"
    return None
