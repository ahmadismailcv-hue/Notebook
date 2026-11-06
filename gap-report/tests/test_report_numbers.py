"""Every number in report.md must come from facts.json; the LLM writer cannot add any."""

import json
import re

import pytest

from gap_report.report import render, writer

NUM = re.compile(r"\d[\d,]*(?:\.\d+)?")
CITE = re.compile(r"\[\d+(?:,\s*\d+)*\]")


def _strings(obj):
    if isinstance(obj, str):
        yield obj
    elif isinstance(obj, dict):
        for v in obj.values():
            yield from _strings(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from _strings(v)
    elif obj is not None and not isinstance(obj, bool):
        yield str(obj)


def numbers_missing_from_facts(md: str, facts_doc: dict) -> set[str]:
    allowed = {n for s in _strings(facts_doc["facts"]) for n in NUM.findall(s)}
    body, sources = md.split("## Sources", 1)
    # citation markers are references, not claims; check they point at listed sources
    n_sources = len(re.findall(r"^\d+\. ", sources, re.M))
    for m in CITE.finditer(body):
        assert all(1 <= int(x) <= n_sources for x in re.findall(r"\d+", m.group())), m.group()
    used = set(NUM.findall(CITE.sub("", body))) | set(NUM.findall(re.sub(r"^\d+\. ", "", sources, flags=re.M)))
    return used - allowed


@pytest.fixture(scope="module")
def built(foleshill, gapped):
    from gap_report.stages import report_stage
    report_stage.facts_stage(foleshill)
    doc = json.loads((foleshill.report_dir / "facts.json").read_text())
    return doc, {f["id"]: f for f in doc["facts"]}


def test_every_fact_has_a_source(built):
    doc, _ = built
    for f in doc["facts"]:
        srcs = f["source"] if isinstance(f["source"], list) else [f["source"]]
        assert srcs and all(s["dataset"] and s["url"] and s["retrieved"] for s in srcs), f["id"]


def test_report_numbers_all_in_facts(built, foleshill):
    """Checks the committed report.md (whatever wrote its narrative) against facts.json."""
    from gap_report.stages import report_stage
    path = foleshill.report_dir / "report.md"
    if not path.exists():
        report_stage.report_stage(foleshill, use_llm=False)
    doc, _ = built
    assert numbers_missing_from_facts(path.read_text(), doc) == set()


def test_template_report_numbers_all_in_facts(built):
    doc, facts = built
    md = render.assemble(facts, {"gaps": doc["gaps"]}, writer.placeholder_narrative())
    assert numbers_missing_from_facts(md, doc) == set()


def test_injected_number_is_caught(built):
    doc, facts = built
    md = render.assemble(facts, {"gaps": doc["gaps"]}, writer.placeholder_narrative())
    bad = md.replace("## Summary\n\n", "## Summary\n\nFootfall is 98765 a week.\n\n")
    assert numbers_missing_from_facts(bad, doc) == {"98765"}


def test_validator_rejects_typed_digits_and_unknown_ids(built):
    _, facts = built
    errs = writer.validate({"summary": "About 23% of residents", "gaps": "{{fact:nope}}"}, set(facts))
    assert any("digit typed" in e for e in errs) and any("unknown fact id" in e for e in errs)
    assert writer.validate({"summary": "Children are {{fact:demand.age_0_15.ratio}} the city rate."}, set(facts)) == []


class _FakeClient:
    """Stands in for the API: first answer types a number, second uses placeholders."""

    def __init__(self):
        self.calls = 0
        self.messages = self

    def parse(self, *, output_format, **kw):
        from types import SimpleNamespace
        self.calls += 1
        txt = ("The street is 2.8 km long." if self.calls == 1 else
               "The street is {{fact:street.length_km}} km long.")
        return SimpleNamespace(stop_reason="end_turn",
                               parsed_output=output_format(**{s: txt for s in render.NARRATIVE_SLOTS}))


def test_writer_retries_then_passes(built):
    _, facts = built
    fake = _FakeClient()
    narr = writer.write(facts, client=fake)
    assert fake.calls == 2 and "{{fact:street.length_km}}" in narr["summary"]
