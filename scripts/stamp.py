#!/usr/bin/env python3
"""Give the pages' links to assets/exam.css and assets/app.js a content hash (?v=...), so a browser fetches a new
version as soon as one is published and keeps its cached copy otherwise."""

import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
stamps = {name: hashlib.sha256((ROOT / "assets" / name).read_bytes()).hexdigest()[:8] for name in ("exam.css", "app.js")}
changed = 0
for page in sorted([*ROOT.glob("**/index.html"), ROOT / "404.html"]):
    text = page.read_text(encoding="utf-8")
    new = re.sub(r'(assets/(exam\.css|app\.js))(\?v=[0-9a-f]+)?"', lambda m: f'{m.group(1)}?v={stamps[m.group(2)]}"', text)
    if new != text:
        page.write_text(new, encoding="utf-8")
        changed += 1
print(f"stamped {changed} pages: " + ", ".join(f"{k}?v={v}" for k, v in stamps.items()))
