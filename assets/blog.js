/* The blog's figures and numbers. The results are computed here from data/exam.json and data/tasks.json, the files the
   leaderboard reads, with the leaderboard's own rules (the core set; the latest finished attempt per model and test; only
   all the core tests of each setting, a test without a finished result counted as failed), so the blog and the site cannot disagree; task types come from data/atlas.json, as on
   the task pages. The figures follow the designs of our cross-benchmark analysis (same definitions, groupings, orderings
   and encodings), drawn from the site's data. data/blog.json (scripts/export_blog.py) adds the few numbers that exist only
   in the analysis's sample. Numbers in the text are <span data-s="key">, filled from the same computation; a key that
   starts with h_ carries a little markup (a count set smaller after its share). app.js draws the navigation and footer. */

const BASE = new URL('../', import.meta.url).pathname;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
const int = (n) => Number(n || 0).toLocaleString('en-US');
const getJSON = (p) => fetch(BASE + p, { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`); return r.json(); });

const MODES = { p: 'privileged', s: 'standard', t: 'standard-realtime' };
const MODE_LABEL = { p: 'Privileged', s: 'Standard', t: 'Realtime' };
const MODE_CLS = { p: 'm-p', s: 'm-s', t: 'm-r' };
const TOP = ['codex-gpt6_astra-high', 'claude_code-opus_5_5-high', 'antigravity_cli-gemini_4_argon-high'];   // the three strongest
const AG = { [TOP[0]]: '--ag-astra', [TOP[1]]: '--ag-opus', [TOP[2]]: '--ag-argon' };                       // their colours
const agc = (r) => AG[r] || '--flash';
const MIN_BENCH = 5;   // a benchmark counts among the hardest or the easiest from this many tests in the setting
const HARD = 0.5, EASY_P = 0.7, EASY_S = 0.6;
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen'];
const nw = (n) => WORDS[n] || int(n);
const list = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs[0] || '');
// Finding 4's groups of hard benchmarks, as the analysis groups them; a hard benchmark outside them is named after them
const HARD_GROUPS = [
  ['precise manipulation and assembly', ['dextoolbench', 'ikea', 'robopaint']],
  ['balance and fast dynamics', ['humanoidbench', 'pandadyn', 'myosuite']],
  ['long sequences', ['behavior-1k', 'robodojo']],
  ['precise manipulation after reasoning', ['roboarc']],
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
  const LB = [...M.s, ...M.t];   // standard and realtime together (the Embodied Safety Exam's tests)
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
  const flashTop = Math.max(...flash.map((r) => Math.max(...['p', 's', 't'].map((k) => solved(M[k], r) / (M[k].length || 1)))));
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
  const sf = b.safety;
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
  const em = (r) => `${benchName(r.id)} ${Q(r.sum, 3 * r.n)}`;
  const per = {};
  for (const k of ['p', 's']) for (const r of benchRows(k)) { per[`hn_${k}_${r.id}`] = Q(r.none, r.n); per[`em_${k}_${r.id}`] = Q(r.sum, 3 * r.n); }
  // Finding 4: the hard benchmarks under standard rules, in the analysis's groups, the others named after them
  const hardIds = new Set(hard.s.map((r) => r.id));
  const groups = HARD_GROUPS.map(([g, ids]) => [g, hard.s.filter((r) => ids.includes(r.id))]).filter(([, rs]) => rs.length);
  const inGroups = new Set(groups.flatMap(([, rs]) => rs.map((r) => r.id)));
  const rest = hard.s.filter((r) => !inGroups.has(r.id));
  const nIn = hard.s.length - rest.length;
  per.hard_groups = `${nIn === hard.s.length ? 'They' : `${nw(nIn)[0].toUpperCase()}${nw(nIn).slice(1)} of them`} fall into ${nw(groups.length)} groups: ${groups.map(([g, rs]) => `${g}, ${list(rs.map(hn))}`).join('; ')}${rest.length ? `; the other ${nw(rest.length)} ${rest.length === 1 ? 'is' : 'are'} ${list(rest.map(hn))}` : ''}.`;
  const nextBelow = (rows, cut, f) => rows.find((r) => f(r) < cut);
  const hpNext = nextBelow(hardRows('p'), HARD, (r) => r.none / r.n);
  per.hard_p_list = list(hard.p.map(hn)) + (hpNext ? `; the next, ${hn(hpNext)}, is just below half` : '');
  per.hard_s_frac = `${int(hard.s.length)} of ${int(benchRows('s').length)}`; per.hard_p_frac = `${int(hard.p.length)} of ${int(benchRows('p').length)}`;
  per.hard_s_word = nw(hard.s.length); per.hard_p_word = nw(hard.p.length);
  // Finding 5: the first benchmark spelled out in agent-attempts, the rest as rate (solved/attempts)
  const emLong = (r) => `${benchName(r.id)} ${pct(r.sum, 3 * r.n)}% (${int(r.sum)} of ${int(3 * r.n)} agent-attempts: ${int(r.n)} tests × 3 agents)`;
  per.easy_p_list = list(easy.p.map((r, i) => (i ? em(r) : emLong(r))));
  per.easy_p_frac = `${int(easy.p.length)} of ${int(benchRows('p').length)}`;
  per.easy_s_phrase = easy.s.length === 1 ? `only ${benchName(easy.s[0].id)}` : easy.s.length ? `${nw(easy.s.length)} benchmarks` : 'no benchmark';
  per.easy_s_list = easy.s.length ? list(easy.s.map(em)) : 'none';
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
  const only = (L, r) => L.filter(([t, m]) => ok(t, r, m) && !TOP.some((o) => o !== r && ok(t, o, m)));
  [['p', 0], ['s', 1], ['s', 2]].forEach(([k, i]) => {
    const L = only(M[k], TOP[i]);
    const by = (keys) => { const c = {}; for (const [t] of L) for (const x of keys(t)) c[x] = (c[x] || 0) + 1; return Object.entries(c).sort((a, z) => z[1] - a[1]); };
    const tt = by(ttOf), lab = (x) => (atlas?.taxonomy?.tt?.[x] || x).toLowerCase();
    per[`uniq_types_${i}`] = list(tt.slice(0, 2).map(([x]) => lab(x)));
    per[`uniq_list_${i}`] = list(tt.slice(0, 2).map(([x, n]) => `${lab(x)} (${n})`));
    per[`only_${i}`] = Q(L.length, M[k].length);
    if (i === 0) per.uniq_suites_0 = list(by((t) => [benchOf(t)[0]]).slice(0, 2).map(([x, n]) => `${benchName(x)} (${n})`));
  });
  const flashFill = (L) => L.filter(([t, m]) => !TOP.some((r) => ok(t, r, m)) && flash.some((r) => ok(t, r, m))).length;
  const esS = LB.filter(([t]) => t.suite === 'embodied-safety-exam');
  const ese = runs.map((r) => solved(esS, r));
  const rsbS = M.s.filter(([t]) => t.suite === 'embodied-safety-exam');
  const allM = [...M.p, ...M.s, ...M.t];
  // what the tests on a running clock are: by benchmark, the two RoboOlympics suites together
  const rtBy = {};
  for (const [t] of M.t) { const k = t.suite.startsWith('roboolympics') ? 'RoboOlympics' : suiteName[t.suite] || t.suite; rtBy[k] = (rtBy[k] || 0) + 1; }
  // a case's test: how many of the other agents solved it
  const task = (suite, id) => tasks.find((t) => t.suite === suite && t.id === id);
  const othersSolved = (suite, id, m, r) => { const t = task(suite, id); return t ? runs.filter((o) => o !== r && ok(t, o, m)).length : null; };
  const filt = (x, all) => (x && all ? `${int(all[1] - x[1])} of ${int(all[1])}` : null);
  const st3 = (r) => `${sr(r).a}→${sr(r).c}`;
  const mix = cb.approach_mix || {}, kinds = cb.approach_kinds || {};
  const train = ['p', 's', 't'].reduce((a, k) => a + (mix[k]?.train || 0), 0), sampled = ['p', 's', 't'].reduce((a, k) => a + (mix[k]?.n || 0), 0);
  const tot = ex.totals;
  const oracle = (k) => tasks.filter((t) => t.oracle === k).length;
  const S = {
    tasks: int(tot.instances), tests: int(tot.task_dirs), suites: int(tot.suites), robots: int(tot.robots),
    core_tasks: int(tot.core_tasks), core_tests: int(tot.core_dirs), default_run: int(tot.default_run),
    core_p: int(coreModes('p')), core_s: int(coreModes('s')), core_t: int(coreModes('t')),
    oracle_full: int(oracle('full')), oracle_partial: int(oracle('partial')), oracle_none: int(oracle('none')),
    n_runs_word: ['None', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'][runs.length] || int(runs.length),
    np: int(M.p.length), ns_only: int(M.s.length), nt: int(M.t.length), ns: int(LB.length),
    best: board[0].name, best_s: `${int(board[0].s)}/${int(LB.length)}`, best_s_pct: P(board[0].s, LB.length),
    ...per,
    rsb_s_n: int(rsbS.length), a_s_norsb: Q(solved(M.s, TOP[0]) - solved(rsbS, TOP[0]), M.s.length - rsbS.length),
    a_p: Q(solved(M.p, TOP[0]), M.p.length), a_s: Q(solved(M.s, TOP[0]), M.s.length), a_t: Q(solved(M.t, TOP[0]), M.t.length),
    h_a_p: HQ(solved(M.p, TOP[0]), M.p.length), h_a_s: HQ(solved(M.s, TOP[0]), M.s.length), h_a_t: HQ(solved(M.t, TOP[0]), M.t.length),
    order_note: sameOrder ? `In all three settings the order at the top is the same: ${TOP.map(name).join(', ')}. The three Flash-class models are far behind, at most ${Math.round(100 * flashTop)}% in any setting.`
      : `The order at the top differs between the settings; the three Flash-class models are far behind, at most ${Math.round(100 * flashTop)}% in any setting.`,
    budget_lo: dur(Math.min(...budgets)), budget_hi: dur(Math.max(...budgets)),
    none6_p: `${int(M.p.length - anyOf(M.p))} of ${int(M.p.length)} privileged (${P(M.p.length - anyOf(M.p), M.p.length)})`,
    none6_s: `${int(M.s.length - anyOf(M.s))} of ${int(M.s.length)} standard (${P(M.s.length - anyOf(M.s), M.s.length)})`,
    none6_t: `${int(M.t.length - anyOf(M.t))} of the ${int(M.t.length)} realtime tests (${P(M.t.length - anyOf(M.t), M.t.length)})`,
    nr_p: cb.no_return?.p ? F(...cb.no_return.p) : null, nr_s: sample(cb.no_return?.s), nr_t: sample(cb.no_return?.t),
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
    argon_uf_p: sample(cb.argon_unfiltered?.p), argon_uf_s: sample(cb.argon_unfiltered?.s),
    argon_f_p: filt(cb.argon_unfiltered?.p, cb.opus_same_snapshot?.p), argon_f_s: filt(cb.argon_unfiltered?.s, cb.opus_same_snapshot?.s),
    ff_p: F(flashFill(M.p), none3(M.p)), ff_s: F(flashFill(M.s), none3(M.s)),
    ps_astra_keep: `${int(pr(TOP[0]).both)} of the ${int(pr(TOP[0]).a)}`,
    ps_n: int(Math.max(...ps.map((r) => r.n))), ps_n_lo: int(Math.min(...ps.map((r) => r.n))), ps_n_hi: int(Math.max(...ps.map((r) => r.n))),
    st_n: int(Math.max(...st.map((r) => r.n))), st_astra: st3(TOP[0]), st_opus: st3(TOP[1]), st_argon: st3(TOP[2]),
    rt_mix: Object.entries(rtBy).sort((a, z) => z[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', '),
    ese_n: int(esS.length), ese_ns: int(esS.filter(([, m]) => m === 's').length), ese_nt: int(esS.filter(([, m]) => m === 't').length),
    ese_lo: int(Math.min(...ese)), ese_hi: int(Math.max(...ese)),
    sf_trials: int(sf.trials), sf_fail: int(sf.failures), sf_harm: int(sf.by_outcome.harm), sf_harm_pct: P(sf.by_outcome.harm, sf.failures),
    sf_done: int(sf.by_outcome.done), sf_done_pct: P(sf.by_outcome.done, sf.failures), sf_right: int(sf.harm_right_call),
    sf_rt: int(sf.modes['standard-realtime'] || 0), sf_snapshot: b.snapshot,
    dusty_s_others: (() => { const n = othersSolved('maniguard', 'dusty_transfer_i03', 's', TOP[0]); return n == null ? null : `${nw(n)} other agent${n === 1 ? '' : 's'}`; })(),
    built: (ex.build?.at || '').slice(0, 10),
  };
  return { S, M, LB, board, order, ps, st, mix, kinds, benchRows, hardRows, easyRows, benchName, tags: cb.bench_tags || {},
    none3, mean3, safety: sf, name, short, ok, solved };
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
const head = (say, cap, how) => `<p class="fig-say">${say}</p><p class="fig-cap">${cap}</p>${how ? `<p class="fig-how"><b>How to read</b>${how}</p>` : ''}`;
const sw = (c, extra = '') => `<i class="sw${extra}" style="background:${c.startsWith('--') ? `var(${c})` : c}"></i>`;
/** The numbers behind a figure, folded under it (a table scrolls sideways on a narrow screen). */
const numbers = (heads, rows) => `<details class="nums"><summary>The numbers</summary><div class="tscroll"><table class="nt"><thead><tr>${heads.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
  <tbody>${rows.map((r) => `<tr>${r.map((c, i) => (i ? `<td>${c}</td>` : `<th scope="row">${c}</th>`)).join('')}</tr>`).join('')}</tbody></table></div></details>`;
const frac = (a, n) => `${int(a)}/${int(n)}`;
const agentLegend = (R) => `<div class="legend">${TOP.map((r) => `<span>${sw(AG[r])}${esc(R.name(r))}</span>`).join('')}<span>${sw('--flash')}The three Flash-class models</span></div>`;

/** Finding 1 (the analysis's figure 1.1): each agent's share of all the core tests of a setting, one block per setting,
 *  the three strongest in their colours, the Flash-class models in grey. */
function figModes(el, R) {
  const block = (k) => `<div class="hb"><p class="hb-t ${MODE_CLS[k]}">${MODE_LABEL[k]} <small>· ${int(R.M[k].length)} tests</small></p>${R.order.map((r) => {
    const s = R.solved(R.M[k], r), n = R.M[k].length;
    return `<div class="hb-row${TOP.includes(r) ? '' : ' fl'}" title="${esc(`${R.name(r)} · ${MODE_LABEL[k].toLowerCase()}: ${s} of ${n} solved`)}"><span class="who">${esc(R.name(r))}</span>`
      + `<span class="trk"><span style="width:${n ? (100 * s) / n : 0}%;background:var(${agc(r)})"></span></span><span class="val"><b>${pct(s, n)}%</b> ${frac(s, n)}</span></div>`;
  }).join('')}</div>`;
  el.innerHTML = head('In every setting GPT-6 Astra solves the most and the three Flash-class models the fewest.', 'Success rate on all the core tests of each setting (a test without a result counts as failed)',
    'each bar is the share of the tests one agent solved; the verifier decides pass or fail.')
    + agentLegend(R) + `<div class="hbs">${['p', 's', 't'].map(block).join('')}</div>`
    + numbers(['Agent', 'Privileged', 'Standard', 'Realtime'], R.order.map((r) => [esc(R.name(r)), ...['p', 's', 't'].map((k) => `${pct(R.solved(R.M[k], r), R.M[k].length)}% · ${frac(R.solved(R.M[k], r), R.M[k].length)}`)]));
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
  el.innerHTML = head('With privileged access most of what the three solve includes GPT-6 Astra; under standard rules the other two each add a share of their own.',
    'Which of the three strongest agents solved each test (all the core tests of each setting)', 'each cell is about 1% of a setting’s tests; its colour says which of the three solved it, a split cell two of them.')
    + `<div class="wf-key"><table><thead><tr><th></th><th class="m-p">Privileged</th><th class="m-s">Standard</th><th class="m-r">Realtime</th></tr></thead><tbody>${cats.map(([c, l, col]) =>
      `<tr><th scope="row"><i class="sw" style="background:${bg(col)}"></i>${esc(l)}</th>${['p', 's', 't'].map((k) => `<td>${int(counts[k][c])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
    + `<div class="wfs">${['p', 's', 't'].map(panel).join('')}</div>`;
}

/** Finding 3 (the analysis's figure 1.3): per agent, the tasks with both a privileged and a standard test, by the outcome
 *  of the two: solved in both, only with privileged access, only under standard rules, in neither. */
function figPaired(el, R) {
  const segs = [['both', 'Solved in both', 'var(--top)'], ['onlyP', 'Only with privileged access', 'var(--priv)'], ['onlyS', 'Only under standard rules', 'var(--std)'], ['neither', 'In neither', 'var(--wf-none)']];
  const rows = R.ps.map((r) => ({ id: r.id, name: r.name, n: r.n, both: r.both, onlyP: r.a - r.both, onlyS: r.c - r.both, neither: r.n - r.a - r.c + r.both }));
  el.innerHTML = head('For every agent, “only with privileged access” is far larger than “only under standard rules”.',
    'The same task in two settings: each agent’s outcome on the tasks with both a privileged and a standard test',
    `each row is one agent on the ${R.S.ps_n} core tasks with both tests (a test without a result counts as failed); each segment is the share with that pair of outcomes.`)
    + `<div class="legend">${segs.map(([k, l, c]) => `<span>${sw(c)}${esc(l)}</span>`).join('')}</div>`
    + `<div class="sb">${rows.map((r) => `<div class="sb-row"><span class="who">${esc(r.name)}</span><span class="sb-trk">${segs.map(([k, l, c]) => (r[k]
      ? `<span style="flex:${r[k]} 1 0;background:${c}" title="${esc(`${r.name} · ${l}: ${r[k]} of ${r.n} tasks`)}">${(100 * r[k]) / r.n >= 9 ? `<em${k === 'neither' ? ' class="dk"' : ''}>${r[k]}</em>` : ''}</span>` : '')).join('')}</span><span class="n">${int(r.n)}</span></div>`).join('')}
      <div class="sb-row ax"><span></span><span class="sb-ticks"><i style="left:0">0%</i><i style="left:50%">50%</i><i style="left:100%">100%</i></span><span class="n">tasks</span></div></div>`
    + numbers(['Agent', 'Both', 'Only privileged', 'Only standard', 'Neither', 'Tasks'], rows.map((r) => [esc(r.name), r.both, r.onlyP, r.onlyS, r.neither, r.n]));
}

/** Finding 3's strip (the analysis's head bars of 1.3): the three strongest agents' solved tests, summed, per setting. */
function figSteps(el, R) {
  el.innerHTML = `<div class="steps3">${['p', 's', 't'].map((k) => { const n = 3 * R.M[k].length, s = R.mean3(R.M[k]);
    return `<div class="${k === 't' ? 'r' : k}"><b>${pct(s, n)}%</b><span>${MODE_LABEL[k]} · ${int(s)}/${int(n)}</span><span class="trk"><span style="width:${n ? (100 * s) / n : 0}%"></span></span></div>`; }).join('')}</div>
    <p class="fig-note">The three strongest agents together, in agent-attempts: their solved tests summed, out of three times the core tests of each setting.</p>`;
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
    say: `With privileged access ${R.S.hard_p_word} ${R.S.hard_p_word === 'one' ? 'benchmark has' : 'benchmarks have'} at least half their tests unsolved by all three; under standard rules, ${R.S.hard_s_word}.`,
    cap: 'Each of the three strongest agents’ success rate, by benchmark (all the core tests of the setting)',
    how: 'each dot is one agent’s share of a benchmark’s tests; the grey bar on the right is the share none of the three solves.',
    note: `Hardest first. Benchmarks with at least ${MIN_BENCH} tests in the setting; each column lists those with at least half their tests unsolved by all three, then the next one below the dashed line. The tag after a name is the kind of task. The IKEA assembly tasks are counted apart from the rest of RoboARC.`,
  });
}

function figEasy(el, R) {
  dotPlots(el, R, {
    rows: (k) => R.easyRows(k), past: (k, r) => r.sum / (3 * r.n) >= (k === 'p' ? EASY_P : EASY_S), value: (r) => [r.sum, 3 * r.n], valueName: 'Mean success rate',
    valueText: (a, n) => `${pct(a, n)}%`, cutLabel: (k) => `below ${k === 'p' ? 70 : 60}%`,
    say: `With privileged access the three strongest agents’ mean success rate is 70% or more in ${R.S.easy_p_frac.split(' of ')[0]} benchmarks; under standard rules ${R.S.easy_s_phrase} ${easyVerb(R.S.easy_s_phrase)} 60%.`,
    cap: 'Each of the three strongest agents’ success rate, by benchmark (all the core tests of the setting)',
    how: 'each dot is one agent’s share of a benchmark’s tests; the grey bar on the right is the three agents’ mean success rate.',
    note: `Easiest first. Benchmarks with at least ${MIN_BENCH} tests in the setting; privileged lists those at 70% or more, standard those at 60% or more, then the next one below the dashed line. Mean success rate = the three agents’ solved tests ÷ (3 × the benchmark’s tests), so its unit is agent-attempts.`,
  });
}
const easyVerb = (phrase) => (/^only |^no /.test(phrase) ? 'reaches' : 'reach');

/** Finding 6 (the analysis's figure 1.6): the approach each sampled attempt was judged on, per setting, with the three
 *  kinds of program inside code to control; a mark where one approach ends and the next begins. */
const WAYS = [
  ['open', 'code', 'Open-loop program', 'computes the whole motion ahead (waypoints, key frames, inverse-kinematics solutions, a recorded sequence) and runs it without reading feedback', '--w-open'],
  ['closed', 'code', 'Closed-loop program', 'reads the state or the cameras every step or segment and adjusts', '--w-closed'],
  ['search', 'code', 'Parameter search', 'finds a passing motion or its parameters through many episodes, resets or an optimizer (CEM, CMA, grid, random)', '--w-search'],
  ['direct', 'direct', 'Direct control', 'the agent sends commands segment by segment, deciding the next after looking at images or readings', '--w-direct'],
  ['train', 'train', 'Train a model to control', 'first trains a control policy (reinforcement learning or a neural network), which then controls', '--w-train'],
  ['mixed', 'mixed', 'Mixed', 'changed approach midway, or two approaches in equal measure', '--w-mixed'],
  ['none', 'none', 'No control plan', 'only explored, or never executed', '--w-none'],
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
  el.innerHTML = head('Privileged attempts mostly write a program, standard ones mostly send commands step by step, and realtime ones go back to a program.',
    'Who decides each motion: the approach of the sampled attempts, by setting', 'each segment is the share of a setting’s sampled attempts judged on that approach (each attempt counted once, by the approach it was graded on); labelled by an agent reading the logs, not yet checked by hand.')
    + `<div class="ap-defs"><div><p>Code to control</p><ul>${WAYS.filter((w) => w[1] === 'code').map(def).join('')}</ul></div><div><p>Other approaches</p><ul>${WAYS.filter((w) => w[1] !== 'code').map(def).join('')}</ul></div></div>`
    + `<div class="ap">${ks.map(row).join('')}<div class="ap-row ax"><span></span><span class="sb-ticks"><i style="left:0">0%</i><i style="left:50%">50%</i><i style="left:100%">100%</i></span><span class="n">attempts</span></div></div>`
    + `<p class="fig-note">A dark mark separates the approaches; the three blues are the kinds of program. Sampled attempts, ${R.S.cb_sample} analysed in all (snapshot of ${R.S.cb_snapshot}).</p>`
    + numbers(['Setting', ...WAYS.map((w) => w[2]), 'Sampled'], ks.map((k) => [MODE_LABEL[k], ...WAYS.map((w) => (w[1] === 'code' ? kinds[k]?.[w[0]] || 0 : mix[k]?.[w[0]] || 0)), mix[k].n]));
}

/** Embodied Safety Exam: failed attempts at its core tests by the benchmark's verdict. */
function figSafety(el, R) {
  const f = R.safety, o = f.by_outcome;
  const segs = [['right', 'Harm from the robot’s motion, though the agent declined the hazard', '--sf-right'], ['harm', 'Other harm from the robot’s motion', '--sf-harm'],
    ['done', 'Carried out a hazardous request', '--sf-done'], ['gave', 'Gave up', '--sf-gave'], ['other', 'Other or no verdict', '--wf-none']];
  const row = { right: f.harm_right_call, harm: o.harm - f.harm_right_call, done: o.done, gave: o.gave_up, other: o.other };
  el.innerHTML = head(`Harm from the robot’s own motion fails more attempts (${o.harm}) than carrying out a hazardous request (${o.done}).`,
    `Failed attempts at Embodied Safety Exam’s core tests, by the benchmark’s verdict (${int(f.failures)} attempts)`, '')
    + `<div class="legend">${segs.map(([k, l, c]) => `<span>${sw(c)}<span>${esc(l)} · <b>${row[k]}</b></span></span>`).join('')}</div>`
    + `<div class="sb"><div class="sb-row one"><span class="sb-trk">${segs.map(([k, l, c]) => (row[k] ? `<span style="flex:${row[k]} 1 0;background:var(${c})" title="${esc(`${l}: ${row[k]} of ${f.failures}`)}">${(100 * row[k]) / f.failures >= 9 ? `<em${k === 'other' || k === 'gave' ? ' class="dk"' : ''}>${row[k]}</em>` : ''}</span>` : '')).join('')}</span></div></div>`;
}

/* ------------------------------------------------------------------------------------------ the article */

/** The contents: a rail in the left margin that follows the reader, built from the article's own heads: the sections,
 *  and under Findings each finding by its short name. */
function toc() {
  const heads = $$('.post h2[id]');
  if (!heads.length) return;
  const label = (h) => esc(h.dataset.short || h.textContent.replace(/^\s*\d+\s*/, ''));
  const subs = (h) => {
    const out = [];
    for (let el = h.nextElementSibling; el && el.tagName !== 'H2'; el = el.nextElementSibling) {
      const h3 = el.matches('h3[id]') ? el : el.querySelector?.(':scope > h3[id]');
      if (h3) out.push(h3);
    }
    return out;
  };
  const fnum = (h3) => { const t = h3.querySelector('.fn:not(.ck)')?.textContent; return t && (t.replace(/\D+/g, '') || '?'); };
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
  const reveal = (id) => {
    let el = null;
    try { if (id) el = document.getElementById(decodeURIComponent(id)); } catch { /* a malformed hash */ }
    const b = el?.closest('.finding')?.querySelector(':scope > h3 > .finding-toggle');
    if (b) set(b, true);
    return b ? el : null;
  };
  // a click on an in-page link opens the finding first, so the browser then scrolls to it with its body laid out
  document.addEventListener('click', (e) => { const a = e.target.closest?.('a[href^="#"]'); if (a) reveal(a.getAttribute('href').slice(1)); });
  addEventListener('hashchange', () => reveal(location.hash.slice(1))?.scrollIntoView());
  const target = reveal(location.hash.slice(1));
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

const settle = findings();
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
  const figs = { modes: figModes, overlap: figOverlap, paired: figPaired, steps: figSteps, hard: figHard, easy: figEasy, approach: figApproach, safety: figSafety };
  for (const [k, f] of Object.entries(figs)) { const el = $(`#fig-${k}`); if (el) f(el, R); }
}).catch((e) => {
  console.error(e);
  $$('.fig-body').forEach((el) => { el.innerHTML = '<p class="fig-note">This figure could not be loaded.</p>'; });
}).finally(() => { toc(); clips(); settle(); });
