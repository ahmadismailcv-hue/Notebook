import csv

from gap_report.config import load_street, settings


def test_settings_load():
    s = settings()
    assert s.geometry.context_radius_m >= 800, "800 m rules need data collected at least that far"


def test_street_lookup_by_name_and_slug():
    assert load_street("Foleshill Road, Coventry").slug == "foleshill-road-coventry"
    assert load_street("foleshill-road-coventry").local_authority.fsa_api_id == 375


def test_manual_templates_have_required_columns():
    cfg = load_street("Foleshill Road, Coventry")
    with open(cfg.manual_path / "vacant_units.csv") as f:
        cols = next(csv.reader(f))
    for c in ["address", "size_sqft", "rent_pa", "use_class", "features", "status",
              "source_url", "checked_date"]:
        assert c in cols
