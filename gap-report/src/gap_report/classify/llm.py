"""LLM fallback for businesses the rules could not place.

The model only picks a category from the fixed list (enforced by a Literal schema);
it never sees or produces numbers. Answers are cached in data/cache/llm_classify.json,
keyed by the business text, the model and a hash of the category list, so re-runs are
free, offline and deterministic. Changing categories.yaml invalidates the cache.
"""

from __future__ import annotations

import hashlib
import json
import os
from datetime import date
from typing import Literal

from dotenv import load_dotenv
from pydantic import BaseModel, create_model

from gap_report.classify.rules import categories
from gap_report.config import ROOT, settings

CACHE = ROOT / "data" / "cache" / "llm_classify.json"
BATCH = 40

SYSTEM = """You classify UK high-street businesses into exactly one category from a fixed list.
You get the business name, the source's own type label (Food Standards Agency type or
OpenStreetMap tag) and the address. Pick the category a local shopper would recognise.
If the name alone is genuinely uninformative, use the source type, and mark confidence low.
Use "other" only when no category fits. Never invent categories."""


def _cats_hash() -> str:
    return hashlib.sha1(json.dumps(categories(), sort_keys=True).encode()).hexdigest()[:8]


def key(name, raw_type, address) -> str:
    blob = json.dumps([name, raw_type, address, settings().models.classify, _cats_hash()])
    return hashlib.sha1(blob.encode()).hexdigest()[:16]


def _load_cache() -> dict:
    return json.loads(CACHE.read_text()) if CACHE.exists() else {}


def _client():
    import anthropic
    load_dotenv(ROOT / ".env")
    if os.environ.get("ANTHROPIC_API_KEY"):
        return anthropic.Anthropic()
    # No key in the environment: route through the session's HTTPS proxy, which
    # injects a credential saved on the environment. The placeholder is replaced there.
    proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
    if not proxy:
        raise RuntimeError("No ANTHROPIC_API_KEY in environment or .env, and no HTTPS proxy")
    return anthropic.Anthropic(api_key="placeholder-replaced-by-proxy",
                               http_client=anthropic.DefaultHttpxClient(proxy=proxy))


def classify(items: list[dict], cached_only: bool = False) -> dict[str, dict]:
    """items: dicts with id, name, raw_type, address. Returns id -> {category, confidence, ...}."""
    cache = _load_cache()
    out, todo = {}, []
    for it in items:
        k = key(it["name"], it["raw_type"], it["address"])
        if k in cache:
            out[it["id"]] = cache[k]
        else:
            todo.append((k, it))
    if not todo or cached_only:
        return out
    if settings().cache.offline:
        raise RuntimeError(f"Offline mode: {len(todo)} businesses need LLM classification and are not cached")

    cats = categories()
    Cat = Literal[tuple(cats)]  # type: ignore[valid-type]
    Item = create_model("Item", ref=(int, ...), category=(Cat, ...),
                        confidence=(Literal["high", "medium", "low"], ...))
    Result = create_model("Result", items=(list[Item], ...))
    client = _client()
    cat_text = "\n".join(f"- {c}: {d}" for c, d in cats.items())
    model = settings().models.classify
    for i in range(0, len(todo), BATCH):
        chunk = todo[i:i + BATCH]
        lines = "\n".join(f"{n}. name={it['name']!r} | type={it['raw_type']!r} | address={it['address']!r}"
                          for n, (_, it) in enumerate(chunk))
        resp = client.messages.parse(
            model=model, max_tokens=8000, output_config={"effort": "low"},
            system=SYSTEM,
            messages=[{"role": "user", "content":
                       f"Categories:\n{cat_text}\n\nClassify each business; return one item per ref.\n\n{lines}"}],
            output_format=Result)
        if resp.stop_reason == "refusal" or resp.parsed_output is None:
            raise RuntimeError(f"Classification batch {i // BATCH} returned no parsed output ({resp.stop_reason})")
        by_ref = {x.ref: x for x in resp.parsed_output.items}
        for n, (k, it) in enumerate(chunk):
            x = by_ref.get(n)
            if x is None:
                continue  # left unclassified; caught by the caller's coverage check
            cache[k] = {"category": x.category, "confidence": x.confidence, "model": model,
                        "classified": date.today().isoformat(), "name": it["name"], "raw_type": it["raw_type"]}
            out[it["id"]] = cache[k]
        CACHE.write_text(json.dumps(cache, indent=1, sort_keys=True))
    return out
