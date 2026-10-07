#!/usr/bin/env python3
"""Check the site before it goes out: every link, picture and video on the pages and in the data resolves to a file
here, and nothing points at the internals of other sites (run logs, review pages, private repositories)."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parent.parent
REF = re.compile(r'(?:href|src)="([^"]+)"')
# addresses this site must never carry: the internal review and log site, private repositories, log pages
FORBIDDEN = ["embodied-agent-interface", "runs/overview", "/runs/", "benchmarks/", "reference/capabilities", "github.com/JamesKrW",
             "robot_coding_bench", "internal preview", "log.json", "RoboPaint-strict", "robopaint-strict"]
SKIP = ("http://", "https://", "mailto:", "#", "data:", "javascript:")


def exists(base: Path, ref: str) -> bool:
    target = unquote(ref.split("#")[0].split("?")[0])
    if not target:
        return True
    p = (ROOT / target.lstrip("/")) if target.startswith("/") else (base / target)
    p = p.resolve()
    return p.is_file() or (p / "index.html").is_file()


def main() -> int:
    problems = []
    pages = sorted([*ROOT.glob("**/index.html"), ROOT / "404.html"])
    for page in pages:
        text = page.read_text(encoding="utf-8")
        for ref in REF.findall(text):
            if not ref.startswith(SKIP) and "${" not in ref and not exists(page.parent, ref):
                problems.append(f"{page.relative_to(ROOT)}: broken link {ref}")
    media = 0
    for name in ("exam.json", "tasks.json"):
        data = (ROOT / "data" / name).read_text(encoding="utf-8")
        for path in re.findall(r'"(media/[^"]+)"', data):
            media += 1
            if not (ROOT / path).is_file():
                problems.append(f"data/{name}: missing {path}")
        json.loads(data)
    for f in [*pages, ROOT / "assets/app.js", ROOT / "assets/exam.css", ROOT / "data/exam.json", ROOT / "data/tasks.json"]:
        text = f.read_text(encoding="utf-8")
        for bad in FORBIDDEN:
            if bad in text:
                problems.append(f"{f.relative_to(ROOT)}: contains '{bad}'")
    print(f"checked {len(pages)} pages and {media} media references")
    for p in problems:
        print("  ERROR", p)
    if problems:
        return 1
    print("all links, pictures and videos resolve; no addresses of other sites' internals")
    return 0


if __name__ == "__main__":
    sys.exit(main())
