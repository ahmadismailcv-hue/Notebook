"""Ground truth the pipeline must reproduce.

Each test notes where its answer comes from, because some only prove that a
manual input loaded (they cannot catch a pipeline error in discovery).
"""

from datetime import date


def test_foleshill_ward_population_2021(db, foleshill):
    """Independent check (Nomis TS001, 2022 ward E05001222). Brief: 22,478."""
    (v,) = db.execute("SELECT value FROM census WHERE tbl='TS001' AND geography_code=? "
                      "AND category LIKE 'Total%'", [foleshill.ward.ons_code]).fetchone()
    assert abs(v - 22478) <= 0.005 * 22478
    assert v == 22478


def test_lloyds_531_closed_2025_11_04(db):
    """Manual input check only: comes from data/manual/.../events.csv."""
    row = db.execute("SELECT name, event, event_date, postcode FROM events "
                     "WHERE address ILIKE '531 Foleshill Road%'").fetchone()
    assert row == ("Lloyds Bank", "branch_closed", date(2025, 11, 4), "CV6 5JN")
