"""Score each vacant unit against flagged gaps. Pure functions, unit-testable."""

from __future__ import annotations

import re


def _classes(use_class: str | None) -> set[str]:
    """'E' -> E(a)..E(g); 'e(b), f2' -> {'E(b)', 'F2'}; unknown/blank -> empty set."""
    if not use_class:
        return set()
    out = set()
    for tok in re.split(r"[,/;]|\band\b", use_class):
        tok = tok.strip().replace(" ", "")
        m = re.fullmatch(r"([A-Za-z])(\d)?(?:\(([A-Za-z])\))?", tok)
        if not m:
            if tok:
                out.add(tok.lower())  # e.g. 'suigeneris'
            continue
        letter, num, sub = m.group(1).upper(), m.group(2) or "", m.group(3)
        if letter == "E" and not num and not sub:
            out |= {f"E({c})" for c in "abcdefg"}
        else:
            out.add(f"{letter}{num}" + (f"({sub.lower()})" if sub else ""))
    return out


def has_parking(features: str | None) -> bool | None:
    if not features:
        return None
    f = features.lower()
    if re.search(r"no (off.?street )?parking", f):
        return False
    return bool(re.search(r"parking|car park|forecourt", f))


def score(unit: dict, category: str, need: dict, nearest_m: float | None, sc: dict) -> dict:
    """Return the score and each factor, so the report can explain it."""
    f = {}
    lo, ideal_lo, ideal_hi = need["sqft"]
    size = unit.get("size_sqft")
    if size is None:
        f["size"] = (0.5, "size unknown")
    elif size < lo:
        f["size"] = (0.0, f"{size:.0f} sq ft is below the {lo} sq ft minimum")
    elif size < ideal_lo:
        f["size"] = (sc["size_below_ideal"], f"{size:.0f} sq ft is below the ideal {ideal_lo}-{ideal_hi}")
    elif size > ideal_hi:
        f["size"] = (sc["size_above_ideal"], f"{size:.0f} sq ft is above the ideal {ideal_lo}-{ideal_hi}")
    else:
        f["size"] = (1.0, f"{size:.0f} sq ft is within the ideal {ideal_lo}-{ideal_hi}")
    uc = _classes(unit.get("use_class"))
    if not uc:
        f["use_class"] = (sc["use_class_mismatch"], "use class unknown")
    elif uc & set(need["use_classes"]):
        f["use_class"] = (1.0, f"use class {unit['use_class']} permits it")
    else:
        f["use_class"] = (sc["use_class_mismatch"], f"needs {'/'.join(need['use_classes'])}; change of use required")
    p = has_parking(unit.get("features"))
    if need["parking"] == "none" or p:
        f["parking"] = (1.0, "parking not needed" if need["parking"] == "none" else "has parking")
    else:
        key = "parking_required_missing" if need["parking"] == "required" else "parking_preferred_missing"
        f["parking"] = (sc[key], f"parking {need['parking']}, {'none listed' if p is False else 'not stated'}")
    full = sc["distance_full_credit_m"]
    if nearest_m is None:
        f["distance"] = (1.0, f"no existing {category} within the data")
    else:
        f["distance"] = (min(nearest_m / full, 1.0), f"nearest existing {category} {nearest_m:.0f} m away")
    total = 1.0
    for v, _ in f.values():
        total *= v
    return {"category": category, "score": total, "factors": {k: {"value": v, "why": w} for k, (v, w) in f.items()}}


def recommend(unit: dict, gaps: list[dict], needs: dict, nearest: dict, avoid: list[dict], sc: dict) -> dict:
    flagged = [g for g in gaps if g["status"] in ("gap", "possible_gap_unverified")]
    scored = sorted((score(unit, g["category"], needs[g["category"]], nearest.get(g["category"]), sc) | {
        "gap_status": g["status"], "rule_id": g["rule_id"]} for g in flagged),
        key=lambda s: (-s["score"], s["category"]))
    top = [s for s in scored if s["score"] > 0][:2]
    return {"address": unit["address"], "top_uses": top, "all_scores": scored,
            "avoid": [{"category": a["category"], "basis": a["basis"]} for a in avoid]}
