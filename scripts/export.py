#!/usr/bin/env python3
"""Refresh the site's data and media from the exam's source.

The pages are static; everything they show comes from data/exam.json and data/tasks.json and the pictures and videos
they name, which live on HF (scripts/media.py: the public dataset's site/ folder). Those are produced by the exam's generator (scripts/exam_data.py in the source checkout, the branch that
holds the exam's task set and results), run in its public mode. This script runs it and makes the output fit this site:

  - it keeps only what this site shows: no addresses of other sites (task review pages, run pages, logs), no links into
    private repositories;
  - it gives every picture and video an address on HF, site/<suite>/<file> (media/<suite>/<file> before 2026-10-19),
    with its content hash (?v=...); files the source has that HF does not have yet (new or replaced media) are made
    into web copies in the local stage (scripts/media.py STAGE, outside this repository) and listed for `make media`,
    which uploads them;
  - it rewords the few sentences that mention those other sites.

    python3 scripts/export.py --src ../tmp/2026-10-06_exam_site

The source is normally a clone of the private repository Embodied-First-Exam/exam-site-source, which holds the media
manifests but not the media files. A file the source lacks is taken as it is on HF; a file the source has (a new or
replaced web copy in its docs/assets/<suite>/demos/, see its SITE_SOURCE.md) is brought into the stage unless HF has
it already. Nothing is ever removed from HF here (`make media PRUNE=1` does that, after showing the list).
"""

from __future__ import annotations

import argparse
import filecmp
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
sys.path.insert(0, str(Path(__file__).resolve().parent))
import media  # noqa: E402  (scripts/media.py: the HF address, the stage, the dataset's listing)

# data keys that hold addresses on other sites, or the private repository's task directory names; dropped wherever
# they occur
DROP_KEYS = {"pages", "page", "log", "overview", "dirs"}
# suites shown here under another id (owner, 2026-10-07: RoboPaint is the strict version only, under the plain name);
# the source leaves the old RoboPaint out of the exam (its exclude_suites)
SUITE_IDS = {"robopaint-strict": "robopaint"}
# the contribution page's links into the source repository, which is private: left out until public ones exist
PRIVATE_CONTRIBUTE = ("repository", "proposal_issue", "protocol_issue", "docs")
# sentences reworded for this site (they mention the other site)
NOTE_TEXT: dict[str, str] = {}      # (the core set card's text names no other site since 2026-10-18)
# the source repository is private: in text shown on this site it is "the exam", and its name is not a link anywhere
REWORD = [
    ("RoboPaint-strict", "RoboPaint"),
    ("robopaint_strict_", "robopaint_"),
    (" (robot_coding_bench @ ", " (exam @ "),
    ("(robot_coding_bench @ ", "(exam @ "),
    ("The example task of robot_coding_bench:", "The exam's example task:"),
]


def reword(node):
    """Rename the suites in SUITE_IDS (as keys and as whole values) and reword the text (REWORD)."""
    if isinstance(node, dict):
        return {SUITE_IDS.get(k, k): reword(v) for k, v in node.items()}
    if isinstance(node, list):
        return [reword(v) for v in node]
    if isinstance(node, str):
        if node in SUITE_IDS:
            return SUITE_IDS[node]
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
        suite, kind, rest = SUITE_IDS.get(parts[1], parts[1]), parts[2], "/".join(parts[3:])
        out = f"media/{suite}/{rest}" if kind == "demos" else f"media/{suite}/{kind}/{rest}"
    else:
        raise SystemExit(f"unexpected media path: {src}")
    return out[:-4] + ".jpg" if out.lower().endswith(".png") else out


# this machine's record of the web copies it made (site path -> source file, size, date and the copy's sha256), next to
# the stage: the encoder is not deterministic, so a source file is not re-encoded once its copy is staged or on HF
BROUGHT = media.STAGE.parent / "brought-site.json"


def source_file(src_root: Path, path: str) -> Path:
    return src_root / "docs" / path


VIDEO_MAX = 1_200_000          # bytes: smaller videos are kept as they are
WEB_HEIGHT, WEB_RATE = 720, 3_200_000   # a larger video at most this tall and this many bits per second is kept too
# GitHub Pages serves at most 1 GB per site: a video over this many bytes is re-encoded to fit it, at 540p
# (BEHAVIOR's 30 s time-lapses were 6 MB each at 720p, and 99 of them alone would fill a third of the site)
VIDEO_BUDGET, BUDGET_HEIGHT = 2_500_000, 540


def web_sized(src: Path) -> bool:
    """Whether a video is already a web copy (the suites' masters arrive as 720p web copies made from them)."""
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=height:format=bit_rate",
                          "-of", "json", str(src)], capture_output=True, text=True)
    d = json.loads(out.stdout or "{}")
    height = int(((d.get("streams") or [{}])[0]).get("height") or 0)
    rate = int((d.get("format") or {}).get("bit_rate") or 0)
    return 0 < height <= WEB_HEIGHT and 0 < rate <= WEB_RATE


def bring(src: Path, dest: Path) -> None:
    """Put one picture or video on this site: a PNG as a JPEG, a large video re-encoded, anything else copied."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_name(dest.name + ".part")
    if src.suffix.lower() == ".png" and dest.suffix == ".jpg":
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-vf", "scale='min(1280,iw)':-2", "-q:v", "3",
                        "-f", "image2", str(tmp)], check=True)
    elif src.suffix.lower() == ".mp4" and src.stat().st_size > VIDEO_BUDGET:
        seconds = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(src)],
                                       capture_output=True, text=True).stdout or 0) or 1.0
        rate = int(VIDEO_BUDGET * 8 / seconds * 0.95 / 1000)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-an", "-vf", f"scale=-2:'min({BUDGET_HEIGHT},ih)'",
                        "-c:v", "libx264", "-preset", "slow", "-crf", "26", "-maxrate", f"{rate}k", "-bufsize", f"{2 * rate}k",
                        "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-f", "mp4", str(tmp)], check=True)
        if tmp.stat().st_size >= src.stat().st_size:      # never larger than the original
            shutil.copy2(src, tmp)
    elif src.suffix.lower() == ".mp4" and src.stat().st_size > VIDEO_MAX and not web_sized(src):
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-an", "-vf", f"scale=-2:'min({WEB_HEIGHT},ih)'",
                        "-c:v", "libx264", "-preset", "slow", "-crf", "26", "-maxrate", "2500k", "-bufsize", "5000k",
                        "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-f", "mp4", str(tmp)], check=True)
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
    ids = [x["id"] for x in exam.get("suites") or []]
    if len(ids) != len(set(ids)):
        raise SystemExit(f"two suites share an id after renaming: {sorted(i for i in ids if ids.count(i) > 1)}")
    (exam.get("task_set") or {}).pop("repository", None)
    (exam.get("task_set") or {}).pop("ref", None)
    for k in PRIVATE_CONTRIBUTE:
        (exam.get("contribute") or {}).pop(k, None)
    for n in (exam.get("leaderboard") or {}).get("notes") or []:
        if n.get("icon") in NOTE_TEXT:
            n["text"] = NOTE_TEXT[n["icon"]]

    # media: every file the data names is site/<suite>/<file> on HF. The source's own files (new or replaced web copies)
    # are brought into the stage unless HF has them already; the rest are taken as HF has them.
    hf = media.listing()
    present, missing, version = [], [], {}
    for site, srcpath in sorted(rw.media.items()):
        rel = site[len("media/"):]
        f, dest = source_file(src, srcpath), media.STAGE / rel
        if f.is_file():
            present.append((rel, f, dest))
        elif rel in hf:
            version[rel] = hf[rel][1]
        elif dest.is_file():                  # staged earlier, not uploaded yet
            version[rel] = media.sha256(dest)
        else:
            missing.append(str(f))
    if missing:
        raise SystemExit(f"missing in the source, on HF and in the stage ({len(missing)}):\n  " + "\n  ".join(missing[:20])
                         + ("\n  ..." if len(missing) > 20 else ""))
    brought = json.loads(BROUGHT.read_text()) if BROUGHT.is_file() else {}
    ident = lambda f: [str(f), f.stat().st_size, f.stat().st_mtime_ns]
    def made_already(rel: str, f: Path, dest: Path) -> str:
        """The sha256 of the copy of f that is staged or on HF already, or '' when it has to be made."""
        on_hf = hf.get(rel, (0, ""))[1]
        if dest.is_file() and filecmp.cmp(f, dest, shallow=False):
            return media.sha256(dest)
        was = brought.get(rel) or {}
        if was.get("src") == ident(f):
            if dest.is_file() and media.sha256(dest) == was.get("sha256"):
                return was["sha256"]
            if on_hf and on_hf == was.get("sha256"):
                return on_hf
        if on_hf and media.sha256(f) == on_hf:          # HF has this very file
            return on_hf
        return ""
    jobs = []
    for rel, f, dest in present:
        done = made_already(rel, f, dest)
        if done:
            version[rel] = done
        else:
            jobs.append((rel, f, dest))
    with ThreadPoolExecutor(max_workers=6) as pool:
        list(pool.map(lambda job: bring(job[1], job[2]), jobs))
    for rel, f, dest in jobs:
        version[rel] = media.sha256(dest)
        brought[rel] = {"src": ident(f), "sha256": version[rel]}
    if jobs:
        BROUGHT.parent.mkdir(parents=True, exist_ok=True)
        BROUGHT.write_text(json.dumps(brought, indent=0))
    upload = sorted(rel for rel, v in version.items() if hf.get(rel, (0, ""))[1] != v)
    unused = sorted(rel for rel in hf if rel not in version and not rel.startswith(media.SITE_OWN))

    # difficulty labels stay off the public site until they are settled (user, 2026-10-16)
    for t in tasks:
        t.pop("difficulty", None)
        t.pop("author", None)          # no per-person attribution on the public site (user, 2026-10-17)
    for su in exam.get("suites", []):
        su.pop("difficulty", None)
        su.pop("authors", None)
    # no suites "on the way in" on the public site (user, 2026-10-18)
    exam.pop("incoming", None)
    exam.get("totals", {}).pop("incoming", None)
    # every picture and video is linked at its HF address with its content hash (?v=...): a replaced render gets a new
    # address, so no browser keeps showing the one it cached (owners, 2026-10-18)
    def to_hf(node):
        if isinstance(node, dict):
            return {k: to_hf(v) for k, v in node.items()}
        if isinstance(node, list):
            return [to_hf(v) for v in node]
        if isinstance(node, str) and node.startswith("media/") and node[len("media/"):] in version:
            rel = node[len("media/"):]
            return media.url(rel, version[rel])
        return node
    exam, tasks = to_hf(exam), to_hf(tasks)
    DATA.mkdir(exist_ok=True)
    (DATA / "exam.json").write_text(json.dumps(exam, ensure_ascii=False, separators=(",", ":")))
    (DATA / "tasks.json").write_text(json.dumps(tasks, ensure_ascii=False, separators=(",", ":")))
    size = sum(hf[r][0] if r not in upload else (media.STAGE / r).stat().st_size for r in version)
    print(f"data/exam.json, data/tasks.json written ({len(tasks)} tasks); media: {len(version)} files, {size / 1e6:.0f} MB, "
          f"{len(jobs)} web copies made into {media.STAGE}, {len(upload)} to upload")
    if upload:
        print(f"  NOT ON HF YET ({len(upload)}): run `make media` before `make release`:", file=sys.stderr)
        for rel in upload[:30]:
            print(f"    {rel}", file=sys.stderr)
        if len(upload) > 30:
            print("    ...", file=sys.stderr)
    if unused:
        print(f"  {len(unused)} files on HF (site/) nothing refers to any more, kept; `make media PRUNE=1` lists and "
              f"removes them", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
