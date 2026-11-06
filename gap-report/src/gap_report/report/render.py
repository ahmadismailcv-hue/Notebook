"""Render report.md from facts. Code writes every table and the Sources section; the
LLM (writer.py) supplies only narrative paragraphs, which also use {{fact:id}} only.

Template text below must contain no digits: every number comes from a fact.
"""

from __future__ import annotations

import re

PH = re.compile(r"\{\{fact:([A-Za-z0-9_.\-]+)\}\}")
CITE = re.compile(r"\[(\d+(?:,\s*\d+)*)\]")


class Citer:
    """Numbers sources in order of first citation."""

    def __init__(self, facts: dict):
        self.facts, self.order, self.index = facts, [], {}

    def _ids(self, fid):
        srcs = self.facts[fid]["source"]
        srcs = srcs if isinstance(srcs, list) else [srcs]
        out = []
        for s in srcs:
            k = (s["dataset"], s["url"])
            if k not in self.index:
                self.order.append(s)
                self.index[k] = len(self.order)
            out.append(self.index[k])
        return sorted(set(out))

    def sub(self, text: str, cite: bool = True) -> str:
        def rep(m):
            fid = m.group(1)
            if fid not in self.facts:
                raise KeyError(f"unknown fact {fid}")
            d = self.facts[fid]["display"]
            if cite and re.search(r"\d", d) and not fid.endswith(".label"):
                return f"{d} [{', '.join(map(str, self._ids(fid)))}]"
            return d
        return PH.sub(rep, text)


def f(fid: str) -> str:
    return "{{fact:" + fid + "}}"


def _table(head: list[str], rows: list[list[str]]) -> str:
    out = ["| " + " | ".join(head) + " |", "|" + "---|" * len(head)]
    out += ["| " + " | ".join(r) + " |" for r in rows]
    return "\n".join(out)


DEMAND_ROWS = ["population", "age_0_15", "age_0_4", "age_65_plus", "ethnic_asian", "ethnic_pakistani",
               "ethnic_indian", "ethnic_bangladeshi", "ethnic_black", "religion_muslim", "religion_sikh",
               "religion_christian", "no_car", "overcrowded", "main_lang_not_english", "limited_english",
               "imd_decile1_share", "idaci_score", "income_score"]


def skeleton(facts: dict, extra: dict) -> list[tuple[str, str]]:
    """Ordered (section, markdown-with-placeholders). '<<narrative:x>>' marks LLM slots."""
    has = lambda k: k in facts
    S = []
    S.append(("title", f"# High-street gap analysis: {f('street.name')}\n\n"
                       f"_Generated {f('report.generated')}. Every number is cited to the numbered sources at the end._"))
    S.append(("summary", "## Summary\n\n<<narrative:summary>>"))

    cats = sorted([k.split(".")[1] for k in facts if k.startswith("supply.") and k.endswith(".on_street")
                   and k.count(".") == 2], key=lambda c: -facts[f"supply.{c}.on_street"]["value"])
    rows = [[c.replace("_", " "), f(f"supply.{c}.on_street"), f(f"supply.{c}.per_100m"),
             f(f"supply.{c}.share"), f(f"supply.{c}.within_radius")]
            for c in cats if facts[f"supply.{c}.on_street"]["value"] > 0]
    absent = [[c.replace("_", " "), f(f"supply.{c}.within_radius")]
              for c in cats if facts[f"supply.{c}.on_street"]["value"] == 0]
    street = (f"## The street today\n\n<<narrative:street_today>>\n\n"
              f"The analysed stretch runs from {f('street.start')} to {f('street.end')}: {f('street.length_m')} m, "
              f"split into {f('street.segments')} segments of {f('method.segment_length_m')} m. An outlet counts as on "
              f"the street within {f('method.street_buffer_m')} m of the centreline. "
              f"There are {f('supply.outlets_on_street')} open outlets on the street, of which "
              f"{f('supply.unclassified_on_street')} are not yet classified.\n\n"
              + _table(["Category", "On street", "Per 100 m", "Share of street",
                        f"Within {f('method.catchment_radius_m')} m"], rows))
    if absent:
        street += "\n\nCategories with no outlet on the street:\n\n" + _table(
            ["Category", f"Within {f('method.catchment_radius_m')} m"], absent)
    ev = sorted({k.split(".")[1] for k in facts if k.startswith("event.")})
    if ev:
        street += "\n\nRecorded changes:\n\n" + "\n".join(
            f"- {f(f'event.{i}.name')}, {f(f'event.{i}.address')}: {f(f'event.{i}.what')} on {f(f'event.{i}.date')}."
            for i in ev)
    S.append(("street_today", street))

    drows = []
    for m in DEMAND_ROWS:
        if not has(f"demand.{m}.catchment"):
            continue
        drows.append([facts[f"demand.{m}.catchment"]["description"].split(":")[0],
                      f(f"demand.{m}.catchment"),
                      f(f"demand.{m}.ward") if has(f"demand.{m}.ward") else "n/a",
                      f(f"demand.{m}.benchmark"),
                      f(f"demand.{m}.ratio") if has(f"demand.{m}.ratio") else "n/a"])
    S.append(("who_lives_here",
              f"## Who lives here\n\n<<narrative:who_lives_here>>\n\nThe catchment is the {f('demand.catchment_lsoas')} "
              f"neighbourhoods (LSOAs) whose population-weighted centre lies within {f('method.catchment_radius_m')} m "
              f"of the street.\n\n" + _table(["Measure", "Catchment", "Ward (2022)", "City", "Ratio to city"], drows)))

    units = sorted({k.split(".")[1] for k in facts if k.startswith("unit.") and k.endswith(".address")})
    if units:
        urows = [[f(f"unit.{i}.address"), f(f"unit.{i}.size_sqft") if has(f"unit.{i}.size_sqft") else "not stated",
                  f(f"unit.{i}.rent_pa") if has(f"unit.{i}.rent_pa") else "not stated", f(f"unit.{i}.use_class")]
                 for i in units]
        S.append(("vacant_units", "## Vacant units\n\n<<narrative:vacant_units>>\n\n" +
                  _table(["Address", "Size (sq ft)", "Rent per year", "Use class"], urows)))
    else:
        S.append(("vacant_units", f"## Vacant units\n\nThe vacant-units file lists {f('units.count')} units, so no "
                                  f"unit-by-unit recommendations are made."))

    grows = []
    for g in extra["gaps"]:
        gid = f"gap.{g['rule_id']}"
        dem = (" OR " if g["demand_mode"] == "any" else " AND ").join(
            f"{f(f'{gid}.demand{j}.label')} {f(f'{gid}.demand{j}.value')} the city rate, needs {f(f'{gid}.demand{j}.op')} "
            f"{f(f'{gid}.demand{j}.threshold')} ({f(f'{gid}.demand{j}.passed')})" for j in range(len(g["demand_checks"])))
        mlabel = {"on_street": "outlets on street", "per_100m": "outlets per 100 m",
                  "share_of_street": "share of street", "within_radius": "outlets within"}
        sup = " AND ".join(
            mlabel[c["measure"]]
            + (f" {f(f'{gid}.supply{j}.radius_m')} m" if "radius_m" in c else "")
            + f" {f(f'{gid}.supply{j}.value')}, needs {f(f'{gid}.supply{j}.op')} {f(f'{gid}.supply{j}.threshold')}"
            + f" ({f(f'{gid}.supply{j}.passed')}"
            + (f", missed by {f(f'{gid}.supply{j}.missed_by')})" if has(f"{gid}.supply{j}.missed_by") else ")")
            for j, c in enumerate(g["supply_checks"]))
        grows.append([f(f"{gid}.category"), f(f"{gid}.status"), dem, sup])
    S.append(("gaps", "## Gaps\n\n<<narrative:gaps>>\n\nEach rule is in `config/gaps.yaml` with its reasoning; "
                      "demand is tested on the catchment against the city.\n\n"
                      + _table(["Use", "Outcome", "Demand test", "Supply test"], grows)))

    avoid = sorted({k.split(".")[1] for k in facts if k.startswith("avoid.") and k.endswith(".basis")})
    rec = "## Recommendations by unit\n\n<<narrative:recommendations>>\n\n"
    for i in units:
        rec += f"### {f(f'unit.{i}.address')}\n\n"
        for k, lab in ((1, "First choice"), (2, "Second choice")):
            p = f"unit.{i}.top{k}"
            if has(f"{p}.category"):
                rec += (f"- **{lab}: {f(f'{p}.category')}** (fit {f(f'{p}.score')}): {f(f'{p}.size')}; "
                        f"{f(f'{p}.use_class')}; {f(f'{p}.parking')}; {f(f'{p}.distance')}.\n")
        if not has(f"unit.{i}.top1.category"):
            rec += "- No flagged gap fits this unit.\n"
        rec += "\n"
    rec += "Uses to avoid on any unit:\n\n" + "\n".join(
        f"- {a.replace('_', ' ')} ({f(f'avoid.{a}.basis')}): {f(f'avoid.{a}.reasoning')}" for a in avoid)
    rec += (f"\n\nA category is saturated when it makes up at least {f('method.saturation_share')} of outlets on the "
            f"street or reaches {f('method.saturation_per_100m')} outlets per 100 m.")
    S.append(("recommendations", rec))

    S.append(("limits", "## Limits\n\n<<narrative:limits>>\n\n"
              "- Outlets come from OpenStreetMap (volunteer-mapped) and the Food Standards Agency register (food "
              "businesses only). Non-food uses with no OSM entry are missing, so an absence of a non-food category is "
              "marked unverified unless the street walk covers it.\n"
              f"- {f('supply.unclassified_on_street')} outlets on the street are not yet classified.\n"
              "- Thresholds in the gap rules are judgement, not calibrated against other streets. Near misses are "
              "shown so the reader can see how close each rule came.\n"
              "- Deprivation rates from the latest Indices of Deprivation are not comparable with earlier editions.\n"
              "- Census figures describe census day, not today; the catchment uses the census neighbourhood boundaries."))
    S.append(("sources", "<<sources>>"))
    return S


NARRATIVE_SLOTS = ["summary", "street_today", "who_lives_here", "vacant_units", "gaps", "recommendations", "limits"]


def assemble(facts: dict, extra: dict, narrative: dict[str, str]) -> str:
    c = Citer(facts)
    parts = []
    for name, md in skeleton(facts, extra):
        if md == "<<sources>>":
            continue
        for slot in NARRATIVE_SLOTS:
            md = md.replace(f"<<narrative:{slot}>>", narrative.get(slot, "").strip())
        parts.append(c.sub(md))
    src_lines = ["## Sources", ""]
    for n, s in enumerate(c.order, 1):
        disp_date = next(v["display"] for v in facts.values()
                         if v["id"].startswith("source.") and _same(v["source"], s))
        src_lines.append(f"{n}. {s['dataset']}. {s['url']}. Retrieved {disp_date}.")
    return "\n\n".join(p for p in parts if p) + "\n\n" + "\n".join(src_lines) + "\n"


def _same(srcs, s):
    srcs = srcs if isinstance(srcs, list) else [srcs]
    return any(x["dataset"] == s["dataset"] and x["url"] == s["url"] for x in srcs)
