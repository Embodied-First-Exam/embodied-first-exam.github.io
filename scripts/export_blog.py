#!/usr/bin/env python3
"""Write data/blog.json, the numbers behind the blog's figures, from a frozen snapshot of the cross-benchmark analysis.

The analysis is a page with its data embedded as `const DATA = {...}` (the core-set build). Every figure in the blog reads
one of its data tables ("看数字"), so the blog shows exactly the counts the analysis reports; this script only picks the
tables, turns their cells into numbers and gives the rows English and Chinese labels. Nothing else is computed here.

    python3 scripts/export_blog.py --analysis <core.html or core.json> --bottleneck <atlas data folder> --repo <task repo> --db <trials.sqlite> [--out data/blog.json]

The second source, the bottleneck atlas (its data/ folder: summary.json, subtask.json, report.md), gives the random-sample
estimates with 95% intervals, the chance of eventual success by time used, and where the time goes by subtask.
"""
import argparse
import html
import json
import re
from pathlib import Path

AGENTS = {  # analysis name -> (en, zh, family) ; family picks the colour
    'GPT-6 Astra': ('GPT-6 Astra', 'GPT-6 Astra', 'top'), 'Opus 5.5': ('Claude Opus 5.5', 'Claude Opus 5.5', 'top'),
    'Gemini 4 Argon': ('Gemini 4 Argon', 'Gemini 4 Argon', 'top'), 'GPT-6 Luna': ('GPT-6 Luna', 'GPT-6 Luna', 'ref'),
    'GLM-5.3 Flash': ('GLM-5.3 Flash', 'GLM-5.3 Flash', 'flash'), 'DeepSeek V4.1 Flash': ('DeepSeek V4.1 Flash', 'DeepSeek V4.1 Flash', 'flash'),
    'Gemini 3.8 Flash': ('Gemini 3.8 Flash', 'Gemini 3.8 Flash', 'flash'),
}
MODES = {'privileged': ('Privileged', 'Privileged'), 'standard': ('Standard', 'Standard'), 'realtime': ('Realtime', 'Realtime')}
TYPES = {  # task types of the analysis (EFE Task Atlas)
    '单物体搬运': ('Pick and place, one object', '单物体搬运'), '多物体整理': ('Arranging several objects', '多物体整理'),
    '铰接机构': ('Doors, drawers, hinges', '铰接机构'), '精细接触': ('Precise contact', '精细接触'), '工具使用': ('Tool use', '工具使用'),
    '柔性体与流体': ('Cloth, rope and fluids', '柔性体与流体'), '移动与全身动作': ('Locomotion and whole body', '移动与全身动作'),
    '导航与搜索': ('Navigation and search', '导航与搜索'), '动态交互': ('Dynamic interaction', '动态交互'),
}
FIXES = {  # the one missing step (finding 5.1)
    '按时钟规划': ('Plan by the clock', '按时钟排进度'), '换方法': ('Switch method when stuck', '没进展就换方法'),
    '选对抓法': ('Choose the grasp', '选对抓法'), '在真环境核对': ('Check in the real scene before grading', '评分前在真环境核对'),
}


def load(path):
    s = Path(path).read_text(encoding='utf8')
    if path.endswith('.json'):
        return json.loads(s)
    m = re.search(r'const DATA = ', s)
    return json.JSONDecoder().raw_decode(s[m.end():])[0]


def tables(h):
    text = lambda x: html.unescape(re.sub('<[^>]+>', '', x)).strip()
    return [[[text(c) for c in re.findall(r'<t[hd][^>]*>(.*?)</t[hd]>', r, re.S)] for r in re.findall(r'<tr.*?</tr>', t, re.S)]
            for t in re.findall(r'<table.*?</table>', h, re.S)]


def n(cell):
    """'74（27%）' -> 74, '129/173' -> [129, 173], '停 55%' -> 55."""
    cell = cell.replace(',', '')
    m = re.match(r'\s*(\d+)\s*/\s*(\d+)', cell)
    if m:
        return [int(m[1]), int(m[2])]
    m = re.search(r'(\d+)', cell)
    return int(m[1]) if m else None


ROOTS = {  # root causes of the bottleneck analysis's random sample of failures
    'GRASP_CONTACT_FAIL': ('Grasp and contact', '抓取与接触'), 'DYNAMICS_BALANCE_CONTROL': ('Dynamics and balance', '动力学与平衡'),
    'IK_PLANNING_FAIL': ('Reaching, IK and planning', '够到、IK 与规划'), 'PLACEMENT_PRECISION': ('Placement precision', '放置与对准精度'),
    'PERCEPTION_ERROR': ('Perception and pose', '感知与位姿'), 'SAFETY_JUDGMENT': ('Safety judgement', '安全判断'),
    'OTHER:stroke_plan_fidelity': ('Brush-stroke fidelity', '笔画还原度'), 'VERIFICATION_MISMATCH': ('Saw success, graded otherwise', '自认成功、评分判负'),
    'STRATEGY_WRONG': ('Wrong strategy', '策略错误'), 'INFRA_ERROR': ('Infrastructure', '基础设施'),
}
BREAKS = {  # how long-stalled successes broke through
    'PERSISTENCE_ONLY': ('Kept making steady progress', '持续稳步推进'), 'STRATEGY_SWITCH': ('Switched to another approach', '换一种做法'),
    'PHYSICAL_DIAGNOSIS': ('Diagnosed the physics from data', '用数据诊断物理原因'), 'CLOSED_LOOP_FEEDBACK': ('Added closed-loop feedback', '执行中加闭环反馈'),
    'OFFLINE_MODEL': ('Tested on its own offline model', '先在自建离线模型上验证'), 'PERCEPTION_FIX': ('Fixed its perception', '修正感知'),
    'PARAM_TUNING_CONVERGED': ('Same approach, tuning finally worked', '同一做法调参终于成功'),
}
SUBTASKS = {
    'MANIP': ('Carrying and contact', '搬运与接触操作'), 'GRASP': ('Grasping', '抓取'), 'MOTION': ('Reaching, IK and planning', '运动规划 / IK / 到达'),
    'DYNAMIC': ('Dynamics and balance', '动态与平衡控制'), 'PERCEPTION': ('Perception and localisation', '感知与定位'),
    'SETUP': ('Setup and planning the approach', '准备与方案设计'), 'PLACE': ('Placing and aligning', '放置与对齐'),
    'VERIFY': ('Checking and delivering', '验证与交付'), 'DRAW': ('Painting strokes', '绘画 / 笔画'),
}
CURVES = {'ALL|core': ('All agents', '全部 agent'), 'codex-gpt6_astra-high|core': ('GPT-6 Astra', 'GPT-6 Astra'),
          'claude_code-opus_5_5-high|core': ('Claude Opus 5.5', 'Claude Opus 5.5'), 'antigravity_cli-gemini_4_argon-high|core': ('Gemini 4 Argon', 'Gemini 4 Argon'),
          'antigravity_cli-gemini_3_8_flash-high|core': ('Gemini 3.8 Flash', 'Gemini 3.8 Flash'), 'dsh-deepseek_v4_1_flash-high|core': ('DeepSeek V4.1 Flash', 'DeepSeek V4.1 Flash'),
          'claude_code-glm_5_3_flash-high|core': ('GLM-5.3 Flash', 'GLM-5.3 Flash')}


def bottleneck(root):
    """The second analysis (the bottleneck atlas): its random-sample estimates with 95% intervals, the chance a run that
    has not succeeded yet still will, and where the time goes by subtask. Text-only counts come from its report."""
    s = json.loads((root / 'summary.json').read_text(encoding='utf8'))
    sub = json.loads((root / 'subtask.json').read_text(encoding='utf8'))
    est = lambda rows, key, names: [{'key': r[key], 'en': names[r[key]][0], 'zh': names[r[key]][1], 'share': float(r['est_share']),
                                     'lo': float(r['ci95_low'] or r['est_share']), 'hi': float(r['ci95_high'] or r['est_share'])}
                                    for r in rows if r[key] in names]
    c = s['curves']
    report = (root / 'report.md').read_text(encoding='utf8')
    facts = {  # each must match once in the report
        'trials': r'分析范围：([\d,]+) 个已结束试验',
        'sample_fail': r'共 (\d+) 个，由分析 agent 逐条读日志标注',
        'sample_break': r'随机抽 12 个，共 (\d+) 个，逐条标注突破方式',
        'error_time': r'连续报错的时间只占墙钟 ([\d.]+)%',
        'after_change_s': r'找到正确改变后，中位只需 (\d+) s 就成功',
        'fail_tuning': r'这段时间的 (\d+)% 是同一策略族反复调参',
        'after_last': r'失败试验平均把 (\d+)% 的墙钟花在最后一次进展之后',
        'snap': r'用 state snapshot 的 DexToolBench privileged 成功率 (\d+)%，不用为 (\d+)%',
        'persist_sim': r'RoboARC 常驻仿真 (\d+)% vs (\d+)%',
        'self_verify': r'BEHAVIOR (\d+)% 的成功做过这一步，失败中只有 (\d+)%',
        'look_first': r'先看证据再动手的成功率 (\d+)% vs (\d+)%',
        'ask_op': r'询问操作员 (\d+)% vs (\d+)%',
        'myo_local': r'standard MyoSuite 中 (\d+)/(\d+) 个试验装了本地副本，(\d+) 个成功中 (\d+) 个来自这些试验',
        'stop_loss': r'想省下 (\d+)% 的资源，就要丢掉 (\d+)% 的 core 成功',
        'argon_filter': r'Argon core 成功率因此会从 ([\d.]+)% 变成 ([\d.]+)%',
        'argon_filtered': r'Gemini 4 Argon 有 (\d+) 个试验被内容过滤中止',
        'late_success': r'core (\d+)% 的成功出现在 τ>0.5 之后',
    }
    f = {}
    for key, pat in facts.items():
        hits = re.findall(pat, report)
        if len(set(map(str, hits))) != 1:
            raise SystemExit(f'bottleneck {key}: pattern matched {hits!r}')
        h = hits[0] if isinstance(hits[0], tuple) else (hits[0],)
        f[key] = [float(x.replace(',', '')) if '.' in x else int(x.replace(',', '')) for x in h]
    return {
        'snapshot': s['generated'],
        'roots': est(s['calibration']['root_cause'], 'root_cause', ROOTS),
        'stages': {r['stuck_stage']: float(r['est_share']) for r in s['calibration']['stuck_stage']},
        'breaks': est(s['breakthrough']['breakthrough_primary'], 'breakthrough_primary', BREAKS),
        'eventual': {'taus': c['taus'], 'lines': [{'key': k, 'en': v[0], 'zh': v[1], 'p': c['p_eventual'][k], 'n': c['n'][k]}
                                                  for k, v in CURVES.items() if k in c['p_eventual']]},
        'subtasks': [{'key': r['code'], 'en': SUBTASKS[r['code']][0], 'zh': SUBTASKS[r['code']][1], 'time': r['time_share'],
                      'tok': r['tok_share'], 'stuck': r['stuck_pct'], 'ok': r['share_ok'], 'fail': r['share_fail']}
                     for r in sub['by_subtask'] if r['code'] in SUBTASKS],
        'facts': f,
    }


def repo_counts(root):
    """The exam in numbers, from the task repository itself: task dirs, the scenes they come from, benchmarks, the core
    set, and the distinct simulators and robots the tasks declare (docs/TAXONOMY.md)."""
    import tomllib
    dirs = [p for p in (root / 'tasks').glob('*/*') if (p / 'task.toml').is_file()]
    meta = [tomllib.loads((p / 'task.toml').read_text(encoding='utf8')).get('metadata', {}) for p in dirs]
    scene = lambda name: re.sub(r'-(standard-realtime|privileged|standard)$', '', name)
    core = sum(1 for line in (root / 'docs' / 'core_set.toml').read_text(encoding='utf8').splitlines() if line.startswith('[['))
    modes = [m.get('mode') for m in meta]
    return {'tasks': len(dirs), 'scenes': len({(p.parent.name, scene(p.name)) for p in dirs}), 'benchmarks': len({p.parent.name for p in dirs}),
            'core': core, 'simulators': len({m.get('simulator') for m in meta}), 'robots': len({m.get('robot') for m in meta}),
            'privileged': modes.count('privileged'), 'standard': modes.count('standard'), 'realtime': modes.count('standard-realtime')}


def where_we_are(db, root, run='codex-gpt6_astra-high'):
    """One agent's standing, from the results index (read-only): core tasks sat and solved, and the robots, benchmarks and
    simulators its solved tasks (all sets) span, by the task repository's own metadata."""
    import sqlite3
    import tomllib
    meta = {p.parent.name: tomllib.loads(p.read_text(encoding='utf8')).get('metadata', {}) | {'bench': p.parent.parent.name}
            for p in (root / 'tasks').glob('*/*/task.toml')}
    core = set(re.findall(r'"(?:[^"/]+/)?([^"/]+)"', '\n'.join(l for l in (root / 'docs' / 'core_set.toml').read_text(encoding='utf8').splitlines()
                                                              if re.match(r'\s*(task|dir)\s*=', l))))
    con = sqlite3.connect(f'file:{db}?mode=ro', uri=True)
    rows = con.execute("select task, state from cells where run=? and state in ('success','failed')", (run,)).fetchall()
    solved = [meta[t] for t, st in rows if st == 'success' and t in meta]
    sat_core = [st for t, st in rows if t in core]
    return {'run': run, 'core_sat': len(sat_core), 'core_solved': sat_core.count('success'), 'solved': len(solved), 'sat': len(rows),
            'robots': len({m.get('robot') for m in solved}), 'benchmarks': len({m['bench'] for m in solved}),
            'simulators': len({m.get('simulator') for m in solved})}


RUN_NAMES = {'codex-gpt6_astra-high': 'GPT-6 Astra · Codex', 'claude_code-opus_5_5-high': 'Claude Opus 5.5 · Claude Code',
             'antigravity_cli-gemini_4_argon-high': 'Gemini 4 Argon · Antigravity CLI', 'antigravity_cli-gemini_3_8_flash-high': 'Gemini 3.8 Flash · Antigravity CLI',
             'dsh-deepseek_v4_1_flash-high': 'DeepSeek V4.1 Flash · DeepSeek harness', 'claude_code-glm_5_3_flash-high': 'GLM-5.3 Flash · Claude Code',
             'codex-gpt6_luna-xhigh': 'GPT-6 Luna · Codex (reference run)'}


def overall(db, root):
    """Core-set results per run and mode from the results index: the latest graded trial of each core task dir
    (docs/core_set.toml); success = the verifier's pass. Runs with fewer than 100 graded core tasks are left out."""
    import sqlite3
    core = set(re.findall(r'"(?:[^"/]+/)?([^"/]+)"', '\n'.join(l for l in (root / 'docs' / 'core_set.toml').read_text(encoding='utf8').splitlines()
                                                              if re.match(r'\s*(task|dir)\s*=', l))))
    con = sqlite3.connect(f'file:{db}?mode=ro', uri=True)
    rows = con.execute("select run, task, mode, state from cells where state in ('success','failed')").fetchall()
    when = con.execute("select max(finished) from cells").fetchone()[0]
    out = {}
    for run, task, mode, state in rows:
        if task not in core or run not in RUN_NAMES:
            continue
        r = out.setdefault(run, {'run': run, 'name': RUN_NAMES[run], 'privileged': [0, 0], 'standard': [0, 0], 'standard-realtime': [0, 0]})
        r[mode][1] += 1
        r[mode][0] += state == 'success'
    res = [r | {'all': [sum(r[m][0] for m in ('privileged', 'standard', 'standard-realtime')), sum(r[m][1] for m in ('privileged', 'standard', 'standard-realtime'))]}
           for r in out.values()]
    res = sorted((r for r in res if r['all'][1] >= 100), key=lambda r: -r['all'][0] / r['all'][1])
    import datetime
    return {'snapshot': datetime.datetime.fromtimestamp(when, datetime.timezone.utc).strftime('%Y-%m-%d %H:%M UTC'), 'core': len(core), 'runs': res}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--analysis', required=True)
    ap.add_argument('--repo', help='the task repository checkout, for the exam in numbers')
    ap.add_argument('--db', help="the results index (batch_eval_live's trials.sqlite), for where the strongest agent stands; needs --repo")
    ap.add_argument('--bottleneck', help='the bottleneck atlas data folder (summary.json, subtask.json, report.md)')
    ap.add_argument('--out', default=str(Path(__file__).resolve().parent.parent / 'data' / 'blog.json'))
    a = ap.parse_args()
    d = load(a.analysis)
    F = {k: tables(v['html']) for k, v in d['findings'].items()}
    S = [tables(s['fig']) for s in d['summary']]
    out = {'snapshot': d['site']['snapshot'], 'set': d['site']['set'],
           'sample': {'trials': d['site']['n_trials'], 'valid': d['site']['n_valid'], 'analysed': d['site']['n_sample']},
           'agents': {k: {'en': v[0], 'zh': v[1], 'family': v[2]} for k, v in AGENTS.items()},
           'modes': {k: {'en': v[0], 'zh': v[1]} for k, v in MODES.items()}}

    # same tasks, both modes: the six agents that ran them all (finding 1.1)
    same = {}
    for metric, agent, val in S[0][0][1:]:
        same.setdefault(agent, {})['privileged' if metric.startswith('privileged') else 'standard'] = n(val)
    out['same_tasks'] = same

    # privileged success kept in standard, per agent, on tasks both modes ran (finding 1.3)
    out['kept'] = [{'agent': r[0], 'n': n(r[1]), 'both': n(r[2]), 'priv_only': n(r[3]), 'std_only': n(r[4]), 'neither': n(r[5])}
                   for r in F['1.3'][0][1:]]

    # where nobody succeeds, by task type and mode (finding 1.5); rows look like ['<type> · 合计 a/b', mode, 'x/y']
    nobody = {}
    for label, mode, val in F['1.5'][0][1:]:
        t = label.split(' · ')[0]
        key = 'all' if t == '全部任务' else t
        if key != 'all' and key not in TYPES:
            continue
        nobody.setdefault(key, {})[mode] = n(val)
    out['nobody'] = nobody
    out['types'] = {k: {'en': v[0], 'zh': v[1]} for k, v in TYPES.items()}

    # who decides each move, by mode (finding 2.1) and on the benchmarks that have realtime (finding 1.4)
    cols = ['code', 'direct', 'train', 'mixed', 'none']
    way = lambda rows: {r[0]: {'n': n(r[1]), **{c: n(v) for c, v in zip(cols, r[2:])}} for r in rows[1:]}
    out['ways'] = way(F['2.1'][0])
    out['ways_rt_benches'] = way(F['1.4'][0])

    # what lay behind a failure, per agent (summary figure of finding 4.1)
    lcols = ['thought', 'before', 'after', 'motor', 'external']
    out['layers'] = [{'agent': r[0], 'n': n(r[1]), **{c: n(v) for c, v in zip(lcols, r[2:])}} for r in S[1][0][1:]]
    out['layers_mode'] = {r[0]: {'n': n(r[1]), **{c: n(v) for c, v in zip(lcols, r[2:])}} for r in F['4.1'][0][1:]}

    # grasp failures of the three strongest agents (finding 4.2)
    out['grasp'] = [{'agent': r[0], 'n': n(r[1]), 'missed': n(r[2]), 'dropped': n(r[3]), 'other': n(r[4])}
                    for r in F['4.2'][0][1:] if r[0] in ('GPT-6 Astra', 'Gemini 4 Argon', 'Opus 5.5')]

    # the share of trials that had reached level 3 by each point of the time limit (finding 4.6, second table)
    reach = {}
    for label, outcome, cnt, *ps in F['4.6'][1][1:]:
        mode = label.split('（')[0]
        reach.setdefault(mode, {})['success' if outcome == '成功' else 'failure'] = {'n': n(cnt), 'at': [n(p) for p in ps]}
    out['reach3'] = {'at': [10, 25, 50, 75, 100], 'modes': reach}

    # the last level a failure reached, by mode (finding 4.6, first table)
    out['levels'] = {r[0]: {'n': n(r[1]), 'stay': n(r[2]), 'levels': [n(v) for v in r[3:9]]} for r in F['4.6'][0][1:]}

    # how failed trials ended, by mode (finding 4.5, third table)
    ecols = ['timeout', 'resets', 'delivered', 'stopped', 'goal', 'external']
    out['endings'] = {r[0]: {'n': n(r[1]), **{c: n(v) for c, v in zip(ecols, r[2:])}} for r in F['4.5'][2][1:]}

    # after the point of no return: stopped or kept going (finding 4.8)
    out['after_point'] = [{'agent': r[0], 'n': n(r[1]), 'left': n(r[2]), 'stopped': n(r[3]), 'kept': n(r[4])} for r in F['4.8'][0][1:]]

    # the final word on a failure, per agent (finding 3.6)
    ccols = ['claimed', 'honest', 'silent', 'mismatch', 'other']
    out['claims'] = [{'agent': r[0], 'n': n(r[1]), **{c: n(v) for c, v in zip(ccols, r[2:])}} for r in F['3.6'][0][1:]]

    # the one missing step (summary figure of finding 5.1)
    out['fixes'] = [{'key': r[0], 'en': FIXES[r[0]][0], 'zh': FIXES[r[0]][1], 'n': n(r[1]), 'likely': n(r[2]), 'possible': n(r[3]),
                     'unlikely': n(r[4])} for r in S[2][0][1:]]

    # counts the analysis states in its text rather than in a table; each pattern must match exactly once
    text = lambda k: html.unescape(re.sub('<[^>]+>', '', d['findings'][k]['html'] if '.' in k else d['summary'][int(k)]['html']))
    facts = {
        'pooled_priv': ('0', r'Luna 没过的评测项里，三家合计成功的/跑过的：privileged (\d+)/(\d+)'),
        'pooled_std': ('0', r'Luna 没过的评测项里，三家合计成功的/跑过的：privileged \d+/\d+（\d+%），standard (\d+)/(\d+)'),
        'rt_same_priv': ('1.4', r'成功的/有效 trial：privileged (\d+)/(\d+)'),
        'rt_same_std': ('1.4', r'成功的/有效 trial：privileged \d+/\d+（\d+%），standard (\d+)/(\d+)'),
        'rt_same_rt': ('1.4', r'standard \d+/\d+（\d+%），realtime (\d+)/(\d+)'),
        'clock_looked': ('1', r'看过时钟的 (\d+)/(\d+)'),
        'clock_planned': ('1', r'按剩余时间排了计划的 (\d+)/(\d+)'),
        'action_primary': ('1', r'主因是动作失误的 (\d+)/(\d+)'),
        'action_before': ('1', r'事前想错（想法先错，引出失误）的 (\d+)/(\d+)'),
        'action_after': ('1', r'事后没挽回（失误在先，没补救成）的 (\d+)/(\d+)'),
        'grasp_primary': ('1', r'主因是抓取/接触的 (\d+)/(\d+)'),
        'percept_std': ('1', r'主因属感知与接口的：standard (\d+)/(\d+)'),
        'percept_priv': ('1', r'主因属感知与接口的：standard \d+/\d+，privileged (\d+)/(\d+)'),
        'kept_going': ('1', r'继续做无用功的 (\d+)/(\d+)'),
        'noticed': ('1', r'agent 察觉了的 (\d+)/(\d+)'),
        'nr_priv': ('1', r'有不可挽回点的，privileged (\d+)/(\d+)'),
        'nr_std': ('1', r'有不可挽回点的，privileged \d+/\d+，standard (\d+)/(\d+)'),
        'nr_rt': ('1', r'standard \d+/\d+，realtime (\d+)/(\d+)'),
        'honest': ('3.6', r'如实说失败（最终消息明说没做成）(\d+)/(\d+)'),
        'claimed': ('3.6', r'声称成功但失败（说或暗示做成了）(\d+)/(\d+)'),
        'claimed_flash': ('3.6', r'Gemini 3.8 Flash (\d+)/(\d+)，其余八家'),
        'claimed_rest': ('3.6', r'其余八家 (\d+)/(\d+)'),
        'fix_possible': ('2', r'补上这一步很可能或可能成功的 (\d+)/(\d+)'),
        'fix_action': ('2', r'属抓取与接触、闭环与安全两组的 (\d+)/(\d+)'),
        'fix_thinking': ('2', r'属思考类四组的 (\d+)/(\d+)'),
    }
    out['facts'] = {
        'nobody_all': [sum(v[0] for v in out['nobody']['all'].values()), sum(v[1] for v in out['nobody']['all'].values())],
        'ways_priv_code': [out['ways']['privileged']['code'], out['ways']['privileged']['n']],
        'ways_std_direct': [out['ways']['standard']['direct'], out['ways']['standard']['n']],
        'ways_rt_code': [out['ways']['realtime']['code'], out['ways']['realtime']['n']],
    }
    for key, (src, pat) in facts.items():
        hits = re.findall(pat, text(src))
        if len(set(hits)) != 1:
            raise SystemExit(f'{key}: pattern matched {hits!r} in {src}')
        out['facts'][key] = [int(x) for x in hits[0]]

    if a.bottleneck:
        out['bottleneck'] = bottleneck(Path(a.bottleneck))
    if a.repo:
        out['repo'] = repo_counts(Path(a.repo))
    if a.db and a.repo:
        out['where'] = where_we_are(a.db, Path(a.repo))
        out['overall'] = overall(a.db, Path(a.repo))

    Path(a.out).write_text(json.dumps(out, ensure_ascii=False, indent=1) + '\n', encoding='utf8')
    print(f'wrote {a.out} (snapshot {out["snapshot"]}, set {out["set"]})')


if __name__ == '__main__':
    main()
