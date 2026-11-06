"""Timestamped raw cache. Every network response is written to data/raw/<source>/.

fetch() returns the newest cached copy when one exists (unless refresh=True), so
re-runs are repeatable and work offline. In offline mode a missing cache is an error.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import httpx

from gap_report.config import ROOT, settings


@dataclass
class Cached:
    path: Path
    retrieved: datetime
    url: str

    def text(self) -> str:
        return self.path.read_text(encoding="utf-8")

    def json(self):
        return json.loads(self.text())

    @property
    def rel_path(self) -> str:
        return str(self.path.relative_to(ROOT))


def _key(url: str, params: dict | None, body: str | None) -> str:
    blob = json.dumps([url, sorted((params or {}).items()), body], default=str)
    return hashlib.sha256(blob.encode()).hexdigest()[:16]


def _stamp(path: Path) -> datetime:
    # filenames look like <key>__20261106T170501Z.<ext>
    ts = path.name.split("__")[-1].split(".")[0]
    return datetime.strptime(ts, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)


def fetch(source: str, url: str, *, params: dict | None = None, data: str | None = None,
          headers: dict | None = None, ext: str = "json", refresh: bool = False,
          method: str = "GET") -> Cached:
    cfg = settings()
    folder = cfg.raw_dir / source
    folder.mkdir(parents=True, exist_ok=True)
    key = _key(url, params, data)
    existing = sorted(f for f in folder.glob(f"{key}__*.{ext}")
                      if not f.name.endswith(".meta.json"))
    full_url = str(httpx.URL(url, params=params)) if params else url

    if existing and not refresh:
        return Cached(existing[-1], _stamp(existing[-1]), full_url)
    if cfg.cache.offline:
        raise RuntimeError(f"Offline mode and no cache for {source}: {full_url}")

    hdrs = {"User-Agent": cfg.http.user_agent, **(headers or {})}
    resp = httpx.request(method, url, params=params, content=data, headers=hdrs,
                         timeout=cfg.http.timeout_s, follow_redirects=True)
    resp.raise_for_status()
    now = datetime.now(timezone.utc)
    path = folder / f"{key}__{now:%Y%m%dT%H%M%SZ}.{ext}"
    path.write_bytes(resp.content)
    # sidecar records what was asked for, so a raw file is self-describing
    path.with_name(path.name + ".meta.json").write_text(json.dumps(
        {"url": full_url, "method": method, "body": data, "retrieved": now.isoformat(),
         "status": resp.status_code}, indent=2))
    return Cached(path, now, full_url)
