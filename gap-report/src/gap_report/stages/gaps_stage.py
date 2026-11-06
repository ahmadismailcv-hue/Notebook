"""Stage 5: evaluate gaps.yaml, then score each vacant unit against the flagged gaps."""

from __future__ import annotations

import json

from gap_report import gaps as G
from gap_report.config import StreetConfig
from gap_report.db import open_db
from gap_report.matching import recommend


def run(cfg: StreetConfig) -> dict:
    con = open_db(cfg)
    walk = con.execute("SELECT count(*) FROM businesses WHERE source='street_walk'").fetchone()[0]
    results, avoid = G.evaluate(con, walk)
    con.execute("CREATE OR REPLACE TABLE gap_results (rule_id VARCHAR, category VARCHAR, status VARCHAR, detail JSON)")
    con.executemany("INSERT INTO gap_results VALUES (?, ?, ?, ?)",
                    [[r["rule_id"], r["category"], r["status"], json.dumps(r)] for r in results])
    con.execute("CREATE OR REPLACE TABLE avoid_uses (category VARCHAR, basis VARCHAR, detail JSON)")
    if avoid:
        con.executemany("INSERT INTO avoid_uses VALUES (?, ?, ?)",
                        [[a["category"], a["basis"], json.dumps(a)] for a in avoid])

    cfgy = G.load()
    units = con.execute("SELECT address, postcode, size_sqft, rent_pa, use_class, features, status, "
                        "geocode FROM vacant_units").fetchall()
    cols = ["address", "postcode", "size_sqft", "rent_pa", "use_class", "features", "status", "geocode"]
    recs = []
    for row in units:
        u = dict(zip(cols, row))
        nearest = dict(con.execute("SELECT category, nearest_m FROM unit_nearest WHERE address=?",
                                   [u["address"]]).fetchall())
        recs.append(recommend(u, results, cfgy["category_needs"], nearest, avoid, cfgy["scoring"]))
    con.execute("CREATE OR REPLACE TABLE unit_recommendations (address VARCHAR, detail JSON)")
    if recs:
        con.executemany("INSERT INTO unit_recommendations VALUES (?, ?)", [[r["address"], json.dumps(r)] for r in recs])
    con.close()

    def show(r):
        d = " & ".join(f"{c['metric']} {c['value']:.2f} {c['op'].replace('ratio_', '')} {c['threshold']}"
                       for c in r["demand_checks"])
        s = " & ".join(f"{c['measure']}{'@' + str(c['radius_m']) if 'radius_m' in c else ''} "
                       f"{c['value']:.2f} {c['op']} {c['threshold']}" for c in r["supply_checks"])
        return (r["rule_id"], r["status"], f"demand[{r['demand_mode']}]: {d}", f"supply: {s}")
    return {"gap_rules": [show(r) for r in results],
            "avoid": [(a["category"], a["basis"]) for a in avoid],
            "vacant_units_scored": len(recs),
            "unit_top_uses": [(r["address"], [(t["category"], round(t["score"], 2)) for t in r["top_uses"]])
                              for r in recs]}
