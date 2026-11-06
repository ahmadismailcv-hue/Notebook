"""Stage 6: write facts.json, then report.md (code tables + validated LLM narrative)."""

from __future__ import annotations

import json
from datetime import datetime, timezone

from gap_report.config import StreetConfig
from gap_report.db import open_db
from gap_report.facts import build
from gap_report.report import render, writer


def facts_stage(cfg: StreetConfig) -> dict:
    con = open_db(cfg)
    F, extra = build(con, cfg)
    con.close()
    cfg.report_dir.mkdir(parents=True, exist_ok=True)
    doc = {"street": cfg.name, "slug": cfg.slug, "generated": datetime.now(timezone.utc).isoformat(),
           "facts": F.dump(), "gaps": extra["gaps"], "avoid": extra["avoid"], "units": extra["recs"]}
    (cfg.report_dir / "facts.json").write_text(json.dumps(doc, indent=1, default=str))
    return {"facts": len(doc["facts"]), "path": str(cfg.report_dir / "facts.json")}


def report_stage(cfg: StreetConfig, use_llm: bool = True, client=None) -> dict:
    doc = json.loads((cfg.report_dir / "facts.json").read_text())
    facts = {f["id"]: f for f in doc["facts"]}
    narr = writer.write(facts, client) if use_llm else writer.placeholder_narrative()
    md = render.assemble(facts, {"gaps": doc["gaps"]}, narr)
    (cfg.report_dir / "report.md").write_text(md)
    return {"path": str(cfg.report_dir / "report.md"), "narrative": "llm" if use_llm else "placeholder",
            "chars": len(md)}
