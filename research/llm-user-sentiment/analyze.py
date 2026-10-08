"""Aggregate sentiment and theme prevalence by user group and half-year."""
import json, re, sys, collections, datetime
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

SRC, OUT_JSON, OUT_TOP = sys.argv[1], sys.argv[2], sys.argv[3]

GROUPS = {
    "Enthusiasts & power users": ["ChatGPT", "singularity", "OpenAI", "ClaudeAI"],
    "Open-model tinkerers": ["LocalLLaMA"],
    "Software developers": ["programming", "ExperiencedDevs", "cscareerquestions"],
    "Educators": ["Teachers", "Professors"],
    "Creatives (anti-AI)": ["ArtistHate", "writing"],
    "AI-art debate arena": ["aiwars"],
    "General tech public": ["technology", "Futurology"],
    "Workers / labour": ["antiwork"],
    "Companion users": ["replika", "CharacterAI", "MyBoyfriendIsAI"],
}
SUB2G = {s: g for g, subs in GROUPS.items() for s in subs}

THEMES = {
    "jobs/layoffs": r"\b(jobs?|layoffs?|laid off|unemploy\w*|replace[ds]?|hiring|career)\b",
    "cheating/academic integrity": r"\b(cheat\w*|plagiari\w*|academic (dis)?honesty|ai detect\w*|turnitin|wrote (it|this) with)\b",
    "hallucination/accuracy": r"\b(hallucinat\w*|made up|makes? (stuff|things) up|wrong answer|inaccura\w*|fabricat\w*|confidently wrong)\b",
    "censorship/refusals": r"\b(censor\w*|refus\w*|filters?|guardrails?|woke|nanny|as an ai language model|content policy)\b",
    "degradation/nerfs": r"\b(nerf\w*|dumber|lobotom\w*|worse than before|getting worse|downgrad\w*|lazy)\b",
    "sycophancy/personality": r"\b(sycophan\w*|glaz\w*|flatter\w*|personality|tone|yes-?man|too agreeable)\b",
    "companionship/attachment": r"\b(companion\w*|boyfriend|girlfriend|in love|lonel\w*|my partner|grief|griev\w*|miss (him|her|it))\b",
    "art theft/copyright": r"\b(stole|steal\w*|theft|copyright\w*|consent|scrap\w*|training data|lawsuit)\b",
    "slop/low-quality content": r"\b(slop|spam|garbage|ai[- ]generated (crap|junk)|enshittif\w*|dead internet)\b",
    "productivity/usefulness": r"\b(productiv\w*|saved me|saves? (me )?(hours|time)|game ?changer|workflow|useful|helped me)\b",
    "AGI/existential": r"\b(agi|asi|superintelligen\w*|singularity|existential|extinction|doom\w*|alignment)\b",
    "mental health": r"\b(therap\w*|mental health|depress\w*|anxiety|suicid\w*|psychosis|delusion\w*)\b",
    "privacy/data": r"\b(privacy|personal data|surveillance|data (leak|breach)|tracking)\b",
    "energy/data centers": r"\b(data ?cent(er|re)s?|electricity|power grid|water use|energy (use|consumption))\b",
    "hype/bubble skepticism": r"\b(hype\w*|bubble|grift\w*|snake oil|overrated|scam)\b",
    "pricing/rate limits": r"\b(rate limit\w*|usage limit\w*|price|pricing|subscription|cancel(l?ed|ling)? (my )?(plus|pro|sub))\b",
}
THEME_RE = {k: re.compile(v, re.I) for k, v in THEMES.items()}


def half(ts):
    d = datetime.datetime.fromtimestamp(ts, datetime.UTC)
    return f"{d.year}-H{1 if d.month <= 6 else 2}"


sia = SentimentIntensityAnalyzer()
agg = collections.defaultdict(lambda: {"n": 0, "comp": 0.0, "pos": 0, "neg": 0,
                                       "themes": collections.Counter()})
top = collections.defaultdict(list)
seen = set()
for line in open(SRC):
    p = json.loads(line)
    if p["id"] in seen:
        continue
    seen.add(p["id"])
    g = SUB2G.get(p["subreddit"]) or SUB2G.get(next((s for s in SUB2G if s.lower() == p["subreddit"].lower()), ""))
    if not g:
        continue
    body = p.get("selftext") or ""
    if body in ("[removed]", "[deleted]"):
        body = ""
    text = f"{p['title']}. {body}"
    c = sia.polarity_scores(text)["compound"]
    key = (g, half(p["created_utc"]))
    a = agg[key]
    a["n"] += 1
    a["comp"] += c
    a["pos"] += c >= 0.05
    a["neg"] += c <= -0.05
    for k, rx in THEME_RE.items():
        if rx.search(text):
            a["themes"][k] += 1
    top[key].append((p.get("score") or 0, p.get("num_comments") or 0, p["subreddit"], p["title"][:160], c))

rows = []
for (g, h), a in sorted(agg.items()):
    n = a["n"]
    rows.append({"group": g, "period": h, "n": n,
                 "mean_compound": round(a["comp"] / n, 3),
                 "pct_pos": round(100 * a["pos"] / n, 1),
                 "pct_neg": round(100 * a["neg"] / n, 1),
                 "themes_pct": {k: round(100 * v / n, 1) for k, v in a["themes"].most_common()}})
json.dump(rows, open(OUT_JSON, "w"), indent=1)

with open(OUT_TOP, "w") as f:
    for key in sorted(top):
        f.write(f"\n## {key[0]} | {key[1]}\n")
        for s, nc, sub, t, c in sorted(top[key], reverse=True)[:12]:
            f.write(f"{s:>6} {nc:>5} r/{sub:<16} {c:+.2f}  {t}\n")
print(len(seen), "unique posts")
