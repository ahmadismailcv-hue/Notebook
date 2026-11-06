"""Address parsing helpers: house numbers and ranges like '408-410' or '424a'."""

from __future__ import annotations

import re

_NUM = re.compile(r"^\s*(?:unit\s+\S+,?\s*)?(\d+)\s*([a-z])?(?:\s*-\s*(\d+)\s*[a-z]?)?\b", re.I)


def house_numbers(text: str | None) -> list[int]:
    """'408-410 Foleshill Road' -> [408, 410]; '364a' -> [364]; no number -> []."""
    if not text:
        return []
    m = _NUM.match(text)
    if not m:
        return []
    a = int(m.group(1)); b = int(m.group(3)) if m.group(3) else None
    return [a, b] if b and b > a else [a]


def norm_postcode(pc: str | None) -> str | None:
    if not pc:
        return None
    pc = re.sub(r"\s+", "", pc.upper())
    return f"{pc[:-3]} {pc[-3:]}" if len(pc) >= 5 else pc
