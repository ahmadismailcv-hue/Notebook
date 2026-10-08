# LLM user sentiment, Nov 2022 to Oct 2026

- `REPORT.md`: the grouped analysis (start here).
- `collect.py`: pulls Reddit posts from the Arctic Shift archive (`python3 collect.py posts.jsonl`; needs `requests`).
- `analyze.py`: VADER sentiment and theme tagging by user group and half-year (`python3 analyze.py posts.jsonl data/agg.json data/top.txt`; needs `vaderSentiment`).
- `data/agg.json`: per group × half-year counts, % positive/negative, and theme prevalence.
- `data/top.txt`: top-scoring post titles per group × half-year.

The raw `posts.jsonl` (~44 MB, ~112k posts) isn't committed. Re-run `collect.py` to regenerate it; archive contents may change slightly.
