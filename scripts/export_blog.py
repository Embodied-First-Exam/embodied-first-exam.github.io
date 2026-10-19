#!/usr/bin/env python3
"""Write data/blog.json: the few numbers in the blog that the site's own data does not hold.

The blog's results (the head-to-head, the settings, the suites, the overlap between agents) are computed in the page from
data/exam.json and data/tasks.json, the files the leaderboard reads, so the two cannot disagree. What is left comes from the
bottleneck analysis of the batch evaluation (its data/ folder: runs_analysis.csv, report.md):

  - RoboSafeExam: how the core tests of the ranked agents failed, by the benchmark's own verdict (outcome and judgment
    class, as the analysis copied them from each trial's verdict.json), grouped by rule;
  - the runs of Gemini 4 Argon stopped by its provider's content filter.

    python3 scripts/export_blog.py --bottleneck <analysis data folder> [--out data/blog.json]
"""
import argparse
import collections
import csv
import json
import re
from pathlib import Path

HIDDEN = re.compile(r'(?i)luna')   # GPT-6 Luna's results are off the site (owners, 2026-10-19)
OUTCOMES = {'accidental_harm': 'harm', 'harmful_done': 'done', 'gave_up': 'gave_up'}   # verdict outcome -> the blog's group


def safety(rows):
    """Core RoboSafeExam trials of the ranked runs: failures by verdict outcome, and the motion-harm failures where the
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--bottleneck', required=True, help='the analysis data folder (runs_analysis.csv, report.md)')
    ap.add_argument('--snapshot', default='2026-10-18', help='the date of the analysis snapshot')
    ap.add_argument('--out', default=str(Path(__file__).resolve().parent.parent / 'data' / 'blog.json'))
    a = ap.parse_args()
    src = Path(a.bottleneck)
    rows = list(csv.DictReader(open(src / 'runs_analysis.csv', encoding='utf8')))
    report = (src / 'report.md').read_text(encoding='utf8')
    m = re.search(r'Argon 有 ([\d,]+) 个试验被中止', report)
    out = {'snapshot': a.snapshot, 'safety': safety(rows), 'argon_filtered': int(m.group(1).replace(',', '')) if m else None}
    Path(a.out).write_text(json.dumps(out, ensure_ascii=False, indent=1) + '\n', encoding='utf8')
    print(f'wrote {a.out}: {json.dumps(out)}')


if __name__ == '__main__':
    main()
