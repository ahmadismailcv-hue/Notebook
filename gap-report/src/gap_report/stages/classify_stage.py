"""Stage 3: categorise every business, then merge OSM/FSA/street-walk records that
describe the same outlet into one row of `outlets`.

Precedence when merged records disagree: street walk > name rule > OSM tag >
FSA type > LLM. Excluded street furniture never becomes an outlet.
"""

from __future__ import annotations

import re
from difflib import SequenceMatcher

from gap_report.address import house_numbers
from gap_report.classify import llm, rules
from gap_report.config import StreetConfig
from gap_report.db import open_db

RANK = {"manual": 0, "name": 1, "osm": 2, "fsa": 3, "llm": 4}
# 'unclassified' (LLM not run) ranks last within a merged group via the llm rank + tiebreak below
MERGE_M = 60
_STOP = re.compile(r"\b(ltd|limited|the|and|coventry|cov|uk|plc|co)\b|[^a-z0-9 ]")


def _norm(name: str | None) -> str:
    return re.sub(r"\s+", " ", _STOP.sub(" ", (name or "").lower().replace("&", " and "))).strip()


def _similar(a, b) -> bool:
    a, b = _norm(a), _norm(b)
    if not a or not b:
        return False
    if a in b or b in a:
        return True
    return SequenceMatcher(None, a, b).ratio() >= 0.75


def run(cfg: StreetConfig, use_llm: bool = True) -> dict:
    con = open_db(cfg)
    rows = con.execute("""SELECT id, source, name, raw_type, address, in_street FROM businesses""").fetchall()
    cls, leftovers = {}, []
    for bid, src, name, raw, addr, _ in rows:
        r = rules.classify(src, name, raw)
        if r:
            cat, method, rule = r
            kind = "manual" if method == "manual" else rule.split(":")[0]
            cls[bid] = (cat, kind, rule, None)
        else:
            leftovers.append({"id": bid, "name": name, "raw_type": raw, "address": addr})
    llm_out = llm.classify(leftovers, cached_only=not use_llm)
    for it in leftovers:
        a = llm_out.get(it["id"])
        cls[it["id"]] = (a["category"], "llm", f"llm:{a['model']}", a["confidence"]) if a else \
            ("unclassified", "llm", "llm:not_run", "none")

    con.execute("""CREATE OR REPLACE TABLE business_class (id VARCHAR, category VARCHAR, method VARCHAR,
                   rule VARCHAR, confidence VARCHAR)""")
    con.executemany("INSERT INTO business_class VALUES (?, ?, ?, ?, ?)",
                    [[k, *v] for k, v in cls.items()])

    # ---- merge duplicates: candidate pairs within MERGE_M metres, different sources
    pairs = con.execute(f"""
        SELECT a.id, b.id, a.name, b.name, a.address, b.address, ST_Distance(a.geom, b.geom) d
        FROM businesses a JOIN businesses b ON a.id < b.id AND a.source <> b.source
          AND ST_DWithin(a.geom, b.geom, {MERGE_M})
        JOIN business_class ca ON ca.id = a.id JOIN business_class cb ON cb.id = b.id
        WHERE ca.category <> '_excluded' AND cb.category <> '_excluded'""").fetchall()
    parent = {}
    src_of = {r[0]: r[1] for r in rows}
    members = {}  # root -> set of sources already in the group (one record per source)

    def find(x):
        while parent.get(x, x) != x:
            x = parent[x]
        return x
    merged = 0
    for a, b, na, nb, aa, ab, d in sorted(pairs, key=lambda p: p[-1]):
        same_no = bool(set(house_numbers(aa or "")) & set(house_numbers(ab or "")))
        if _similar(na, nb) or (same_no and d < 25 and (not na or not nb)):
            ra, rb = find(a), find(b)
            sa = members.get(ra, {src_of[ra]}); sb = members.get(rb, {src_of[rb]})
            if ra != rb and not (sa & sb):
                parent[rb] = ra
                members[ra] = sa | sb
                merged += 1

    con.execute("CREATE OR REPLACE TEMP TABLE grp (id VARCHAR, grp VARCHAR)")
    ids = [r[0] for r in rows]
    con.executemany("INSERT INTO grp VALUES (?, ?)", [[i, find(i)] for i in ids])
    rank_sql = " ".join(f"WHEN '{k}' THEN {v}" for k, v in RANK.items())
    con.execute(f"""CREATE OR REPLACE TABLE outlets AS
        WITH m AS (
          SELECT g.grp, b.*, c.category, c.method, c.rule, c.confidence,
                 CASE c.method {rank_sql} END AS mrank,
                 CASE b.source WHEN 'street_walk' THEN 0 WHEN 'fsa' THEN 1 ELSE 2 END AS srank,
                 CASE WHEN b.geocode IN ('osm', 'fsa', 'manual') THEN 0 ELSE 1 END AS grank
          FROM businesses b JOIN business_class c USING (id) JOIN grp g USING (id)
          WHERE c.category <> '_excluded')
        SELECT grp AS outlet_id,
               arg_min(category, mrank) AS category,
               arg_min(method, mrank) AS method,
               arg_min(rule, mrank) AS rule,
               arg_min(confidence, mrank) AS confidence,
               arg_min(name, srank) FILTER (WHERE name IS NOT NULL) AS name,
               arg_min(address, srank) FILTER (WHERE address IS NOT NULL) AS address,
               arg_min(postcode, srank) FILTER (WHERE postcode IS NOT NULL) AS postcode,
               arg_min(geom, grank) AS geom,
               arg_min(geocode, grank) AS geocode,
               list(id ORDER BY id) AS source_ids,
               list(DISTINCT source ORDER BY source) AS sources
        FROM m GROUP BY grp""")
    con.execute("""CREATE OR REPLACE TABLE outlets AS
        SELECT o.*, ST_Distance(o.geom, l.geom) AS dist_to_line_m,
               ST_Distance(o.geom, l.geom) <= 150 AS in_street,
               (SELECT arg_min(s.id, ST_Distance(o.geom, s.geom)) FROM segments s) AS nearest_segment
        FROM outlets o, street_line l""")
    con.execute("""CREATE OR REPLACE TABLE outlets AS SELECT * EXCLUDE (nearest_segment),
        CASE WHEN in_street THEN nearest_segment END AS segment_id FROM outlets""")

    out = {
        "records": len(rows),
        "by_rule": sum(1 for v in cls.values() if v[1] != "llm"),
        "by_llm": sum(1 for v in cls.values() if v[1] == "llm" and v[0] != "unclassified"),
        "unclassified": sum(1 for v in cls.values() if v[0] == "unclassified"),
        "excluded_street_furniture": sum(1 for v in cls.values() if v[0] == "_excluded"),
        "duplicate_links_merged": merged,
        "outlets_within_1km": con.execute("SELECT count(*) FROM outlets").fetchone()[0],
        "outlets_on_street": con.execute("SELECT count(*) FROM outlets WHERE in_street").fetchone()[0],
        "on_street_by_category": con.execute(
            "SELECT category, count(*) n FROM outlets WHERE in_street GROUP BY 1 ORDER BY n DESC, 1").fetchall(),
        "llm_low_confidence_on_street": con.execute(
            "SELECT name, category FROM outlets WHERE in_street AND method='llm' AND confidence='low' ORDER BY 1").fetchall(),
    }
    con.close()
    return out
