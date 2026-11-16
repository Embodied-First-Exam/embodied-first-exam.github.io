#!/usr/bin/env python3
"""Write data/blog-sol.json: the per-attempt numbers of the GPT-6.1 Sol post that the site's own data does not hold.

The post's results (scores, the head-to-head with GPT-6 Astra, the suites) are computed in the page from data/exam.json and
data/tasks.json, the files the leaderboard reads. What is left is how the attempts went, for the five strong agents: list-price
cost, agent time and output tokens, per setting and by outcome. They come from the paper's cost table (one row per core test
and agent: verdict, wall time, tokens, list-price cost usd_list), whose prices and method are the paper's (list prices of
November 2026). Each mean is over the priced attempts.

    python3 scripts/export_blog_sol.py --attempts <overleaf arxiv>/arxiv/scripts/app_cost_vs_success/attempts.csv [--snapshot TEXT] [--out data/blog-sol.json]
"""
import argparse
import csv
import json
import statistics as st
from pathlib import Path

RUNS = ['codex-gpt6_1_sol-high', 'codex-gpt6_astra-high', 'claude_code-fable_5_2-high', 'claude_code-opus_5_5-high',
        'antigravity_cli-gemini_4_argon-high']


def med(xs):
    xs = [x for x in xs if x is not None]
    return round(st.median(xs), 2) if xs else None


def mean(xs):
    xs = [x for x in xs if x is not None]
    return round(st.mean(xs), 2) if xs else None


def num(x):
    return float(x) if x not in (None, '') else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--attempts', required=True)
    ap.add_argument('--snapshot', default='')
    ap.add_argument('--out', default=str(Path(__file__).resolve().parent.parent / 'data' / 'blog-sol.json'))
    a = ap.parse_args()

    out = {}
    rows = [r for r in csv.DictReader(open(a.attempts, encoding='utf8')) if r['agent'] in RUNS]
    for run in RUNS:
        out[run] = {}
        for m in ('p', 's', 't'):
            L = [r for r in rows if r['agent'] == run and r['setting'] == m]
            g = [r for r in L if r['verdict'] in ('S', 'F')]
            c = [r for r in g if r['usd_list'] not in ('', None)]
            ok = [r for r in c if r['verdict'] == 'S']
            bad = [r for r in c if r['verdict'] == 'F']
            wall = lambda R: [num(r['wall_s']) / 60 if num(r['wall_s']) is not None else None for r in R]
            out[run][m] = {
                'n_cost': len(c),
                'usd_mean': mean([num(r['usd_list']) for r in c]), 'usd_total': round(sum(num(r['usd_list']) for r in c), 1),
                'usd_med_ok': med([num(r['usd_list']) for r in ok]), 'usd_med_fail': med([num(r['usd_list']) for r in bad]),
                'wall_med': med(wall(g)), 'wall_med_ok': med(wall([r for r in g if r['verdict'] == 'S'])),
                'wall_med_fail': med(wall([r for r in g if r['verdict'] == 'F'])),
                'tok_out_med': med([num(r['tok_out']) for r in c]),
            }
    Path(a.out).write_text(json.dumps({'snapshot': a.snapshot, 'source': 'paper cost table (app_cost_vs_success/attempts.csv)',
                                       'runs': out}, indent=1) + '\n', encoding='utf8')
    print(f'{a.out}: {len(RUNS)} runs')


if __name__ == '__main__':
    main()
