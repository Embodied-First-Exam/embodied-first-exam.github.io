#!/usr/bin/env python3
"""Give the site's own assets a content hash (?v=...), so a browser fetches a new version as soon as one is published and
keeps its cached copy otherwise.

- Modules that app.js (or another module) imports by a relative URL, `import('./search.js?v=…')` or
  `from './search_core.js?v=…'`, get the hash of the module they name. Leaves are hashed first, so a change in a
  module changes the hash of everything that imports it.
- The pages' links to assets/exam.css and assets/app.js get their hashes last."""

import hashlib
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
A = ROOT / "assets"
REF = re.compile(r"""(['"`]\./([\w-]+\.(?:js|css)))(\?v=[0-9a-f]*)?(['"`])""")


def digest(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()[:8]


# the JS modules and the imports between them, then stamp each in an order where the modules it names come first
mods = {p.name: p for p in A.glob("*.js")}
deps = {n: {m.group(2) for m in REF.finditer(p.read_text(encoding="utf-8")) if m.group(2) in mods or (A / m.group(2)).is_file()}
        for n, p in mods.items()}
done: dict[str, str] = {}


def stamp(name: str, seen=()) -> str:
    if name in done:
        return done[name]
    p = A / name
    if name in mods:
        for d in deps[name] - set(seen) - {name}:
            stamp(d, (*seen, name))
        text = p.read_text(encoding="utf-8")
        # a module that names itself (in a comment, say) is left as it is: its own hash cannot be inside it
        new = REF.sub(lambda m: f"{m.group(1)}?v={done.get(m.group(2)) or stamp(m.group(2), (*seen, name))}{m.group(4)}"
                      if (A / m.group(2)).is_file() and m.group(2) != name and m.group(2) not in seen else m.group(0), text)
        if new != text:
            p.write_text(new, encoding="utf-8")
    done[name] = digest(p)
    return done[name]


for n in sorted(mods):
    stamp(n)
# the site's own pictures named in the modules (site('media/ways/...'), on HF: scripts/media.py) get their content hash
# too: the version on HF, or the staged one about to be uploaded (make media)
sys.path.insert(0, str(ROOT / "scripts"))
import media  # noqa: E402
MEDIA_REF = re.compile(r"""(site\(['"`])media/([\w./-]+\.(?:jpg|png|mp4))(\?v=[0-9a-f]*)?(['"`]\))""")
_hf: dict = {}


def media_version(rel: str) -> str:
    if not _hf:
        _hf.update(media.listing())
    staged = media.STAGE / rel
    return (_hf.get(rel) or (0, ""))[1][:8] or (media.sha256(staged)[:8] if staged.is_file() else "")


for n, p in mods.items():
    text = p.read_text(encoding="utf-8")
    new = MEDIA_REF.sub(lambda m: f"{m.group(1)}media/{m.group(2)}?v={v}{m.group(4)}" if (v := media_version(m.group(2))) else m.group(0), text)
    if new != text:
        p.write_text(new, encoding="utf-8")
        done.pop(n, None)
for n in sorted(mods):
    stamp(n)
stamps = {"exam.css": digest(A / "exam.css"), "app.js": done["app.js"], "blog.css": digest(A / "blog.css"), "blog.js": done["blog.js"]}
changed = 0
for page in sorted([*ROOT.glob("**/index.html"), ROOT / "404.html"]):
    text = page.read_text(encoding="utf-8")
    new = re.sub(r'(assets/(exam\.css|app\.js|blog\.css|blog\.js))(\?v=[0-9a-f]+)?"', lambda m: f'{m.group(1)}?v={stamps[m.group(2)]}"', text)
    if new != text:
        page.write_text(new, encoding="utf-8")
        changed += 1
print(f"stamped {changed} pages: " + ", ".join(f"{k}?v={v}" for k, v in stamps.items())
      + (f"; modules: {', '.join(f'{k}?v={v}' for k, v in sorted(done.items()) if k != 'app.js')}" if len(done) > 1 else ""))
