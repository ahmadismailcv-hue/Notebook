"""LLM classifier plumbing, with a fake client: schema, batching, caching, offline."""

from types import SimpleNamespace

import pytest

from gap_report.classify import llm
from gap_report.config import settings


class FakeMessages:
    def __init__(self):
        self.calls = 0

    def parse(self, *, output_format, messages, **kw):
        self.calls += 1
        n = messages[0]["content"].count(" | type=")
        Item = output_format.model_fields["items"].annotation.__args__[0]
        items = [Item(ref=i, category="grocer", confidence="medium") for i in range(n)]
        return SimpleNamespace(stop_reason="end_turn", parsed_output=output_format(items=items))


def test_classify_caches_and_respects_offline(tmp_path, monkeypatch):
    monkeypatch.setattr(llm, "CACHE", tmp_path / "cache.json")
    fake = SimpleNamespace(messages=FakeMessages())
    monkeypatch.setattr(llm, "_client", lambda: fake)
    monkeypatch.setattr(settings().cache, "offline", False)
    items = [{"id": f"x{i}", "name": f"Shop {i}", "raw_type": "Retailers - other", "address": None}
             for i in range(llm.BATCH + 5)]
    out = llm.classify(items)
    assert len(out) == len(items) and fake.messages.calls == 2
    assert all(v["category"] == "grocer" for v in out.values())
    # second run: all cached, no calls, works offline
    monkeypatch.setattr(settings().cache, "offline", True)
    assert llm.classify(items) == out and fake.messages.calls == 2


def test_schema_rejects_unknown_category():
    from pydantic import ValidationError
    from typing import Literal
    from pydantic import create_model
    from gap_report.classify.rules import categories
    Item = create_model("Item", category=(Literal[tuple(categories())], ...))
    with pytest.raises(ValidationError):
        Item(category="nightlife")
