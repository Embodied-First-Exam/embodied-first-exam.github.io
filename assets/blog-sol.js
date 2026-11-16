/* The GPT-6.1 Sol post: its figures and numbers. As in the Claude Fable 5.2 post (blog-fable.js), the results are computed here
   from data/exam.json and data/tasks.json, the files the leaderboard reads, with the leaderboard's rules (the core set; the
   counted attempt per agent and test; all the core tests of each setting), so the
   post and the leaderboard cannot disagree. data/blog-sol.json (scripts/export_blog_sol.py) adds how the attempts went
   (list-price cost, agent time, output tokens) from the paper's cost table. Numbers in the text are <span data-f="key">,
   filled from the same computation; a key that cannot be computed shows "?". GPT-6.1 Sol's own headline numbers are written
   in the page as the report gives them; REPORTED below checks them against the site's data and says so in the console
   if they differ. The contents rail, the clips and the Enlarge buttons are the Fable post's. */

const BASE = new URL('../', import.meta.url).pathname;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
const int = (n) => Number(n || 0).toLocaleString('en-US');
const getJSON = (p) => fetch(BASE + p, { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`); return r.json(); });

const MODE_LABEL = { p: 'Privileged', s: 'Standard', t: 'Realtime', o: 'Overall' };
const MODE_CLS = { p: 'm-p', s: 'm-s', t: 'm-r', o: '' };
const INK = { p: '--priv-ink', s: '--std-ink', t: '--rt-ink' };
const S = 'codex-gpt6_1_sol-high', A = 'codex-gpt6_astra-high', F = 'claude_code-fable_5_2-high', O = 'claude_code-opus_5_5-high',
  G = 'antigravity_cli-gemini_4_argon-high';
const COL = { [S]: 'var(--ag-sol)', [A]: 'var(--ag-astra)', [F]: 'var(--ag-fable)', [O]: 'var(--ag-opus)', [G]: 'var(--ag-argon)' };
const col = (r) => COL[r] || 'var(--flash)';
const BOARD_COL = new Set([S, A, F]);   // Figure 1 colours these three; the other seven are greys
const MIN_BENCH = 5;   // a suite gets a row from this many core tests in the setting
// GPT-6.1 Sol's results as the report gives them (456 tasks; 456 Standard, 391 Privileged, 54 Realtime tests)
const REPORTED = { s: 147, p: 281, t: 13, o: 132 };
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const nw = (n) => WORDS[n] || int(n);
const list = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs[0] || '');
const usd = (x) => (x == null ? null : `$${Number(x).toFixed(x >= 100 ? 0 : 1)}`);

/* ---------------------------------------------------------------------------------------------- numbers */

function compute(ex, tasks, bs) {
  const runs = ex.leaderboard.shared.runs;
  const run = Object.fromEntries(ex.runs.map((r) => [r.id, r]));
  const name = (id) => run[id]?.model || id;
  const short = (id) => name(id).replace(/^(Claude|GPT-6\.1|GPT-6|Gemini \d|Gemini) /, '').replace(/ \d.*$/, '');
  const core = tasks.filter((t) => t.set === 'core');
  const ok = (t, r, m) => t.results?.[r]?.[m]?.s === 'S';
  const sat = (m) => core.filter((t) => (t.core || '').includes(m));
  const M = { p: sat('p'), s: sat('s'), t: sat('t'), o: core };
  const solvedIn = (t, r, m) => (m === 'o' ? [...(t.core || '')].every((c) => ok(t, r, c)) : ok(t, r, m));
  const solved = (m, r, L = M[m]) => L.filter((t) => solvedIn(t, r, m)).length;
  const board = runs.map((r) => ({ id: r, p: solved('p', r), s: solved('s', r), t: solved('t', r), o: solved('o', r) }))
    .sort((x, y) => y.o - x.o || y.s - x.s || y.p - x.p);
  const order = board.map((x) => x.id);
  const rank = (m) => 1 + runs.filter((r) => solved(m, r) > solved(m, S)).length;
  // head to head with GPT-6 Astra, per setting
  const h2h = Object.fromEntries(['s', 'p', 't'].map((m) => {
    const c = { both: 0, x: 0, y: 0, none: 0, n: M[m].length };
    for (const t of M[m]) { const x = ok(t, S, m), y = ok(t, A, m); c[x && y ? 'both' : x ? 'x' : y ? 'y' : 'none'] += 1; }
    return [m, c];
  }));
  // the same task in two settings
  const PS = core.filter((t) => (t.core || '').includes('p') && (t.core || '').includes('s'));
  const paired = [F, A, S, O].map((r) => ({ id: r, name: name(r), n: PS.length, a: PS.filter((t) => ok(t, r, 'p')).length,
    c: PS.filter((t) => ok(t, r, 's')).length, both: PS.filter((t) => ok(t, r, 'p') && ok(t, r, 's')).length }));
  const P = Object.fromEntries(paired.map((r) => [r.id, r]));
  // suites, as in the report: the IKEA assembly tasks of RoboARC are a suite of their own
  const suiteName = Object.fromEntries(ex.suites.map((x) => [x.id, x.name]));
  const benchOf = (t) => (t.suite === 'roboarc' && /ikea/i.test(t.id) ? 'ikea' : t.suite);
  const benchName = (k) => (k === 'ikea' ? 'IKEA assembly' : suiteName[k] || k);
  const suites = (m) => {
    const g = {};
    for (const t of M[m]) (g[benchOf(t)] ??= []).push(t);
    return Object.entries(g).map(([id, L]) => ({ id, n: L.length, x: L.filter((t) => ok(t, S, m)).length, y: L.filter((t) => ok(t, A, m)).length,
      xo: L.filter((t) => ok(t, S, m) && !ok(t, A, m)).length, yo: L.filter((t) => ok(t, A, m) && !ok(t, S, m)).length,
      best: Math.max(...runs.filter((r) => r !== S).map((r) => L.filter((t) => ok(t, r, m)).length)) }))
      .sort((p, q) => (q.x - q.y) - (p.x - p.y) || q.n - p.n);
  };
  // the tests GPT-6.1 Sol fails, by how many of the other agents solve them; and the tests only it solves
  const others = runs.filter((r) => r !== S);
  const miss = Object.fromEntries(['p', 's', 't'].map((m) => {
    const k = (t) => others.filter((r) => ok(t, r, m)).length;
    const fail = M[m].filter((t) => !ok(t, S, m));
    const oth = fail.filter((t) => k(t) > 0);
    const g = {};
    for (const t of oth) (g[benchOf(t)] ??= []).push(t);
    return [m, { n: M[m].length, fail: fail.length, oth: oth.length, k0: fail.length - oth.length,
      k1: oth.filter((t) => k(t) === 1).length, k23: oth.filter((t) => k(t) >= 2 && k(t) <= 3).length, k4: oth.filter((t) => k(t) >= 4).length,
      only: M[m].filter((t) => ok(t, S, m) && k(t) === 0).length,
      by: Object.fromEntries(others.map((r) => [r, oth.filter((t) => ok(t, r, m)).length])),
      suites: Object.entries(g).map(([id, L]) => ({ id, n: L.length, k4: L.filter((t) => k(t) >= 4).length })).sort((x, y) => y.k4 - x.k4 || y.n - x.n || x.id.localeCompare(y.id)) }];
  }));
  const B = bs?.runs || {};
  const b = (r, m, k) => B[r]?.[m]?.[k];
  const Q = (a, n) => `${pct(a, n)}% (${int(a)}/${int(n)})`;
  const fr = (a, n) => `${int(a)} of ${int(n)}`;
  const costAll = (r) => { const n = ['p', 's', 't'].reduce((x, m) => x + (b(r, m, 'n_cost') || 0), 0);
    return n ? ['p', 's', 't'].reduce((x, m) => x + (b(r, m, 'usd_total') || 0), 0) / n : null; };
  const perSolve = (r, m) => (b(r, m, 'usd_total') != null && solved(m, r) ? b(r, m, 'usd_total') / solved(m, r) : null);
  const ratio = (x, y) => (x && y ? `${(x / y).toFixed(1)}` : null);
  const keep = (r) => `${pct(P[r].both, P[r].a)}% (${int(P[r].both)}/${int(P[r].a)})`;
  const cheapest = [S, A, F, O, G].every((r) => r === S || (b(r, 's', 'usd_mean') ?? Infinity) > (b(S, 's', 'usd_mean') ?? Infinity));
  const X = {
    built: (ex.build?.at || '').slice(0, 10),
    n_s: int(M.s.length), n_p: int(M.p.length), n_t: int(M.t.length), n_o: int(M.o.length), n_ps: int(PS.length),
    s_s: Q(solved('s', S), M.s.length), s_p: Q(solved('p', S), M.p.length), s_t: Q(solved('t', S), M.t.length), s_o: Q(solved('o', S), M.o.length),
    a_s: Q(solved('s', A), M.s.length), a_p: Q(solved('p', A), M.p.length), a_t: Q(solved('t', A), M.t.length), a_o: Q(solved('o', A), M.o.length),
    a_t_n: int(solved('t', A)), s_t_n: int(solved('t', S)),
    gap_s: int(solved('s', A) - solved('s', S)), gap_o: int(solved('o', A) - solved('o', S)), gap_p: int(solved('p', A) - solved('p', S)),
    over_o_s: int(solved('s', S) - solved('s', O)),
    third: ['s', 'p', 't', 'o'].every((m) => rank(m) === 3) ? 'third in every setting and Overall' : `ranked ${['s', 'p', 't', 'o'].map((m) => `${rank(m)} (${MODE_LABEL[m]})`).join(', ')}`,
    h_s_x: int(h2h.s.x), h_s_y: int(h2h.s.y), h_p_x: int(h2h.p.x), h_p_y: int(h2h.p.y), h_t_x: int(h2h.t.x), h_t_y: int(h2h.t.y),
    h_s_both: int(h2h.s.both), h_p_both: int(h2h.p.both),
    keep_s: keep(S), keep_a: keep(A), keep_f: keep(F), keep_o: keep(O), lost_s: int(P[S].a - P[S].both), only_s_ps: int(P[S].c - P[S].both),
    // how the attempts went (data/blog-sol.json, the paper's cost table)
    cost_s_s: usd(b(S, 's', 'usd_mean')), cost_a_s: usd(b(A, 's', 'usd_mean')), cost_f_s: usd(b(F, 's', 'usd_mean')),
    cost_o_s: usd(b(O, 's', 'usd_mean')), cost_g_s: usd(b(G, 's', 'usd_mean')),
    cost_s_all: usd(costAll(S)), cost_a_all: usd(costAll(A)), cost_ratio: ratio(costAll(A), costAll(S)), cost_ratio_s: ratio(b(A, 's', 'usd_mean'), b(S, 's', 'usd_mean')),
    ps_s_s_usd: usd(perSolve(S, 's')), ps_a_s_usd: usd(perSolve(A, 's')),
    cheapest: cheapest ? 'the least of the five strong agents' : 'not the least of the five strong agents',
    wall_s_s: b(S, 's', 'wall_med') != null ? `${Math.round(b(S, 's', 'wall_med'))} minutes` : null,
    wall_a_s: b(A, 's', 'wall_med') != null ? `${Math.round(b(A, 's', 'wall_med'))} minutes` : null,
    usd_ok_s: usd(b(S, 's', 'usd_med_ok')), usd_fail_s: usd(b(S, 's', 'usd_med_fail')),
    miss_fail_s: int(miss.s.fail), miss_none_s: int(miss.s.k0), miss_one_s: int(miss.s.k1), miss_astra_s: int(miss.s.by[A]),
    miss_k4: int(miss.p.k4 + miss.s.k4 + miss.t.k4), miss_k4_s: int(miss.s.k4), miss_k4_p: int(miss.p.k4), miss_k4_t: int(miss.t.k4),
    miss_top_s: (() => { const r = miss.s.suites.find((x) => x.k4); return r ? `${benchName(r.id)} (${r.k4})` : null; })(),
    only_s: int(miss.s.only), only_p: int(miss.p.only), only_t: int(miss.t.only), only_all: nw(miss.s.only + miss.p.only + miss.t.only),
    snapshot: bs?.snapshot || null,
  };
  // named suites: "<GPT-6.1 Sol> against <GPT-6 Astra>" and the suite's test count, per setting
  const SV = { dh: 'dexhand', bg: 'bigym2', ese: 'embodied-safety-exam', rd: 'robodojo', rl: 'robolab', mg: 'maniguard',
    b1k: 'behavior-1k', myo: 'myosuite', arc: 'roboarc', rw: 'robowits' };
  for (const m of ['p', 's', 't']) {
    const L = suites(m);
    for (const [k, id] of Object.entries(SV)) {
      const r = L.find((x) => x.id === id);
      if (r) { X[`sv_${k}_${m}`] = `${int(r.x)} against ${int(r.y)}`; X[`n_${k}_${m}`] = int(r.n); X[`x_${k}_${m}`] = int(r.x);
        X[`lead_${k}_${m}`] = r.x > r.best ? 'more than any other agent' : r.x === r.best ? 'as many as the best other agent' : 'fewer than another agent'; }
    }
  }
  const maxDiff = Math.max(...['s', 'p'].flatMap((m) => suites(m).filter((r) => r.n >= MIN_BENCH).map((r) => Math.abs(r.x - r.y))));
  X.max_diff = nw(maxDiff);
  // the headline against the site's data
  const live = { s: solved('s', S), p: solved('p', S), t: solved('t', S), o: solved('o', S) };
  const drift = Object.keys(REPORTED).filter((k) => REPORTED[k] !== live[k]);
  if (drift.length) console.warn('GPT-6.1 Sol: the site data differ from the report in', drift.map((k) => `${MODE_LABEL[k]} ${live[k]} (report ${REPORTED[k]})`).join(', '));
  return { X, M, board, order, h2h, paired, suites, benchName, name, short, solved, b, perSolve, miss, others };
}

function fill(X) {
  $$('[data-f]').forEach((el) => { const v = X[el.dataset.f]; el.textContent = v == null ? '?' : v; });
}

/* --------------------------------------------------------------------------------------------- figures */

const cap1 = (x) => `${x[0].toUpperCase()}${x.slice(1)}`.replace(/\.?\s*$/, '.');
const head = (say, cap, how) => `<p class="fig-cap"><span class="fc-t">${cap1(cap)}</span> ${say}${how ? ` ${cap1(how)}` : ''}</p>`;
const sw = (c) => `<i class="sw" style="background:${c}"></i>`;
const numbers = (heads, rows) => `<details class="nums"><summary>The numbers</summary><div class="tscroll"><table class="nt"><thead><tr>${heads.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
  <tbody>${rows.map((r) => `<tr>${r.map((c, i) => (i ? `<td>${c}</td>` : `<th scope="row">${c}</th>`)).join('')}</tr>`).join('')}</tbody></table></div></details>`;
const frac = (a, n) => `${int(a)}/${int(n)}`;
const boardCol = (r) => (BOARD_COL.has(r) ? COL[r] : 'var(--flash)');
const GREY_O = (R, r) => { const i = R.order.filter((x) => !BOARD_COL.has(x)).indexOf(r); return BOARD_COL.has(r) ? 1 : [1, 0.8, 0.62, 0.48, 0.36, 0.28, 0.22][i] ?? 0.2; };

/** Figure 1: grouped bars, one group per setting and Overall, one bar per agent in the leaderboard's order. */
function figBoard(el, R) {
  const V = ['s', 'p', 't', 'o'], N = R.order.length;
  const W = 760, H = 300, L = 34, B = 46, T = 16, gw = (W - L - 8) / V.length, bw = Math.min(16, (gw - 20 - (N - 1) * 3) / N), top = 100;
  const y = (v) => T + (H - T - B) * (1 - v / top);
  let svg = '';
  for (let g = 0; g <= top; g += 25) svg += `<line x1="${L}" x2="${W - 4}" y1="${y(g)}" y2="${y(g)}" class="gl"/><text x="${L - 6}" y="${y(g) + 3.5}" class="ax" text-anchor="end">${g}%</text>`;
  V.forEach((k, gi) => {
    const n = R.M[k].length, x0 = L + gi * gw + (gw - N * bw - (N - 1) * 3) / 2;
    R.order.forEach((r, i) => {
      const s = R.solved(k, r), v = n ? (100 * s) / n : 0, x = x0 + i * (bw + 3);
      svg += `<rect x="${x}" y="${y(v)}" width="${bw}" height="${Math.max(0.5, y(0) - y(v))}" rx="2" style="fill:${boardCol(r)};opacity:${GREY_O(R, r)}"><title>${esc(`${R.name(r)} · ${MODE_LABEL[k]}: ${s} of ${n} (${pct(s, n)}%)`)}</title></rect>`;
      if (BOARD_COL.has(r)) svg += `<text x="${x + bw / 2}" y="${y(v) - 4}" class="bv" text-anchor="middle">${pct(s, n)}</text>`;
    });
    svg += `<text x="${L + gi * gw + gw / 2}" y="${H - B + 18}" class="gx ${MODE_CLS[k]}" text-anchor="middle">${MODE_LABEL[k]}</text>`
      + `<text x="${L + gi * gw + gw / 2}" y="${H - B + 33}" class="ax" text-anchor="middle">${int(n)} ${k === 'o' ? 'tasks' : 'tests'}</text>`;
  });
  const legend = `<div class="legend">${R.order.map((r) => `<span><i class="sw" style="background:${boardCol(r)};opacity:${GREY_O(R, r)}"></i>${esc(R.name(r))}</span>`).join('')}</div>`;
  el.innerHTML = head(`${R.name(S)} is ${R.X.third}, behind ${R.name(F)} and ${R.name(A)}.`,
    'Success rate of each agent on the core set, by setting',
    'each bar is the share of a setting’s core tests that one agent solved (labelled in percent for the three agents in colour); Overall counts a core task as solved only if every setting it has was solved.')
    + legend + `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Success rate by agent and setting">${svg}</svg></div>`
    + numbers(['Agent', ...V.map((k) => MODE_LABEL[k])], R.order.map((r) => [esc(R.name(r)), ...V.map((k) => `${((100 * R.solved(k, r)) / R.M[k].length).toFixed(1)}% · ${frac(R.solved(k, r), R.M[k].length)}`)]));
}

/** A row of stacked segments (shares of n), the report's style. */
const sbRow = (who, segs, n, unit) => `<div class="sb-row"><span class="who">${who}</span><span class="sb-trk">${segs.map(([v, l, c, dk]) => (v
  ? `<span style="flex:${v} 1 0;background:${c}" title="${esc(`${l}: ${v} of ${n} ${unit}`)}">${(100 * v) / n >= 6 ? `<em${dk ? ' class="dk"' : ''}>${v}</em>` : ''}</span>` : '')).join('')}</span><span class="n">${int(n)}</span></div>`;
const sbAxis = (unit) => `<div class="sb-row ax"><span></span><span class="sb-ticks"><i style="left:0">0%</i><i style="left:50%">50%</i><i style="left:100%">100%</i></span><span class="n">${unit}</span></div>`;

/** Figure 2: the head-to-head with GPT-6 Astra, per setting: the tests both solve, only Sol, only Astra, neither. */
function figH2H(el, R) {
  const xN = R.short(S), yN = R.short(A);
  const segs = (c) => [[c.both, 'Both', 'var(--top)'], [c.x, `Only ${xN}`, COL[S]], [c.y, `Only ${yN}`, COL[A]], [c.none, 'Neither', 'var(--wf-none)', true]];
  const keys = [['Both', 'var(--top)'], [`Only ${xN}`, COL[S]], [`Only ${yN}`, COL[A]], ['Neither', 'var(--wf-none)']];
  el.innerHTML = head(`In the Standard Setting, ${R.name(S)} solves ${R.h2h.s.x} tests that ${R.name(A)} fails, and ${R.name(A)} ${R.h2h.s.y} that it fails.`,
    `Head to head: which of ${R.name(S)} and ${R.name(A)}, both in Codex, solved each core test, by setting`,
    'each row is one setting’s core tests; each segment is the share of tests with that pair of outcomes, and the number in it is the count.')
    + `<div class="legend">${keys.map(([l, c]) => `<span>${sw(c)}${esc(l)}</span>`).join('')}</div>`
    + `<div class="sb">${['s', 'p', 't'].map((m) => sbRow(`<b style="color:var(${INK[m]})">${MODE_LABEL[m]}</b>`, segs(R.h2h[m]), R.h2h[m].n, 'tests')).join('')}${sbAxis('tests')}</div>`
    + numbers(['Setting', 'Both', `Only ${xN}`, `Only ${yN}`, 'Neither', 'Tests'], ['s', 'p', 't'].map((m) => { const c = R.h2h[m]; return [MODE_LABEL[m], c.both, c.x, c.y, c.none, c.n]; }));
}

/** Figure 4: the same task in two settings, per agent: solved in both, only in Privileged, only in Standard, in neither. */
function figPaired(el, R) {
  const segs = (r) => [[r.both, 'Solved in both', 'var(--top)'], [r.a - r.both, 'Only in Privileged', 'var(--priv)'], [r.c - r.both, 'Only in Standard', 'var(--std)'],
    [r.n - r.a - r.c + r.both, 'In neither', 'var(--wf-none)', true]];
  const keys = [['Solved in both', 'var(--top)'], ['Only in Privileged', 'var(--priv)'], ['Only in Standard', 'var(--std)'], ['In neither', 'var(--wf-none)']];
  const s = R.paired.find((r) => r.id === S), f = R.paired.find((r) => r.id === F);
  el.innerHTML = head(`${R.name(S)} keeps ${pct(s.both, s.a)}% of the tasks it solves with privileged access when it has only the robot’s sensors, about as many as ${R.name(A)} and ${R.name(O)}, against ${pct(f.both, f.a)}% for ${R.name(F)}.`,
    'The same task in two settings: each agent’s outcome on the core tasks that have both a Privileged and a Standard test',
    `each row is one agent on the ${int(s.n)} core tasks with both tests; each segment is the share of tasks with that pair of outcomes.`)
    + `<div class="legend">${keys.map(([l, c]) => `<span>${sw(c)}${esc(l)}</span>`).join('')}</div>`
    + `<div class="sb">${R.paired.map((r) => sbRow(esc(r.name), segs(r), r.n, 'tasks')).join('')}${sbAxis('tasks')}</div>`
    + numbers(['Agent', 'Both', 'Only Privileged', 'Only Standard', 'Neither', 'Tasks', 'Privileged successes kept'], R.paired.map((r) => [esc(r.name), r.both, r.a - r.both, r.c - r.both, r.n - r.a - r.c + r.both, r.n, `${pct(r.both, r.a)}% · ${frac(r.both, r.a)}`]));
}

/** Figure 3: per suite and setting, how many more tests GPT-6.1 Sol solved than GPT-6 Astra (a diverging bar). */
function figSuites(el, R) {
  const rowsOf = (m) => R.suites(m).filter((r) => r.n >= MIN_BENCH);
  const mx = Math.max(1, ...['s', 'p'].flatMap((m) => rowsOf(m).map((r) => Math.abs(r.x - r.y))));
  const panel = (m) => {
    const row = (r) => {
      const d = r.x - r.y, w = (50 * Math.abs(d)) / mx, c = d > 0 ? COL[S] : COL[A];
      return `<div class="dp-row"><span class="who"><b>${esc(R.benchName(r.id))}</b><small>${int(r.n)} tests · ${pct(r.x, r.n)}% vs ${pct(r.y, r.n)}%</small></span>`
        + `<span class="dp-trk dv"><i class="gl" style="left:0"></i><i class="gl" style="left:100%"></i><i class="gl mid" style="left:50%"></i>`
        + (d ? `<span class="dvb" style="${d > 0 ? 'left:50%' : `left:${50 - w}%`};width:${w}%;background:${c}" title="${esc(`${R.benchName(r.id)}: ${R.name(S)} ${r.x}, ${R.name(A)} ${r.y} of ${r.n}`)}"></span>` : '')
        + `</span><span class="dp-v"><small class="net ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d)}</small></span></div>`;
    };
    return `<div class="dp ${m}"><p class="dp-h ${MODE_CLS[m]}">${MODE_LABEL[m]}</p><div class="dp-row dp-head"><span></span><span class="dvh"><small>${esc(R.short(A))} more</small><small>${esc(R.short(S))} more</small></span><span class="dp-v"><small>${esc(R.short(S))} − ${esc(R.short(A))}</small></span></div>${rowsOf(m).map(row).join('')}
      <div class="dp-row dp-ax"><span></span><span class="dp-trk"><i style="left:0">−${mx}</i><i style="left:50%">0</i><i style="left:100%">+${mx}</i></span><span></span></div></div>`;
  };
  el.innerHTML = head(`No suite separates ${R.name(S)} and ${R.name(A)} by more than ${R.X.max_diff} tests in either setting.`,
    `Difference in solved tests between ${R.name(S)} and ${R.name(A)}, by suite and setting`,
    `each bar is how many more of a suite’s core tests one agent solved than the other, in that agent’s colour; under each suite are the two success rates.`)
    + `<div class="legend"><span>${sw(COL[S])}${esc(R.name(S))} solves more</span><span>${sw(COL[A])}${esc(R.name(A))} solves more</span></div>`
    + `<div class="dps">${panel('s')}${panel('p')}</div><p class="fig-note">Suites with at least ${MIN_BENCH} core tests in the setting, by the difference in solved tests. The IKEA assembly tasks of RoboARC count as their own suite.</p>`
    + numbers(['Suite', 'Setting', 'Tests', R.short(S), R.short(A), `Only ${R.short(S)}`, `Only ${R.short(A)}`], ['s', 'p', 't'].flatMap((m) => R.suites(m).map((r) => [esc(R.benchName(r.id)), MODE_LABEL[m], r.n, r.x, r.y, r.xo, r.yo])));
}

/** Figure 8: the tests GPT-6.1 Sol fails, per setting, by how many of the other nine agents solve each one. */
function figMiss(el, R) {
  const K = [['k0', 'No other agent', 'var(--wf-none)', true], ['k1', 'One other agent', 'color-mix(in srgb, var(--ag-astra) 35%, var(--bg))'],
    ['k23', 'Two or three', 'color-mix(in srgb, var(--ag-astra) 65%, var(--bg))'], ['k4', 'Four or more', 'var(--ag-astra)']];
  const nO = R.others.length;
  el.innerHTML = head(`Most of the tests ${R.name(S)} fails are solved by no other agent either.`,
    `The core tests that ${R.name(S)} fails, by how many of the other ${nw(nO)} agents solve each one`,
    'each row is one setting; each segment is the share of the tests it fails, and the number in it is the count.')
    + `<div class="legend">${K.map(([, l, c]) => `<span>${sw(c)}${esc(l)}</span>`).join('')}</div>`
    + `<div class="sb">${['s', 'p', 't'].map((m) => sbRow(`<b style="color:var(${INK[m]})">${MODE_LABEL[m]}</b>`, K.map(([k, l, c, dk]) => [R.miss[m][k], l, c, dk]), R.miss[m].fail, 'failed tests')).join('')}${sbAxis('failed')}</div>`
    + numbers(['Setting', 'Tests', 'Failed', ...K.map(([, l]) => l), ...R.others.map((r) => `Solved by ${esc(R.name(r))}`)],
      ['s', 'p', 't'].map((m) => { const x = R.miss[m]; return [MODE_LABEL[m], x.n, x.fail, x.k0, x.k1, x.k23, x.k4, ...R.others.map((r) => x.by[r])]; }))
    + numbers(['Suite', 'Setting', 'Failed but solved by another agent', 'Of these, solved by four or more'],
      ['s', 'p', 't'].flatMap((m) => R.miss[m].suites.map((r) => [esc(R.benchName(r.id)), MODE_LABEL[m], r.n, r.k4]))).replace('The numbers', 'By suite');
}

/** Figure 5: how the attempts went, per setting, for the five strong agents: list-price cost, agent time, output tokens. */
function figEffort(el, R) {
  const AG = [S, A, F, O, G];
  const metric = [
    ['usd_mean', 'Mean list-price cost of an attempt (US$)', (v) => `${v.toFixed(v >= 10 ? 0 : 1)}`],
    ['wall_med', 'Median agent time of an attempt (minutes)', (v) => `${Math.round(v)}`],
    ['tok_out_med', 'Median output tokens of an attempt (thousands)', (v) => `${Math.round(v / 1000)}`],
  ];
  const small = ([k, title, f]) => {
    const V = ['s', 'p', 't'], W = 360, H = 200, L = 8, B = 30, T = 18, gw = (W - L - 4) / V.length, bw = 16, gap = 4;
    const mx = Math.max(1, ...V.flatMap((m) => AG.map((r) => R.b(r, m, k) || 0))) * 1.12;
    const y = (v) => T + (H - T - B) * (1 - v / mx);
    let svg = `<line x1="${L}" x2="${W - 2}" y1="${y(0)}" y2="${y(0)}" class="gl"/>`;
    V.forEach((m, gi) => {
      const x0 = L + gi * gw + (gw - AG.length * bw - (AG.length - 1) * gap) / 2;
      AG.forEach((r, i) => {
        const v = R.b(r, m, k); if (v == null) return;
        const x = x0 + i * (bw + gap);
        svg += `<rect x="${x}" y="${y(v)}" width="${bw}" height="${Math.max(0.5, y(0) - y(v))}" rx="2" style="fill:${col(r)}"><title>${esc(`${R.name(r)} · ${MODE_LABEL[m]}: ${f(v)}`)}</title></rect>`
          + `<text x="${x + bw / 2}" y="${y(v) - 4}" class="bv" text-anchor="middle" style="font-size:8px">${f(v)}</text>`;
      });
      svg += `<text x="${L + gi * gw + gw / 2}" y="${H - B + 18}" class="gx ${MODE_CLS[m]}" text-anchor="middle">${MODE_LABEL[m]}</text>`;
    });
    return `<div class="ef"><p class="hb-t">${esc(title)}</p><div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">${svg}</svg></div></div>`;
  };
  el.innerHTML = head(`A Standard attempt of ${R.name(S)} costs ${R.X.cost_s_s} on average, against ${R.X.cost_a_s} for ${R.name(A)}, and in every setting it costs the least of the five; its attempts take about as long as ${R.name(A)}’s.`,
    'How the attempts went: cost, time and output tokens, by setting, for the five strong agents',
    'each bar is one agent in one setting, over its counted attempts on the core tests; cost is the list price of the tokens the attempt used.')
    + `<div class="legend">${AG.map((r) => `<span>${sw(col(r))}${esc(R.name(r))}</span>`).join('')}</div>`
    + `<div class="efs">${metric.map(small).join('')}</div>`
    + `<p class="fig-note">From the report’s cost table: the providers’ list prices of November 2026, as in the report.</p>`
    + numbers(['Agent', 'Setting', 'Tests', 'Mean cost', 'Cost per solved test', 'Median cost, solved', 'Median cost, failed', 'Median minutes', 'Median minutes, solved', 'Median minutes, failed', 'Median output tokens'],
      AG.flatMap((r) => ['s', 'p', 't'].map((m) => [esc(R.name(r)), MODE_LABEL[m], int(R.M[m].length), usdC(R.b(r, m, 'usd_mean')), usdC(R.perSolve(r, m)), usdC(R.b(r, m, 'usd_med_ok')), usdC(R.b(r, m, 'usd_med_fail')),
        num0(R.b(r, m, 'wall_med')), num0(R.b(r, m, 'wall_med_ok')), num0(R.b(r, m, 'wall_med_fail')), R.b(r, m, 'tok_out_med') == null ? '–' : `${Math.round(R.b(r, m, 'tok_out_med') / 1000)}K`])));
}
const usdC = (v) => (v == null ? '–' : `$${v.toFixed(2)}`);
const num0 = (v) => (v == null ? '–' : `${Math.round(v)}`);

/* ------------------------------------------------------------------------------------------ the article */

/** The contents: a rail in the left margin, built from the article's heads, with the findings under Findings. */
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
  const fh = $$('.post .finding h3[id]').filter(fnum);
  document.body.insertAdjacentHTML('beforeend', `<nav class="toc-rail" aria-label="Contents"><p>Contents</p><ol>${heads.map((h) => {
    const s = subs(h).filter(fnum);
    if (!s.length) return `<li><a href="#${h.id}">${label(h)}</a></li>`;
    return `<li class="fold"><div class="fold-head"><a href="#${h.id}">${label(h)}</a><button type="button" aria-expanded="false" aria-label="Show the findings">${s.length}</button></div>`
      + `<div class="fold-body"><ol>${s.map((x, i) => `<li><a href="#${x.id}"><span class="k">${i + 1}</span>${esc(x.dataset.short || '')}</a></li>`).join('')}</ol></div></li>`;
  }).join('')}</ol></nav>`);
  const rail = $('.toc-rail'), first = heads[0];
  const marks = [...heads, ...fh].sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  const links = marks.map((h) => $(`a[href="#${h.id}"]`, rail));
  const folds = $$('.fold', rail).map((li) => ({ li, h: document.getElementById($('a', li).getAttribute('href').slice(1)), manual: null, inside: false }));
  const paint = () => folds.forEach((f) => { const open = f.manual ?? f.inside; f.li.classList.toggle('open', open); $('button', f.li).setAttribute('aria-expanded', String(open)); });
  folds.forEach((f) => {
    $('button', f.li).addEventListener('click', () => { f.manual = !f.li.classList.contains('open'); paint(); });
    $('a', f.li).addEventListener('click', () => { f.manual = true; paint(); });
  });
  const onScroll = () => {
    const hd = $('.post-head');
    rail.classList.toggle('show', (!hd || hd.getBoundingClientRect().bottom < 0) && first.getBoundingClientRect().top < innerHeight * 0.5);
    let cur = 0, s = 0;
    marks.forEach((h, k) => { if (h.getBoundingClientRect().top < innerHeight * 0.35) cur = k; });
    heads.forEach((h, k) => { if (h.getBoundingClientRect().top < innerHeight * 0.35) s = k; });
    links.forEach((a, k) => a?.classList.toggle('on', k === cur));
    folds.forEach((f) => { const inside = heads[s] === f.h; if (inside !== f.inside) { f.inside = inside; f.manual = null; } });
    paint();
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/** The findings fold open and shut on their heading; a link into a finding opens it; printing opens all. */
function findings() {
  const set = (b, open) => {
    b.setAttribute('aria-expanded', String(open));
    const body = document.getElementById(b.getAttribute('aria-controls'));
    if (open) body.removeAttribute('hidden'); else body.setAttribute('hidden', 'until-found');
  };
  $$('.finding > h3 > .finding-toggle').forEach((b) => {
    b.addEventListener('click', () => set(b, b.getAttribute('aria-expanded') !== 'true'));
    document.getElementById(b.getAttribute('aria-controls'))?.addEventListener('beforematch', () => set(b, true));
  });
  const reveal = (id) => {
    let el = null;
    try { if (id) el = document.getElementById(decodeURIComponent(id)); } catch { /* a malformed hash */ }
    const b = el?.closest('.finding')?.querySelector(':scope > h3 > .finding-toggle');
    if (b) set(b, true);
    return el;
  };
  document.addEventListener('click', (e) => { const a = e.target.closest?.('a[href^="#"]'); if (a) reveal(a.getAttribute('href').slice(1)); });
  addEventListener('hashchange', () => reveal(location.hash.slice(1))?.scrollIntoView());
  const target = reveal(location.hash.slice(1));
  target?.scrollIntoView({ behavior: 'instant' });
  let shut = [];
  addEventListener('beforeprint', () => { shut = $$('.post details:not([open])'); shut.forEach((d) => { d.open = true; }); });
  addEventListener('afterprint', () => { shut.forEach((d) => { d.open = false; }); shut = []; });
  return () => { const t = target?.getBoundingClientRect().top; if (t > 0 && t < 200) target.scrollIntoView({ behavior: 'instant' }); };
}

/** Videos play only while on screen. */
function clips() {
  const io = new IntersectionObserver((es) => es.forEach((e) => { const v = e.target; if (e.isIntersecting) v.play?.().catch(() => {}); else v.pause?.(); }), { threshold: 0.35 });
  $$('video[data-auto]').forEach((v) => {
    v.muted = true; v.loop = true; v.playsInline = true;
    if (v.dataset.rate) { const r = +v.dataset.rate; v.defaultPlaybackRate = r; v.addEventListener('play', () => { v.playbackRate = r; }); }
    io.observe(v);
  });
}

/** Every figure gets an Enlarge button (and opens on a click) that shows it full size in an overlay. */
function zoomFigs() {
  const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>';
  const open = (el) => {
    const ov = document.createElement('div'); ov.className = 'zoom-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    const inner = document.createElement('div'); inner.className = 'zoom-in fig';
    const x = Object.assign(document.createElement('button'), { className: 'zoom-x', type: 'button', textContent: '×' }); x.setAttribute('aria-label', 'Close');
    const mark = document.createComment('zoom'); el.before(mark);
    inner.append(el); ov.append(x, inner); document.body.append(ov); document.documentElement.style.overflow = 'hidden';
    const close = () => { mark.replaceWith(el); ov.remove(); document.documentElement.style.overflow = ''; removeEventListener('keydown', key); };
    const key = (e) => { if (e.key === 'Escape') close(); };
    x.addEventListener('click', close); ov.addEventListener('click', (e) => { if (e.target === ov) close(); }); addEventListener('keydown', key);
    x.focus();
  };
  $$('.post .fig-body[data-fig]').forEach((fb) => {
    fb.classList.add('fig-zoom-host');
    const b = document.createElement('button'); b.type = 'button'; b.className = 'zoom-btn'; b.innerHTML = `${ICON}Enlarge`;
    b.addEventListener('click', (e) => { e.stopPropagation(); open(fb); });
    fb.append(b);
    fb.addEventListener('click', (e) => { if (e.target.closest('details, summary, a, button, .zoom-ov') || fb.closest('.zoom-ov')) return; open(fb); });
  });
}

const settle = findings();
Promise.all([getJSON('data/exam.json'), getJSON('data/tasks.json'), getJSON('data/blog-sol.json').catch(() => ({}))]).then(([ex, tasks, bs]) => {
  const R = compute(ex, tasks, bs);
  fill(R.X);
  const figs = { board: figBoard, h2h: figH2H, paired: figPaired, suites: figSuites, effort: figEffort, miss: figMiss };
  for (const [k, f] of Object.entries(figs)) { const el = $(`#fig-${k}`); if (el) f(el, R); }
  $$('.fig-body[data-fig]').forEach((el) => $('.fig-cap', el)?.insertAdjacentHTML('afterbegin', `<b>Figure ${el.dataset.fig}.</b> `));
}).catch((e) => {
  console.error(e);
  $$('.fig-body').forEach((el) => { el.innerHTML = '<p class="fig-note">This figure could not be loaded.</p>'; });
}).finally(() => { toc(); clips(); settle(); zoomFigs(); });
