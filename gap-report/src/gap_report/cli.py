"""Command line entry point: `uv run gap-report "Foleshill Road, Coventry"`."""

from __future__ import annotations

import argparse

from gap_report.config import load_street, settings

from gap_report.stages import geometry_stage, load_stage

RUNNERS = {"geometry": geometry_stage.run, "load": load_stage.run}

STAGES = ["geometry", "load", "classify", "metrics", "gaps", "facts", "report"]


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="gap-report",
                                description="Cited high-street gap report for one UK street.")
    p.add_argument("street", help='Street name or slug, e.g. "Foleshill Road, Coventry"')
    p.add_argument("--until", choices=STAGES, default="report",
                   help="Stop after this pipeline stage (default: report)")
    p.add_argument("--offline", action="store_true", help="Use cached raw data only")
    p.add_argument("--refresh", action="store_true", help="Re-fetch all network sources")
    args = p.parse_args(argv)

    cfg = load_street(args.street)
    s = settings()
    if args.offline:
        s.cache.offline = True
    print(f"Street: {cfg.name} ({cfg.slug})")
    print(f"Manual data: {cfg.manual_path}")
    print(f"Models: classify={s.models.classify} report={s.models.report}")
    for stage in STAGES:
        runner = RUNNERS.get(stage)
        if runner is None:
            print(f"[{stage}] not implemented yet")
        else:
            print(f"[{stage}] running")
            result = runner(cfg)
            for k, v in result.items():
                print(f"  {k}: {v}")
        if stage == args.until:
            break
    return 0
