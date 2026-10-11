import json, re, collections, math, csv
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

rc = json.load(open("review_counts.json"))
tot, hit = rc["tot"], rc["hit"]
meta = json.load(open("meta.json"))

NON_FILM = re.compile(
    r"season|series|complete|collection|volume|vol\.|episode|box set|workout|fitness|yoga|pilates|"
    r"exercise|tai chi|dance|lesson|learn|course|bible|sermon|concert|live at|live in|trilogy|"
    r"\bpack\b|double feature|seasons|tv|bbc|masterpiece|nova|frontline|national geographic|"
    r"meditation|weight|abs\b|cardio|beachbody|insanity|p90x|how to|guide|kids|sesame|vhs", re.I)
BAD_CATS = {"TV", "Exercise & Fitness", "Fitness & Yoga", "Special Interest", "Kids & Family",
            "Music Artists", "Musicals & Performing Arts", "Boxed Sets", "Educational"}

def norm(t):
    t = re.sub(r"\[.*?\]|\(.*?\)", "", t or "")
    t = re.sub(r"\b(blu-?ray|dvd|hd|4k|uhd|digital|widescreen|special edition|collector'?s edition)\b", "", t, flags=re.I)
    return re.sub(r"[^a-z0-9]+", " ", t.lower()).strip()

agg = collections.defaultdict(lambda: [0, 0, None])
for a, n in tot.items():
    m = meta.get(a)
    if not m or not m[0]:
        continue
    title, _, cats = m
    if NON_FILM.search(title) or (cats and BAD_CATS & set(cats)):
        continue
    k = norm(title)
    if len(k) < 2:
        continue
    g = agg[k]
    g[0] += n; g[1] += hit.get(a, 0)
    if g[2] is None or len(title) < len(g[2]):
        g[2] = re.sub(r"\s*\[.*?\]|\s*\(.*?\)", "", title).strip()

rows = [(v[2], v[0], v[1], 100 * v[1] / v[0]) for v in agg.values() if v[0] >= 50 and v[1] >= 1]
rows.sort(key=lambda r: -r[3])
with open("life_changing_movies.csv", "w", newline="") as f:
    w = csv.writer(f); w.writerow(["title", "reviews", "life_changing_mentions", "pct"])
    w.writerows(rows)

print("titles >=50 reviews with >=1 hit:", len(rows))
print("\nTop by %:")
for r in rows[:30]: print(f"{r[3]:5.1f}%  {r[2]:4d}/{r[1]:<6d} {r[0][:70]}")
print("\nTop by %, >=1000 reviews:")
for r in [r for r in rows if r[1] >= 1000][:30]: print(f"{r[3]:5.1f}%  {r[2]:4d}/{r[1]:<6d} {r[0][:70]}")
print("\nTop by raw count:")
for r in sorted(rows, key=lambda r: -r[2])[:20]: print(f"{r[3]:5.1f}%  {r[2]:4d}/{r[1]:<6d} {r[0][:70]}")

# Chart (same shape as the book chart)
fig, ax = plt.subplots(figsize=(13, 7.5), dpi=150)
fig.patch.set_facecolor("#fcfcfb"); ax.set_facecolor("#fcfcfb")
xs = [r[1] for r in rows]; ys = [r[3] for r in rows]
ax.scatter(xs, ys, s=10, c="#2a78d6", alpha=0.35, linewidths=0)
ax.set_xscale("log")
ymax = max(ys); ax.set_ylim(0, min(ymax * 1.08, 30))
# label: top % in each log-decade bucket + biggest absolute
label = {}
for lo in [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]:
    b = [r for r in rows if lo <= r[1] < lo * 2.2]
    for r in sorted(b, key=lambda r: -r[3])[:2]: label[r[0]] = r
for r in rows:
    if r[0] in ("Food, Inc.","The Room","The Passion of the Christ","Fight Club","Life of Pi","The Shack","Peaceful Warrior","The Matrix","Fireproof"): label[r[0]]=r
label={k:v for k,v in label.items() if v[3]>=0.3}
for t, r in label.items():
    if r[3] > ax.get_ylim()[1]: continue
    ax.scatter([r[1]], [r[3]], s=22, c="#2a78d6", edgecolors="#fcfcfb", linewidths=1.2, zorder=3)
    ax.annotate(t.lower()[:40], (r[1], r[3]), xytext=(4, 4), textcoords="offset points",
                fontsize=8, color="#0b0b0b")
for s in ("top", "right"): ax.spines[s].set_visible(False)
for s in ("left", "bottom"): ax.spines[s].set_color("#c3c2b7")
ax.grid(True, color="#e8e7e2", linewidth=0.6); ax.set_axisbelow(True)
ax.tick_params(colors="#52514e", labelsize=9)
from matplotlib.ticker import FixedLocator, FixedFormatter
tk = [t for t in [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000] if t <= max(xs) * 1.2]
ax.xaxis.set_major_locator(FixedLocator(tk)); ax.xaxis.set_major_formatter(FixedFormatter([f"{t:,}" for t in tk]))
ax.xaxis.set_minor_locator(FixedLocator([]))
ax.set_xlabel("Number of reviews (log scale)", color="#52514e")
ax.set_ylabel('% of reviews saying "life-changing" / "changed my life"', color="#52514e")
ax.set_title('Movies: % of Amazon reviews calling the film life-changing, by number of reviews',
             loc="left", fontsize=12, color="#0b0b0b")
fig.text(0.01, 0.01, "Source: Amazon Reviews 2023, Movies & TV (McAuley Lab, UCSD), ~17M reviews. Editions merged by title; "
         "TV, fitness, box sets filtered heuristically. Films with ≥50 reviews and ≥1 match.",
         fontsize=7.5, color="#52514e")
fig.tight_layout(rect=(0, 0.03, 1, 1))
fig.savefig("life_changing_movies.png")
