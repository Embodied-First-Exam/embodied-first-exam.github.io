"""Where the site's pictures and videos live: the public HF dataset MLL-Lab/embodied-exam-media, under site/.

GitHub Pages serves at most 1 GB per site, so the media are not in this repository. A file the pages call
media/<suite>/<file> is site/<suite>/<file> in the dataset and is linked as

    https://huggingface.co/datasets/MLL-Lab/embodied-exam-media/resolve/main/site/<suite>/<file>?v=<sha256[:8]>

HF answers that address with a redirect (never cached) to its CDN, at an address named by the file's content, so a
browser always gets the current file; ?v= is the content hash the data was built with, and scripts/check.py checks it
against the dataset. The local copy of site/ (STAGE, outside the repository) is where scripts/export.py puts new or
replaced files before scripts/upload_media.py uploads them. Standard library only: `make data` and `make check` need no
HF account."""

from __future__ import annotations

import hashlib
import json
import os
import re
import urllib.error
import urllib.request
from pathlib import Path

REPO = "MLL-Lab/embodied-exam-media"
PREFIX = "site"
HF = f"https://huggingface.co/datasets/{REPO}/resolve/main/"
URL = HF + PREFIX + "/"
# the local copy of site/: new or replaced files wait here until they are uploaded (MEDIA_DIR=... to put it elsewhere)
STAGE = Path(os.environ.get("MEDIA_DIR") or Path(os.environ.get("XDG_CACHE_HOME") or Path.home() / ".cache") / "efe-export" / "media")
# media/ways/ is the site's own (the home page's examples of how agents answer, named in assets/app.js), not the source's
SITE_OWN = "ways/"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def url(rel: str, digest: str) -> str:
    return f"{URL}{rel}?v={digest[:8]}"


def rel_of(ref: str) -> tuple[str, str] | None:
    """(path under site/, version) of a media address, or None for any other string."""
    if ref.startswith(URL):
        path, _, v = ref[len(URL):].partition("?v=")
        return path, v
    return None


def listing(prefix: str = PREFIX) -> dict[str, tuple[int, str]]:
    """Every file under <prefix>/ in the dataset: path under it -> (bytes, sha256). A few paged API calls, no account."""
    out: dict[str, tuple[int, str]] = {}
    nxt = f"https://huggingface.co/api/datasets/{REPO}/tree/main/{prefix}?recursive=true&expand=false"
    while nxt:
        req = urllib.request.Request(nxt, headers={"User-Agent": "efe-site"})
        try:
            r = urllib.request.urlopen(req, timeout=60)
        except urllib.error.HTTPError as e:
            if e.code == 404 and not out:       # nothing under the prefix yet
                return out
            raise
        with r:
            for e in json.load(r):
                if e.get("type") == "file":
                    lfs = e.get("lfs") or {}
                    out[e["path"][len(prefix) + 1:]] = (e.get("size") or 0, lfs.get("oid") or "")
            m = re.search(r'<([^>]+)>;\s*rel="next"', r.headers.get("Link") or "")
            nxt = m.group(1) if m else None
    return out


def referenced(root: Path) -> dict[str, str]:
    """Every media file the site uses: path under site/ -> the version the data or the pages name ('' if none)."""
    refs: dict[str, str] = {}
    for name in ("exam.json", "tasks.json"):
        f = root / "data" / name
        if f.is_file():
            for m in re.findall(r'"(' + re.escape(URL) + r'[^"]+)"', f.read_text(encoding="utf-8")):
                path, v = rel_of(m)
                refs[path] = v
    app = (root / "assets" / "app.js").read_text(encoding="utf-8")
    for path, v in re.findall(r"""site\(['"`]media/([\w./-]+\.(?:jpg|png|mp4))(?:\?v=([0-9a-f]+))?['"`]\)""", app):
        refs[path] = v
    for vid in re.findall(r"""\bvid: '([\w-]+)'""", app):           # the "ways" examples: media/ways/<vid>.{mp4,jpg}
        for ext in ("mp4", "jpg"):
            refs.setdefault(f"{SITE_OWN}{vid}.{ext}", "")
    return refs
