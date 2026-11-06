"""LLM narrative for the report. The model sees facts (id, display, description) and
writes short paragraphs using only {{fact:id}} placeholders. validate() rejects any
digit outside a placeholder and any unknown fact id; one retry with the errors."""

from __future__ import annotations

import json
import re

from pydantic import create_model

from gap_report.config import settings
from gap_report.report.render import NARRATIVE_SLOTS, PH

SYSTEM = """You write the narrative paragraphs of a cited high-street gap report for planners and
landlords. You are given a facts file. Rules, all mandatory:
1. Every number, date, address, postcode, road name with digits, or statistic MUST be written as a
   placeholder {{fact:<id>}} using an id from the facts file. Never type a digit yourself, not even
   in words like "A444" or "Census 2021": use a placeholder or rephrase ("the latest Census").
2. Do not state any claim that the facts do not support. No outside knowledge about the area.
3. Outcome "possible gap unverified" must be described as unconfirmed and needing a street check,
   never as a confirmed gap. "near miss" means the rule did not fire; say how close it came.
4. Plain, direct British English. No hype. Two to five sentences per section unless told otherwise.
5. Do not repeat tables: they are rendered separately below your text. Interpret them.
Sections: summary (the headline: what the street is short of and what to avoid), street_today,
who_lives_here, vacant_units, gaps, recommendations, limits (only limits not already listed: may be empty)."""


def validate(narr: dict[str, str], fact_ids: set[str]) -> list[str]:
    errs = []
    for slot, text in narr.items():
        for fid in PH.findall(text):
            if fid not in fact_ids:
                errs.append(f"{slot}: unknown fact id {fid}")
        bare = PH.sub("", text)
        for m in re.finditer(r"\d", bare):
            ctx = bare[max(0, m.start() - 20): m.end() + 20].replace("\n", " ")
            errs.append(f"{slot}: digit typed outside a placeholder near '...{ctx}...'")
            break
        if re.search(r"\{\{|\}\}", bare):
            errs.append(f"{slot}: malformed placeholder")
    return errs


def _facts_for_prompt(facts: dict) -> str:
    return "\n".join(f"{k} = {v['display']!r} ({v['description']})" for k, v in facts.items()
                     if not k.startswith("source."))


def write(facts: dict, client=None) -> dict[str, str]:
    from gap_report.classify.llm import _client
    client = client or _client()
    Narr = create_model("Narrative", **{s: (str, ...) for s in NARRATIVE_SLOTS})
    msgs = [{"role": "user", "content": "Facts file (id = display (description)):\n\n" + _facts_for_prompt(facts)
             + "\n\nWrite each section."}]
    for attempt in range(2):
        resp = client.messages.parse(model=settings().models.report, max_tokens=16000,
                                     output_config={"effort": "high"}, system=SYSTEM,
                                     messages=msgs, output_format=Narr)
        if resp.stop_reason == "refusal" or resp.parsed_output is None:
            raise RuntimeError(f"report writer returned no narrative ({resp.stop_reason})")
        narr = resp.parsed_output.model_dump()
        errs = validate(narr, set(facts))
        if not errs:
            return narr
        msgs = msgs + [{"role": "assistant", "content": json.dumps(narr)},
                       {"role": "user", "content": "Rejected. Fix every error and return all sections again:\n"
                                                   + "\n".join(errs)}]
    raise RuntimeError("report narrative failed validation twice:\n" + "\n".join(errs))


def placeholder_narrative() -> dict[str, str]:
    return {s: "_Narrative not generated: run without --no-llm to add it._" for s in NARRATIVE_SLOTS}
