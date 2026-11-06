def test_catchment_ward_and_benchmark_populations(mdb, foleshill):
    rows = dict(mdb.execute("SELECT metric, catchment_value FROM demand_metrics").fetchall())
    ward = mdb.execute("SELECT ward_value FROM demand_metrics WHERE metric='population'").fetchone()[0]
    bench = mdb.execute("SELECT benchmark_value FROM demand_metrics WHERE metric='population'").fetchone()[0]
    assert ward == 22478
    assert 300_000 < bench < 400_000          # Coventry, Census 2021
    assert 0 < rows["population"] < bench


def test_shares_are_fractions_and_ratios_consistent(mdb):
    for m, kind, c, b, r in mdb.execute(
            "SELECT metric, kind, catchment_value, benchmark_value, ratio_to_benchmark FROM demand_metrics "
            "WHERE kind = 'share'").fetchall():
        assert 0 <= c <= 1 and 0 <= b <= 1, m
        assert abs(r - c / b) < 1e-9, m


def test_per_100m_matches_count(mdb):
    length = mdb.execute("SELECT length_m FROM street_line").fetchone()[0]
    for cat, n, p in mdb.execute("SELECT category, on_street, per_100m FROM supply_category").fetchall():
        assert abs(p - n / (length / 100)) < 1e-9, cat
