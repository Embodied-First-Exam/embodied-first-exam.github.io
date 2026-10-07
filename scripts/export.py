#!/usr/bin/env python3
"""Refresh the site's data and media from the exam's source.

The pages are static; everything they show comes from data/exam.json and data/tasks.json and the pictures and videos
under media/. Those are produced by the exam's generator (scripts/exam_data.py in the source checkout, the branch that
holds the exam's task set and results), run in its public mode. This script runs it and makes the output fit this site:

  - it keeps only what this site shows: no addresses of other sites (task review pages, run pages, logs), no links into
    private repositories;
  - it moves every picture and video it refers to under media/<suite>/ and copies those files here (and removes the
    ones nothing refers to any more);
  - it rewords the few sentences that mention those other sites.

    python3 scripts/export.py --src ../tmp/2026-10-06_exam_site
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
MEDIA = ROOT / "media"

# data keys that hold addresses on other sites; dropped wherever they occur
DROP_KEYS = {"pages", "page", "log", "overview"}
# the contribution page's links into the source repository, which is private: left out until public ones exist
PRIVATE_CONTRIBUTE = ("repository", "proposal_issue", "protocol_issue", "docs")
# sentences reworded for this site (they mention the other site)
NOTE_TEXT = {
    "target": "Counts the exam's questions at {commit}.",
}
# the source repository is private: in text shown on this site it is "the exam", and its name is not a link anywhere
REWORD = [
    (" (robot_coding_bench @ ", " (exam @ "),
    ("(robot_coding_bench @ ", "(exam @ "),
    ("The example task of robot_coding_bench:", "The exam's example task:"),
]


def reword(node):
    if isinstance(node, dict):
        return {k: reword(v) for k, v in node.items()}
    if isinstance(node, list):
        return [reword(v) for v in node]
    if isinstance(node, str):
        for a, b in REWORD:
            node = node.replace(a, b)
    return node


def media_path(src: str) -> str:
    """The path of a picture or video on this site: media/<suite>/<file> (scenes keep their folder; PNG pictures are
    served as JPEG, a tenth of the size for these renders)."""
    if not src or src.startswith(("http://", "https://")):
        return src
    parts = src.split("/")
    if src.startswith("exam/media/"):
        out = "media/" + "/".join(parts[2:])
    elif parts[0] == "assets" and len(parts) >= 4:        # assets/<suite>/<demos|scenes>/<file>
        suite, kind, rest = parts[1], parts[2], "/".join(parts[3:])
        out = f"media/{suite}/{rest}" if kind == "demos" else f"media/{suite}/{kind}/{rest}"
    else:
        raise SystemExit(f"unexpected media path: {src}")
    return out[:-4] + ".jpg" if out.lower().endswith(".png") else out


def source_file(src_root: Path, path: str) -> Path:
    return src_root / "docs" / path


VIDEO_MAX = 1_200_000          # bytes: videos above this are re-encoded for the web; smaller ones are kept as they are


def bring(src: Path, dest: Path) -> None:
    """Put one picture or video on this site: a PNG as a JPEG, a large video re-encoded, anything else copied."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_name(dest.name + ".part")
    if src.suffix.lower() == ".png" and dest.suffix == ".jpg":
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-vf", "scale='min(1280,iw)':-2", "-q:v", "3",
                        "-f", "image2", str(tmp)], check=True)
    elif src.suffix.lower() == ".mp4" and src.stat().st_size > VIDEO_MAX:
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "30",
                        "-maxrate", "900k", "-bufsize", "1800k", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
                        "-f", "mp4", str(tmp)], check=True)
        if tmp.stat().st_size >= src.stat().st_size:      # never larger than the original
            shutil.copy2(src, tmp)
    else:
        shutil.copy2(src, tmp)
    tmp.replace(dest)


class Rewriter:
    def __init__(self):
        self.media: dict[str, str] = {}               # site path -> source path

    def walk(self, node, key=None):
        if isinstance(node, dict):
            return {k: self.walk(v, k) for k, v in node.items() if k not in DROP_KEYS}
        if isinstance(node, list):
            return [self.walk(v, key) for v in node]
        if isinstance(node, str) and key in ("poster", "video", "p") and not node.startswith(("http://", "https://")):
            site = media_path(node)
            self.media[site] = node
            return site
        return node


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--src", type=Path, required=True, help="the exam's source checkout (with scripts/exam_data.py and .venv/)")
    args = ap.parse_args()
    src = args.src.resolve()
    py = src / ".venv" / "bin" / "python"
    gen = src / "scripts" / "exam_data.py"
    if not gen.is_file():
        raise SystemExit(f"no generator at {gen}")
    with tempfile.TemporaryDirectory() as tmp:
        env = {**os.environ, "RB_PUBLIC": "1"}
        subprocess.run([str(py if py.exists() else sys.executable), str(gen), "--out", tmp], check=True, env=env, cwd=src,
                       stdout=subprocess.DEVNULL)
        exam = json.loads((Path(tmp) / "exam/data/exam.json").read_text())
        tasks = json.loads((Path(tmp) / "exam/data/tasks.json").read_text())

    rw = Rewriter()
    exam, tasks = reword(rw.walk(exam)), reword(rw.walk(tasks))
    (exam.get("task_set") or {}).pop("repository", None)
    (exam.get("task_set") or {}).pop("ref", None)
    for k in PRIVATE_CONTRIBUTE:
        (exam.get("contribute") or {}).pop(k, None)
    for n in (exam.get("leaderboard") or {}).get("notes") or []:
        if n.get("icon") in NOTE_TEXT:
            n["text"] = NOTE_TEXT[n["icon"]]

    # media: bring in what is referred to (compressed where it pays), drop what is not
    jobs = []
    for site, srcpath in sorted(rw.media.items()):
        f = source_file(src, srcpath)
        if not f.is_file():
            raise SystemExit(f"missing in the source: {f}")
        dest = ROOT / site
        if not dest.is_file() or dest.stat().st_mtime < f.stat().st_mtime:
            jobs.append((f, dest))
    with ThreadPoolExecutor(max_workers=6) as pool:
        list(pool.map(lambda job: bring(*job), jobs))
    copied = len(jobs)
    wanted = {ROOT / p for p in rw.media}
    stale = [f for f in MEDIA.rglob("*") if f.is_file() and f not in wanted]
    for f in stale:
        f.unlink()
    for d in sorted((d for d in MEDIA.rglob("*") if d.is_dir()), reverse=True):
        if not any(d.iterdir()):
            d.rmdir()

    DATA.mkdir(exist_ok=True)
    (DATA / "exam.json").write_text(json.dumps(exam, ensure_ascii=False, separators=(",", ":")))
    (DATA / "tasks.json").write_text(json.dumps(tasks, ensure_ascii=False, separators=(",", ":")))
    size = sum(f.stat().st_size for f in MEDIA.rglob("*") if f.is_file())
    print(f"data/exam.json, data/tasks.json written ({len(tasks)} tasks); media: {len(rw.media)} files, {copied} copied, "
          f"{len(stale)} removed, {size / 1e6:.0f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
