/* The blog's figures and numbers. The results are computed here from data/exam.json and data/tasks.json, the files the
   leaderboard reads, with the leaderboard's own rules (the core set; the latest finished attempt per model and test; only
   all the core tests of each setting, a test without a finished result counted as failed), so the blog and the site cannot disagree; task types come from data/atlas.json, as on
   the task pages. The figures follow the designs of our cross-benchmark analysis (same definitions, groupings, orderings
   and encodings), drawn from the site's data. data/blog.json (scripts/export_blog.py) adds the few numbers that exist only
   in the analysis's sample. Numbers in the text are <span data-s="key">, filled from the same computation; a key that
   starts with h_ carries a little markup (a count set smaller after its share). app.js draws the navigation, the footer and the
   Introduction's framework figure (the home page's). */

const BASE = new URL('../', import.meta.url).pathname;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
const int = (n) => Number(n || 0).toLocaleString('en-US');
const getJSON = (p) => fetch(BASE + p, { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`); return r.json(); });

const MODES = { p: 'privileged', s: 'standard', t: 'standard-realtime' };
const MODE_LABEL = { c: 'Core', p: 'Privileged', s: 'Standard', t: 'Standard-realtime' };
const MODE_CLS = { c: '', p: 'm-p', s: 'm-s', t: 'm-r' };
const TOP = ['codex-gpt6_astra-high', 'claude_code-opus_5_5-high', 'antigravity_cli-gemini_4_argon-high'];   // the three strongest
const AG = { [TOP[0]]: '--ag-astra', [TOP[1]]: '--ag-opus', [TOP[2]]: '--ag-argon' };                       // their colours
const agc = (r) => AG[r] || '--flash';
const MIN_BENCH = 5;   // a benchmark counts among the hardest or the easiest from this many tests in the setting
const HARD = 0.5, EASY_P = 0.7, EASY_S = 0.6;
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen'];
const nw = (n) => WORDS[n] || int(n);
// a share in plain words: about(0.66) = 'about two thirds'; moreThan(0.6) = 'more than half'
const FRACS = [[1 / 4, 'a quarter'], [1 / 3, 'a third'], [1 / 2, 'half'], [2 / 3, 'two thirds'], [3 / 4, 'three quarters'], [9 / 10, 'nine in ten']];
const about = (x) => { const [f, w] = FRACS.reduce((a, z) => (Math.abs(z[0] - x) < Math.abs(a[0] - x) ? z : a)); return Math.abs(f - x) <= 0.04 ? `about ${w}` : `${Math.round(100 * x)}%`; };
const moreThan = (x) => { const f = [...FRACS].reverse().find(([v]) => x > v); return f ? `more than ${f[1]}` : `${Math.round(100 * x)}%`; };
const list = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs[0] || '');
// Finding 4's groups of hard benchmarks, as the analysis groups them; a hard benchmark outside them is named after them
const HARD_GROUPS = [
  ['precise manipulation and assembly', ['dextoolbench', 'ikea', 'robopaint']],
  ['balance and fast dynamics', ['humanoidbench', 'pandadyn', 'myosuite']],
  ['long multi-step tasks', ['behavior-1k', 'robodojo']],
  ['reasoning before precise manipulation', ['roboarc']],
];

/* ---------------------------------------------------------------------------------------------- numbers */

/** Everything the article says about results, from the site's data. A test is one task in one setting. */
function compute(ex, tasks, b, atlas) {
  const runs = ex.leaderboard.shared.runs;
  const run = Object.fromEntries(ex.runs.map((r) => [r.id, r]));
  const name = (id) => run[id]?.model || id;
  const short = (id) => name(id).replace(/^Claude /, '');
  const core = tasks.filter((t) => t.set === 'core');
  const v = (t, r, m) => t.results?.[r]?.[m]?.s;
  const graded = (t, r, m) => v(t, r, m) === 'S' || v(t, r, m) === 'F';
  const ok = (t, r, m) => v(t, r, m) === 'S';
  // all the core tests of a setting, as [task, mode] pairs: the denominator is fixed and a test without a finished result
  // counts as failed (owners, 2026-10-19)
  const sat = (m) => core.filter((t) => (t.core || '').includes(m)).map((t) => [t, m]);
  const M = { p: sat('p'), s: sat('s'), t: sat('t') };
  const LB = [...M.s, ...M.t];   // standard and standard-realtime together
  // the leaderboard's default view, Core: each core task once, in its default mode
  const CORE = core.filter((t) => t.default && (t.core || '').includes(t.default)).map((t) => [t, t.default]);
  const solved = (L, r) => L.filter(([t, m]) => ok(t, r, m)).length;
  const anyOf = (L, rs = runs) => L.filter(([t, m]) => rs.some((r) => ok(t, r, m))).length;
  const board = runs.map((r) => ({ id: r, name: name(r), harness: run[r]?.harness || '', p: solved(M.p, r), s: solved(LB, r), c: solved(CORE, r) }))
    .sort((x, y) => y.c - x.c || y.p - x.p);
  const order = board.map((x) => x.id);   // every figure lists the agents in the leaderboard's order
  // the same task in two settings, per agent: tasks whose two tests are both in the core set (a missing result is a failure)
  const paired = (a, c) => order.map((r) => {
    const L = core.filter((t) => (t.core || '').includes(a) && (t.core || '').includes(c));
    return { id: r, name: name(r), n: L.length, a: L.filter((t) => ok(t, r, a)).length, c: L.filter((t) => ok(t, r, c)).length,
      both: L.filter((t) => ok(t, r, a) && ok(t, r, c)).length };
  });
  const ps = paired('p', 's'), st = paired('s', 't');
  const pr = (r) => ps.find((x) => x.id === r), sr = (r) => st.find((x) => x.id === r);
  const none3 = (L) => L.length - anyOf(L, TOP);
  const mean3 = (L) => L.reduce((a, [t, m]) => a + TOP.filter((r) => ok(t, r, m)).length, 0);   // solved by the three, summed
  const flash = runs.filter((r) => !TOP.includes(r));
  const ranked = (L) => [...runs].sort((x, y) => solved(L, y) - solved(L, x));
  const sameOrder = ['p', 's', 't'].every((k) => ranked(M[k]).slice(0, 3).join() === TOP.join());
  const sameOrderCore = sameOrder && ranked(CORE).slice(0, 3).join() === TOP.join();
  // the best Flash-class result in any setting, with its count
  const flashTop = flash.flatMap((r) => ['p', 's', 't'].map((k) => [solved(M[k], r), M[k].length])).reduce((a, x) => (x[0] / (x[1] || 1) > a[0] / (a[1] || 1) ? x : a), [0, 1]);
  const group = (L, keys) => { const g = {}; for (const x of L) for (const k of keys(x[0])) (g[k] ??= []).push(x); return g; };
  const ttOf = (t) => atlas?.tasks?.[`${t.suite}/${t.id}`]?.tt || [];
  // benchmarks as the analysis counts them: the IKEA assembly tasks (family ikea_*) apart from the rest of RoboARC
  const benchOf = (t) => [(t.family || '').startsWith('ikea_') ? 'ikea' : t.suite];
  const benchH = { p: group(M.p, benchOf), s: group(M.s, benchOf) };
  const suiteName = Object.fromEntries(ex.suites.map((x) => [x.id, x.name]));
  const benchName = (k) => (k === 'ikea' ? 'IKEA assembly' : suiteName[k] || k);
  const budgets = core.map((t) => t.budget_min).filter(Boolean);
  const dur = (min) => (min % 60 ? `${min} minutes` : `${['', 'one', 'two', 'three', 'four', 'five', 'six'][min / 60] || min / 60} hour${min > 60 ? 's' : ''}`);
  const cb = b.crossbench || {};
  const coreModes = (m) => core.filter((t) => (t.core || '').includes(m)).length;
  const P = (a, n) => `${pct(a, n)}%`, F = (a, n) => `${int(a)} of ${int(n)}`;
  const Q = (a, n) => `${a && !pct(a, n) ? '<1' : pct(a, n)}% (${int(a)}/${int(n)})`;
  const HQ = (a, n) => `${a && !pct(a, n) ? '&lt;1' : pct(a, n)}%<small class="cnt"> (${int(a)}/${int(n)})</small>`;
  const QL = (L, f) => Q(f(L || []), (L || []).length);
  const sample = (x) => (x ? Q(x[0], x[1]) : null);

  // the hardest and the easiest benchmarks (from MIN_BENCH tests in the setting)
  const benchRows = (k) => Object.entries(benchH[k]).filter(([, L]) => L.length >= MIN_BENCH)
    .map(([id, L]) => ({ id, L, n: L.length, none: none3(L), sum: mean3(L), per: TOP.map((r) => solved(L, r)) }));
  const hardRows = (k) => benchRows(k).sort((x, y) => y.none / y.n - x.none / x.n || y.n - x.n);
  const easyRows = (k) => benchRows(k).sort((x, y) => y.sum / y.n - x.sum / x.n || y.n - x.n);
  const hard = { p: hardRows('p').filter((r) => r.none / r.n >= HARD), s: hardRows('s').filter((r) => r.none / r.n >= HARD) };
  const easy = { p: easyRows('p').filter((r) => r.sum / (3 * r.n) >= EASY_P), s: easyRows('s').filter((r) => r.sum / (3 * r.n) >= EASY_S) };
  const hn = (r) => `${benchName(r.id)} ${Q(r.none, r.n)}`;
  // standard-realtime by benchmark (too few tests for the figures): the benchmarks with MIN_BENCH tests, hardest first
  const tRows = Object.entries(group(M.t, benchOf)).filter(([, L]) => L.length >= MIN_BENCH)
    .map(([id, L]) => ({ id, L, n: L.length, none: none3(L), sum: mean3(L) })).sort((x, y) => y.none / y.n - x.none / x.n || y.n - x.n);
  const em = (r) => `${benchName(r.id)} ${Q(r.sum, 3 * r.n)}`;
  const per = {};
  for (const k of ['p', 's']) for (const r of benchRows(k)) { per[`hn_${k}_${r.id}`] = Q(r.none, r.n); per[`em_${k}_${r.id}`] = Q(r.sum, 3 * r.n); }
  // Finding 4: the hard benchmarks under standard rules, in the analysis's groups, the others named after them
  const hardIds = new Set(hard.s.map((r) => r.id));
  const groups = HARD_GROUPS.map(([g, ids]) => [g, hard.s.filter((r) => ids.includes(r.id))]).filter(([, rs]) => rs.length);
  const inGroups = new Set(groups.flatMap(([, rs]) => rs.map((r) => r.id)));
  const rest = hard.s.filter((r) => !inGroups.has(r.id));
  const nIn = hard.s.length - rest.length;
  per.hard_groups = `${nIn === hard.s.length ? 'They' : `${nw(nIn)[0].toUpperCase()}${nw(nIn).slice(1)} of them`} fall into ${nw(groups.length)} groups (each percentage is the share of a benchmark’s tests that none of the three solves). ${groups.map(([g, rs]) => `${g[0].toUpperCase()}${g.slice(1)}: ${list(rs.map(hn))}.`).join(' ')}${rest.length ? ` The other ${nw(rest.length)} ${rest.length === 1 ? 'is' : 'are'} ${list(rest.map(hn))}.` : ''}`;
  per.hard_p_list = list(hard.p.map(hn));
  per.hard_s_frac = `${int(hard.s.length)} of ${int(benchRows('s').length)}`; per.hard_p_frac = `${int(hard.p.length)} of ${int(benchRows('p').length)}`;
  per.hard_s_word = nw(hard.s.length); per.hard_p_word = nw(hard.p.length);
  // Finding 5: the first benchmark spelled out in agent-attempts, the rest as rate (solved/attempts)
  const emLong = (r) => `${benchName(r.id)} ${pct(r.sum, 3 * r.n)}% (${int(r.sum)} of ${int(3 * r.n)} agent-attempts: ${int(r.n)} tests × 3 agents)`;
  per.easy_p_list = list(easy.p.map((r, i) => (i ? em(r) : emLong(r))));
  per.easy_p_frac = `${int(easy.p.length)} of ${int(benchRows('p').length)}`;
  per.easy_s_phrase = easy.s.length === 1 ? `only ${benchName(easy.s[0].id)}` : easy.s.length ? `${nw(easy.s.length)} benchmarks` : 'no benchmark';
  per.easy_s_list = easy.s.length ? list(easy.s.map(em)) : 'none';
  per.easy_s_claim = easy.s.length === 1 ? `only one benchmark reaches 60% or more: ${em(easy.s[0])}` : easy.s.length ? `${nw(easy.s.length)} benchmarks reach 60% or more: ${list(easy.s.map(em))}` : 'no benchmark reaches 60%';
  // the tests the core set left out (set easy): the three strongest agents' mean rate there, on the tests all six sat
  const easySet = tasks.filter((t) => t.set !== 'core');
  for (const k of ['p', 's']) {
    const L = easySet.filter((t) => (t.modes || []).includes(MODES[k]) && runs.every((r) => graded(t, r, k))).map((t) => [t, k]);
    per[`easy_set_${k}`] = `${pct(mean3(L), 3 * L.length)}% (${int(mean3(L))} of ${int(3 * L.length)} agent-attempts on ${int(L.length)} tests)`;
  }
  // Finding 1: in how many benchmarks (from MIN_BENCH tests in both settings) GPT-6 Astra solves a smaller share under standard rules
  const both = Object.keys(benchH.p).filter((k) => (benchH.p[k] || []).length >= MIN_BENCH && (benchH.s[k] || []).length >= MIN_BENCH);
  const lower = both.filter((k) => solved(benchH.s[k], TOP[0]) / benchH.s[k].length < solved(benchH.p[k], TOP[0]) / benchH.p[k].length);
  per.gap_bench = lower.length === both.length ? `every one of the ${int(both.length)}` : `${int(lower.length)} of the ${int(both.length)}`;
  // what each of the three solves alone: by task type (privileged for GPT-6 Astra, standard for the other two, as the
  // analysis reads it), and for GPT-6 Astra the benchmarks
  const rivals = (t, m) => ok(t, TOP[1], m) || ok(t, TOP[2], m);
  const only = (L, r) => L.filter(([t, m]) => ok(t, r, m) && !TOP.some((o) => o !== r && ok(t, o, m)));
  [['p', 0], ['s', 1], ['s', 2]].forEach(([k, i]) => {
    const L = only(M[k], TOP[i]);
    const by = (keys) => { const c = {}; for (const [t] of L) for (const x of keys(t)) c[x] = (c[x] || 0) + 1; return Object.entries(c).sort((a, z) => z[1] - a[1]); };
    const tt = by(ttOf), lab = (x) => (atlas?.taxonomy?.tt?.[x] || x).toLowerCase().replace(/ & /g, '/');
    per[`uniq_types_${i}`] = list(tt.slice(0, 2).map(([x]) => lab(x)));
    per[`uniq_list_${i}`] = list(tt.slice(0, 2).map(([x, n]) => `${lab(x)} (${n})`));
    per[`only_${i}`] = Q(L.length, M[k].length);
    if (i === 0) per.uniq_suites_0 = list(by((t) => [benchOf(t)[0]]).slice(0, 2).map(([x, n]) => `${benchName(x)} (${n})`));
  });
  const flashFill = (L) => L.filter(([t, m]) => !TOP.some((r) => ok(t, r, m)) && flash.some((r) => ok(t, r, m))).length;
  const allM = [...M.p, ...M.s, ...M.t];
  // what the tests on a running clock are: by benchmark, the two Embodied Olympics suites together
  const rtBy = {};
  for (const [t] of M.t) { const k = /^(embodied-olympics|roboolympics)-/.test(t.suite) ? 'Embodied Olympics' : suiteName[t.suite] || t.suite; rtBy[k] = (rtBy[k] || 0) + 1; }
  // a case's test: how many of the other agents solved it
  const task = (suite, id) => tasks.find((t) => t.suite === suite && t.id === id);
  const othersSolved = (suite, id, m, r) => { const t = task(suite, id); return t ? runs.filter((o) => o !== r && ok(t, o, m)).length : null; };
  const st3 = (r) => `${sr(r).a}→${sr(r).c}`;
  const mix = cb.approach_mix || {}, kinds = cb.approach_kinds || {};
  const train = ['p', 's', 't'].reduce((a, k) => a + (mix[k]?.train || 0), 0), sampled = ['p', 's', 't'].reduce((a, k) => a + (mix[k]?.n || 0), 0);
  const tot = ex.totals;
  const oracle = (k) => tasks.filter((t) => t.oracle === k).length;
  // Overall results: the Core view by task type (mean of the three strongest) and by suite (who leads)
  const ttLab = (x) => (atlas?.taxonomy?.tt?.[x] || x);
  const byT = {};
  for (const x of CORE) for (const k of ttOf(x[0])) (byT[k] ??= []).push(x);
  const tRank = Object.entries(byT).map(([k, L]) => ({ k, n: L.length, m: mean3(L) / (3 * L.length), a: solved(L, TOP[0]) / L.length,
    o: Math.max(solved(L, TOP[1]), solved(L, TOP[2])) / L.length })).sort((x, y) => y.m - x.m);
  const LOW = { 'deformable-fluid': 'deformable objects and fluids', locomotion: 'locomotion', 'precision-contact': 'precise contact', navigation: 'navigation and search' };
  const low = (k) => LOW[k] || ttLab(k).toLowerCase().replace(/ & /g, ' and ');
  const edge = [...tRank].sort((x, y) => (y.a - y.o) - (x.a - x.o)).slice(0, 2);
  const bySuite = {};
  for (const x of CORE) (bySuite[x[0].suite] ??= []).push(x);
  const suiteRows = Object.values(bySuite).filter((L) => L.length >= MIN_BENCH);
  const leads = (r) => suiteRows.filter((L) => runs.every((o) => solved(L, o) <= solved(L, r))).length;
  const S = {
    tasks: int(tot.instances), tests: int(tot.task_dirs), suites: int(tot.suites), robots: int(tot.robots), simulators: int(tot.simulators),
    core_tasks: int(tot.core_tasks), core_tests: int(tot.core_dirs), default_run: int(tot.default_run),
    core_p: int(coreModes('p')), core_s: int(coreModes('s')), core_t: int(coreModes('t')),
    oracle_full: int(oracle('full')), oracle_partial: int(oracle('partial')), oracle_none: int(oracle('none')),
    n_runs_lc: ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][runs.length] || int(runs.length),
    n_runs_word: ['None', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'][runs.length] || int(runs.length),
    np: int(M.p.length), ns_only: int(M.s.length), nt: int(M.t.length), ns: int(LB.length),
    best: board[0].name, best_s: `${int(board[0].s)}/${int(LB.length)}`, best_s_pct: P(board[0].s, LB.length),
    ...per,
    a_p: Q(solved(M.p, TOP[0]), M.p.length), a_s: Q(solved(M.s, TOP[0]), M.s.length), a_t: Q(solved(M.t, TOP[0]), M.t.length),
    h_a_p: HQ(solved(M.p, TOP[0]), M.p.length), h_a_s: HQ(solved(M.s, TOP[0]), M.s.length), h_a_t: HQ(solved(M.t, TOP[0]), M.t.length),
    order_note: sameOrder ? `The top three are the same in all three settings: ${list(TOP.map(name))}, in that order. The three Flash-class models trail far behind; their best result in any setting is ${Q(...flashTop)}.`
      : `The order of the top three changes from setting to setting. The three Flash-class models trail far behind; their best result in any setting is ${Q(...flashTop)}.`,
    budget_lo: dur(Math.min(...budgets)), budget_hi: dur(Math.max(...budgets)),
    none6_p: `${int(M.p.length - anyOf(M.p))} of ${int(M.p.length)} privileged (${P(M.p.length - anyOf(M.p), M.p.length)})`,
    none6_s: `${int(M.s.length - anyOf(M.s))} of ${int(M.s.length)} standard (${P(M.s.length - anyOf(M.s), M.s.length)})`,
    none6_t: `${int(M.t.length - anyOf(M.t))} of the ${int(M.t.length)} standard-realtime tests (${P(M.t.length - anyOf(M.t), M.t.length)})`,
    ap_p: sample(cb.approach?.p), ap_s: sample(cb.approach?.s),
    ap_t_code: mix.t ? Q(mix.t.code, mix.t.n) : null, ap_t_closed: kinds.t ? `${int(kinds.t.closed)} of the ${int(mix.t?.code)}` : null,
    h_ap_p: cb.approach?.p ? HQ(...cb.approach.p) : null, h_ap_s: cb.approach?.s ? HQ(...cb.approach.s) : null, h_ap_t: mix.t ? HQ(mix.t.code, mix.t.n) : null,
    ap_train: F(train, sampled),
    cb_sample: cb.sample == null ? null : int(cb.sample), cb_snapshot: (cb.snapshot || '').slice(0, 10) || null,
    u_p_any: QL(M.p, (L) => anyOf(L, TOP)), u_p_astra: QL(M.p, (L) => solved(L, TOP[0])),
    u_s_any: QL(M.s, (L) => anyOf(L, TOP)), u_s_astra: QL(M.s, (L) => solved(L, TOP[0])),
    u_s_extra: int(anyOf(M.s, TOP) - solved(M.s, TOP[0])),
    astra_cover_p: Q(solved(M.p, TOP[0]), anyOf(M.p, TOP)), h_astra_cover_p: HQ(solved(M.p, TOP[0]), anyOf(M.p, TOP)),
    flash_rate: Q(flash.reduce((a, r) => a + solved(allM, r), 0), flash.length * allM.length), astra_rate: Q(solved(allM, TOP[0]), allM.length),
    ff_p: F(flashFill(M.p), none3(M.p)), ff_s: F(flashFill(M.s), none3(M.s)),
    ps_astra_keep: `${int(pr(TOP[0]).both)} of the ${int(pr(TOP[0]).a)}`,
    ps_n: int(Math.max(...ps.map((r) => r.n))), ps_n_lo: int(Math.min(...ps.map((r) => r.n))), ps_n_hi: int(Math.max(...ps.map((r) => r.n))),
    st_n: int(Math.max(...st.map((r) => r.n))), st_astra: st3(TOP[0]), st_opus: st3(TOP[1]), st_argon: st3(TOP[2]),
    rt_mix: Object.entries(rtBy).sort((a, z) => z[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', '),
    dusty_s_others: (() => { const n = othersSolved('maniguard', 'dusty_transfer_i03', 's', TOP[0]); return n == null ? null : `${nw(n)} other agent${n === 1 ? '' : 's'}`; })(),
    built: (ex.build?.at || '').slice(0, 10),
    // plain words for the headings: the best agent's standard failure share, what every agent loses without privileged
    // access, and the leaderboard's Core view for the overall results
    a_s_fail_word: about(1 - solved(M.s, TOP[0]) / (M.s.length || 1)),
    ps_lose_all: moreThan(Math.min(...ps.filter((x) => x.a).map((x) => (x.a - x.both) / x.a))),
    ps_lose_n: ps.filter((x) => x.a).length === runs.length ? 'every agent' : `each of the ${nw(ps.filter((x) => x.a).length)} agents that solves any`,
    ps_astra_a: int(pr(TOP[0]).a), ps_astra_both: int(pr(TOP[0]).both),
    core_top3: list(board.slice(0, 3).map((x) => `${x.name} at ${Q(x.c, CORE.length)}`)),
    core_rest_max: Q(Math.max(...board.slice(3).map((x) => x.c)), CORE.length),
    // the Introduction: each core task's default setting
    def_s: int(CORE.filter(([, m]) => m === 's').length), def_t: int(CORE.filter(([, m]) => m === 't').length),
    // Finding 1: the other two strongest agents, standard and standard-realtime; the three together
    o_s: Q(solved(M.s, TOP[1]), M.s.length), o_t: Q(solved(M.t, TOP[1]), M.t.length),
    g_s: Q(solved(M.s, TOP[2]), M.s.length), g_t: Q(solved(M.t, TOP[2]), M.t.length),
    m3_s: Q(mean3(M.s), 3 * M.s.length), m3_t: Q(mean3(M.t), 3 * M.t.length),
    a_t_cmp: (() => { const d = pct(solved(M.t, TOP[0]), M.t.length) - pct(solved(M.s, TOP[0]), M.s.length);
      return Math.abs(d) <= 2 ? 'about the same share as in standard mode' : d < 0 ? 'a smaller share than in standard mode' : 'a larger share than in standard mode'; })(),
    // Finding 2: what GPT-6 Astra solves of the tests its two rivals solve, per setting
    rival_p: Q(M.p.filter(([t, m]) => ok(t, TOP[0], m) && rivals(t, m)).length, M.p.filter(([t, m]) => rivals(t, m)).length),
    rival_p_n: int(M.p.filter(([t, m]) => rivals(t, m)).length),
    rival_s_extra: int(M.s.filter(([t, m]) => !ok(t, TOP[0], m) && rivals(t, m)).length),
    rival_t_extra: int(M.t.filter(([t, m]) => !ok(t, TOP[0], m) && rivals(t, m)).length),
    rival_t: Q(M.t.filter(([t, m]) => ok(t, TOP[0], m) && rivals(t, m)).length, M.t.filter(([t, m]) => rivals(t, m)).length),
    // Finding 3: the share of its privileged successes each agent fails in standard mode, lowest and highest
    ...(() => { const L = ps.filter((x) => x.a).map((x) => ({ n: x.name, v: pct(x.a - x.both, x.a) }));
      const lo = Math.min(...L.map((x) => x.v)), hi = Math.max(...L.map((x) => x.v));
      return { ps_lose_lo: `${lo}%`, ps_lose_hi: `${hi}%`, ps_lose_lo_who: list(L.filter((x) => x.v === lo).map((x) => x.n)), ps_lose_hi_who: list(L.filter((x) => x.v === hi).map((x) => x.n)) }; })(),
    // Finding 4: in privileged mode, the hardest benchmarks past the cut and the two after it; standard-realtime by benchmark
    hard_p_more: list(hardRows('p').filter((r) => r.none / r.n < HARD).slice(0, 2).map(hn)),
    hard_p_more_in: hardRows('p').filter((r) => r.none / r.n < HARD).slice(0, 2).every((r) => HARD_GROUPS.some(([, ids]) => ids.includes(r.id))) ? 'also come from these groups' : 'come from other groups',
    hard_t_list: list(tRows.map(hn)), hard_t_n: nw(tRows.length),
    // Finding 5: the best standard-realtime benchmark by the three's mean success rate
    easy_t_best: tRows.length ? em([...tRows].sort((x, y) => y.sum / y.n - x.sum / x.n)[0]) : 'none',
    // Finding 6: closed-loop programs among all sampled standard-realtime attempts; the kinds of privileged program
    ap_t_closed_all: kinds.t && mix.t ? Q(kinds.t.closed, mix.t.n) : null,
    ap_p_kinds: kinds.p ? `${int(kinds.p.closed)} closed-loop, ${int(kinds.p.open)} open-loop and ${int(kinds.p.search)} parameter searches` : null,
    types_best: low(tRank[0].k), types_worst: list(tRank.slice(-2).reverse().map((x) => low(x.k))),
    types_edge: list(edge.map((x) => `${low(x.k)} (${pct(x.a * x.n, x.n)}% against at most ${pct(x.o * x.n, x.n)}% for the other two)`)),
    suites_n: int(suiteRows.length), suites_astra: int(leads(TOP[0])), suites_opus: int(leads(TOP[1])), suites_argon: int(leads(TOP[2])),
    views_note: sameOrderCore ? 'The three keep this order in all four views' : 'The order of the three changes between views',
  };
  return { S, M: { ...M, c: CORE }, LB, board, order, ps, st, mix, kinds, benchRows, hardRows, easyRows, benchName, tags: cb.bench_tags || {},
    none3, mean3, name, short, ok, solved, flash, ttOf, ttLab: (x) => atlas?.taxonomy?.tt?.[x] || x, suiteName };
}

function fill(S) {
  $$('[data-s]').forEach((el) => {
    const k = el.dataset.s, v = S[k];
    if (v == null) el.textContent = '?';
    else if (k.startsWith('h_')) el.innerHTML = v;
    else el.textContent = v;
  });
}

/* --------------------------------------------------------------------------------------------- figures */

/** A figure's head, as in the analysis: what it shows in one sentence, what it is, how to read it. */
const cap1 = (x) => `${x[0].toUpperCase()}${x.slice(1)}`.replace(/\.?\s*$/, '.');
/** A figure's caption, under it as in a paper: what it shows, the finding in one sentence, how to read it. */
const head = (say, cap, how) => `<p class="fig-cap"><span class="fc-t">${cap1(cap)}</span> ${say}${how ? ` ${cap1(how)}` : ''}</p>`;
const sw = (c, extra = '') => `<i class="sw${extra}" style="background:${c.startsWith('--') ? `var(${c})` : c}"></i>`;
/** The numbers behind a figure, folded under it (a table scrolls sideways on a narrow screen). */
const numbers = (heads, rows) => `<details class="nums"><summary>The numbers</summary><div class="tscroll"><table class="nt"><thead><tr>${heads.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
  <tbody>${rows.map((r) => `<tr>${r.map((c, i) => (i ? `<td>${c}</td>` : `<th scope="row">${c}</th>`)).join('')}</tr>`).join('')}</tbody></table></div></details>`;
const frac = (a, n) => `${int(a)}/${int(n)}`;
const agentLegend = (R) => `<div class="legend">${TOP.map((r) => `<span>${sw(AG[r])}${esc(R.name(r))}</span>`).join('')}<span>${sw('--flash')}The three Flash-class models</span></div>`;

/* Overall results: every agent in its own colour, the three Flash-class models in three greys */
const FLASH_O = [1, 0.62, 0.36];
const colOf = (R, r) => (TOP.includes(r) ? { c: `var(${AG[r]})`, o: 1 } : { c: 'var(--flash)', o: FLASH_O[R.flash.indexOf(r)] ?? 1 });
const legend6 = (R) => `<div class="legend">${R.order.map((r) => { const k = colOf(R, r);
  return `<span><i class="sw" style="background:${k.c};opacity:${k.o}"></i>${esc(R.name(r))}</span>`; }).join('')}</div>`;

/** Figure 7: grouped bars, one group per view (Core, then each setting), one bar per agent. */
function figModes(el, R) {
  const V = ['c', 'p', 's', 't'], lead = R.order[0], N = R.order.length;
  const W = 760, H = 300, L = 34, B = 46, T = 16, gw = (W - L - 8) / V.length, bw = Math.min(18, (gw - 22) / N), top = 80;
  const y = (v) => T + (H - T - B) * (1 - v / top);
  let svg = '';
  for (let g = 0; g <= top; g += 20) svg += `<line x1="${L}" x2="${W - 4}" y1="${y(g)}" y2="${y(g)}" class="gl"/><text x="${L - 6}" y="${y(g) + 3.5}" class="ax" text-anchor="end">${g}%</text>`;
  V.forEach((k, gi) => {
    const n = R.M[k].length, x0 = L + gi * gw + (gw - N * bw - (N - 1) * 3) / 2;
    R.order.forEach((r, i) => {
      const s = R.solved(R.M[k], r), v = n ? (100 * s) / n : 0, x = x0 + i * (bw + 3), c = colOf(R, r);
      svg += `<rect x="${x}" y="${y(v)}" width="${bw}" height="${Math.max(0.5, y(0) - y(v))}" rx="2" style="fill:${c.c};opacity:${c.o}"><title>${esc(`${R.name(r)} · ${MODE_LABEL[k]}: ${s} of ${n} (${pct(s, n)}%)`)}</title></rect>`;
      if (TOP.includes(r) || v >= 3) svg += `<text x="${x + bw / 2}" y="${y(v) - 4}" class="bv" text-anchor="middle">${pct(s, n)}</text>`;
    });
    svg += `<text x="${L + gi * gw + gw / 2}" y="${H - B + 18}" class="gx ${MODE_CLS[k]}" text-anchor="middle">${MODE_LABEL[k]}</text>`
      + `<text x="${L + gi * gw + gw / 2}" y="${H - B + 33}" class="ax" text-anchor="middle">${int(n)} tests</text>`;
  });
  const leads = V.every((k) => R.order.every((r) => R.solved(R.M[k], r) <= R.solved(R.M[k], lead)));
  el.innerHTML = head(leads ? `${R.name(lead)} leads in the Core view and in every setting, and every agent solves by far its largest share of tests in privileged mode.` : `${R.name(lead)} leads in the Core view.`,
    'Success rate of each agent on the core set, in the Core view and in each setting',
    'each bar is the share of a view’s tests that one agent solved (the number on top is the percentage). Core counts each core task once, in its default setting; the other three count every core test of one setting.')
    + legend6(R) + `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Success rate by agent and setting">${svg}</svg></div>`
    + numbers(['Agent', ...V.map((k) => MODE_LABEL[k])], R.order.map((r) => [esc(R.name(r)), ...V.map((k) => `${pct(R.solved(R.M[k], r), R.M[k].length)}% · ${frac(R.solved(R.M[k], r), R.M[k].length)}`)]));
}

/** Figure 8: a radar of the Core view by task type, one outline per agent. */
function figTypes(el, R) {
  const by = {};
  for (const [t, m] of R.M.c) for (const x of R.ttOf(t)) (by[x] ??= []).push([t, m]);
  const axes = Object.entries(by).sort((a, z) => z[1].length - a[1].length).map(([x]) => x);
  const val = (r, x) => (100 * R.solved(by[x], r)) / by[x].length;
  const top = Math.max(10, Math.ceil(Math.max(...R.order.flatMap((r) => axes.map((x) => val(r, x)))) / 10) * 10);
  const S = 460, cx = S / 2, cy = S / 2 + 4, rad = 150, n = axes.length;
  const pt = (i, v) => { const a = -Math.PI / 2 + (2 * Math.PI * i) / n; return [cx + rad * (v / top) * Math.cos(a), cy + rad * (v / top) * Math.sin(a)]; };
  let svg = '';
  for (let g = 10; g <= top + 1e-9; g += 10) svg += `<polygon points="${axes.map((_, i) => pt(i, g).join(',')).join(' ')}" class="gl"/>`
    + `<text x="${cx + 3}" y="${pt(0, g)[1] - 3}" class="ax">${Math.round(g)}%</text>`;
  axes.forEach((x, i) => { const [ex, ey] = pt(i, top), [lx, ly] = pt(i, top * 1.17);
    svg += `<line x1="${cx}" y1="${cy}" x2="${ex}" y2="${ey}" class="gl"/>`
      + `<text x="${lx}" y="${ly}" class="rl" text-anchor="${Math.abs(lx - cx) < 8 ? 'middle' : lx > cx ? 'start' : 'end'}" dominant-baseline="middle">${esc(R.ttLab(x))}<tspan class="ax"> ${by[x].length}</tspan></text>`; });
  [...R.order].reverse().forEach((r) => { const c = colOf(R, r), top3 = TOP.includes(r);
    svg += `<polygon points="${axes.map((x, i) => pt(i, val(r, x)).join(',')).join(' ')}" style="stroke:${c.c};fill:${top3 ? c.c : 'none'};opacity:${c.o}" class="rp${top3 ? '' : ' fl'}"><title>${esc(R.name(r))}</title></polygon>`; });
  el.innerHTML = head(`The three strongest agents do best on ${R.S.types_best} and worst on ${R.S.types_worst}.`,
    'Success rate in the Core view by task type',
    'each axis is one task type (with its number of core tasks; a task can have several types), and each outline is one agent. Further from the center is better.')
    + legend6(R) + `<div class="chart radar"><svg viewBox="0 0 ${S} ${S}" role="img" aria-label="Success rate by task type">${svg}</svg></div>`
    + numbers(['Task type', ...R.order.map((r) => esc(R.short(r)))], axes.map((x) => [`${esc(R.ttLab(x))} (${by[x].length})`, ...R.order.map((r) => `${Math.round(val(r, x))}%`)]));
}

const HEAT_NAME = (n) => n.replace(/^GPT-6 /, '').replace(/^Claude /, '').replace(/^Gemini 4 /, '').replace(/^Gemini 3\.8 Flash$/, 'Gem. Flash').replace(/ V4\.1 Flash$/, '').replace(/ 5\.3 Flash$/, '');
/** Figure 9: a heatmap of the Core view, one row per suite (suites with fewer than MIN_BENCH core tasks together), one column per agent. */
function figSuites(el, R) {
  const g = {};
  for (const [t, m] of R.M.c) (g[t.suite] ??= []).push([t, m]);
  const big = Object.entries(g).filter(([, L]) => L.length >= MIN_BENCH), small = Object.entries(g).filter(([, L]) => L.length < MIN_BENCH);
  const mean = (L) => TOP.reduce((a, r) => a + R.solved(L, r), 0) / (3 * L.length);
  const rows = big.sort((a, z) => mean(z[1]) - mean(a[1]) || z[1].length - a[1].length).map(([id, L]) => [esc(R.suiteName[id] || id), L]);
  if (small.length) rows.push([`Other suites <small>(${small.length})</small>`, small.flatMap(([, L]) => L)]);
  const cell = (L, r) => { const s = R.solved(L, r), v = pct(s, L.length);
    return `<td style="--v:${v}" class="${v >= 50 ? 'hi' : ''}" title="${esc(`${R.name(r)}: ${s} of ${L.length}`)}">${v}</td>`; };
  el.innerHTML = head(`The leader changes from suite to suite: of the ${R.S.suites_n} suites with at least five core tasks, GPT-6 Astra leads or ties in ${R.S.suites_astra}, Claude Opus 5.5 in ${R.S.suites_opus} and Gemini 4 Argon in ${R.S.suites_argon}.`,
    'Success rate in the Core view by suite and agent (%)',
    'each row is a suite with its number of core tasks, sorted by the mean of the three strongest agents; deeper blue is higher. Suites with fewer than five core tasks are grouped as Other.')
    + `<div class="tscroll"><table class="heat"><thead><tr><th>Suite</th>${R.order.map((r) => `<th title="${esc(R.name(r))}">${esc(HEAT_NAME(R.name(r)))}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(([nm, L]) => `<tr><th scope="row">${nm} <small>${L.length}</small></th>${R.order.map((r) => cell(L, r)).join('')}</tr>`).join('')}</tbody></table></div>`;
}

/** Finding 2 (the analysis's figure 1.2): a waffle per setting, each cell about 1% of the tests, coloured by which of the
 *  three strongest solved it (a cell split in two colours: those two); above it, each agent's solved count. */
function figOverlap(el, R) {
  const [A, O, G] = TOP, nm = (r) => R.name(r).split(' ').pop() === '5.5' ? 'Opus' : R.name(r).split(' ').pop();   // Astra, Opus, Argon, as the analysis names them
  const cats = [['k', 'All three', 'var(--top)'], ['ao', `${nm(A)} + ${nm(O)}`, [A, O]], ['ag', `${nm(A)} + ${nm(G)}`, [A, G]], ['a', `Only ${nm(A)}`, `var(${AG[A]})`],
    ['go', `${nm(G)} + ${nm(O)}`, [G, O]], ['o', `Only ${nm(O)}`, `var(${AG[O]})`], ['g', `Only ${nm(G)}`, `var(${AG[G]})`], ['z', 'None of the three', 'var(--wf-none)']];
  const bg = (c) => (Array.isArray(c) ? `linear-gradient(135deg, var(${AG[c[0]]}) 0 50%, var(${AG[c[1]]}) 50% 100%)` : c);
  const key = (t, m) => { const s = TOP.map((r) => R.ok(t, r, m)); return s[0] && s[1] && s[2] ? 'k' : s[0] && s[1] ? 'ao' : s[0] && s[2] ? 'ag' : s[0] ? 'a'
    : s[1] && s[2] ? 'go' : s[1] ? 'o' : s[2] ? 'g' : 'z'; };
  const counts = {};
  for (const k of ['p', 's', 't']) { counts[k] = Object.fromEntries(cats.map(([c]) => [c, 0])); for (const [t, m] of R.M[k]) counts[k][key(t, m)] += 1; }
  // 100 cells by the largest remainder, so each panel has exactly 100
  const cells = (k) => {
    const n = R.M[k].length, raw = cats.map(([c]) => (100 * counts[k][c]) / (n || 1)), fl = raw.map(Math.floor);
    let left = 100 - fl.reduce((a, x) => a + x, 0);
    raw.map((x, i) => [x - fl[i], i]).sort((a, z) => z[0] - a[0]).forEach(([, i]) => { if (left > 0 && raw[i] > 0) { fl[i] += 1; left -= 1; } });
    return cats.map(([c, l, col], i) => Array.from({ length: fl[i] }, () => `<i style="background:${bg(col)}" title="${esc(`${l}: ${counts[k][c]} of ${n} tests`)}"></i>`).join('')).join('');
  };
  const panel = (k) => { const n = R.M[k].length;
    return `<div class="wf"><p class="hb-t ${MODE_CLS[k]}">${MODE_LABEL[k]} <small>· ${int(n)} tests</small></p>${TOP.map((r) => { const s = R.solved(R.M[k], r);
      return `<div class="wf-ag"><span>${esc(R.short(r))}</span><span class="trk"><span style="width:${n ? (100 * s) / n : 0}%;background:var(${AG[r]})"></span></span><b>${int(s)}</b></div>`; }).join('')}
      <div class="wf-grid" role="img" aria-label="${esc(`${MODE_LABEL[k]}: ${cats.map(([c, l]) => `${l} ${counts[k][c]}`).join(', ')}`)}">${cells(k)}</div></div>`; };
  el.innerHTML = head('In privileged mode, GPT-6 Astra solves almost every test that any of the three solves; in standard mode, the other two each solve some tests that it fails.',
    'Which of the three strongest agents solved each test (all the core tests of each setting)', 'each cell is about 1% of a setting’s tests; its color shows which of the three solved it, and a cell split in two colors means two of them did.')
    + `<div class="wf-key"><table><thead><tr><th></th><th class="m-p">Privileged</th><th class="m-s">Standard</th><th class="m-r">Standard-realtime</th></tr></thead><tbody>${cats.map(([c, l, col]) =>
      `<tr><th scope="row"><i class="sw" style="background:${bg(col)}"></i>${esc(l)}</th>${['p', 's', 't'].map((k) => `<td>${int(counts[k][c])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
    + `<div class="wfs">${['p', 's', 't'].map(panel).join('')}</div>`;
}

/** Finding 3 (the analysis's figure 1.3): per agent, the tasks with both a privileged and a standard test, by the outcome
 *  of the two: solved in both, only with privileged access, only under standard rules, in neither. */
function figPaired(el, R) {
  const segs = [['both', 'Solved in both', 'var(--top)'], ['onlyP', 'Only in privileged mode', 'var(--priv)'], ['onlyS', 'Only in standard mode', 'var(--std)'], ['neither', 'In neither', 'var(--wf-none)']];
  const rows = R.ps.map((r) => ({ id: r.id, name: r.name, n: r.n, both: r.both, onlyP: r.a - r.both, onlyS: r.c - r.both, neither: r.n - r.a - r.c + r.both }));
  el.innerHTML = head('Every agent solves far more tasks only in privileged mode than only in standard mode.',
    'The same task in two settings: each agent’s outcome on the tasks that have both a privileged and a standard test',
    `each row is one agent on the ${R.S.ps_n} core tasks that have both tests; each segment is the share of tasks with that pair of outcomes.`)
    + `<div class="legend">${segs.map(([k, l, c]) => `<span>${sw(c)}${esc(l)}</span>`).join('')}</div>`
    + `<div class="sb">${rows.map((r) => `<div class="sb-row"><span class="who">${esc(r.name)}</span><span class="sb-trk">${segs.map(([k, l, c]) => (r[k]
      ? `<span style="flex:${r[k]} 1 0;background:${c}" title="${esc(`${r.name} · ${l}: ${r[k]} of ${r.n} tasks`)}">${(100 * r[k]) / r.n >= 9 ? `<em${k === 'neither' ? ' class="dk"' : ''}>${r[k]}</em>` : ''}</span>` : '')).join('')}</span><span class="n">${int(r.n)}</span></div>`).join('')}
      <div class="sb-row ax"><span></span><span class="sb-ticks"><i style="left:0">0%</i><i style="left:50%">50%</i><i style="left:100%">100%</i></span><span class="n">tasks</span></div></div>`
    + numbers(['Agent', 'Both', 'Only privileged', 'Only standard', 'Neither', 'Tasks'], rows.map((r) => [esc(r.name), r.both, r.onlyP, r.onlyS, r.neither, r.n]));
}

/** Finding 1's strip (the analysis's head bars of 1.3): the three strongest agents' solved tests, summed, per setting. */
function figSteps(el, R) {
  el.innerHTML = `<div class="steps3">${['p', 's', 't'].map((k) => { const n = 3 * R.M[k].length, s = R.mean3(R.M[k]);
    return `<div class="${k === 't' ? 'r' : k}"><b>${pct(s, n)}%</b><span>${MODE_LABEL[k]} · ${int(s)}/${int(n)}</span><span class="trk"><span style="width:${n ? (100 * s) / n : 0}%"></span></span></div>`; }).join('')}</div>
    <p class="fig-note">The three strongest agents’ mean success rate: their solved tests added up ÷ (3 × the setting’s core tests), in agent-attempts.</p>`;
}

/** Findings 4 and 5 (the analysis's figures 1.4 and 1.5): a dot plot per setting, one row per benchmark (from MIN_BENCH
 *  tests), a dot per strongest agent at its success rate and a line across their range; on the right a bar with the
 *  ranking value (4: tests none of the three solves; 5: their mean success rate). Rows past the cut, then the next one
 *  under a dashed line. */
function dotPlots(el, R, o) {
  const panel = (k) => {
    const all = o.rows(k), past = all.filter((r) => o.past(k, r)), next = all.find((r) => !o.past(k, r));
    const shown = next ? [...past, next] : past;
    const row = (r, i) => {
      const xs = TOP.map((a, j) => ({ a, x: (100 * r.per[j]) / r.n })), lo = Math.min(...xs.map((d) => d.x)), hi = Math.max(...xs.map((d) => d.x));
      const [vv, vn] = o.value(r);
      return `${i === past.length && next ? `<div class="dp-cut"><span>${esc(o.cutLabel(k))}</span></div>` : ''}<div class="dp-row">`
        + `<span class="who"><b>${esc(R.benchName(r.id))}</b>${R.tags[r.id] ? `<small>${esc(R.tags[r.id])}</small>` : ''}</span>`
        + `<span class="dp-trk"><i class="gl" style="left:0"></i><i class="gl" style="left:25%"></i><i class="gl" style="left:50%"></i><i class="gl" style="left:75%"></i><i class="gl" style="left:100%"></i>`
        + `<span class="rng" style="left:${lo}%;width:${hi - lo}%"></span>${xs.sort((a, z) => z.x - a.x).map((d) => `<i class="dpd" style="left:${d.x}%;background:var(${AG[d.a]})" title="${esc(`${R.name(d.a)} · ${R.benchName(r.id)}: ${r.per[TOP.indexOf(d.a)]} of ${r.n} solved`)}"></i>`).join('')}</span>`
        + `<span class="dp-v" title="${esc(`${o.valueName} · ${R.benchName(r.id)}: ${vv} of ${vn}`)}"><span class="trk"><span style="width:${(100 * vv) / vn}%"></span></span><small>${o.valueText(vv, vn)}</small></span></div>`;
    };
    return `<div class="dp ${k}"><p class="dp-h ${MODE_CLS[k]}">${MODE_LABEL[k]}</p><div class="dp-row dp-head"><span></span><span></span><span class="dp-v"><small>${esc(o.valueName)}</small></span></div>${shown.map(row).join('')}
      <div class="dp-row dp-ax"><span></span><span class="dp-trk"><i style="left:0">0</i><i style="left:25%">25</i><i style="left:50%">50</i><i style="left:75%">75</i><i style="left:100%">100%</i></span><span></span></div></div>`;
  };
  el.innerHTML = head(o.say, o.cap, o.how) + `<div class="legend">${TOP.map((r) => `<span>${sw(AG[r], ' dotk')}${esc(R.name(r))}</span>`).join('')}<span><i class="sw barkey"></i>${esc(o.valueName)} (right)</span></div>`
    + `<div class="dps">${panel('p')}${panel('s')}</div><p class="fig-note">${o.note}</p>`
    + numbers(['Benchmark', 'Setting', 'Tests', ...TOP.map((r) => esc(R.short(r))), o.valueName], ['p', 's'].flatMap((k) => o.rows(k).map((r) => [esc(R.benchName(r.id)), MODE_LABEL[k], r.n, ...r.per, `${o.valueText(...o.value(r))}`])));
}

function figHard(el, R) {
  dotPlots(el, R, {
    rows: (k) => R.hardRows(k), past: (k, r) => r.none / r.n >= HARD, value: (r) => [r.none, r.n], valueName: 'None of the three solves',
    valueText: (a, n) => `${a}/${n}`, cutLabel: () => 'below half',
    say: `In privileged mode, ${R.S.hard_p_word} ${R.S.hard_p_word === 'one' ? 'benchmark has' : 'benchmarks have'} at least half their tests solved by none of the three; in standard mode, ${R.S.hard_s_word}.`,
    cap: 'Success rate of each of the three strongest agents, by benchmark (all the core tests of the setting)',
    how: 'each dot is one agent’s share of a benchmark’s tests; the gray bar on the right is the share that none of the three solves.',
    note: `Hardest first. Only benchmarks with at least ${MIN_BENCH} tests in the setting. Each column lists the benchmarks with at least half their tests solved by none of the three, then the next one below the dashed line. The small label under each name is the kind of task. The IKEA assembly tasks are counted separately from the rest of RoboARC.`,
  });
}

function figEasy(el, R) {
  dotPlots(el, R, {
    rows: (k) => R.easyRows(k), past: (k, r) => r.sum / (3 * r.n) >= (k === 'p' ? EASY_P : EASY_S), value: (r) => [r.sum, 3 * r.n], valueName: 'Mean success rate',
    valueText: (a, n) => `${pct(a, n)}%`, cutLabel: (k) => `below ${k === 'p' ? 70 : 60}%`,
    say: `In privileged mode the three strongest agents’ mean success rate is 70% or more in ${R.S.easy_p_frac.split(' of ')[0]} benchmarks; in standard mode ${R.S.easy_s_phrase} ${easyVerb(R.S.easy_s_phrase)} 60%.`,
    cap: 'Success rate of each of the three strongest agents, by benchmark (all the core tests of the setting)',
    how: 'each dot is one agent’s share of a benchmark’s tests; the gray bar on the right is the three agents’ mean success rate.',
    note: `Easiest first. Only benchmarks with at least ${MIN_BENCH} tests in the setting. The privileged column lists the benchmarks at 70% or more and the standard column those at 60% or more, each followed by the next one below the dashed line. Mean success rate = the three agents’ solved tests ÷ (3 × the benchmark’s tests), counted in agent-attempts.`,
  });
}
const easyVerb = (phrase) => (/^only |^no /.test(phrase) ? 'reaches' : 'reach');

/** Finding 6 (the analysis's figure 1.6): the approach each sampled attempt was judged on, per setting, with the three
 *  kinds of program inside code to control; a mark where one approach ends and the next begins. */
const WAYS = [
  ['open', 'code', 'Open-loop program', 'computes the whole motion in advance (waypoints, key frames, inverse-kinematics solutions, a recorded sequence) and runs it without feedback', '--w-open'],
  ['closed', 'code', 'Closed-loop program', 'reads the state or the cameras at every step or segment and adjusts', '--w-closed'],
  ['search', 'code', 'Parameter search', 'finds a passing motion, or its parameters, by trying many episodes and resets or by running an optimizer (CEM, CMA, grid or random search)', '--w-search'],
  ['direct', 'direct', 'Direct control', 'the agent sends commands one segment at a time and decides the next one after looking at images or readings', '--w-direct'],
  ['train', 'train', 'Train a model to control', 'first trains a control policy, such as a neural network or a reinforcement-learning policy, that then drives the robot', '--w-train'],
  ['mixed', 'mixed', 'Mixed', 'switched approach midway, or used two approaches equally', '--w-mixed'],
  ['none', 'none', 'No control plan', 'only explored, or never ran anything', '--w-none'],
];
const GROUP_NAME = { code: 'Code to control', direct: 'Direct control' };
function figApproach(el, R) {
  const mix = R.mix || {}, kinds = R.kinds || {};
  const def = (w) => `<li>${sw(w[4])}<span><b>${w[2]}</b> ${w[3]}</span></li>`;
  const row = (k) => {
    const n = mix[k]?.n || 0, kd = kinds[k] || {};
    let at = 0, prev = null;
    const segs = WAYS.map((w) => { const v = w[1] === 'code' ? kd[w[0]] || 0 : mix[k]?.[w[0]] || 0; const s = { w, v, x: at, edge: prev && prev !== w[1] && v }; at += v; if (v) prev = w[1]; return s; });
    const groups = ['code', 'direct'].map((g) => { const ss = segs.filter((s) => s.w[1] === g && s.v); const v = ss.reduce((a, s) => a + s.v, 0); return { g, v, x: ss[0]?.x || 0 }; })
      .filter((g) => n && g.v / n >= 0.25);
    const sum = ['code', 'direct'].map((g) => { const v = segs.filter((s) => s.w[1] === g).reduce((a, s) => a + s.v, 0); return v ? `${GROUP_NAME[g]} ${v}/${n}` : ''; }).filter(Boolean).join(' · ');
    return `<div class="ap-row"><span class="who ${MODE_CLS[k]}">${MODE_LABEL[k]}</span><span class="ap-trk">${groups.map((g) => `<em class="ap-g" style="left:${(100 * g.x) / n}%;width:${(100 * g.v) / n}%"><span>${GROUP_NAME[g.g]} ${g.v}/${n}</span></em>`).join('')}`
      + `<span class="ap-bar">${segs.filter((s) => s.v).map((s) => `<span class="${s.edge ? 'edge' : ''}" style="flex:${s.v} 1 0;background:var(${s.w[4]})" title="${esc(`${MODE_LABEL[k]} · ${s.w[2]}: ${s.v} of ${n}`)}"></span>`).join('')}</span><small class="ap-sum">${sum}</small></span><span class="n">${int(n)}</span></div>`;
  };
  const ks = ['p', 's', 't'].filter((k) => mix[k]);
  el.innerHTML = head('In privileged mode agents mostly write a program, in standard mode they mostly send commands step by step, and in standard-realtime they mostly write a closed-loop program.',
    'How agents control the robot: the approach taken in the sampled attempts, by setting', 'each segment is the share of a setting’s sampled attempts that used that approach (each attempt counted once, by the approach that produced its graded answer); labeled by an agent from the run logs, not yet checked by hand.')
    + `<div class="ap-defs"><div><p>Code to control</p><ul>${WAYS.filter((w) => w[1] === 'code').map(def).join('')}</ul></div><div><p>Other approaches</p><ul>${WAYS.filter((w) => w[1] !== 'code').map(def).join('')}</ul></div></div>`
    + `<div class="ap">${ks.map(row).join('')}<div class="ap-row ax"><span></span><span class="sb-ticks"><i style="left:0">0%</i><i style="left:50%">50%</i><i style="left:100%">100%</i></span><span class="n">attempts</span></div></div>`
    + `<p class="fig-note">A dark mark separates the approaches; the three shades of blue are the three kinds of program. Sampled attempts: ${R.S.cb_sample} analyzed in all (snapshot of ${R.S.cb_snapshot}).</p>`
    + numbers(['Setting', ...WAYS.map((w) => w[2]), 'Sampled'], ks.map((k) => [MODE_LABEL[k], ...WAYS.map((w) => (w[1] === 'code' ? kinds[k]?.[w[0]] || 0 : mix[k]?.[w[0]] || 0)), mix[k].n]));
}

/* ------------------------------------------------------------------------------------------ the article */

/** The contents: a rail in the left margin that follows the reader, built from the article's own heads: the sections,
 *  and under Findings each finding by its short name. */
function toc() {
  const heads = $$('.post h2[id]');
  if (!heads.length) return;
  const label = (h) => `<span class="k">${esc(h.querySelector('.num')?.textContent || '')}</span>${esc(h.dataset.short || h.textContent.replace(/^\s*\d+\s*/, ''))}`;
  const subs = (h) => {
    const out = [];
    for (let el = h.nextElementSibling; el && el.tagName !== 'H2'; el = el.nextElementSibling) {
      const h3 = el.matches('h3[id]') ? el : el.querySelector?.(':scope > h3[id]');
      if (h3) out.push(h3);
    }
    return out;
  };
  const fnum = (h3) => { const t = h3.querySelector('.fn')?.textContent; return t && (t.replace(/\D+/g, '') || '?'); };
  const sub3 = (h3) => esc([...(h3.querySelector('button') || h3).childNodes].filter((n) => !n.classList?.contains('fn')).map((n) => n.textContent).join('').trim());
  // the rail: section names, plus each finding by its short name, folded until the reader reaches the findings or
  // opens them; the current one marked
  const fh = $$('.post .finding h3[id]').filter(fnum);
  document.body.insertAdjacentHTML('beforeend', `<nav class="toc-rail" aria-label="Contents"><p>Contents</p><ol>${heads.map((h) => {
    const s = subs(h).filter(fnum);
    if (!s.length) return `<li><a href="#${h.id}">${label(h)}</a></li>`;
    return `<li class="fold"><div class="fold-head"><a href="#${h.id}">${label(h)}</a><button type="button" aria-expanded="false" aria-label="Show the findings">${s.length}</button></div>`
      + `<div class="fold-body"><ol>${s.map((x, i) => `<li><a href="#${x.id}"><span class="k">${i + 1}</span>${esc(x.dataset.short || sub3(x))}</a></li>`).join('')}</ol></div></li>`;
  }).join('')}</ol></nav>`);
  const rail = $('.toc-rail'), first = heads[0];
  const marks = [...heads, ...fh].sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  const links = marks.map((h) => $(`a[href="#${h.id}"]`, rail));
  const folds = $$('.fold', rail).map((li) => ({ li, h: document.getElementById($('a', li).getAttribute('href').slice(1)), manual: null, inside: false }));
  const paint = () => folds.forEach((f) => {
    const open = f.manual ?? f.inside;
    f.li.classList.toggle('open', open);
    $('button', f.li).setAttribute('aria-expanded', String(open));
  });
  folds.forEach((f) => {
    $('button', f.li).addEventListener('click', () => { f.manual = !f.li.classList.contains('open'); paint(); });
    $('a', f.li).addEventListener('click', () => { f.manual = true; paint(); });
  });
  const onScroll = () => {
    // only once the page's title block has left the screen, so the rail never sits beside the title
    const hd = $('.post-head');
    rail.classList.toggle('show', (!hd || hd.getBoundingClientRect().bottom < 0) && first.getBoundingClientRect().top < innerHeight * 0.5);
    let cur = 0, s = 0;
    marks.forEach((h, k) => { if (h.getBoundingClientRect().top < innerHeight * 0.35) cur = k; });
    heads.forEach((h, k) => { if (h.getBoundingClientRect().top < innerHeight * 0.35) s = k; });
    links.forEach((a, k) => a.classList.toggle('on', k === cur));
    // a fold is open while the reader is inside its section; entering or leaving the section undoes a click
    folds.forEach((f) => { const inside = heads[s] === f.h; if (inside !== f.inside) { f.inside = inside; f.manual = null; } });
    paint();
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/** The findings fold: each shows its label and its conclusion, and the button that is its heading opens the rest (the
 *  body is hidden="until-found", so the browser's find in page opens it too). A link to a finding or into one, from the
 *  contents, the text or the address (#f3), opens it; printing opens every finding (blog.css) and every inner fold. */
function findings() {
  const set = (b, open) => {
    b.setAttribute('aria-expanded', String(open));
    const body = document.getElementById(b.getAttribute('aria-controls'));
    if (open) body.removeAttribute('hidden'); else body.setAttribute('hidden', 'until-found');
  };
  const btns = $$('.finding > h3 > .finding-toggle');
  btns.forEach((b) => {
    b.addEventListener('click', () => set(b, b.getAttribute('aria-expanded') !== 'true'));
    document.getElementById(b.getAttribute('aria-controls'))?.addEventListener('beforematch', () => set(b, true));
  });
  // the sections' old addresses: the old overview is now the overall results, and the old case study is gone
  const ALIAS = { framework: 'introduction', overview: 'results', safety: 'findings', s1: 'findings' };
  const moved = () => {
    let id = '';
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { /* a malformed hash */ }
    if (!ALIAS[id]) return null;
    history.replaceState(null, '', `#${ALIAS[id]}`);
    return document.getElementById(ALIAS[id]);
  };
  const reveal = (id) => {
    let el = null;
    try { if (id) el = document.getElementById(decodeURIComponent(id)); } catch { /* a malformed hash */ }
    const b = el?.closest('.finding')?.querySelector(':scope > h3 > .finding-toggle');
    if (b) set(b, true);
    return b ? el : null;
  };
  // a click on an in-page link opens the finding first, so the browser then scrolls to it with its body laid out
  document.addEventListener('click', (e) => { const a = e.target.closest?.('a[href^="#"]'); if (a) reveal(a.getAttribute('href').slice(1)); });
  addEventListener('hashchange', () => { const m = moved(); (reveal(location.hash.slice(1)) || m)?.scrollIntoView(); });
  const old = moved();
  const target = reveal(location.hash.slice(1)) || old;
  target?.scrollIntoView({ behavior: 'instant' });
  let shut = [];
  addEventListener('beforeprint', () => { shut = $$('.post details:not([open])'); shut.forEach((d) => { d.open = true; }); });
  addEventListener('afterprint', () => { shut.forEach((d) => { d.open = false; }); shut = []; });
  // the numbers and figures above fill in later: then put the finding back at the top, unless the reader has moved on
  return () => { const t = target?.getBoundingClientRect().top; if (t > 0 && t < 200) target.scrollIntoView({ behavior: 'instant' }); };
}

/** Videos play only while on screen. */
function clips() {
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    const v = e.target;
    if (e.isIntersecting) { v.play?.().catch(() => {}); } else v.pause?.();
  }), { threshold: 0.35 });
  $$('video[data-auto]').forEach((v) => {
    v.muted = true; v.loop = true; v.playsInline = true;
    if (v.dataset.rate) { const r = +v.dataset.rate; v.defaultPlaybackRate = r; v.addEventListener('play', () => { v.playbackRate = r; }); }
    io.observe(v);
  });
}

/** In-text citations: a small card with the full reference on hover or focus. */
function refs() {
  let card = null;
  const show = (a) => {
    const items = (a.dataset.refs || '').split(',').map((n) => document.getElementById(`ref-${n}`)).filter(Boolean);
    if (!items.length) return;
    card ??= Object.assign(document.createElement('div'), { className: 'ref-card' });
    card.innerHTML = items.map((li) => `<p>${li.innerHTML}</p>`).join('');
    document.body.append(card);
    const r = a.getBoundingClientRect(), w = card.offsetWidth;
    card.style.left = `${Math.max(16, Math.min(scrollX + r.left - w / 2, scrollX + innerWidth - w - 16))}px`;
    card.style.top = `${scrollY + r.bottom + 8}px`;
  };
  const hide = () => card?.remove();
  $$('sup.ref a').forEach((a) => {
    a.addEventListener('mouseenter', () => show(a)); a.addEventListener('focus', () => show(a));
    a.addEventListener('mouseleave', hide); a.addEventListener('blur', hide);
  });
}

/** Figures as wide as the text: the framework figure is drawn at 1240 px in its landscape layout and scaled to the column;
 *  every figure gets an Enlarge button (charts also open on a click) that shows it full size in an overlay. */
function zoomFigs() {
  const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>';
  const flow = $('#flowfig');
  let box = null;
  if (flow) {
    box = document.createElement('div'); box.className = 'flow-box';
    flow.before(box); box.append(flow);
    const fit = () => {
      if (!box.contains(flow)) return;
      if (innerWidth <= 860) { flow.style.transform = ''; box.style.height = ''; return; }
      const k = Math.min(1, box.clientWidth / 1240);
      flow.style.transform = `scale(${k})`; box.style.height = `${Math.ceil(flow.offsetHeight * k) + 2}px`;
    };
    new ResizeObserver(fit).observe(box); new ResizeObserver(fit).observe(flow); addEventListener('resize', fit); fit();
  }
  const open = (el, home) => {
    const ov = document.createElement('div'); ov.className = 'zoom-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    const inner = document.createElement('div'); inner.className = 'zoom-in fig';
    const x = Object.assign(document.createElement('button'), { className: 'zoom-x', type: 'button', textContent: '×' }); x.setAttribute('aria-label', 'Close');
    const mark = document.createComment('zoom'); el.before(mark);
    inner.append(el); ov.append(x, inner); document.body.append(ov); document.documentElement.style.overflow = 'hidden';
    const close = () => { mark.replaceWith(el); ov.remove(); document.documentElement.style.overflow = ''; removeEventListener('keydown', key); home?.(); };
    const key = (e) => { if (e.key === 'Escape') close(); };
    x.addEventListener('click', close); ov.addEventListener('click', (e) => { if (e.target === ov) close(); }); addEventListener('keydown', key);
    x.focus();
  };
  const add = (host, target, after) => {
    host.classList.add('fig-zoom-host');
    const b = document.createElement('button'); b.type = 'button'; b.className = 'zoom-btn'; b.innerHTML = `${ICON}Enlarge`;
    b.addEventListener('click', (e) => { e.stopPropagation(); open(target, after); });
    host.append(b);
  };
  if (flow && box) add(box, flow, () => dispatchEvent(new Event('resize')));
  $$('.post .fig-body[data-fig]').forEach((fb) => {
    add(fb, fb);
    fb.addEventListener('click', (e) => { if (e.target.closest('details, summary, a, button, .zoom-ov') || fb.closest('.zoom-ov')) return; open(fb); });
  });
}

const settle = findings();
refs();
Promise.all([getJSON('data/exam.json'), getJSON('data/tasks.json'), getJSON('data/blog.json'), getJSON('data/atlas.json')]).then(([ex, tasks, b, atlas]) => {
  const R = compute(ex, tasks, b, atlas);
  fill(R.S);
  const kinds = $('#bodies');
  if (kinds) {
    const c = {};
    for (const t of tasks) c[t.body] = (c[t.body] || 0) + 1;
    kinds.textContent = Object.entries(c).sort((a, z) => z[1] - a[1]).map(([k, n]) => `${(ex.bodies?.[k] || k).toLowerCase()} (${int(n)} tasks)`).join(', ');
    const nk = $('#body-kinds'); if (nk) nk.textContent = nw(Object.keys(c).length);
  }
  const figs = { modes: figModes, types: figTypes, suites: figSuites, overlap: figOverlap, paired: figPaired, steps: figSteps, hard: figHard, easy: figEasy, approach: figApproach };
  for (const [k, f] of Object.entries(figs)) { const el = $(`#fig-${k}`); if (el) f(el, R); }
  // each figure's number before its caption
  $$('.fig-body[data-fig]').forEach((el) => $('.fig-cap', el)?.insertAdjacentHTML('afterbegin', `<b>Figure ${el.dataset.fig}.</b> `));
}).catch((e) => {
  console.error(e);
  $$('.fig-body').forEach((el) => { el.innerHTML = '<p class="fig-note">This figure could not be loaded.</p>'; });
}).finally(() => { toc(); clips(); settle(); zoomFigs(); });
