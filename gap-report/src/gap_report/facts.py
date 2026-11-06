"""Build facts.json: every number or claim the report may use, each with its source.

Fact ids are stable and used by the report writer as {{fact:<id>}} placeholders.
`display` is the exact text substituted into the report.
"""

from __future__ import annotations

import json
from datetime import datetime

from gap_report.config import StreetConfig, settings
from gap_report.models import Fact, Source

PCT_KINDS = {"share"}


def _src(con, *ids: str) -> list[Source]:
    out = []
    for sid in ids:
        row = con.execute("SELECT dataset, url, retrieved, raw_files FROM sources WHERE source_id=?", [sid]).fetchone()
        if row is None:
            raise KeyError(f"no source registered as {sid!r}")
        out.append(Source(dataset=row[0], url=row[1], retrieved=row[2],
                          raw_file=(row[3] or [None])[0]))
    return out


def pct(v: float) -> str:
    return f"{v * 100:.1f}%"


def num(v: float, dp: int = 0) -> str:
    return f"{v:,.{dp}f}"


def fmt_date(d) -> str:
    return d.strftime("%-d %B %Y")


def ratio(v: float) -> str:
    return f"{v:.2f}×"


class Facts:
    def __init__(self):
        self.items: dict[str, Fact] = {}

    def add(self, id: str, value, display: str, description: str, source, unit=None, derived_from=()):
        if id in self.items:
            raise ValueError(f"duplicate fact id {id}")
        self.items[id] = Fact(id=id, value=value, display=display, description=description,
                              source=source, unit=unit, derived_from=list(derived_from))

    def dump(self) -> list[dict]:
        return [json.loads(f.model_dump_json()) for f in self.items.values()]


def build(con, cfg: StreetConfig) -> tuple[Facts, dict]:
    s = settings()
    F = Facts()
    osm_src = _src(con, "osm")
    geo_src = osm_src
    supply_src = _src(con, "osm", "fsa")
    walk = con.execute("SELECT count(*) FROM businesses WHERE source='street_walk'").fetchone()[0]
    if walk:
        supply_src = supply_src + _src(con, "street_walk")

    # ---- street
    length = con.execute("SELECT length_m FROM street_line").fetchone()[0]
    F.add("street.name", cfg.name, cfg.name, "Street analysed", geo_src)
    F.add("street.length_m", length, num(length), "Length of the analysed stretch, metres", geo_src, "m")
    F.add("street.length_km", length / 1000, f"{length / 1000:.1f}", "Length of the analysed stretch, km", geo_src, "km",
          ["street.length_m"])
    nseg = con.execute("SELECT count(*) FROM segments").fetchone()[0]
    F.add("street.segments", nseg, num(nseg), f"Number of {s.geometry.segment_length_m:.0f} m segments", geo_src)
    F.add("street.start", cfg.osm.start_near.label, cfg.osm.start_near.label, "South end of the analysed stretch", geo_src)
    F.add("street.end", cfg.osm.end_near.label, cfg.osm.end_near.label, "North end of the analysed stretch", geo_src)
    F.add("method.street_buffer_m", s.geometry.street_buffer_m, num(s.geometry.street_buffer_m),
          "Distance either side of the street centreline counted as 'on the street', metres", geo_src, "m")
    F.add("method.catchment_radius_m", s.demand.catchment_radius_m, num(s.demand.catchment_radius_m),
          "Catchment: LSOAs whose population-weighted centroid is within this distance of the street, metres",
          _src(con, "ons_pwc"), "m")
    F.add("method.segment_length_m", s.geometry.segment_length_m, num(s.geometry.segment_length_m),
          "Segment length, metres", geo_src, "m")

    # ---- supply
    n_open = con.execute("SELECT count(*) FROM outlets WHERE in_street AND status='open'").fetchone()[0]
    n_uncl = con.execute("SELECT count(*) FROM outlets WHERE in_street AND status='open' "
                         "AND category='unclassified'").fetchone()[0]
    F.add("supply.outlets_on_street", n_open, num(n_open), "Open outlets within the street buffer (OSM and FSA, merged)", supply_src)
    F.add("supply.unclassified_on_street", n_uncl, num(n_uncl),
          "Outlets on the street not yet classified (LLM step not run for them)", supply_src)
    for cat, n, per, share, within in con.execute(
            "SELECT category, on_street, per_100m, share_of_street, within_catchment_radius FROM supply_category").fetchall():
        F.add(f"supply.{cat}.on_street", n, num(n), f"Open {cat} outlets on the street", supply_src)
        F.add(f"supply.{cat}.per_100m", per, f"{per:.2f}", f"Open {cat} outlets per 100 m of street", supply_src,
              derived_from=[f"supply.{cat}.on_street", "street.length_m"])
        F.add(f"supply.{cat}.share", share, pct(share), f"{cat} share of classified outlets on the street", supply_src,
              derived_from=[f"supply.{cat}.on_street"])
        F.add(f"supply.{cat}.within_radius", within, num(within),
              f"Open {cat} outlets within {s.demand.catchment_radius_m:.0f} m of the street", supply_src)

    # ---- events
    ev_file = cfg.manual_path / "events.csv"
    ev_mtime = datetime.fromtimestamp(ev_file.stat().st_mtime).date() if ev_file.exists() else None
    for i, (addr, pc, name, ev, d, src, url, chk) in enumerate(con.execute(
            "SELECT address, postcode, name, event, event_date, source, source_url, checked_date FROM events "
            "ORDER BY event_date").fetchall()):
        esrc = [Source(dataset=f"Manual events log ({src or 'user'})", url=url or f"{cfg.manual_dir}/events.csv",
                       retrieved=chk or ev_mtime)]
        F.add(f"event.{i}.name", name, name, "Business named in a recorded event", esrc)
        F.add(f"event.{i}.address", f"{addr}, {pc}" if pc else addr, f"{addr}, {pc}" if pc else addr, "Event address", esrc)
        F.add(f"event.{i}.what", ev, ev.replace("_", " "), "What happened", esrc)
        F.add(f"event.{i}.date", str(d), d.strftime("%-d %B %Y"), "Event date", esrc)

    # ---- demand
    census_ids = {r[0].removeprefix("census_"): r[0] for r in
                  con.execute("SELECT source_id FROM sources WHERE source_id LIKE 'census_%'").fetchall()}
    for (metric, label, tbl, kind, cv, wv, bv, r) in con.execute(
            "SELECT metric, label, source_table, kind, catchment_value, ward_value, benchmark_value, ratio_to_benchmark "
            "FROM demand_metrics").fetchall():
        src = _src(con, "imd2025") if tbl == "IoD2025" else _src(con, census_ids[tbl])
        if kind == "share" and tbl != "IoD2025" or metric in ("idaci_score", "income_score", "imd_decile1_share"):
            fmt = pct
        elif kind == "count":
            fmt = num
        else:
            fmt = lambda v: f"{v:.1f}"
        label = {"population": "Usual residents", "households": "Households"}.get(metric, label)
        F.add(f"demand.{metric}.catchment", cv, fmt(cv), f"{label}: catchment", src)
        if wv is not None:
            F.add(f"demand.{metric}.ward", wv, fmt(wv), f"{label}: {cfg.ward.name} ward (2022 boundary)", src)
        F.add(f"demand.{metric}.benchmark", bv, fmt(bv), f"{label}: {cfg.benchmark.name}", src)
        if r is not None:
            F.add(f"demand.{metric}.ratio", r, ratio(r), f"{label}: catchment as a multiple of {cfg.benchmark.name}",
                  src, derived_from=[f"demand.{metric}.catchment", f"demand.{metric}.benchmark"])
    nl = con.execute("SELECT count(*) FROM catchment_lsoa").fetchone()[0]
    F.add("demand.catchment_lsoas", nl, num(nl), "Number of LSOAs in the catchment", _src(con, "ons_pwc"))

    # ---- gaps
    gaps = [json.loads(d) for (d,) in con.execute("SELECT detail FROM gap_results").fetchall()]
    rule_src = [Source(dataset="Gap rules (config/gaps.yaml), evaluated by code", url="config/gaps.yaml",
                       retrieved=datetime.now().date())]
    for g in gaps:
        gid = f"gap.{g['rule_id']}"
        F.add(f"{gid}.status", g["status"], g["status"].replace("_", " "), f"Outcome of rule {g['rule_id']}", rule_src)
        F.add(f"{gid}.category", g["category"], g["category"].replace("_", " "), "Category the rule tests", rule_src)
        F.add(f"{gid}.reasoning", g["reasoning"], g["reasoning"], "Reasoning recorded with the rule", rule_src)
        for j, c in enumerate(g["demand_checks"]):
            F.add(f"{gid}.demand{j}.metric", c["metric"], c["metric"].replace("_", " "), "Demand metric tested", rule_src)
            F.add(f"{gid}.demand{j}.threshold", c["threshold"], ratio(c["threshold"]),
                  f"Threshold ({c['op'].replace('_', ' ')}) for {c['metric']} ratio to {cfg.benchmark.name}", rule_src)
            F.add(f"{gid}.demand{j}.passed", c["passed"], "met" if c["passed"] else "not met", "Whether the demand test was met", rule_src)
            F.add(f"{gid}.demand{j}.value", c["value"], ratio(c["value"]),
                  f"{c['metric']}: catchment as a multiple of {cfg.benchmark.name}",
                  F.items[f"demand.{c['metric']}.ratio"].source, derived_from=[f"demand.{c['metric']}.ratio"])
            F.add(f"{gid}.demand{j}.label", c["metric"],
                  F.items[f"demand.{c['metric']}.catchment"].description.split(":")[0], "Demand metric label", rule_src)
            F.add(f"{gid}.demand{j}.op", c["op"], c["op"].replace("ratio_", "").replace("_", " "), "Comparison", rule_src)
        for j, c in enumerate(g["supply_checks"]):
            disp = num(c["threshold"]) if c["measure"] in ("on_street", "within_radius") else f"{c['threshold']:.2f}"
            F.add(f"{gid}.supply{j}.threshold", c["threshold"], disp,
                  f"Supply threshold ({c['op'].replace('_', ' ')}) on {c['measure']}", rule_src)
            if "radius_m" in c:
                F.add(f"{gid}.supply{j}.radius_m", c["radius_m"], num(c["radius_m"]), "Search radius, metres", rule_src)
            F.add(f"{gid}.supply{j}.passed", c["passed"], "met" if c["passed"] else "not met", "Whether the supply test was met", rule_src)
            vd = num(c["value"]) if c["measure"] in ("on_street", "within_radius") else f"{c['value']:.2f}"
            F.add(f"{gid}.supply{j}.value", c["value"], vd, f"Observed {c['measure']} for {g['category']}", supply_src)
            F.add(f"{gid}.supply{j}.op", c["op"], c["op"].replace("_", " "), "Comparison", rule_src)
            if c.get("missed_by") is not None:
                md = num(c["missed_by"]) if c["measure"] in ("on_street", "within_radius") else f"{c['missed_by']:.2f}"
                F.add(f"{gid}.supply{j}.missed_by", c["missed_by"], md, "Amount by which the supply test was missed", rule_src)
    avoid = [json.loads(d) for (d,) in con.execute("SELECT detail FROM avoid_uses").fetchall()]
    for a in avoid:
        F.add(f"avoid.{a['category']}.basis", a["basis"], a["basis"], f"Why {a['category']} is on the avoid list", rule_src)
        F.add(f"avoid.{a['category']}.reasoning", a["reasoning"], a["reasoning"], "Avoid-list reasoning", rule_src)
    sat = __import__("gap_report.gaps", fromlist=["load"]).load()["saturation"]
    F.add("method.saturation_share", sat["share_of_street_at_least"], pct(sat["share_of_street_at_least"]),
          "Share of street outlets at or above which a category counts as saturated", rule_src)
    F.add("method.saturation_per_100m", sat["per_100m_at_least"], f"{sat['per_100m_at_least']:.2f}",
          "Outlets per 100 m at or above which a category counts as saturated", rule_src)

    # ---- units
    units = con.execute("SELECT address, postcode, size_sqft, rent_pa, use_class, features, source_url, checked_date, "
                        "geocode, segment_id FROM vacant_units").fetchall()
    F.add("units.count", len(units), num(len(units)), "Vacant units listed in the manual vacant-units file",
          [Source(dataset="Vacant units (manual)", url=f"{cfg.manual_dir}/vacant_units.csv",
                  retrieved=datetime.now().date())])
    recs = {a: json.loads(d) for a, d in con.execute("SELECT address, detail FROM unit_recommendations").fetchall()}
    for i, (addr, pc, sqft, rent, uc, feat, url, chk, geo, seg) in enumerate(units):
        usrc = [Source(dataset="Vacant units (manual)", url=url or f"{cfg.manual_dir}/vacant_units.csv",
                       retrieved=chk or datetime.now().date())]
        u = f"unit.{i}"
        F.add(f"{u}.address", addr, addr + (f", {pc}" if pc else ""), "Vacant unit address", usrc)
        if sqft is not None:
            F.add(f"{u}.size_sqft", sqft, num(sqft), "Floor area, sq ft", usrc, "sq ft")
        if rent is not None:
            F.add(f"{u}.rent_pa", rent, f"£{num(rent)}", "Asking rent per year", usrc, "GBP")
        F.add(f"{u}.use_class", uc, uc or "not stated", "Planning use class", usrc)
        F.add(f"{u}.geocode", geo, geo.replace("_", " "), "How the unit was located", usrc)
        r = recs.get(addr, {"top_uses": []})
        for k, t in enumerate(r["top_uses"]):
            F.add(f"{u}.top{k + 1}.category", t["category"], t["category"].replace("_", " "), f"Suggested use #{k + 1}", rule_src)
            F.add(f"{u}.top{k + 1}.score", t["score"], f"{t['score']:.2f}", f"Fit score for suggested use #{k + 1} (0-1)", rule_src)
            for fk, fv in t["factors"].items():
                F.add(f"{u}.top{k + 1}.{fk}", fv["value"], fv["why"], f"{fk} factor for suggested use #{k + 1}", rule_src)

    F.add("report.generated", datetime.now().date().isoformat(), datetime.now().strftime("%-d %B %Y"),
          "Date this report was generated", rule_src)

    # ---- sources: retrieval dates are facts too, so the Sources section cites nothing unbacked
    seen = {}
    for fact in list(F.items.values()):
        for src in (fact.source if isinstance(fact.source, list) else [fact.source]):
            seen.setdefault((src.dataset, src.url), src)
    for n, src in enumerate(seen.values()):
        F.add(f"source.{n}.retrieved", str(src.retrieved), fmt_date(src.retrieved),
              f"Retrieval date of {src.dataset}", [src])
    return F, {"gaps": gaps, "avoid": avoid, "recs": recs}
