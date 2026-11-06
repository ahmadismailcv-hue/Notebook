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


@pytest.fixture(scope="session")
def loaded(foleshill, geometry_summary):
    from gap_report.stages import load_stage
    return load_stage.run(foleshill)


@pytest.fixture
def db(foleshill, loaded):
    from gap_report.db import open_db
    con = open_db(foleshill)
    yield con
    con.close()


@pytest.fixture(scope="session")
def classified(foleshill, loaded):
    """Rules + cached LLM answers only: tests never call the API."""
    from gap_report.stages import classify_stage
    return classify_stage.run(foleshill, use_llm=False)


@pytest.fixture
def cdb(foleshill, classified):
    from gap_report.db import open_db
    con = open_db(foleshill)
    yield con
    con.close()


@pytest.fixture(scope="session")
def metrics(foleshill, classified):
    from gap_report.stages import metrics_stage
    return metrics_stage.run(foleshill)


@pytest.fixture
def mdb(foleshill, metrics):
    from gap_report.db import open_db
    con = open_db(foleshill)
    yield con
    con.close()


@pytest.fixture(scope="session")
def gapped(foleshill, metrics):
    from gap_report.stages import gaps_stage
    return gaps_stage.run(foleshill)


@pytest.fixture
def gdb(foleshill, gapped):
    from gap_report.db import open_db
    con = open_db(foleshill)
    yield con
    con.close()
