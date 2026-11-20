#!/usr/bin/env python3
"""Write data/blog-astra62.json: the per-attempt numbers of the GPT-6.2 Astra post that the site's own data does not hold.

The post's results (scores, the head-to-head with Claude Fable 5.2, the suites, the tests others solve) are computed in
the page from its frozen snapshot, data/blog_snapshot_astra62/{exam,tasks}.json, a copy of the files the leaderboard
read on the snapshot date. What is left is how the attempts went, for the agents the post compares: time, model
requests, output tokens, list-price cost, how many attempts ran into the time limit and how much of it the failed ones
used, per setting and by outcome.

Each attempt is the one the leaderboard counts for its core test: the latest finished trial per (run, task dir), as the
site's import records it (data/exam/bel_results.json of the site source). Costs are the site's estimate of that trial
(scripts/exam_data.py): the per-request cost where the run is priced per request (data/exam/per_request.json), otherwise
the tokens at data/prices.yml list prices with requests above a long-context threshold at the higher rates
(data/exam/long_context.json). Whether the attempt ended at the time limit comes from the trial index (trials.sqlite,
read only): the trial with the same run, task dir and finish time.

    python3 scripts/export_blog_astra62.py --src <exam-site-source> --trials <trials.sqlite> [--snapshot DATE] [--out ...]
"""
import argparse
import json
import sqlite3
import statistics as st
from pathlib import Path

import yaml

RUNS = ['codex-gpt6_2_astra-high', 'claude_code-fable_5_2-high', 'codex-gpt6_astra-high']
MODE = {'privileged': 'p', 'standard': 's', 'realtime': 't', 'standard-realtime': 't'}


def med(xs):
    xs = [x for x in xs if x is not None]
    return round(st.median(xs), 2) if xs else None


def mean(xs):
    xs = [x for x in xs if x is not None]
    return round(st.mean(xs), 2) if xs else None


def estimate_usd(tokens, price, long=None):
    """scripts/runsdb.py estimate_usd of the site source, unchanged."""
    if not tokens or not price or tokens.get('input') is None:
        return None

    def at(tok, p):
        tin, cached, out = float(tok.get('input') or 0), float(tok.get('cached') or 0), float(tok.get('output') or 0)
        return ((tin - cached) * float(p['input']) + cached * float(p.get('cached_input', p['input']))
                + out * float(p['output'])) / 1e6
    usd = at(tokens, price)
    if long and long.get('n') and price.get('long_context'):
        usd += at(long, price['long_context']) - at(long, price)
    return usd


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', required=True, help='exam-site-source checkout (data/exam/*.json, data/prices.yml, data/agents)')
    ap.add_argument('--trials', required=True, help='the trial index, trials.sqlite (read only)')
    ap.add_argument('--snapshot', default='', help='the snapshot date shown in the post')
    ap.add_argument('--out', default=str(Path(__file__).resolve().parent.parent / 'data' / 'blog-astra62.json'))
    a = ap.parse_args()
    src = Path(a.src)
    ex = src / 'data' / 'exam'
    inv = json.loads((ex / 'inventory.json').read_text())
    bel = json.loads((ex / 'bel_results.json').read_text())
    long_ctx = json.loads((ex / 'long_context.json').read_text()).get('runs') or {}
    per_req = json.loads((ex / 'per_request.json').read_text()).get('runs') or {}
    prices = yaml.safe_load((src / 'data' / 'prices.yml').read_text())

    # core task dirs and their time limits; results under a former dir name count for the current one
    core, current = {}, {}
    for s in inv['suites'].values():
        for t in s['tasks'].values():
            for mode, mv in t['modes'].items():
                if mv.get('former_dir'):
                    current[mv['former_dir']] = mv['dir']
                if mv.get('core'):
                    core[mv['dir']] = (MODE[mode], float(mv.get('timeout_s') or 0))
    db = sqlite3.connect(f'file:{a.trials}?mode=ro', uri=True)

    out = {'snapshot': a.snapshot, 'core_tests': len(core), 'runs': {}}
    for run in RUNS:
        agent = yaml.safe_load((src / 'data' / 'agents' / f'{run}.yml').read_text())
        price = prices.get(str(agent.get('price') or ''))
        recs = {}
        for d, rec in (bel['results'].get(run) or {}).items():
            d2 = current.get(d, d)
            if d2 not in recs or rec.get('finished', 0) > recs[d2].get('finished', 0):
                recs[d2] = dict(rec, dir=d)
        lc = {current.get(d, d): v for d, v in (long_ctx.get(run) or {}).items()}
        pq = {current.get(d, d): v for d, v in (per_req.get(run) or {}).items()}
        # the trial index rows of this run, to find the counted trial's exception by finish time
        idx = {}
        for task, fin, data in db.execute('select task, finished, data from trials where run=?', (run,)):
            idx.setdefault(task, []).append((fin or 0, data))
        rows = []
        for d, (m, limit_s) in core.items():
            rec = recs.get(d)
            if not rec or rec.get('state') not in ('success', 'failed'):
                continue
            fin = rec.get('finished') or 0
            exc = None
            for f2, data in idx.get(rec['dir'], []) + (idx.get(d, []) if rec['dir'] != d else []):
                if abs(f2 - fin) < 2:
                    exc = (json.loads(data).get('exception') or '') if data else ''
                    break
            l = lc.get(d)
            l = l if l and l.get('finished') == fin else None
            q = pq.get(d)
            q = q if q and q.get('finished') == fin else None
            usd = q['usd'] if q else estimate_usd(rec.get('tokens'), price, l)
            wall = rec.get('agent_wall_s')
            rows.append({'m': m, 'ok': rec['state'] == 'success', 'exc': exc,
                         'wall': wall / 60 if wall is not None else None,
                         'req': rec.get('requests'), 'tok_out': (rec.get('tokens') or {}).get('output'),
                         'usd': usd, 'used': (wall / limit_s) if (wall is not None and limit_s) else None,
                         'left': (limit_s - wall) if (wall is not None and limit_s) else None,
                         'long': bool(l and l.get('n'))})
        per = {}
        for m in ['p', 's', 't', 'all']:
            R = [x for x in rows if m == 'all' or x['m'] == m]
            F = [x for x in R if not x['ok']]
            per[m] = {
                'n': len(R), 'n_matched': sum(1 for x in R if x['exc'] is not None),
                'timeout': sum(1 for x in R if x['exc'] == 'AgentTimeoutError'),
                'wall_med': med([x['wall'] for x in R]),
                'wall_med_ok': med([x['wall'] for x in R if x['ok']]),
                'wall_med_fail': med([x['wall'] for x in F]),
                'req_med': med([x['req'] for x in R]),
                'tok_out_med': med([x['tok_out'] for x in R]),
                'n_cost': sum(1 for x in R if x['usd'] is not None),
                'usd_mean': mean([x['usd'] for x in R]), 'usd_med': med([x['usd'] for x in R]),
                'usd_total': round(sum(x['usd'] for x in R if x['usd'] is not None), 1),
                'usd_med_ok': med([x['usd'] for x in R if x['ok']]),
                'usd_med_fail': med([x['usd'] for x in F]),
                'n_long': sum(1 for x in R if x['long']),
                'n_fail_used': sum(1 for x in F if x['used'] is not None),
                'used_med_fail': med([100 * x['used'] for x in F if x['used'] is not None]),
                'left10_fail': sum(1 for x in F if x['left'] is not None and x['left'] >= 600),
            }
        out['runs'][run] = per
    Path(a.out).write_text(json.dumps(out, ensure_ascii=False, indent=1) + '\n', encoding='utf8')
    print(f'wrote {a.out}')


if __name__ == '__main__':
    main()
