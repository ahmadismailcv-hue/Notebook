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


def _outlet_at(con, number: str):
    """Outlets on the street whose address starts with this house number or range."""
    return con.execute(
        "SELECT name, category, method FROM outlets WHERE in_street AND "
        "regexp_matches(coalesce(address, ''), ?, 'i')",
        [rf"(^|\D){number}\s*,?\s*(families for all hub\s+)?foleshill road"]).fetchall()


def test_south_asian_sweet_cluster(cdb):
    """Pipeline check: FSA lists these as Restaurant/Cafe; the name rule must win."""
    for number in ("364", "408-410", "424-426"):
        rows = _outlet_at(cdb, number)
        assert rows, f"no outlet found at {number} Foleshill Road"
        assert {r[1] for r in rows} == {"south_asian_sweets"}, (number, rows)


def test_body_worx_is_gym(cdb):
    """Pipeline check: OSM node (no address) 'Body Worx Gym'/'Body Work Gym For Women'."""
    rows = cdb.execute("SELECT name, category FROM outlets WHERE in_street AND "
                       "regexp_matches(lower(name), 'body ?wor(x|k)')").fetchall()
    assert rows and all(c == "gym" for _, c in rows), rows


def test_families_for_all_hub_is_community(cdb):
    """Pipeline check: FSA 'Other catering premises', name misspelt 'Familes'."""
    rows = _outlet_at(cdb, "454")
    assert ("community_family" in {r[1] for r in rows}), rows


def test_lloyds_closure_removes_branch_from_supply(mdb):
    """Pipeline check: OSM still lists Lloyds as a bank; the event must close it."""
    rows = mdb.execute("SELECT status FROM outlets WHERE in_street AND name ILIKE 'Lloyds%'").fetchall()
    assert rows == [("closed",)]
    open_banks = mdb.execute("SELECT count(*) FROM outlets WHERE in_street AND status='open' "
                             "AND category='bank_atm' AND name ILIKE 'Lloyds%'").fetchone()[0]
    assert open_banks == 0
