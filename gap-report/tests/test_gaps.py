import json

from gap_report import gaps as G
from gap_report.matching import _classes, has_parking, recommend, score

SC = G.load()["scoring"]
NEEDS = G.load()["category_needs"]


def test_status_follows_checks(gdb):
    for (d,) in gdb.execute("SELECT detail FROM gap_results").fetchall():
        r = json.loads(d)
        dem = [c["passed"] for c in r["demand_checks"]]
        dpass = any(dem) if r["demand_mode"] == "any" else all(dem)
        spass = all(c["passed"] for c in r["supply_checks"])
        if dpass and spass:
            assert r["status"] == ("gap" if r["well_observed"] else "possible_gap_unverified")
        else:
            assert r["status"] in ("no_gap", "near_miss")
            if r["status"] == "near_miss":
                failing = [c for c in r["demand_checks"] + r["supply_checks"] if not c["passed"]]
                assert failing and all(c["missed_by"] is not None for c in failing)


def test_absence_of_poorly_observed_category_is_unverified(gdb):
    st = gdb.execute("SELECT status FROM gap_results WHERE category='kids_leisure'").fetchone()[0]
    assert st in ("possible_gap_unverified", "no_gap")


def test_saturated_categories_are_avoided(gdb):
    avoid = {r[0] for r in gdb.execute("SELECT category FROM avoid_uses").fetchall()}
    top = gdb.execute("SELECT category FROM supply_category ORDER BY on_street DESC LIMIT 1").fetchone()[0]
    assert top in avoid


def test_use_class_and_parking_parsing():
    assert _classes("E") >= {"E(b)", "E(f)"}
    assert _classes("E(b), F2") == {"E(b)", "F2"}
    assert has_parking("rear car park, 3 spaces") is True
    assert has_parking("no parking") is False
    assert has_parking(None) is None


def test_matching_synthetic_unit():
    """A made-up unit, used only here: never written to data/manual or a report."""
    unit = {"address": "TEST UNIT", "size_sqft": 3000, "use_class": "E", "features": "rear car park"}
    gaps = [{"rule_id": "a", "category": "kids_leisure", "status": "possible_gap_unverified"},
            {"rule_id": "b", "category": "cafe_dessert", "status": "gap"},
            {"rule_id": "c", "category": "childcare", "status": "no_gap"},
            {"rule_id": "d", "category": "gym", "status": "near_miss"}]
    rec = recommend(unit, gaps, NEEDS, {"cafe_dessert": 120.0}, [{"category": "takeaway", "basis": "saturation"}], SC)
    cats = [t["category"] for t in rec["top_uses"]]
    assert "childcare" not in cats and "gym" not in cats  # not flagged / near miss only
    assert cats[0] == "kids_leisure"                     # fits size, class, parking, none nearby
    cafe = next(s for s in rec["all_scores"] if s["category"] == "cafe_dessert")
    assert cafe["factors"]["size"]["value"] == SC["size_above_ideal"]
    assert abs(cafe["factors"]["distance"]["value"] - 120 / SC["distance_full_credit_m"]) < 1e-9
    assert rec["avoid"] == [{"category": "takeaway", "basis": "saturation"}]


def test_too_small_unit_scores_zero():
    s = score({"address": "x", "size_sqft": 400, "use_class": "E"}, "gym", NEEDS["gym"], None, SC)
    assert s["score"] == 0
