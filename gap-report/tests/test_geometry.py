"""Stage 1 checks. Bounds are physical sanity checks, not the values we happened to get."""

from gap_report.db import open_db


def test_line_length_is_plausible(geometry_summary):
    # straight-line distance between the junctions is ~2.75 km; the road is nearly straight
    assert 2600 < geometry_summary["length_m"] < 3100


def test_segments_cover_line(geometry_summary, foleshill):
    con = open_db(foleshill)
    total = con.execute("SELECT sum(end_m - start_m) FROM segments").fetchone()[0]
    n_long = con.execute("SELECT count(*) FROM segments WHERE end_m - start_m > 100.01").fetchone()[0]
    con.close()
    assert abs(total - geometry_summary["length_m"]) < 1
    assert n_long == 0


def test_ends_snap_to_junctions(geometry_summary):
    assert geometry_summary["start"]["gap_m"] < 30   # ring road
    assert geometry_summary["end"]["gap_m"] < 30     # A444


def test_no_long_joins(geometry_summary):
    assert all(j["gap_m"] <= 150 for j in geometry_summary["joins"])


def test_known_postcode_and_ward(geometry_summary, foleshill):
    con = open_db(foleshill)
    row = con.execute("SELECT ward FROM postcodes WHERE postcode = 'CV6 5JN'").fetchone()
    con.close()
    assert row == ("Foleshill",), "Lloyds' postcode (531 Foleshill Road) should be inside the buffer"
    assert geometry_summary["wards"][0][0] == "Foleshill"
