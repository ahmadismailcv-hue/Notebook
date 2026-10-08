"""Collect Reddit posts about LLMs via the Arctic Shift archive API.

Samples one 6-day window every other month per subreddit, up to ~1000
posts each, from Dec 2022 to Sep 2026. Non-AI subreddits are filtered locally
to AI-related titles/selftext.
"""
import json, re, sys, time, random
from concurrent.futures import ThreadPoolExecutor
import requests

OUT = sys.argv[1]
BASE = "https://arctic-shift.photon-reddit.com/api/posts/search"
FIELDS = "id,title,selftext,score,num_comments,created_utc,subreddit"

AI_NATIVE = ["ChatGPT", "singularity", "OpenAI", "LocalLLaMA", "ClaudeAI",
             "ArtistHate", "replika", "CharacterAI", "MyBoyfriendIsAI", "aiwars"]
FILTERED = ["programming", "ExperiencedDevs", "cscareerquestions", "Teachers",
            "Professors", "writing", "technology", "Futurology", "antiwork"]
AI_RE = re.compile(r"\b(ai|a\.i\.|chatgpt|chat gpt|gpt[- ]?\d?o?|llms?|openai|claude|"
                   r"gemini|copilot|chatbots?|generative|genai|large language model|"
                   r"anthropic|deepseek|grok|midjourney|vibe ?cod\w*)\b", re.I)


def months():
    y, m = 2022, 12
    while (y, m) <= (2026, 9):
        yield y, m
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)


def fetch(sub, after, before):
    params = dict(subreddit=sub, after=after, before=before, limit="auto",
                  sort="asc", fields=FIELDS)
    for attempt in range(5):
        try:
            r = requests.get(BASE, params=params, timeout=90)
            d = r.json()
            if d.get("data") is not None:
                return d["data"]
            time.sleep(3 * (attempt + 1) + random.random() * 3)
        except Exception:
            time.sleep(3 * (attempt + 1))
    print(f"FAIL {sub} {after}", file=sys.stderr, flush=True)
    return []


def job(args):
    sub, y, m, day = args
    after = f"{y}-{m:02d}-{day:02d}"
    before = f"{y}-{m:02d}-{day + 6:02d}"
    posts = fetch(sub, after, before)
    keep = []
    for p in posts:
        text = f"{p.get('title','')} {(p.get('selftext') or '')[:1500]}"
        if sub in FILTERED and not AI_RE.search(text):
            continue
        p["selftext"] = (p.get("selftext") or "")[:800]
        keep.append(p)
    print(f"{sub} {after}: {len(posts)} fetched, {len(keep)} kept", flush=True)
    return keep


# Every other month, one 6-day window starting on the 8th.
ms = [ym for i, ym in enumerate(months()) if i % 2 == 0]
jobs = [(s, y, m, 8) for (y, m) in ms for s in AI_NATIVE + FILTERED]
with ThreadPoolExecutor(6) as ex, open(OUT, "w") as f:
    for res in ex.map(job, jobs):
        for p in res:
            f.write(json.dumps(p) + "\n")
