import sys, json
out = {}
for line in sys.stdin:
    d = json.loads(line)
    out[d["parent_asin"]] = [d.get("title"), d.get("main_category"), d.get("categories")]
json.dump(out, open("meta.json", "w"))
