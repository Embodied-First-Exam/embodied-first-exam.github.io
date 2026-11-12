#!/usr/bin/env python3
"""Write data/blog-fable.json: the per-attempt numbers of the Claude Fable 5.2 post that the site's own data does not hold.

The post's results (scores, the head-to-head with GPT-6 Astra, the suites) are computed in the page from data/exam.json and
data/tasks.json, the files the leaderboard reads. What is left is how the attempts went, for the agents the post compares:
time, steps, list-price cost, tokens, how many attempts ran into the time limit and how much of it the failed ones used,
per setting and by outcome. Each
attempt is the one the leaderboard counts for its core test (--leaderboard, one row per core test and agent with the
counted trial); a test without a counted trial has no row here (it counts as failed in the results).

  --attempts   the paper's cost table (one row per core test and agent: outcome, list-price cost usd_list, tokens), whose
               prices and method are the paper's (list prices of November 2026)
  --store      the run viewer's local store (runs/<sha1(slug)[:2]>/<slug>/run.json): agent time and steps
  --trials     the trial index (SQLite, read only): whether the attempt ended at the time limit

    python3 scripts/export_blog_fable.py --leaderboard L.csv --attempts A.csv --store STORE --trials T.sqlite [--out data/blog-fable.json]
"""
import argparse
import csv
import hashlib
import json
import re
import sqlite3
import statistics as st
from pathlib import Path

RUNS = ['claude_code-fable_5_2-high', 'codex-gpt6_astra-high', 'claude_code-opus_5_5-high']
MODE = {'privileged': 'p', 'standard': 's', 'realtime': 't', 'standard-realtime': 't'}


def slug_of(task, trial):
    return re.sub(r"[^a-z0-9_-]+", "-", f"{task}--{trial[-7:]}".lower())


def med(xs):
    xs = [x for x in xs if x is not None]
    return round(st.median(xs), 2) if xs else None


def mean(xs):
    xs = [x for x in xs if x is not None]
    return round(st.mean(xs), 2) if xs else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--leaderboard', required=True)
    ap.add_argument('--attempts', required=True)
    ap.add_argument('--store', required=True)
    ap.add_argument('--trials', required=True)
    ap.add_argument('--snapshot', default='')
    ap.add_argument('--out', default=str(Path(__file__).resolve().parent.parent / 'data' / 'blog-fable.json'))
    a = ap.parse_args()

    cost = {(r['agent'], r['suite'], r['task'], r['setting']): r for r in csv.DictReader(open(a.attempts, encoding='utf8'))}
    db = sqlite3.connect(f'file:{a.trials}?mode=ro', uri=True)
    rows = []
    for r in csv.DictReader(open(a.leaderboard, encoding='utf8')):
        if r['run_id'] not in RUNS or not r['trial_id']:
            continue
        m = MODE[r['setting']]
        path = r['dashboard_id'].split('|', 2)[-1]
        x = db.execute('select data from trials where path=?', (path,)).fetchone()
        tr = json.loads(x[0]) if x else {}
        s = slug_of(r['task_dir'], r['trial_id'])
        rj = Path(a.store) / 'runs' / hashlib.sha1(s.encode()).hexdigest()[:2] / s / 'run.json'
        run = json.loads(rj.read_text(encoding='utf8')) if rj.is_file() else None
        rows.append({'run': r['run_id'], 'm': m, 'ok': r['counts_as'] == 'success',
                     'timeout': (tr.get('exception') or '') == 'AgentTimeoutError' if tr else None,
                     'wall_min': (run['wall_s'] / 60) if run and run.get('wall_s') else None,
                     'steps': len(run['steps']) if run else None,
                     'calls': sum(len(stp.get('calls') or []) for stp in run['steps']) if run else None,
                     'robot': sum(1 for stp in run['steps'] for c in (stp.get('calls') or []) if c.get('kind') == 'robot') if run else None,
                     'look': sum(1 for stp in run['steps'] for c in (stp.get('calls') or []) if c.get('kind') == 'look') if run else None,
                     'tok_out': tr.get('tok_out')})
    # list-price cost: the paper's table, one row per (agent, core test), priced from the same counted attempt
    usd = {}
    for (ag, suite, task, m), r in cost.items():
        if ag in RUNS and r.get('match') == 'matched' and r.get('usd_list') not in (None, ''):
            usd.setdefault((ag, m), []).append((r['verdict'] == 'S', float(r['usd_list']), float(r['tok_out'] or 0)))
    # how much of its time limit a failed attempt used (the paper's table: wall time against the test's limit)
    used = {}
    for (ag, suite, task, m), r in cost.items():
        if ag in RUNS and r['verdict'] == 'F' and r.get('wall_s') and r.get('budget_min'):
            lim = float(r['budget_min']) * 60
            used.setdefault((ag, m), []).append((float(r['wall_s']) / lim, lim - float(r['wall_s'])))

    out = {'snapshot': a.snapshot, 'runs': {}}
    for ag in RUNS:
        per = {}
        for m in 'pst':
            R = [x for x in rows if x['run'] == ag and x['m'] == m]
            U = usd.get((ag, m), [])
            withrun = [x for x in R if x['steps'] is not None]
            per[m] = {
                'n': len(R), 'n_run': len(withrun),
                'timeout': sum(1 for x in R if x['timeout']),
                'wall_med': med([x['wall_min'] for x in withrun]),
                'wall_med_ok': med([x['wall_min'] for x in withrun if x['ok']]),
                'wall_med_fail': med([x['wall_min'] for x in withrun if not x['ok']]),
                'steps_med': med([x['steps'] for x in withrun]),
                'calls_med': med([x['calls'] for x in withrun]),
                'robot_med': med([x['robot'] for x in withrun]),
                'look_med': med([x['look'] for x in withrun]),
                'tok_out_med': med([x['tok_out'] for x in R]),
                'n_cost': len(U), 'usd_mean': mean([u for _, u, _ in U]), 'usd_med': med([u for _, u, _ in U]),
                'usd_total': round(sum(u for _, u, _ in U), 1),
                'usd_med_ok': med([u for ok, u, _ in U if ok]), 'usd_med_fail': med([u for ok, u, _ in U if not ok]),
                'n_fail_used': len(used.get((ag, m), [])),
                'used_med_fail': med([100 * f for f, _ in used.get((ag, m), [])]),
                'left10_fail': sum(1 for _, left in used.get((ag, m), []) if left >= 600),
            }
        out['runs'][ag] = per
    Path(a.out).write_text(json.dumps(out, ensure_ascii=False, indent=1) + '\n', encoding='utf8')
    print(f'wrote {a.out}')


if __name__ == '__main__':
    main()
