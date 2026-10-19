#!/usr/bin/env python3
"""Write the Task Atlas data for this site: data/atlas.json (summaries, categories, steps and the task sphere) and
data/search.json (the search index read by assets/search_core.js), both over exactly the questions in data/tasks.json.

The Atlas is built per task base of the exam's source (a question's directories without their mode suffix); this site
shows questions as "<suite>/<id>". The source checkout's inventory (data/exam/inventory.json, the file `make data`
reads) says which base each question is. Without it, the base is derived from the suite and the id.

Only English is kept, model results are left out (the site has its own), and no task directory names are written.
Re-run after `make data`:

    python3 scripts/export_atlas.py --atlas <Atlas package> --src ../tmp/2026-10-06_exam_site [--easy-set <easy_set.toml>]
"""

from __future__ import annotations

import argparse
import base64
import collections as C
import datetime as dt
import hashlib
import json
import math
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

# the source's suite ids shown here under another id (as in scripts/export.py and the generator's merge_suites)
SUITE_IDS = {"robopaint-strict": "robopaint", "ikea-mujoco": "roboarc"}
EXCLUDE = {"robopaint"}               # source suite left out of the exam (its strict version is shown as robopaint)
MODES = ("privileged", "standard", "standard-realtime", "realtime")
# directory prefixes per suite shown here, for deriving a base without the inventory
PREFIX = {"behavior-1k": ["behavior-"], "robotwin-2": ["robotwin_2_0_"], "mujoco-playground": ["mujoco_playground_"],
          "dextoolbench": ["dextoolbench_"], "roboarc": ["roboarc-", "ikea-"], "robosafe": ["rsb-"]}
CJK = re.compile(r"[\u2e80-\u2fff\u3000-\u303f\u3040-\u9fff\uf900-\ufaff\uff00-\uffef]+")
# Chinese text inside English summaries, said in English (anything else in Chinese is dropped)
CJK_EN = {"\u672c\u6240\u7acb\u5ddd": "Honjo Tatekawa"}   # a painting's title in a VLABench task
# addresses and names that must never reach this site's files: scripts/check.py's list, and local paths
sys.path.insert(0, str(Path(__file__).resolve().parent))
from check import FORBIDDEN as SITE_FORBIDDEN  # noqa: E402

FORBIDDEN = [*SITE_FORBIDDEN, "/home/", "/mnt/", "/tmp/"]


def r3(v):
    return [round(float(x), 3) for x in v]


def base_of(d: str) -> str:
    m = max((m for m in MODES if d.endswith("-" + m)), key=len)
    return d[: -len(m) - 1]


def english(s, roman: str | None = None):
    """Text with every Chinese run replaced: by its English name (CJK_EN), by the task's romanised title (RoboPaint's
    calligraphy, whose target text is Chinese), else removed."""
    if isinstance(s, list):
        return [english(x, roman) for x in s]
    if isinstance(s, dict):
        return {k: english(v, roman) for k, v in s.items()}
    if not isinstance(s, str) or not CJK.search(s):
        return s
    for zh, en in CJK_EN.items():
        s = s.replace(zh, en)
    s = CJK.sub(roman or "", s)
    return re.sub(r"\s+([,.;:)])", r"\1", re.sub(r"\s{2,}", " ", s)).strip()


def site_bases(site: list[dict], inv: dict | None, atlas: dict) -> dict[str, str | None]:
    """site key -> the Atlas base it shows (None when there is none)."""
    by_key = {}
    if inv:
        for sid, s in inv["suites"].items():
            if sid in EXCLUDE:
                continue
            shown = SUITE_IDS.get(sid, sid)
            for tid, t in s["tasks"].items():
                by_key[f"{shown}/{tid}"] = t["base"]
    out = {}
    for t in site:
        key = f"{t['suite']}/{t['id']}"
        if key in by_key:
            b = by_key[key]
            # RoboOlympics split into -fun and -match in the repository (2026-10-18); the Atlas knows the bases before it
            if b not in atlas:
                b = b.replace("roboolympics-fun-", "roboolympics-").replace("roboolympics-match-", "roboolympics-")
            out[key] = b if b in atlas else None
            continue
        out[key] = derive_base(t, atlas)
    return out


def derive_base(t: dict, atlas: dict) -> str | None:
    """A question's base from its suite and id, without the inventory: the first candidate the Atlas has."""
    suite, tid = t["suite"], t["id"]
    m = re.fullmatch(r"(.*?)_(i\d\d)", tid)
    stem, inst = (m.group(1), m.group(2)) if m else (tid, None)
    if suite == "robosafe":
        return next((b for b in [f"rsb-{t.get('family')}-{inst or 'i00'}"] if b in atlas), None)
    prefixes = PREFIX.get(suite, [suite + "-"])
    cands = []
    for p in prefixes:
        for s in (stem, stem.replace("_", "-")):
            for i in ([inst] if inst else ["i00", "i01"]):
                cands += [f"{p}{s}-{i}", f"{p}{s}-fahexa-{i}"]
            cands.append(f"{p}{s}")
    return next((b for b in cands if b in atlas), None)


def decode_q8(b64: str, rows: int, dim: int) -> list[bytes]:
    raw = base64.b64decode(b64)
    return [raw[i * dim:(i + 1) * dim] for i in range(rows)]


def deq(row: bytes, scale: list[float]) -> list[float]:
    return [(b - 256 if b > 127 else b) * s for b, s in zip(row, scale)]


def q8_row(v: list[float], scale: list[float]) -> bytes:
    return bytes((max(-127, min(127, round(x / s))) & 0xFF) for x, s in zip(v, scale))


def stem(w):
    if len(w) > 4 and w.endswith("ies"):
        return w[:-3] + "y"
    if len(w) > 3 and w.endswith("s") and not w.endswith("ss") and not w.endswith("us"):
        return w[:-1]
    return w


def words(s):
    return re.findall(r"[a-z][a-z0-9']*(?:-[a-z0-9]+)*", s.lower())


# the Atlas lexicon's stop words (its build_index.py), for the document frequencies
STOP = set("""a an the and or of to in on at by for from with into onto over under up down out off as is are be been
being was were it its this that these those there their them they then than so such not no nor but if while when
where which who whom whose what how why all any both each few more most other some own same too very can will just
should now one two three four five six seven eight nine ten its itself his her he she we you your our us also
must may might has have had do does did doing done get gets got make makes made using use used via each every
before after again further once only between through during without within along across about against among
first second third last next back away still yet even ever upon per either whether onto""".split())


def doc_freq(recs: list[dict], keys: list[str]) -> list[int]:
    """Each lexicon term's document frequency over these tasks (unigrams and bigrams, as the Atlas counts them)."""
    df = C.Counter()
    for t in recs:
        text = " ".join([t["n"], t["t"], " ".join(t["o"]), " ".join(k.replace("-", " ") for k in t["k"])])
        toks = words(text)
        seen = {stem(w) for w in toks if w not in STOP and not w.isdigit() and len(w) > 1}
        for a, b in zip(toks, toks[1:]):
            if a in STOP or b in STOP or a.isdigit() or b.isdigit():
                continue
            seen.add(stem(a) + " " + stem(b))
        df.update(seen)
    return [df.get(k, 0) for k in keys]


def nearest(i: int, V, fam: list, exclude_fam: bool, k: int) -> list[int]:
    """Indices of the k rows most similar to row i (dot product), other families only when exclude_fam."""
    try:
        import numpy as np
        if not isinstance(V, np.ndarray):
            V = np.asarray(V, dtype=np.float32)
        s = V @ V[i]
        order = np.argsort(-s).tolist()
    except ImportError:
        vi = V[i]
        s = [sum(a * b for a, b in zip(vi, row)) for row in V]
        order = sorted(range(len(V)), key=lambda j: -s[j])
    return [j for j in order if j != i and (not exclude_fam or fam[j] != fam[i])][:k]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--atlas", type=Path, required=True, help="the Atlas package (its data/ and efe_wiki/ folders)")
    ap.add_argument("--src", type=Path, default=ROOT.parent / "tmp" / "2026-10-06_exam_site",
                    help="the exam's source checkout, for data/exam/inventory.json (optional)")
    ap.add_argument("--easy-set", type=Path, help="an easy_set.toml newer than the Atlas's (optional)")
    ap.add_argument("--report", type=Path, help="write the mapping summary here (JSON; keep it out of this site)")
    args = ap.parse_args()

    site = json.loads((DATA / "tasks.json").read_text())
    exam = json.loads((DATA / "exam.json").read_text())
    export = json.loads((args.atlas / "data" / "tasks_export.json").read_text())
    index = json.loads((args.atlas / "data" / "index.json").read_text())
    vocab = json.loads((args.atlas / "efe_wiki" / "vocab.json").read_text())
    steps_vocab = json.loads((args.atlas / "efe_wiki" / "steps_vocab.json").read_text())
    atlas = {t["base"]: t for t in export["tasks"]}
    ix_of = {t["b"]: i for i, t in enumerate(index["tasks"])}
    inv_path = args.src / "data" / "exam" / "inventory.json"
    inv = json.loads(inv_path.read_text()) if inv_path.is_file() else None
    if inv is None:
        print(f"no inventory at {inv_path}: bases derived from suite and id", file=sys.stderr)
    easy_override = None
    if args.easy_set:
        import tomllib
        easy_override = {e["base"] for e in tomllib.loads(args.easy_set.read_text()).get("task", [])}

    keys = [f"{t['suite']}/{t['id']}" for t in site]
    base = site_bases(site, inv, atlas)
    key_of = {b: k for k, b in base.items() if b}
    dim = index["vec"]["dim"]
    tscale = index["vec"]["task_scale"]
    trows = decode_q8(index["vec"]["task"], len(index["tasks"]), dim)

    # ---- per question: the Atlas record (or a stand-in for a question the Atlas does not have) ----
    suite_name = {s["id"]: s["name"] for s in exam["suites"]}
    bench_ids = [s["id"] for s in exam["suites"]]
    for t in site:
        if t["suite"] not in bench_ids:
            bench_ids.append(t["suite"])
    recs, vecs, fam_key = [], [], []
    for t, k in zip(site, keys):
        b = base[k]
        roman = t["title"].split(" \u00b7 ")[-1] if t["suite"] == "robopaint" else None
        if b:
            a = atlas[b]
            ia = index["tasks"][ix_of[b]]
            rec = {"n": english(a["name"], roman), "fam": a["family"], "tldr": english(a["tldr"], roman),
                   "tt": a["task_type"], "cap": a["capability"], "kw": a["keywords"], "obj": english(a["objects"], roman),
                   "steps": [s for s in ([x["action"], english(x["object"], roman), english(x["to"], roman), x.get("n", 1),
                                          x.get("modifiers") or []] for x in a["steps"])],
                   "xyz": r3(a["sphere"]["xyz"]), "reg": ia["reg"],
                   "easy": (b in easy_override) if easy_override is not None else bool(a["easy_set"]),
                   "why": english(a["label_reasons"], roman), "rv": 1 if a["label_source"].startswith("new") else 0,
                   "body": a["body"], "robot": a["robot"]}
            for s in rec["steps"]:                     # trailing defaults trimmed: n = 1, no modifiers
                if not s[4]:
                    s.pop()
                    if s[3] == 1:
                        s.pop()
            vecs.append(trows[ix_of[b]])
        else:
            rec = {"n": english(t["title"]), "fam": t.get("family") or t["id"], "tldr": english(t.get("sentence", "")),
                   "tt": [], "cap": [], "kw": [], "obj": [], "steps": [], "xyz": None, "reg": None, "easy": False,
                   "why": {}, "rv": 0, "body": t.get("body", ""), "robot": t.get("robot", ""), "est": 1}
            vecs.append(None)
        recs.append(rec)
        fam_key.append((t["suite"], rec["fam"]))

    # a question without an Atlas record: placed at the centre of its family (else its suite) on the sphere, and
    # searched with the mean of their vectors
    for i, rec in enumerate(recs):
        if not rec.get("est"):
            continue
        peers = [j for j in range(len(recs)) if not recs[j].get("est") and fam_key[j] == fam_key[i]] or \
                [j for j in range(len(recs)) if not recs[j].get("est") and site[j]["suite"] == site[i]["suite"]] or \
                [j for j in range(len(recs)) if not recs[j].get("est") and site[j].get("body") and site[j].get("body") == site[i].get("body")]
        if peers:
            m = [sum(recs[j]["xyz"][d] for j in peers) for d in range(3)]
            n = math.sqrt(sum(x * x for x in m)) or 1
            # a small offset fixed by the question's key, so questions placed at one centre do not sit on one dot
            h = hashlib.sha256(keys[i].encode()).digest()
            m = [x / n + (h[d] / 255 - 0.5) * 0.12 for d, x in enumerate(m)]
            n = math.sqrt(sum(x * x for x in m)) or 1
            rec["xyz"] = r3([x / n for x in m])
            rec["reg"] = max(range(len(index["regions"])),
                             key=lambda r: sum(a * b for a, b in zip(index["regions"][r]["xyz"], rec["xyz"])))
            mv = [sum(deq(vecs[j], tscale)[d] for j in peers) / len(peers) for d in range(dim)]
            vecs[i] = q8_row(mv, tscale)
        else:
            vecs[i] = bytes(dim)

    # related: the Atlas's six nearest in other families that are on this site, topped up from the vectors
    V = [deq(v, tscale) for v in vecs]
    for i, (k, rec) in enumerate(zip(keys, recs)):
        b = base[k]
        rel = [key_of[x] for x in (atlas[b]["related"] if b else []) if x in key_of and key_of[x] != k]
        if len(rel) < 6:
            for j in nearest(i, V, fam_key, True, 12):
                if keys[j] not in rel:
                    rel.append(keys[j])
                if len(rel) >= 6:
                    break
        rec["rel"] = rel[:6]

    # ---- data/atlas.json ----
    tag_en = {c["id"]: c["en"] for g in ("task_type", "capability", "body") for c in index["concepts"][g]}
    taxonomy = {
        "tt": {c["id"]: c["en"] for c in index["concepts"]["task_type"]},
        "cap": {c["id"]: c["en"] for c in index["concepts"]["capability"]},
        "body": {c["id"]: c["en"] for c in index["concepts"]["body"]},
        "kw": {k["id"]: k["id"].replace("-", " ") for g in vocab["groups"] for k in g["keywords"]},
        "kwg": [{"id": g["id"], "n": g["name"], "m": [k["id"] for k in g["keywords"]]} for g in vocab["groups"]],
        "act": {a["id"]: a["id"].replace("-", " ") for a in steps_vocab["actions"]},
        "act_def": {a["id"]: a["def"] for a in steps_vocab["actions"]},
        "act_change": {a["id"]: a["change"] for a in steps_vocab["actions"]},
        "mod": dict(steps_vocab["modifiers"]),
    }
    size = C.Counter(r["reg"] for r in recs)
    regions = [{"n": r["en"], "xyz": r3(r["xyz"]), "size": size.get(j, 0)} for j, r in enumerate(index["regions"])]
    atlas_out = {
        "v": 1,
        "meta": {"atlas_commit": next(v for k, v in export["source"].items() if k.endswith("_commit"))[:10],
                 "site_task_set": (exam.get("task_set") or {}).get("commit", "")[:10],
                 "built": dt.date.today().isoformat(), "n": len(keys),
                 "estimated": sum(1 for r in recs if r.get("est")),
                 "easy_from": "override" if easy_override is not None else "atlas",
                 "model": index["meta"]["model"], "layout_knn": index["meta"]["layout_knn"]},
        "taxonomy": taxonomy,
        "regions": regions,
        "tasks": {k: {kk: vv for kk, vv in r.items() if kk not in ("body", "robot") and vv is not None}
                  for k, r in zip(keys, recs)},
    }

    # ---- data/search.json ----
    concepts = {g: [{kk: c[kk] for kk in ("id", "en", "alias_en", "weak_en") if kk in c} for c in index["concepts"][g]]
                for g in ("task_type", "capability", "body")}
    stasks = [{"n": r["n"], "t": r["tldr"], "k": r["kw"], "o": r["obj"], "bench": bench_ids.index(t["suite"]),
               "body": r["body"], "robot": r["robot"], "tt": r["tt"], "cap": r["cap"],
               "st": [[s[0], s[1]] for s in r["steps"]]} for t, r in zip(site, recs)]
    lex = index["lex"]
    search_out = {
        "v": 1,
        "meta": {"model": index["meta"]["model"], "dim": dim, "n_tasks": len(keys), "n_terms": len(lex["keys"]),
                 "atlas_commit": atlas_out["meta"]["atlas_commit"], "built": atlas_out["meta"]["built"]},
        "keys": keys,
        "benches": [suite_name.get(s, s) for s in bench_ids],
        "bench_ids": bench_ids,
        "concepts": concepts,
        "vocab": {k: v for k, v in index["vocab"].items()},
        "actions": [a["id"] for a in steps_vocab["actions"]],
        "tasks": stasks,
        "lex": {"keys": lex["keys"], "text": lex["text"], "df": doc_freq(stasks, lex["keys"]), "sug": lex["sug"]},
        "vec": {"dim": dim, "task": base64.b64encode(b"".join(vecs)).decode(), "task_scale": tscale,
                "term": index["vec"]["term"], "term_scale": index["vec"]["term_scale"]},
    }

    problems = []
    for name, obj in (("atlas.json", atlas_out), ("search.json", search_out)):
        text = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
        if CJK.search(text):
            problems.append(f"{name}: Chinese text left: {CJK.findall(text)[:5]}")
        for bad in FORBIDDEN:
            if bad in text:
                problems.append(f"{name}: contains '{bad}'")
        for b in atlas:
            if f'"{b}"' in text:
                problems.append(f"{name}: names a task directory ({b})")
                break
        if not problems:
            (DATA / name).write_text(text + "\n", encoding="utf-8")
            print(f"wrote data/{name}: {len(text) / 1e6:.2f} MB")
    for p in problems:
        print("  ERROR", p, file=sys.stderr)
    # each question's set, on the question itself so the Tasks page can filter before the Atlas loads: the easy set
    # (docs/easy_set.toml of the exam's repository: reported apart) or the core set (owners, 2026-10-18)
    if not problems:
        for t, rec in zip(site, recs):
            if "core" not in t:                 # the exam data marks the core set itself (docs/core_set.toml) since 2026-10-18
                t["set"] = "easy" if rec["easy"] else "core"
        (DATA / "tasks.json").write_text(json.dumps(site, ensure_ascii=False, separators=(",", ":")))
        print(f"data/tasks.json: set written ({sum(t['set'] == 'core' for t in site)} core, {sum(t['set'] == 'easy' for t in site)} easy)")

    missing = [k for k in keys if not base[k]]
    shown = set(key_of)
    summary = {"site_tasks": len(keys), "mapped": len(keys) - len(missing), "missing": missing,
               "atlas_bases": len(atlas), "atlas_not_on_site": sorted(b for b in atlas if b not in shown),
               "inventory": bool(inv), "mapping": base}
    print(f"{len(keys)} questions: {len(keys) - len(missing)} with an Atlas record, {len(missing)} without "
          f"(placed by family or suite); {len(summary['atlas_not_on_site'])} Atlas bases not on this site")
    if args.report:
        args.report.write_text(json.dumps(summary, indent=1))
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
