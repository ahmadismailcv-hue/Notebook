import pytest

from gap_report.config import load_street, settings


@pytest.fixture(scope="session")
def foleshill():
    """Run the pipeline offline from committed raw caches; tests never hit the network."""
    settings().cache.offline = True
    return load_street("Foleshill Road, Coventry")


@pytest.fixture(scope="session")
def geometry_summary(foleshill):
    from gap_report.stages import geometry_stage
    return geometry_stage.run(foleshill)
