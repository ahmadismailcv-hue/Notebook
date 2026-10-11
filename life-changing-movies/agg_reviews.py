import sys, json, re, collections
pat = re.compile(r"life[\s-]?chang|changed my life|change your life|changes your life")
tot = collections.Counter(); hit = collections.Counter()
for i, line in enumerate(sys.stdin):
    d = json.loads(line)
    a = d.get("parent_asin") or d["asin"]
    tot[a] += 1
    t = ((d.get("title") or "") + " " + (d.get("text") or "")).lower()
    if "chang" in t and pat.search(t): hit[a] += 1
    if i % 2000000 == 0: print(i, file=sys.stderr, flush=True)
json.dump({"tot": tot, "hit": hit}, open("review_counts.json", "w"))
