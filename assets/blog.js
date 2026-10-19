/* The blog's figures and numbers. The results are computed here from data/exam.json and data/tasks.json, the files the
   leaderboard reads, with the leaderboard's own rules (the core set; the latest finished attempt per model and test; head to
   head on the tests every ranked model sat), so the blog and the site cannot disagree; task types come from data/atlas.json,
   as on the task pages. data/blog.json (scripts/export_blog.py) adds the few numbers the site does not hold. Numbers in the text are <span data-s="key">, filled
   from the same computation. app.js draws the navigation and the footer. */

const BASE = new URL('../', import.meta.url).pathname;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
const int = (n) => Number(n || 0).toLocaleString('en-US');
const getJSON = (p) => fetch(BASE + p, { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`); return r.json(); });

const MODES = { p: 'privileged', s: 'standard', t: 'standard-realtime' };
const TOP = ['codex-gpt6_astra-high', 'claude_code-opus_5_5-high', 'antigravity_cli-gemini_4_argon-high'];   // the three strongest
const MIN_BODY = 20;   // a body gets its own row in the body chart from this many standard tests
const MIN_HARD = 8;   // a suite counts among the hardest from this many tests in the setting

/* ---------------------------------------------------------------------------------------------- numbers */

/** Everything the article says about results, from the site's data. A test is one task in one setting; standard counts
 *  standard-realtime in, as the leaderboard does. */
function compute(ex, tasks, b, atlas) {
  const runs = ex.leaderboard.shared.runs;
  const run = Object.fromEntries(ex.runs.map((r) => [r.id, r]));
  const name = (id) => run[id]?.model || id;
  const core = tasks.filter((t) => t.set === 'core');
  const v = (t, r, m) => t.results?.[r]?.[m]?.s;
  const graded = (t, r, m) => v(t, r, m) === 'S' || v(t, r, m) === 'F';
  const ok = (t, r, m) => v(t, r, m) === 'S';
  // head to head: the core tests every ranked run sat, as [task, mode] pairs
  const h2h = (m) => core.filter((t) => (t.core || '').includes(m) && runs.every((r) => graded(t, r, m))).map((t) => [t, m]);
  const H = { p: h2h('p'), s: [...h2h('s'), ...h2h('t')], t: h2h('t') };
  const solved = (L, r) => L.filter(([t, m]) => ok(t, r, m)).length;
  const anyOf = (L, rs = runs) => L.filter(([t, m]) => rs.some((r) => ok(t, r, m))).length;
  const board = runs.map((r) => ({ id: r, name: name(r), harness: run[r]?.harness || '', p: solved(H.p, r), s: solved(H.s, r) }))
    .sort((x, y) => y.s - x.s || y.p - x.p);
  const best = board[0];
  // the same task in two settings, per agent: tasks whose two tests are both in the core set and both graded for it
  const paired = (a, c) => runs.map((r) => {
    const L = core.filter((t) => (t.core || '').includes(a) && (t.core || '').includes(c) && graded(t, r, a) && graded(t, r, c));
    return { id: r, name: name(r), n: L.length, a: L.filter((t) => ok(t, r, a)).length, c: L.filter((t) => ok(t, r, c)).length,
      both: L.filter((t) => ok(t, r, a) && ok(t, r, c)).length };
  });
  const ps = paired('p', 's'), st = paired('s', 't');
  // the findings keep the three settings apart: standard here is standard alone
  const M = { p: H.p, s: h2h('s'), t: H.t };
  const all3 = (L) => L.filter(([t, m]) => TOP.every((r) => ok(t, r, m))).length;
  const none3 = (L) => L.length - anyOf(L, TOP);
  const flash = runs.filter((r) => !TOP.includes(r));
  const ranked = (L) => [...runs].sort((x, y) => solved(L, y) - solved(L, x));
  const sameOrder = ['p', 's', 't'].every((k) => ranked(M[k]).slice(0, 3).join() === TOP.join());
  const flashTop = Math.max(...flash.map((r) => Math.max(...['p', 's', 't'].map((k) => solved(M[k], r) / (M[k].length || 1)))));
  // groups of tests: by task type (a task can have several), by body, by suite
  const group = (L, keys) => { const g = {}; for (const x of L) for (const k of keys(x[0])) (g[k] ??= []).push(x); return g; };
  const ttOf = (t) => atlas?.tasks?.[`${t.suite}/${t.id}`]?.tt || [];
  const types = { p: group(M.p, ttOf), s: group(M.s, ttOf) };
  const bodiesH = { p: group(M.p, (t) => [t.body]), s: group(M.s, (t) => [t.body]) };
  const suitesH = { p: group(M.p, (t) => [t.suite]), s: group(M.s, (t) => [t.suite]) };
  // the three strongest: how many of them solved each test
  const overlap = (L) => [3, 2, 1, 0].map((k) => L.filter(([t, m]) => TOP.filter((r) => ok(t, r, m)).length === k).length);
  const only = (L, r) => L.filter(([t, m]) => ok(t, r, m) && !TOP.some((o) => o !== r && ok(t, o, m))).length;
  const flashFill = (L) => L.filter(([t, m]) => !TOP.some((r) => ok(t, r, m)) && flash.some((r) => ok(t, r, m))).length;
  const budgets = core.map((t) => t.budget_min).filter(Boolean);
  const dur = (min) => (min % 60 ? `${min} minutes` : `${['', 'one', 'two', 'three', 'four', 'five', 'six'][min / 60] || min / 60} hour${min > 60 ? 's' : ''}`);
  const cb = b.crossbench || {};
  const rsb = board.map((r) => solved(H.s.filter(([t]) => t.suite === 'embodied-safety-exam'), r.id));
  const sf = b.safety;
  const coreModes = (m) => core.filter((t) => (t.core || '').includes(m)).length;
  const bodies = {};
  for (const t of tasks) bodies[t.body] = (bodies[t.body] || 0) + 1;
  const tot = ex.totals;
  const P = (a, n) => `${pct(a, n)}%`, F = (a, n) => `${int(a)} of ${int(n)}`, Q = (a, n) => `${a && !pct(a, n) ? '<1' : pct(a, n)}% (${int(a)}/${int(n)})`;
  const QL = (L, f) => Q(f(L || []), (L || []).length);
  const sample = (x) => (x ? Q(x[0], x[1]) : null);
  // per group: all3_<mode>_<type>, none3_<mode>_<type>, bnone3_<mode>_<body>, snone6_<mode>_<suite>, hand_p_<i> for TOP[i]
  const per = {};
  for (const k of ['p', 's']) {
    for (const [tt, L] of Object.entries(types[k])) { per[`all3_${k}_${tt}`] = QL(L, all3); per[`none3_${k}_${tt}`] = QL(L, none3); }
    for (const [bd, L] of Object.entries(bodiesH[k])) per[`bnone3_${k}_${bd}`] = QL(L, none3);
    for (const [su, L] of Object.entries(suitesH[k])) per[`snone6_${k}_${su}`] = QL(L, (x) => x.length - anyOf(x));
  }
  TOP.forEach((r, i) => { per[`hand_p_${i}`] = QL(bodiesH.p.hand, (L) => solved(L, r)); });
  // the suites where the three strongest solve least: the top three by the share none of them solved, from MIN_HARD tests
  const suiteName = Object.fromEntries(ex.suites.map((x) => [x.id, x.name]));
  const hard = (k) => Object.entries(suitesH[k]).filter(([, L]) => L.length >= MIN_HARD)
    .sort(([, x], [, y]) => none3(y) / y.length - none3(x) / x.length || y.length - x.length).slice(0, 3)
    .map(([su, L]) => `${suiteName[su] || su} ${QL(L, none3)}`);
  const list = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs[0] || '');
  per.hard_p = `none of them solves ${list(hard('p'))}`; per.hard_s = list(hard('s'));
  const allM = [...M.p, ...M.s, ...M.t];
  // what each of the three solves alone: by task type (privileged for GPT-6 Astra, standard for the other two, as the
  // analysis reads it), and for GPT-6 Astra the suites
  const uniq = {};
  [['p', 0], ['s', 1], ['s', 2]].forEach(([k, i]) => {
    const L = M[k].filter(([t, m]) => ok(t, TOP[i], m) && !TOP.some((o) => o !== TOP[i] && ok(t, o, m)));
    const by = (keys) => { const c = {}; for (const [t] of L) for (const x of keys(t)) c[x] = (c[x] || 0) + 1; return Object.entries(c).sort((a, b) => b[1] - a[1]); };
    const tt = by(ttOf), lab = (x) => (atlas?.taxonomy?.tt?.[x] || x).toLowerCase();
    uniq[`uniq_types_${i}`] = list(tt.slice(0, 2).map(([x]) => lab(x)));
    uniq[`uniq_list_${i}`] = list(tt.slice(0, 2).map(([x, n]) => `${lab(x)} ${n}`));
    if (i === 0) uniq.uniq_suites_0 = list(by((t) => [t.suite]).slice(0, 2).map(([x, n]) => `${suiteName[x] || x} (${n})`));
  });
  const rsbS = M.s.filter(([t]) => t.suite === 'embodied-safety-exam');
  const S = {
    tasks: int(tot.instances), tests: int(tot.task_dirs), suites: int(tot.suites), robots: int(tot.robots),
    core_tasks: int(tot.core_tasks), core_tests: int(tot.core_dirs),
    core_p: int(coreModes('p')), core_s: int(coreModes('s')), core_t: int(coreModes('t')),
    n_runs: runs.length, n_runs_word: ['None', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'][runs.length] || int(runs.length), np: int(H.p.length), ns: int(H.s.length), nt: int(H.t.length),
    best: best.name, best_s: F(best.s, H.s.length), best_s_pct: P(best.s, H.s.length), best_p: F(best.p, H.p.length), best_p_pct: P(best.p, H.p.length),
    ...per,
    ns_only: int(M.s.length),
    rsb_s_n: int(rsbS.length), a_s_norsb: Q(solved(M.s, TOP[0]) - solved(rsbS, TOP[0]), M.s.length - rsbS.length),
    a_p: Q(solved(M.p, TOP[0]), M.p.length), a_s: Q(solved(M.s, TOP[0]), M.s.length), a_t: Q(solved(M.t, TOP[0]), M.t.length),
    order_note: sameOrder ? `In all three settings the order at the top is the same, ${TOP.map(name).join(', ')}, and the three Flash-class models are far behind, at most ${Math.round(100 * flashTop)}% of any setting.`
      : `The order at the top differs between the settings; the three Flash-class models are far behind, at most ${Math.round(100 * flashTop)}% of any setting.`,
    flash_any: int(anyOf(allM, flash)), astra_all: int(solved(allM, TOP[0])),
    budget_lo: dur(Math.min(...budgets)), budget_hi: dur(Math.max(...budgets)),
    none6_p: QL(M.p, (L) => L.length - anyOf(L)), none6_s: QL(M.s, (L) => L.length - anyOf(L)), none6_t: QL(M.t, (L) => L.length - anyOf(L)),
    nr_p: sample(cb.no_return?.p), nr_s: sample(cb.no_return?.s), nr_t: sample(cb.no_return?.t),
    ap_p: sample(cb.approach?.p), ap_s: sample(cb.approach?.s), ap_t: sample(cb.approach?.t),
    cb_sample: cb.sample == null ? null : int(cb.sample), cb_snapshot: (cb.snapshot || '').slice(0, 10) || null,
    min_body: MIN_BODY,
    u_p_any: QL(M.p, (L) => anyOf(L, TOP)), u_p_astra: QL(M.p, (L) => solved(L, TOP[0])),
    u_s_any: QL(M.s, (L) => anyOf(L, TOP)), u_s_astra: QL(M.s, (L) => solved(L, TOP[0])),
    only_p_0: QL(M.p, (L) => only(L, TOP[0])), only_s_1: QL(M.s, (L) => only(L, TOP[1])), only_s_2: QL(M.s, (L) => only(L, TOP[2])),
    ...uniq,
    flash_rate: Q(flash.reduce((a, r) => a + solved(allM, r), 0), flash.length * allM.length), astra_rate: Q(solved(allM, TOP[0]), allM.length),
    argon_uf_p: sample(cb.argon_unfiltered?.p), argon_uf_s: sample(cb.argon_unfiltered?.s),
    opus_cb_p: sample(cb.opus_same_snapshot?.p), opus_cb_s: sample(cb.opus_same_snapshot?.s),
    ff_p: F(flashFill(M.p), none3(M.p)), ff_s: F(flashFill(M.s), none3(M.s)),
    second: board[1].name, third: board[2].name, flash_max: P(Math.max(...board.slice(3).map((r) => r.s)), H.s.length),
    any_s: int(anyOf(H.s)), none_s: int(H.s.length - anyOf(H.s)), none_s_pct: P(H.s.length - anyOf(H.s), H.s.length),
    none_p: F(H.p.length - anyOf(H.p), H.p.length),
    ps_astra: `${int(ps[runs.indexOf(TOP[0])].a)} of ${int(ps[runs.indexOf(TOP[0])].n)}`, ps_astra_s: int(ps[runs.indexOf(TOP[0])].c),
    ps_astra_both: F(ps[runs.indexOf(TOP[0])].both, ps[runs.indexOf(TOP[0])].a), ps_astra_both_pct: P(ps[runs.indexOf(TOP[0])].both, ps[runs.indexOf(TOP[0])].a),
    st_n: int(Math.max(...st.map((r) => r.n))),
    st_astra: `${st[runs.indexOf(TOP[0])].a} and ${st[runs.indexOf(TOP[0])].c}`, st_argon: `${st[runs.indexOf(TOP[2])].a} and ${st[runs.indexOf(TOP[2])].c}`,
    st_opus: `${st[runs.indexOf(TOP[1])].a} and ${st[runs.indexOf(TOP[1])].c}`,
    rsb_n: int(H.s.filter(([t]) => t.suite === 'embodied-safety-exam').length), rsb_lo: int(Math.min(...rsb)), rsb_hi: int(Math.max(...rsb)),
    sf_trials: int(sf.trials), sf_fail: int(sf.failures), sf_harm: int(sf.by_outcome.harm), sf_harm_pct: P(sf.by_outcome.harm, sf.failures),
    sf_done: int(sf.by_outcome.done), sf_done_pct: P(sf.by_outcome.done, sf.failures), sf_right: int(sf.harm_right_call),
    sf_rt: int(sf.modes['standard-realtime'] || 0), sf_snapshot: b.snapshot,
    argon_filtered: int(b.argon_filtered), built: (ex.build?.at || '').slice(0, 10),
  };
  return { S, H, M, board, ps, st, mix: b.crossbench?.approach_mix, types, bodiesH, all3, none3, overlap, bodies, safety: sf, name, tt: atlas?.taxonomy?.tt || {}, bodyName: ex.bodies || {} };
}

function fill(S) {
  $$('[data-s]').forEach((el) => { const v = S[el.dataset.s]; el.textContent = v == null ? '?' : v; });
}

/* --------------------------------------------------------------------------------------------- figures */

const legend = (segs) => `<div class="legend">${segs.map(([, l, c]) => `<span><i style="background:var(${c})"></i>${esc(l)}</span>`).join('')}</div>`;

/** A stacked bar per row; segs = [[key, label, colour var, light text?], ...]. */
function stackRows(rows, segs) {
  return `<div class="bars">${rows.map((r) => `<div class="bar-row"><div class="who">${r.label}</div><div class="stack">${segs.map(([k, l, c, lt]) => {
    const v = r[k] || 0, p = r.n ? (100 * v) / r.n : 0;
    return v ? `<span class="${lt ? 'lt' : ''}" style="width:${p}%;background:var(${c})" title="${esc(`${l}: ${v} of ${r.n}`)}">${p >= 7 ? v : ''}</span>` : '';
  }).join('')}</div><div class="n">${int(r.n)}</div></div>`).join('')}</div>`;
}

/** The head-to-head: standard first, as on the leaderboard. */
function figOverall(el, R) {
  const { board, H } = R;
  const cell = (s, n, c) => `<td><div class="ov"><span style="width:${n ? (100 * s) / n : 0}%;background:var(${c})"></span></div><b>${pct(s, n)}%</b><small>${s}/${n}</small></td>`;
  el.innerHTML = `<p class="fig-title">Tests solved on the core set (the tests every agent sat)</p>
    <div class="ovt-wrap"><table class="ovt"><thead><tr><th>Agent · harness</th><th>Standard <small>(${H.s.length} tests)</small></th><th>Privileged <small>(${H.p.length} tests)</small></th></tr></thead>
    <tbody>${board.map((r) => `<tr><td class="who">${esc(r.name)} <small>· ${esc(r.harness)}</small></td>${cell(r.s, H.s.length, '--std')}${cell(r.p, H.p.length, '--priv')}</tr>`).join('')}</tbody></table></div>`;
}

const ROWS = [['s', '<span class="m-s">Standard</span>'], ['t', '<span class="m-r">Realtime</span>'], ['p', '<span class="m-p">Privileged</span>']];

const solvedBy = (t, r, m) => t.results?.[r]?.[m]?.s === 'S';

/** Finding 1: each agent's share of the core tests every agent sat, in each of the three settings. */
function figModes(el, R) {
  const { M, board } = R;
  const cell = (L, r, c) => { const s = L.filter(([t, m]) => solvedBy(t, r, m)).length, n = L.length;
    return `<td><div class="ov"><span style="width:${n ? (100 * s) / n : 0}%;background:var(${c})"></span></div><b>${pct(s, n)}%</b><small>${s}/${n}</small></td>`; };
  el.innerHTML = `<p class="fig-title">Each agent’s share of the core tests every agent sat, by setting</p>
    <div class="ovt-wrap"><table class="ovt"><thead><tr><th>Agent</th><th>Privileged <small>(${M.p.length})</small></th><th>Standard <small>(${M.s.length})</small></th><th>Realtime <small>(${M.t.length})</small></th></tr></thead>
    <tbody>${board.map((r) => `<tr><td class="who">${esc(r.name)}</td>${cell(M.p, r.id, '--priv')}${cell(M.s, r.id, '--std')}${cell(M.t, r.id, '--rt')}</tr>`).join('')}</tbody></table></div>`;
}

/** Finding 3: the same task in both settings, per agent: solved in both, only with privileged access, only under
 *  standard rules, in neither. */
function figPaired(el, R) {
  const segs = [['both', 'Solved in both', '--ink'], ['onlyP', 'Only with privileged access', '--priv'], ['onlyS', 'Only under standard rules', '--std'], ['neither', 'In neither', '--c-other', 1]];
  const rows = R.ps.map((r) => ({ label: esc(r.name), n: r.n, both: r.both, onlyP: r.a - r.both, onlyS: r.c - r.both, neither: r.n - r.a - r.c + r.both }))
    .sort((x, y) => y.onlyP + y.both - x.onlyP - x.both);
  el.innerHTML = `<p class="fig-title">The same task in two settings: what each agent solved (tasks whose privileged and standard tests are both in the core set)</p>${legend(segs)}${stackRows(rows, segs)}`;
}

/** Finding 2: standard against standard-realtime, the same tasks, as counts (few tasks). */
function figRealtime(el, R) {
  const rows = R.st.filter((r) => r.a || r.c);
  el.innerHTML = `<p class="fig-title">Tasks with a standard and a standard-realtime test: solved in each (${Math.max(...R.st.map((r) => r.n))} tasks)</p>
    <div class="ovt-wrap"><table class="ovt"><thead><tr><th>Agent</th><th>Standard</th><th>Standard-realtime</th><th>Both</th></tr></thead>
    <tbody>${rows.map((r) => `<tr><td class="who">${esc(r.name)}</td><td><b>${r.a}</b><small>of ${r.n}</small></td><td><b>${r.c}</b><small>of ${r.n}</small></td><td><b>${r.both}</b></td></tr>`).join('')}</tbody></table></div>
    <p class="fig-note">Agents that solved none in either are left out.</p>`;
}

/** Finding 3: per group of tests (task type or body), how many of the three strongest solved them, in each setting. */
function mixTable(el, R, groups, label, min) {
  const segs = [['k3', 'All three', '--c-honest'], ['k12', 'One or two', '--f-possible'], ['k0', 'None of the three', '--c-other', 1]];
  const cell = (L) => {
    if (!L?.length) return '<td><small>no tests</small></td>';
    const n = L.length, a = R.all3(L), z = R.none3(L), seg = { k3: a, k12: n - a - z, k0: z };
    return `<td><div class="mix">${segs.map(([k, l, c, lt]) => (seg[k] ? `<span class="${lt ? 'lt' : ''}" style="width:${(100 * seg[k]) / n}%;background:var(${c})" title="${esc(`${l}: ${seg[k]} of ${n}`)}"></span>` : '')).join('')}</div><small>${pct(a, n)}% · ${pct(z, n)}% of ${n}</small></td>`;
  };
  const keys = Object.keys({ ...groups.p, ...groups.s });
  const big = keys.filter((k) => (groups.s[k]?.length || 0) >= min)
    .sort((x, y) => R.none3(groups.s[x]) / groups.s[x].length - R.none3(groups.s[y]) / groups.s[y].length);
  const small = keys.filter((k) => !big.includes(k));
  return `${legend(segs)}<div class="ovt-wrap"><table class="ovt mixt"><thead><tr><th>${label}</th><th>Standard</th><th>Privileged</th></tr></thead>
    <tbody>${big.map((k) => `<tr><td class="who">${esc(R.lab(k))}</td>${cell(groups.s[k])}${cell(groups.p[k])}</tr>`).join('')}</tbody></table></div>
    <p class="fig-note">Under each bar: the share all three solved · the share none of them solved, of so many tests. Ordered by the standard share none solved.${small.length
      ? ` Fewer than ${min} standard tests: ${small.map((k) => `${esc(R.lab(k))} (${groups.s[k]?.length || 0} standard, ${groups.p[k]?.length || 0} privileged)`).join(', ')}.` : ''}</p>`;
}

function figTypes(el, R) {
  el.innerHTML = `<p class="fig-title">Tests by task type: how many of ${TOP.map((r) => esc(R.name(r))).join(', ')} solved them</p>`
    + mixTable(el, { ...R, lab: (k) => R.tt[k] || k }, R.types, 'Task type', 1);
}

function figBodies(el, R) {
  el.innerHTML = `<p class="fig-title">Tests by body: how many of the three strongest agents solved them</p>`
    + mixTable(el, { ...R, lab: (k) => R.bodyName[k] || k }, R.bodiesH, 'Body', MIN_BODY);
}

/** Finding 2: which of the three strongest agents solved each test, in each setting. */
function figOverlap(el, R) {
  const [A, O, G] = TOP, nm = (r) => R.name(r).replace(/^Claude /, '');
  const segs = [['k', 'All three', '--ink'], ['ao', `${nm(A)} + ${nm(O)}`, '--std'], ['ag', `${nm(A)} + ${nm(G)}`, '--f-possible'], ['a', `Only ${nm(A)}`, '--rt'],
    ['go', `${nm(G)} + ${nm(O)}`, '--l-thought'], ['o', `Only ${nm(O)}`, '--c-claim'], ['g', `Only ${nm(G)}`, '--f-likely'], ['z', 'None of the three', '--c-other', 1]];
  const key = (t, m) => { const s = TOP.map((r) => solvedBy(t, r, m)); return s[0] && s[1] && s[2] ? 'k' : s[0] && s[1] ? 'ao' : s[0] && s[2] ? 'ag' : s[0] ? 'a'
    : s[1] && s[2] ? 'go' : s[1] ? 'o' : s[2] ? 'g' : 'z'; };
  const row = (L, label) => { const r = { label, n: L.length }; for (const [t, m] of L) { const k = key(t, m); r[k] = (r[k] || 0) + 1; } return r; };
  el.innerHTML = `<p class="fig-title">Core tests by which of the three strongest agents solved them</p>${legend(segs)}
    ${stackRows([['p', '<span class="m-p">Privileged</span>'], ['s', '<span class="m-s">Standard</span>'], ['t', '<span class="m-r">Realtime</span>']].map(([k, l]) => row(R.M[k], l)), segs)}`;
}

/** Finding 6: the approach each sampled attempt was judged on, per setting (the analysis's sample). */
function figApproach(el, R) {
  const mix = R.mix || {};
  const segs = [['code', 'Code to control', '--ink'], ['direct', 'Direct control', '--rt'], ['train', 'Train a model to control', '--priv'], ['mixed', 'Mixed', '--f-possible'], ['none', 'No control plan', '--c-other', 1]];
  const rows = [['p', '<span class="m-p">Privileged</span>'], ['s', '<span class="m-s">Standard</span>'], ['t', '<span class="m-r">Realtime</span>']]
    .filter(([k]) => mix[k]).map(([k, l]) => ({ label: l, ...mix[k] }));
  el.innerHTML = `<p class="fig-title">How the sampled attempts controlled the robot, by setting</p>${legend(segs)}${stackRows(rows, segs)}
    <p class="fig-note">Sampled attempts, each counted once by the approach it was judged on; labelled by an agent reading the logs, not yet checked by hand.</p>`;
}

/** Embodied Safety Exam: failed core tests by the benchmark's verdict. */
function figSafety(el, R) {
  const f = R.safety, o = f.by_outcome;
  const segs = [['right', 'Harm from the robot’s motion, though the agent declined the hazard', '--c-claim'], ['harm', 'Other harm from the robot’s motion', '--l-before'],
    ['done', 'Carried out a hazardous request', '--l-thought'], ['gave', 'Gave up', '--c-silent', 1], ['other', 'Other or no verdict', '--c-other', 1]];
  const row = { label: 'Failed attempts', n: f.failures, right: f.harm_right_call, harm: o.harm - f.harm_right_call, done: o.done, gave: o.gave_up, other: o.other };
  el.innerHTML = `<p class="fig-title">How the agents’ failed attempts at Embodied Safety Exam’s core tests failed, by the benchmark’s verdict</p>${legend(segs)}${stackRows([row], segs)}`;
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
  const sub3 = (h3) => esc([...h3.childNodes].filter((n) => !n.classList?.contains('fn')).map((n) => n.textContent).join('').trim());
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
    const head = $('.post-head');
    rail.classList.toggle('show', (!head || head.getBoundingClientRect().bottom < 0) && first.getBoundingClientRect().top < innerHeight * 0.5);
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

Promise.all([getJSON('data/exam.json'), getJSON('data/tasks.json'), getJSON('data/blog.json'), getJSON('data/atlas.json')]).then(([ex, tasks, b, atlas]) => {
  const R = compute(ex, tasks, b, atlas);
  fill(R.S);
  const bodies = $('#bodies');
  if (bodies) bodies.textContent = Object.entries(R.bodies).sort((a, c) => c[1] - a[1]).map(([k, n]) => `${int(n)} ${(ex.bodies?.[k] || k).toLowerCase()}`).join(', ');
  const figs = { overall: figOverall, modes: figModes, paired: figPaired, realtime: figRealtime, types: figTypes, bodies: figBodies, overlap: figOverlap, approach: figApproach, safety: figSafety };
  for (const [k, f] of Object.entries(figs)) { const el = $(`#fig-${k}`); if (el) f(el, R); }
}).catch((e) => {
  console.error(e);
  $$('.fig-body').forEach((el) => { el.innerHTML = '<p class="fig-note">This figure could not be loaded.</p>'; });
}).finally(() => { toc(); clips(); });
