#!/usr/bin/env python3
"""Write what assets/app.js draws into the pages' HTML, so readers that do not run JavaScript see the same text.

Most of the site is drawn in the browser: app.js reads data/*.json and fills the empty elements of each page (the nav,
the leaderboard, the suite cards, a suite's tasks, the footer). Search engines and AI assistants that read the HTML
without running it saw almost nothing. This script opens every page in headless Chrome, waits for app.js to finish,
and writes the content of each element it filled back into the page file, between <!--pre:ID--> and <!--/pre:ID-->.
In the browser app.js still runs as before and draws the same elements again from the current data.

It also writes one page per suite, suite/<id>/index.html, from the template suite/index.html (body data-suite="<id>"),
so every suite has its own address with its own title, description and tasks. suite/?id=<id> forwards there.

Run it after every change to data/ or to the pages: `make release` runs stamp, then this, then check.
Needs Playwright for Python (`pip install playwright`) and Google Chrome; without Chrome, `playwright install chromium`.
"""
from __future__ import annotations

import asyncio
import functools
import http.server
import json
import re
import sys
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://www.embodied-first-exam.ai/"
# elements left to the browser: the moving wall of scenes behind the home page's title, and the runs list and viewer
# (thousands of runs, read from HF; written into the page they would make it heavy and go stale quickly)
SKIP_IDS = {"wall", "sphere", "run-log", "run-side", "run-strip", "run-stage"}
BLOCK = re.compile(r"<!--pre:([\w-]+)-->.*?<!--/pre:\1-->", re.S)
EMPTY = re.compile(r'<([a-zA-Z][\w-]*)\b([^>]*?\bid="([\w-]+)"[^>]*)>\s*</\1>')
GENERATED = "<!-- written by scripts/prerender.py from suite/index.html: edit that file, not this one -->"


def shell(text: str) -> str:
    """The page as app.js expects to find it: every prerendered block taken out again."""
    return BLOCK.sub("", text)


def targets(text: str) -> list[str]:
    return [m.group(3) for m in EMPTY.finditer(text) if m.group(3) not in SKIP_IDS]


def fill(text: str, parts: dict[str, str]) -> str:
    def put(m: re.Match) -> str:
        tag, attrs, el = m.group(1), m.group(2), m.group(3)
        html = parts.get(el)
        if not html:
            return m.group(0)
        if "data-pre" not in attrs:
            attrs += " data-pre"
        return f"<{tag}{attrs}><!--pre:{el}-->{html}<!--/pre:{el}--></{tag}>"
    return EMPTY.sub(put, text)


def suite_page(template: str, sid: str) -> str:
    """suite/<id>/index.html from the template: paths one level deeper, the suite named on <body>, its own address."""
    t = shell(template)
    t = t.replace('"../', '"../../').replace("'../", "'../../")
    t = t.replace('<body data-page="suite">', f'<body data-page="suite" data-suite="{sid}">', 1)
    t = re.sub(r'<script>/\* suite/\?id= forwards.*?</script>\n', "", t, flags=re.S)
    url = f"{SITE}suite/{sid}/"
    t = t.replace('<meta name="robots" content="noindex, follow">\n', "", 1)
    t = t.replace("<!-- search-meta:start -->", f'<!-- search-meta:start -->\n<link rel="canonical" href="{url}">\n'
                  f'<meta property="og:type" content="website">\n<meta property="og:url" content="{url}">\n'
                  '<meta property="og:title" content="">\n<meta property="og:description" content="">\n'
                  '<meta name="twitter:card" content="summary">', 1)
    return t.replace("<!doctype html>", f"<!doctype html>\n{GENERATED}", 1)


def set_head(text: str, title: str, desc: str) -> str:
    esc = lambda s: s.replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;")
    text = re.sub(r"<title>.*?</title>", f"<title>{esc(title)}</title>", text, count=1, flags=re.S)
    text = re.sub(r'<meta property="og:title" content="[^"]*">', f'<meta property="og:title" content="{esc(title)}">', text, count=1)
    text = re.sub(r'<meta property="og:description" content="[^"]*">', f'<meta property="og:description" content="{esc(desc)}">', text, count=1)
    return re.sub(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{esc(desc)}">', text, count=1)


def pages(suite_ids: list[str]) -> list[Path]:
    out = []
    for p in sorted(ROOT.glob("**/index.html")):
        rel = p.relative_to(ROOT).as_posix()
        if rel.startswith(("data/", "media/", "scripts/")) or rel == "suite/index.html":
            continue
        text = p.read_text(encoding="utf-8")
        if 'http-equiv="refresh"' in text or "data-page=" not in text:
            continue  # an old address that forwards elsewhere
        out.append(p)
    return out


def serve() -> tuple[http.server.ThreadingHTTPServer, int]:
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a, **k):
            pass
    handler = functools.partial(Quiet, directory=str(ROOT))
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, srv.server_address[1]


CAPTURE = """(ids) => {
  // text only: pictures, videos and other media are left out (app.js draws them when the page loads), so the page
  // gets no heavier to download and nothing is fetched twice
  const textOnly = (el) => {
    const c = el.cloneNode(true);
    c.querySelectorAll('img, picture, video, audio, source, iframe, canvas, object, embed').forEach((m) => m.remove());
    [c, ...c.querySelectorAll('[style]')].forEach((m) => {
      const st = m.getAttribute && m.getAttribute('style');
      if (st && /url\\(/.test(st)) m.setAttribute('style', st.replace(/[\\w-]*image\\s*:[^;]*url\\([^)]*\\)[^;]*;?/g, ''));
    });
    return c;
  };
  const out = {};
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) { out[id] = textOnly(el).innerHTML.trim(); continue; }
    // the nav and the footer replace their placeholder whole (outerHTML): keep the element that took its place
    const swap = { nav: 'nav.nav', footer: 'footer.footer' }[id];
    const s = swap && document.querySelector(swap);
    if (s) out[id] = textOnly(s).outerHTML;
  }
  return { parts: out, title: document.title, desc: document.querySelector('meta[name="description"]')?.content || '' };
}"""


async def render(paths: list[Path], port: int) -> dict[Path, dict]:
    from playwright.async_api import async_playwright
    results: dict[Path, dict] = {}
    async with async_playwright() as pw:
        try:
            browser = await pw.chromium.launch(channel="chrome")
        except Exception:
            browser = await pw.chromium.launch()
        ctx = await browser.new_context(viewport={"width": 1440, "height": 900}, reduced_motion="reduce")
        sem = asyncio.Semaphore(4)

        async def one(p: Path) -> None:
            async with sem:
                rel = p.relative_to(ROOT).as_posix()
                url = f"http://127.0.0.1:{port}/{rel[:-len('index.html')]}"
                before = p.read_text(encoding="utf-8")
                text = shell(before)
                ids = targets(text)
                # elements that had content last time must have it again (an empty one means app.js had not finished)
                had = {m.group(1) for m in BLOCK.finditer(before)} & set(ids)
                page = await ctx.new_page()
                errors: list[str] = []
                page.on("pageerror", lambda e: errors.append(str(e)))
                await page.route(url, lambda route: route.fulfill(status=200, content_type="text/html; charset=utf-8", body=text))
                await page.goto(url, wait_until="load", timeout=60000)
                # app.js has finished when the footer is drawn and the page's own elements stop changing
                try:
                    await page.wait_for_selector("footer.footer", timeout=30000)
                except Exception:
                    errors.append("the footer was never drawn")
                last = -1
                for _ in range(20):
                    n = await page.evaluate("document.body.innerHTML.length")
                    if n == last:
                        break
                    last = n
                    await page.wait_for_timeout(500)
                got = await page.evaluate(CAPTURE, ids)
                for _ in range(10):  # slow data (a large JSON file, a busy machine): wait for it, up to 30 s more
                    missing = sorted(i for i in had if not got["parts"].get(i))
                    if not missing:
                        break
                    await page.wait_for_timeout(3000)
                    got = await page.evaluate(CAPTURE, ids)
                else:
                    errors.append(f"still empty after waiting: {', '.join(missing)}")
                await page.close()
                got["errors"] = errors
                results[p] = got
                print(f"  {rel}: {sum(1 for v in got['parts'].values() if v)} of {len(ids)} elements"
                      + (f"  ERRORS: {errors}" if errors else ""))

        await asyncio.gather(*(one(p) for p in paths))
        await browser.close()
    return results


def main() -> int:
    try:
        import playwright  # noqa: F401
    except ImportError:
        print("prerender: needs Playwright for Python: pip install playwright (it uses Google Chrome, or run "
              "`playwright install chromium`)", file=sys.stderr)
        return 1
    ex = json.loads((ROOT / "data/exam.json").read_text(encoding="utf-8"))
    suite_ids = [s["id"] for s in ex.get("suites", [])]
    template = (ROOT / "suite/index.html").read_text(encoding="utf-8")
    # 1. one page per suite, from the template (the old ones first removed, so a dropped suite leaves no page behind)
    for d in (ROOT / "suite").iterdir():
        if d.is_dir() and (d / "index.html").is_file() and GENERATED in (d / "index.html").read_text(encoding="utf-8"):
            if d.name not in suite_ids:
                (d / "index.html").unlink()
                d.rmdir()
    for sid in suite_ids:
        (ROOT / "suite" / sid).mkdir(exist_ok=True)
        (ROOT / "suite" / sid / "index.html").write_text(suite_page(template, sid), encoding="utf-8")
    # 2. the template forwards suite/?id=<id> to suite/<id>/, for the links from before
    known = json.dumps(sorted(suite_ids))
    fwd = ("<script>/* suite/?id= forwards to the suite's own page (scripts/prerender.py) */(function(){var k=" + known
           + ",a={robosafe:'embodied-safety-exam','roboolympics-fun':'embodied-olympics-fun','roboolympics-match':'embodied-olympics-match',"
           "roboolympics:'embodied-olympics-fun','ikea-mujoco':'roboarc'},q=new URLSearchParams(location.search),i=q.get('id');"
           "i=a[i]||i;if(i&&k.indexOf(i)>=0){q.delete('id');var s=q.toString();location.replace(i+'/'+(s?'?'+s:'')+location.hash);}})();</script>\n")
    template = re.sub(r'<script>/\* suite/\?id= forwards.*?</script>\n', "", template, flags=re.S)
    # suite/ alone shows one suite of many: the suites' own pages are the ones to index
    noindex = '<meta name="robots" content="noindex, follow">\n'
    template = template.replace(noindex, "").replace("<!-- search-meta:start -->", fwd + noindex + "<!-- search-meta:start -->", 1)
    (ROOT / "suite/index.html").write_text(template, encoding="utf-8")
    # 3. render every page and write back what app.js drew
    paths = pages(suite_ids)
    srv, port = serve()
    print(f"prerender: {len(paths)} pages")
    try:
        res = asyncio.run(render(paths, port))
    finally:
        srv.shutdown()
    # a page whose data did not load (an error message drawn instead of the content) keeps what it had before
    for r in res.values():
        if any("could not be loaded" in v for v in r["parts"].values()):
            r["errors"].append("the data could not be loaded")
    bad = [p for p, r in res.items() if r["errors"]]
    for p, r in res.items():
        if r["errors"]:
            continue
        text = fill(shell(p.read_text(encoding="utf-8")), r["parts"])
        if p.parent.parent == ROOT / "suite":
            text = set_head(text, r["title"], r["desc"])
        p.write_text(text, encoding="utf-8")
    if bad:
        print(f"prerender: errors on {len(bad)} pages, left as they were: "
              + ", ".join(p.relative_to(ROOT).as_posix() for p in bad), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
