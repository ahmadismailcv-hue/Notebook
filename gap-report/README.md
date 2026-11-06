# gap-report

Cited high-street gap analysis for one UK street. v0 covers Foleshill Road, Coventry.

Status: Stage 0 (scaffold). See the build plan in the session; the full README
(including how to add a second street) is written in Stage 7.

```bash
uv sync
cp .env.example .env        # add ANTHROPIC_API_KEY (needed from Stage 3)
uv run gap-report "Foleshill Road, Coventry"
uv run pytest
```

Raw API responses are cached under `data/raw/<source>/` with UTC timestamps and
committed, so runs repeat offline (`--offline`).
