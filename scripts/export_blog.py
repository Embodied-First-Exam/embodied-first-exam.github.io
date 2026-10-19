#!/usr/bin/env python3
"""Write data/blog.json: the few numbers in the blog that the site's own data does not hold.

The blog's results (the head-to-head, the settings, the suites, the overlap between agents) are computed in the page from
data/exam.json and data/tasks.json, the files the leaderboard reads, so the two cannot disagree. What is left comes from the
bottleneck analysis of the batch evaluation (its data/ folder: runs_analysis.csv, report.md):

  - the Embodied Safety Exam: how the core tests of the ranked agents failed, by the benchmark's own verdict (outcome and judgment
    class, as the analysis copied them from each trial's verdict.json), grouped by rule;
  - the runs of Gemini 4 Argon stopped by its provider's content filter.

and from the cross-benchmark analysis page (its built index.html, which carries its data as `const DATA = {...}`), two numbers
from its random sample of trials that the site cannot hold: failed trials with a point of no return, and the approach each
trial was graded on, per setting (with the three kinds of program inside code to control), the snapshot's own denominators
for Gemini 4 Argon without the sessions its provider's filter stopped, and the short tag the analysis's benchmark figures
give each benchmark (translated here). Each count is read from the page's own count (numerator, denominator), not recomputed.

    python3 scripts/export_blog.py [--bottleneck <analysis data folder>] [--crossbench <analysis page>] [--out data/blog.json]

A source left out keeps what data/blog.json already has.
"""
import argparse
import collections
import csv
import html
import json
import re
from pathlib import Path

HIDDEN = re.compile(r'(?i)luna')   # GPT-6 Luna's results are off the site (owners, 2026-10-19)
OUTCOMES = {'accidental_harm': 'harm', 'harmful_done': 'done', 'gave_up': 'gave_up'}   # verdict outcome -> the blog's group


def safety(rows):
    """Core Embodied Safety Exam trials of the ranked runs: failures by verdict outcome, and the motion-harm failures where the
    agent's own decision was right (it declined and told the operator)."""
    core = [r for r in rows if r['group'] == 'rsb' and r['easy_set'] == '0' and not HIDDEN.search(r['run'])]
    fails = [r for r in core if r['success'] == '0']
    outcome = lambda r: (m.group(1) if (m := re.search(r'outcome=(\w+)', r['evidence'])) else None)
    counts = collections.Counter(OUTCOMES.get(outcome(r), 'other') for r in fails)
    harm = [r for r in fails if outcome(r) == 'accidental_harm']
    right = [r for r in harm if 'judgment itself was right' in r['evidence']]
    return {
        'trials': len(core), 'runs': len({r['run'] for r in core}), 'modes': dict(collections.Counter(r['mode'] for r in core)),
        'failures': len(fails), 'by_outcome': {k: counts.get(k, 0) for k in ('harm', 'done', 'gave_up', 'other')},
        'harm_right_call': len(right),
        'labels': dict(collections.Counter(r['label_method'] for r in fails)),
    }


MODE = {'privileged': 'p', 'standard': 's', 'realtime': 't'}
# the analysis's benchmark ids -> the site's suite ids (the IKEA assembly tasks are their own row in both)
BENCH = {'behavior': 'behavior-1k', 'mujoco_playground': 'mujoco-playground', 'robotwin_2_0': 'robotwin-2', 'rsb': 'embodied-safety-exam'}
# the short tags of the analysis's benchmark figures, in English
TAGS = {'长程家务': 'long household tasks', '人形双臂家务': 'humanoid, two-arm chores', '灵巧手+用工具': 'dexterous hand + tools',
        '人形全身控制': 'humanoid whole-body control', '双臂精密装配': 'two-arm precision assembly', '桌面操作+安全约束': 'tabletop + safety rules',
        '四足/人形控制': 'quadruped / humanoid control', '肌骨手': 'musculoskeletal hand', '动态操作': 'dynamic manipulation',
        '精细操作+推理': 'fine manipulation + reasoning', '厨房多步': 'multi-step kitchen', '双臂长序列': 'two-arm long sequences',
        '控制器调参': 'controller tuning', '书画笔画': 'brush strokes', '安全判断': 'safety judgement', '双臂+物理推理': 'two arms + physical reasoning'}
# the approach figure's segments: group and kind (code to control has three kinds of program)
WAYS = {'Code to Control（开环）': 'open', 'Code to Control（闭环）': 'closed', 'Code to Control（搜索参数）': 'search',
        'Direct Control': 'direct', 'Train Model to Control': 'train', '混合': 'mixed', '无': 'none'}


def crossbench(page):
    """The sample numbers of the cross-benchmark analysis: per setting, [numerator, denominator] for failed trials with a point
    of no return, and for the main approach (code with privileged access, direct commands under standard rules, a closed-loop
    program on a running clock)."""
    text = Path(page).read_text(encoding='utf8')
    d, _ = json.JSONDecoder().raw_decode(text[text.index('const DATA = ') + len('const DATA = '):])
    tips = [html.unescape(t) for f in d['findings'].values() for t in re.findall(r'data-tip="([^"]*)"', f['html'])]

    def count(needles):
        """[numerator, denominator] per setting, from the tips whose text holds all of that setting's needles."""
        out = {}
        for t in tips:
            m = re.search(r'分母：(\d+) .*?[（；](privileged|standard|realtime)）.*?分子：.*?的 (\d+) 个', t)
            if m and all(n in t for n in needles[MODE[m.group(2)]]):
                out[MODE[m.group(2)]] = [int(m.group(3)), int(m.group(1))]
        return out
    # the approach table of finding 1.6: per setting, sampled trials by approach
    t16 = d['findings'].get('1.6', {}).get('html', '')
    cols = ['code', 'direct', 'train', 'mixed', 'none']
    mix = {}
    for row in re.findall(r'<tr><td>(privileged|standard|realtime)</td>(.*?)</tr>', t16):
        nums = re.findall(r'<td class=num>(\d+)(?:/\d+)?</td>', row[1])
        if len(nums) == 1 + len(cols):
            mix[MODE[row[0]]] = {'n': int(nums[0]), **{c: int(v) for c, v in zip(cols, nums[1:])}}
    # finding 1.1: Gemini 4 Argon without the runs its provider's content filter stopped, privileged and standard, and
    # Claude Opus 5.5 on the same snapshot
    li = next((x for x in re.split(r'<li>', d['findings'].get('1.1', {}).get('html', '')) if '不算被掐断' in x), '')
    fr = [[int(n), int(m)] for n, m in re.findall(r'（(\d+)/(\d+)）', re.sub(r'<[^>]+>', '', li))]
    # the same figure's segments: per setting, sampled trials by kind of approach
    kinds = {}
    for t in re.findall(r'<span class="seg"[^>]*data-tip="([^"]*)"', t16):
        m = re.match(r'(privileged|standard|realtime) · [^·]+ · (.+) (\d+)/(\d+)$', html.unescape(t))
        if m and m.group(2) in WAYS:
            kinds.setdefault(MODE[m.group(1)], {'n': int(m.group(4))})[WAYS[m.group(2)]] = int(m.group(3))
    # the benchmark figures' short tags, keyed by the site's suite id
    ids = {v: BENCH.get(k, k) for k, v in d['results']['names'].items()}
    tags = {}
    for f in d['findings'].values():
        for nm, tag in re.findall(r'<span class="cl" title="([^"：]+)：([^"]+)"', f['html']):
            if nm in ids and tag in TAGS:
                tags[ids[nm]] = TAGS[tag]
    site = d['site']
    return {
        'argon_unfiltered': {'p': fr[0], 's': fr[1]} if len(fr) >= 2 else None,
        'opus_same_snapshot': {'p': fr[2], 's': fr[3]} if len(fr) >= 4 else None,
        'approach_mix': mix, 'approach_kinds': kinds, 'bench_tags': tags,
        'snapshot': site['snapshot'], 'sample': site.get('n_sample'), 'interim': bool(site.get('interim')),
        'no_return': count({k: ('有不可挽回点',) for k in 'pst'}),
        'approach': count({'p': ('做法标注', 'Code to Control（开环）'), 's': ('做法标注', '「Direct Control」的'),
                           't': ('做法标注', '「Code to Control（闭环）」的')}),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--bottleneck', help='the analysis data folder (runs_analysis.csv, report.md)')
    ap.add_argument('--crossbench', help="the cross-benchmark analysis page (its index.html)")
    ap.add_argument('--snapshot', default='2026-10-18', help='the date of the analysis snapshot')
    ap.add_argument('--out', default=str(Path(__file__).resolve().parent.parent / 'data' / 'blog.json'))
    a = ap.parse_args()
    out = json.loads(Path(a.out).read_text(encoding='utf8')) if Path(a.out).exists() else {}
    if a.bottleneck:
        src = Path(a.bottleneck)
        rows = list(csv.DictReader(open(src / 'runs_analysis.csv', encoding='utf8')))
        report = (src / 'report.md').read_text(encoding='utf8')
        m = re.search(r'Argon 有 ([\d,]+) 个试验被中止', report)
        out.update(snapshot=a.snapshot, safety=safety(rows), argon_filtered=int(m.group(1).replace(',', '')) if m else None)
    if a.crossbench:
        out['crossbench'] = crossbench(a.crossbench)
    Path(a.out).write_text(json.dumps(out, ensure_ascii=False, indent=1) + '\n', encoding='utf8')
    print(f'wrote {a.out}: {json.dumps(out)}')


if __name__ == '__main__':
    main()
