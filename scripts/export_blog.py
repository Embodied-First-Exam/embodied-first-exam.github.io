#!/usr/bin/env python3
"""Write data/blog.json: the few numbers in the blog that the site's own data does not hold.

The blog's results (the scores per setting, the suites, the overlap between agents) are computed in the page from
data/exam.json and data/tasks.json, the files the leaderboard reads, so the two cannot disagree. What is left comes from the
cross-benchmark analysis page (its built index.html, which carries its data as `const DATA = {...}`): from its random sample
of trials, which the site cannot hold, the approach each trial was graded on, per setting (with the three kinds of program
inside code to control), and the short tag the analysis's benchmark figures give each benchmark (translated here). Each count
is read from the page's own count (numerator, denominator), not recomputed. A count the page no longer reports is left out
(not kept from an older page), so the blog shows no stale number.

    python3 scripts/export_blog.py [--crossbench <analysis page>] [--out data/blog.json]

Without --crossbench, data/blog.json keeps what it already has.
"""
import argparse
import html
import json
import re
from pathlib import Path


MODE = {'privileged': 'p', 'standard': 's', 'realtime': 't'}
# the analysis's benchmark ids -> the site's suite ids (the IKEA assembly tasks are their own row in both)
BENCH = {'behavior': 'behavior-1k', 'mujoco_playground': 'mujoco-playground', 'robotwin_2_0': 'robotwin-2', 'rsb': 'embodied-safety-exam',
         'ese': 'embodied-safety-exam', 'roboolympics-fun': 'embodied-olympics-fun', 'roboolympics-match': 'embodied-olympics-match'}
# the short tags of the analysis's benchmark figures, in English
TAGS = {'长程家务': 'long household tasks', '人形双臂家务': 'humanoid, two-arm chores', '灵巧手+用工具': 'dexterous hand + tools',
        '人形全身控制': 'humanoid whole-body control', '双臂精密装配': 'two-arm precision assembly', '桌面操作+安全约束': 'tabletop + safety rules',
        '四足/人形控制': 'quadruped / humanoid control', '肌骨手': 'musculoskeletal hand', '动态操作': 'dynamic manipulation',
        '精细操作+推理': 'fine manipulation + reasoning', '厨房多步': 'multi-step kitchen', '双臂长序列': 'two-arm long sequences',
        '控制器调参': 'controller tuning', '书画笔画': 'brush strokes', '安全判断': 'safety judgement', '双臂+物理推理': 'two arms + physical reasoning',
        '人形体育动作': 'humanoid sports'}
# the approach figure's segments: group and kind (code to control has three kinds of program)
WAYS = {'Code to Control（开环）': 'open', 'Code to Control（闭环）': 'closed', 'Code to Control（搜索参数）': 'search',
        'Direct Control': 'direct', 'Train Model to Control': 'train', '混合': 'mixed', '无': 'none'}


def crossbench(page):
    """The sample numbers of the cross-benchmark analysis: per setting, [numerator, denominator] for the main approach (code
    with privileged access, direct commands under standard rules, a closed-loop program on a running clock), the approach
    table and figure of its finding 1.6, and the benchmark figures' short tags."""
    text = Path(page).read_text(encoding='utf8')
    d, _ = json.JSONDecoder().raw_decode(text[text.index('const DATA = ') + len('const DATA = '):])
    tips = [html.unescape(t) for f in d['findings'].values() for t in re.findall(r'data-tip="([^"]*)"', f['html'])]

    def count(needles):
        """[numerator, denominator] per setting, from the tips whose text holds all of that setting's needles."""
        out = {}
        for t in tips:
            m = re.search(r'分母：(\d+) .*?[（；](privileged|standard|realtime)[）。；].*?分子：.*?的 (\d+) 个', t)
            if m and all(n in t for n in needles[MODE[m.group(2)]]):
                out[MODE[m.group(2)]] = [int(m.group(3)), int(m.group(1))]
        return out
    # the approach finding (1.6, later 1.5; found by its figure, not by its number): per setting, sampled trials by approach
    t16 = next((f['html'] for f in d['findings'].values() if 'Train Model to Control' in f['html'] and '<span class="seg"' in f['html']), '')
    cols = ['code', 'direct', 'train', 'mixed', 'none']
    mix = {}
    for row in re.findall(r'<tr><td>(privileged|standard|realtime)</td>(.*?)</tr>', t16):
        nums = re.findall(r'<td class=num>(\d+)(?:/\d+)?</td>', row[1])
        if len(nums) == 1 + len(cols):
            mix[MODE[row[0]]] = {'n': int(nums[0]), **{c: int(v) for c, v in zip(cols, nums[1:])}}
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
        'approach_mix': mix, 'approach_kinds': kinds, 'bench_tags': tags,
        'snapshot': site['snapshot'], 'sample': site.get('n_sample'), 'interim': bool(site.get('interim')),
        'approach': count({'p': ('做法标注', 'Code to Control（开环）'), 's': ('做法标注', '「Direct Control」的'),
                           't': ('做法标注', '「Code to Control（闭环）」的')}),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--crossbench', help="the cross-benchmark analysis page (its index.html)")
    ap.add_argument('--out', default=str(Path(__file__).resolve().parent.parent / 'data' / 'blog.json'))
    a = ap.parse_args()
    out = json.loads(Path(a.out).read_text(encoding='utf8')) if Path(a.out).exists() else {}
    if a.crossbench:
        out['crossbench'] = crossbench(a.crossbench)
    Path(a.out).write_text(json.dumps(out, ensure_ascii=False, indent=1) + '\n', encoding='utf8')
    print(f'wrote {a.out}: {json.dumps(out)}')


if __name__ == '__main__':
    main()
