#!/usr/bin/env python3
"""Write what search engines and AI assistants read but a visitor does not see, from data/exam.json, data/tasks.json and
data/blogs.json: the keywords in the pages' heads, a JSON-LD block at the end of their bodies, sitemap.xml, robots.txt,
llms.txt and llms-full.txt. Run it after every `make data` (`make seo`, part of `make release`); it rewrites only its own
blocks, so the pages' visible content is never touched."""

from __future__ import annotations

import html
import json
import re
import subprocess
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
BASE = "https://www.embodied-first-exam.ai/"
CODE = "https://github.com/mll-lab-nu/embodied-first-exam"
TEAM = {"@type": "Organization", "name": "Embodied First Exam Team", "url": BASE}
WEBSITE = {"@type": "WebSite", "@id": BASE + "#website", "name": "Embodied First Exam", "url": BASE}
EXAM = {"@type": "Dataset", "@id": BASE + "#exam", "name": "Embodied First Exam", "url": BASE}
# what people search for when they look for the exam: all of it is true of the exam. Hidden keywords barely move rankings;
# the visible pages and the crawlable suite pages (sitemap.xml) do the work, and these help assistants and Bing match terms
KEYWORDS = [
    "Embodied First Exam", "EFE", "coding agents", "code agents", "coding agents for robots", "coding agents for robotics",
    "code agents in the physical world", "Terminal-Bench for robotics", "Terminal-Bench for robots", "robot programming benchmark",
    "embodied AI benchmark", "LLM agents for robotics", "agentic coding for robots", "real-time robot control", "standard-realtime",
    "privileged", "Robo Olympics", "Embodied Olympics", "RoboDojo", "RoboDynamicExam", "dynamic manipulation", "Harbor",
    "robot manipulation benchmark", "humanoid", "dexterous hand", "mobile manipulation",
]
# other names the suites go by (their media folders: site/roboolympics/), so a search for either finds the suite
ALIASES = {"embodied-olympics-fun": ["Robo Olympics", "RoboOlympics"], "embodied-olympics-match": ["Robo Olympics", "RoboOlympics"]}
# the three settings in the report's words (blogs/first-exam/); Core is the leaderboard's default view, not a setting
SETTINGS = {"privileged": "the agent works inside the simulator",
            "standard": "real-robot rules: the agent reaches the robot only through the robot's API",
            "standard-realtime": "standard on a running clock that never stops, offered where timing matters, mostly for dynamic tasks "
                                 "with moving objects or opponents"}
CORE = "the leaderboard's default view: each core task once, in its default setting"
MARKING = ("The answer is a program, marked by replaying it in a fresh simulator (privileged) or on the live episode "
           "(standard and standard-realtime).")
AI_BOTS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-Web", "anthropic-ai", "PerplexityBot",
           "Perplexity-User", "Google-Extended", "CCBot"]
# page -> canonical path, or None for a page that shows one item chosen by its query string
PAGES = {"index.html": "", "leaderboard/index.html": "leaderboard/", "suites/index.html": "suites/", "suite/index.html": None,
         "tasks/index.html": None, "run/index.html": None, "how/index.html": "how/", "contribute/index.html": "contribute/",
         "blogs/index.html": "blogs/", "blogs/first-exam/index.html": "blogs/first-exam/"}
# sitemap: path -> its page file; the data-driven pages change with every build, the others when their file does
SITEMAP = {"": "index.html", "leaderboard/": "leaderboard/index.html", "suites/": "suites/index.html", "tasks/": "tasks/index.html",
           "how/": "how/index.html", "contribute/": "contribute/index.html", "blogs/": "blogs/index.html",
           "blogs/first-exam/": "blogs/first-exam/index.html"}
DATA_DRIVEN = {"", "leaderboard/", "suites/", "tasks/"}
LD = re.compile(r'<script type="application/ld\+json" id="seo-ld">.*?</script>\n', re.S)
KW = re.compile(r'<meta name="keywords" content="[^"]*">\n')


def clean(node):
    """Leave out empty values, so a suite with no description or no robots writes no null."""
    if isinstance(node, dict):
        return {k: clean(v) for k, v in node.items() if v not in (None, "", [], {})}
    if isinstance(node, list):
        return [clean(v) for v in node if v not in (None, "", [], {})]
    return node


def suite_url(s: dict) -> str:
    return f"{BASE}suite/?id={quote(s['id'])}"


def suite_node(s: dict) -> dict:
    robots = [r["name"] for r in (s.get("robots") or [])]
    node = {"@type": "Dataset", "name": s["name"], "alternateName": [s["id"], *ALIASES.get(s["id"], [])], "url": suite_url(s),
            "description": s.get("description") or s.get("blurb"),
            "keywords": [s["name"], *ALIASES.get(s["id"], []), s.get("simulator"), s.get("edition"), *robots],
            "isPartOf": EXAM}
    if s.get("origin") == "ours":
        node["creator"] = TEAM
    else:  # an upstream benchmark the exam adapted: credit it, not the team
        node["isBasedOn"] = next(iter((s.get("links") or {}).values()), None)
    return node


def agents(exam: dict) -> list[str]:
    return sorted({f"{r['harness']} + {r['model']}" for r in exam["runs"]})


def unranked(exam: dict) -> list[str]:
    return sorted({f"{r['harness']} + {r['model']}" for r in exam.get("unranked_runs", [])})


def keywords(exam: dict) -> list[str]:
    names = [s["name"] for s in exam["suites"]] + [a for s in exam["suites"] for a in ALIASES.get(s["id"], [])]
    extra = sorted({r["model"] for r in exam["runs"]} | {r["harness"] for r in exam["runs"]})
    return list(dict.fromkeys(KEYWORDS + names + extra))


def settings_ld() -> list[dict]:
    return [{"@type": "PropertyValue", "name": k, "description": v} for k, v in SETTINGS.items()]


def graph(page: str, exam: dict, tasks: list, post: dict, title: str, desc: str) -> dict:
    suites, names, kw = exam["suites"], {s["id"]: s["name"] for s in exam["suites"]}, keywords(exam)
    if page == "index.html":
        t = exam["totals"]
        nodes = [{**WEBSITE, "alternateName": exam["short"], "description": desc, "publisher": TEAM},
                 {**EXAM, "alternateName": [exam["short"]], "description": f"{exam['summary']} {exam['hero']['lead']}",
                  "keywords": kw, "isAccessibleForFree": True, "creator": TEAM, "measurementTechnique": MARKING,
                  "variableMeasured": settings_ld(),
                  "size": f"{t['instances']} tasks from {t['suites']} suites, {t['robots']} robots, {t['simulators']} simulators",
                  "hasPart": [suite_node(s) for s in suites]},
                 {"@type": "SoftwareSourceCode", "name": exam["name"], "codeRepository": CODE, "runtimePlatform": "Harbor"}]
        return {"@context": "https://schema.org", "@graph": nodes}
    base = {"@context": "https://schema.org", "name": title, "description": desc, "keywords": kw, "isPartOf": WEBSITE}
    if page == "leaderboard/index.html":
        return {**base, "@type": "Dataset", "url": BASE + "leaderboard/", "creator": TEAM, "measurementTechnique": MARKING,
                "variableMeasured": settings_ld(),
                "about": [{"@type": "SoftwareApplication", "name": a, "applicationCategory": "coding agent"} for a in agents(exam)]}
    if page == "suites/index.html":
        return {**base, "@type": "ItemList", "url": BASE + "suites/", "numberOfItems": len(suites),
                "itemListElement": [{"@type": "ListItem", "position": i + 1, "item": suite_node(s)} for i, s in enumerate(suites)]}
    if page == "tasks/index.html":
        return {**base, "@type": "ItemList", "url": BASE + "tasks/", "numberOfItems": len(tasks),
                "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": f"{q['title']} ({names.get(q['suite'], q['suite'])})",
                                     "url": f"{BASE}tasks/?task={quote(q['suite'] + '/' + q['id'], safe='')}"}
                                    for i, q in enumerate(tasks)]}
    if page == "blogs/first-exam/index.html":
        return {**base, "@type": "BlogPosting", "headline": post.get("title") or exam["name"], "url": BASE + "blogs/first-exam/",
                "datePublished": post.get("date"), "author": TEAM, "publisher": TEAM, "image": post.get("poster"), "about": EXAM}
    return {**base, "@type": "WebPage", "url": BASE + (PAGES[page] if PAGES[page] is not None else page.replace("index.html", ""))}


def to_script(data: dict) -> str:
    # every <, > and & as a JSON escape: the value is the same, and nothing in it can end or reopen the script element
    ld = json.dumps(clean(data), ensure_ascii=False, separators=(",", ":"))
    ld = ld.replace("&", "\\u0026").replace("<", "\\u003c").replace(">", "\\u003e")
    return f'<script type="application/ld+json" id="seo-ld">{ld}</script>\n'


def pages(exam: dict, tasks: list, post: dict) -> None:
    kw = html.escape(", ".join(keywords(exam)), quote=True)
    for page in PAGES:
        p = ROOT / page
        t = p.read_text(encoding="utf-8")
        title = html.unescape(re.search(r"<title>(.*?)</title>", t).group(1))
        desc = html.unescape(re.search(r'<meta name="description" content="([^"]*)">', t).group(1))
        # the keywords in the head; the JSON-LD (the tasks page's runs to ~200 KB) at the end of the body, after the content
        t = KW.sub("", LD.sub("", t))
        t = t.replace("</head>", f'<meta name="keywords" content="{kw}">\n</head>', 1)
        t = t.replace("</body>", to_script(graph(page, exam, tasks, post, title, desc)) + "</body>", 1)
        p.write_text(t, encoding="utf-8")


def changed(path: str, fallback: str) -> str:
    try:
        out = subprocess.run(["git", "log", "-1", "--format=%cs", "--", path], cwd=ROOT, capture_output=True, text=True).stdout.strip()
    except OSError:
        out = ""
    return out or fallback


def crawl_files(exam: dict) -> None:
    build = exam["build"]["at"][:10]
    rows = [(BASE + u, build if u in DATA_DRIVEN else changed(f, build)) for u, f in SITEMAP.items()]
    rows += [(suite_url(s), build) for s in exam["suites"] if not s.get("example")]
    lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    lines += [f"  <url><loc>{html.escape(u)}</loc><lastmod>{d}</lastmod></url>" for u, d in rows] + ["</urlset>"]
    (ROOT / "sitemap.xml").write_text("\n".join(lines) + "\n", encoding="utf-8")
    bots = "".join(f"User-agent: {b}\nAllow: /\n\n" for b in AI_BOTS)
    (ROOT / "robots.txt").write_text(f"User-agent: *\nAllow: /\n\n{bots}Sitemap: {BASE}sitemap.xml\n", encoding="utf-8")


def llms(exam: dict, tasks: list) -> None:
    t, suites = exam["totals"], exam["suites"]
    by_suite: dict[str, list] = {}
    for q in tasks:
        by_suite.setdefault(q["suite"], []).append(q)
    ranked, others = agents(exam), unranked(exam)
    facts = [f"- {t['instances']} tasks ({t['core_tasks']} core) from {t['suites']} benchmark suites, {t['robots']} robots, "
             f"{t['simulators']} simulators, {t['graded_trials']} graded trials.",
             "- Settings: " + "; ".join(f"{k} ({v})" for k, v in SETTINGS.items()) + f". Core is {CORE}.",
             f"- Marking: {MARKING}",
             "- Agents ranked: " + ", ".join(ranked) + "." + (" Also run, unranked: " + ", ".join(others) + "." if others else ""),
             f"- Run it with Harbor: `harbor run -d embodied-first-exam -a <agent> -m <model>`. Code: {CODE}"]
    head = [f"# {exam['name']}", "", f"> {exam['summary']} {exam['hero']['lead']}", "", "## Key facts", "", *facts, "",
            "## Pages", "", f"- Home: {BASE}", f"- Leaderboard: {BASE}leaderboard/", f"- Suites: {BASE}suites/",
            f"- Every task: {BASE}tasks/", f"- How a test is marked: {BASE}how/", f"- Contribute: {BASE}contribute/",
            f"- Report: {BASE}blogs/first-exam/", f"- Full text for language models: {BASE}llms-full.txt", "", "## Suites", ""]
    for s in suites:
        alias = f" ({', '.join(ALIASES[s['id']])})" if s["id"] in ALIASES else ""
        blurb = s.get("blurb") or s.get("description") or ""
        head.append(f"- {s['name']}{alias}: {blurb} {suite_url(s)}".replace("  ", " "))
    (ROOT / "llms.txt").write_text("\n".join(head) + "\n", encoding="utf-8")
    faq = [("What is the Embodied First Exam?", f"{exam['summary']} {exam['hero']['lead']}"),
           ("Is it a Terminal-Bench for robotics?", f"Yes: {exam['hero']['lead']} A coding agent in its harness (such as Codex, "
            f"Claude Code or Antigravity) writes a program for a robot. {MARKING} The exam runs through Harbor, so one command can "
            "evaluate any agent on any task."),
           ("How do coding agents do on robots?", f"See the leaderboard at {BASE}leaderboard/ for " + ", ".join(ranked) + "."),
           ("What is the real-time setting?", f"standard-realtime: {SETTINGS['standard-realtime']}; "
            f"{t['core_modes'].get('standard-realtime', 0)} core tests."),
           ("What are privileged and standard?", f"privileged: {SETTINGS['privileged']}; standard: {SETTINGS['standard']}.")]
    full = ["\n".join(head), "", "## Questions", ""] + [f"### {q}\n\n{a}\n" for q, a in faq] + ["## Every suite and its tasks", ""]
    for s in suites:
        meta = [f"Simulator: {s['simulator']}" if s.get("simulator") else "", f"Edition: {s['edition']}" if s.get("edition") else "",
                "Robots: " + ", ".join(r["name"] for r in (s.get("robots") or [])) if s.get("robots") else "",
                "Adapted from an upstream benchmark" if s.get("origin") != "ours" else "Built for the exam"]
        full += [f"### {s['name']}", "", s.get("description") or s.get("blurb") or "", "", " · ".join(m for m in meta if m), "",
                 "Tasks: " + "; ".join(q["title"] for q in by_suite.get(s["id"], [])) + ".", ""]
    (ROOT / "llms-full.txt").write_text("\n".join(full), encoding="utf-8")


def main() -> None:
    exam = json.loads((ROOT / "data/exam.json").read_text(encoding="utf-8"))
    tasks = json.loads((ROOT / "data/tasks.json").read_text(encoding="utf-8"))
    blogs = json.loads((ROOT / "data/blogs.json").read_text(encoding="utf-8"))
    post = next((b for b in blogs if b.get("slug") == "first-exam"), {})
    pages(exam, tasks, post)
    crawl_files(exam)
    llms(exam, tasks)
    print(f"seo: {len(PAGES)} pages, {len(exam['suites'])} suites, {len(tasks)} tasks")


if __name__ == "__main__":
    main()
