#!/usr/bin/env python3
"""Check the site before it goes out: every link on the pages resolves to a file here, every picture and video the data
and the pages name is on HF in the version named (one listing of the dataset; scripts/media.py), and nothing points at
the internals of other sites (run logs, review pages, private repositories)."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import media  # noqa: E402
# the blog's direct links into the dataset's other folders (the reviewed masters, the older web copies)
HF_REF = re.compile(re.escape(media.HF) + r"(masters|web)/([^\"'?)\s]+)")
REF = re.compile(r'(?:href|src)="([^"]+)"')
# addresses this site must never carry: the internal review and log site, private repositories, log pages
FORBIDDEN = ["embodied-agent-interface", "runs/overview", "/runs/", "benchmarks/", "reference/capabilities", "github.com/JamesKrW",
             "robot_coding_bench", "internal preview", "log.json", "RoboPaint-strict", "robopaint-strict"]
SKIP = ("http://", "https://", "mailto:", "#", "data:", "javascript:")
# public addresses that contain a forbidden fragment by coincidence: removed from the text before the scan
ALLOWED = ["huggingface.co/datasets/MLL-Lab/embodied-exam-media/resolve/main/runs/", "blog.json"]  # blog.json: the blog's own data file, not a log


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
    for name in ("exam.json", "tasks.json"):
        data = (ROOT / "data" / name).read_text(encoding="utf-8")
        json.loads(data)
        for path in re.findall(r'"(media/[^"]+)"', data):
            problems.append(f"data/{name}: {path} is not an HF address (run make data)")
    # every picture and video on HF, in the version its address names
    refs, hf = media.referenced(ROOT), media.listing()
    for rel, v in sorted(refs.items()):
        if rel not in hf:
            problems.append(f"not on HF: {media.PREFIX}/{rel} (run make media)")
        elif v and not hf[rel][1].startswith(v):
            problems.append(f"on HF in another version: {media.PREFIX}/{rel} (?v={v}; run make data, then make media)")
    others = {}
    for f in [*pages, ROOT / "assets/blog.js", ROOT / "data/blog.json"]:
        if f.is_file():
            for top, path in HF_REF.findall(f.read_text(encoding="utf-8")):
                others.setdefault(top, set()).add((f.relative_to(ROOT), unquote(path)))
    for top, found in sorted(others.items()):
        there = media.listing(top)
        problems += [f"{f}: not on HF: {top}/{path}" for f, path in sorted(found) if path not in there]
    # the Task Atlas files (scripts/export_atlas.py), when present
    atlas = [p for p in (ROOT / "assets/search_core.js", ROOT / "data/atlas.json", ROOT / "data/search.json") if p.is_file()]
    blog = [p for p in (ROOT / "assets/blog.js", ROOT / "assets/blog.css", ROOT / "data/blog.json") if p.is_file()]
    for f in [*pages, ROOT / "assets/app.js", ROOT / "assets/exam.css", ROOT / "data/exam.json", ROOT / "data/tasks.json", *atlas, *blog]:
        text = f.read_text(encoding="utf-8")
        for ok in ALLOWED:
            text = text.replace(ok, "")
        for bad in FORBIDDEN:
            if bad in text:
                problems.append(f"{f.relative_to(ROOT)}: contains '{bad}'")
    print(f"checked {len(pages)} pages, {len(refs)} media files on HF ({media.PREFIX}/) and "
          f"{sum(len(x) for x in others.values())} links to its other folders")
    for p in problems:
        print("  ERROR", p)
    if problems:
        return 1
    print("all links, pictures and videos resolve; no addresses of other sites' internals")
    return 0


if __name__ == "__main__":
    sys.exit(main())
