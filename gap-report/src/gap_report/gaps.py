"""Evaluate gaps.yaml against the metrics tables. Pure code: no LLM involved."""

from __future__ import annotations

from functools import lru_cache

import yaml

from gap_report.config import CONFIG_DIR

OPS = {"ratio_at_least": lambda v, t: v >= t, "ratio_at_most": lambda v, t: v <= t,
       "at_least": lambda v, t: v >= t, "at_most": lambda v, t: v <= t}


@lru_cache
def load() -> dict:
    cfg = yaml.safe_load((CONFIG_DIR / "gaps.yaml").read_text())
    from gap_report.classify.rules import categories
    cats = set(categories())
    used = {r["category"] for r in cfg["gap_rules"]} | set(cfg["category_needs"]) | \
           {p["category"] for p in cfg["saturation"]["policy_avoid"]} | set(cfg["well_observed"])
    if used - cats:
        raise ValueError(f"gaps.yaml uses unknown categories: {used - cats}")
    missing = {r["category"] for r in cfg["gap_rules"]} - set(cfg["category_needs"])
    if missing:
        raise ValueError(f"gap categories without category_needs: {missing}")
    return cfg


def _check(cond: dict, value: float | None) -> dict:
    op = next(k for k in cond if k in OPS)
    ok = value is not None and OPS[op](value, cond[op])
    return {**cond, "op": op, "threshold": cond[op], "value": value, "passed": ok}


def demand_value(con, metric: str, area: str) -> tuple[float | None, float | None]:
    """(ratio_to_benchmark, area value). Ratio is only defined for the catchment."""
    col = {"catchment": "catchment_value", "ward": "ward_value"}[area]
    row = con.execute(f"SELECT ratio_to_benchmark, {col}, benchmark_value FROM demand_metrics WHERE metric=?",
                      [metric]).fetchone()
    if row is None:
        raise ValueError(f"unknown demand metric {metric!r}")
    ratio = row[0] if area == "catchment" else (row[1] / row[2] if row[1] is not None else None)
    return ratio, row[1]


def supply_value(con, category: str, cond: dict) -> float:
    m = cond["measure"]
    if m == "within_radius":
        return con.execute(
            "SELECT count(*) FROM outlets WHERE status='open' AND category=? AND dist_to_line_m <= ?",
            [category, cond["radius_m"]]).fetchone()[0]
    if m in ("on_street", "per_100m", "share_of_street"):
        return con.execute(f"SELECT {m} FROM supply_category WHERE category=?", [category]).fetchone()[0]
    raise ValueError(f"unknown supply measure {m!r}")


def evaluate(con, street_walk_rows: int) -> tuple[list[dict], list[dict]]:
    cfg = load()
    area = cfg["defaults"]["area"]
    results = []
    for r in cfg["gap_rules"]:
        dem = r["demand"]
        mode = "any" if "any" in dem else "all"
        dchecks = [_check(c, demand_value(con, c["metric"], area)[0]) for c in dem[mode]]
        dpass = any(c["passed"] for c in dchecks) if mode == "any" else all(c["passed"] for c in dchecks)
        schecks = [_check(c, supply_value(con, r["category"], c)) for c in r["supply"]]
        spass = all(c["passed"] for c in schecks)
        observed = r["category"] in cfg["well_observed"] or (
            street_walk_rows > 0 and all(c["measure"] != "within_radius" for c in r["supply"]))
        status = ("gap" if observed else "possible_gap_unverified") if dpass and spass else "no_gap"
        results.append({"rule_id": r["id"], "category": r["category"], "area": area,
                        "demand_mode": mode, "demand_checks": dchecks, "supply_checks": schecks,
                        "demand_passed": dpass, "supply_passed": spass, "well_observed": observed,
                        "status": status, "reasoning": " ".join(r["reasoning"].split())})
    sat = cfg["saturation"]
    avoid = []
    for cat, share, per in con.execute(
            "SELECT category, share_of_street, per_100m FROM supply_category ORDER BY on_street DESC").fetchall():
        why = []
        if share >= sat["share_of_street_at_least"]:
            why.append({"measure": "share_of_street", "value": share, "threshold": sat["share_of_street_at_least"]})
        if per >= sat["per_100m_at_least"]:
            why.append({"measure": "per_100m", "value": per, "threshold": sat["per_100m_at_least"]})
        if why:
            avoid.append({"category": cat, "basis": "saturation", "checks": why,
                          "reasoning": "Already one of the most common uses on the street."})
    for p in sat["policy_avoid"]:
        c = _check(p["when"], demand_value(con, p["when"]["metric"], area)[0])
        if c["passed"]:
            avoid.append({"category": p["category"], "basis": "policy", "checks": [c],
                          "reasoning": " ".join(p["reasoning"].split())})
    return results, avoid
