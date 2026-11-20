/* The GPT-6.2 Astra post: its figures and numbers. The results are computed here from the post's frozen snapshot,
   data/blog_snapshot_astra62/{exam,tasks}.json (a copy of the files the leaderboard read on the snapshot date; the
   leaderboard itself moves on), with the leaderboard's rules: the core set; the counted attempt per agent and test; all
   the core tests of each setting, a test without a result counted as failed; a core task solved only if every core test
   it has was solved. data/blog-astra62.json (scripts/export_blog_astra62.py) adds how the attempts went (time, model
   requests, output tokens, list-price cost, the time limit), which the site's data does not hold. Numbers in the text
   are <span data-f="key">, filled from the same computation; a key that cannot be computed shows "?". The page's look
   is the blog's (blog.css); the contents rail, the folding findings and the Enlarge buttons work as in the other posts. */

const BASE = new URL('../', import.meta.url).pathname;
const SNAP = 'data/blog_snapshot_astra62/';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
const pct1 = (a, b) => (b ? ((100 * a) / b).toFixed(1) : '0.0');
const int = (n) => Number(n || 0).toLocaleString('en-US');
const getJSON = (p) => fetch(BASE + p, { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`); return r.json(); });

const MODE_LABEL = { p: 'Privileged', s: 'Standard', t: 'Realtime', a: 'All tests', o: 'All tasks' };
const MODE_CLS = { p: 'm-p', s: 'm-s', t: 'm-r', a: '', o: '' };
const INK = { p: '--priv-ink', s: '--std-ink', t: '--rt-ink' };
const X = 'codex-gpt6_2_astra-high', F = 'claude_code-fable_5_2-high', G = 'codex-gpt6_astra-high';
const COL = { [X]: 'var(--ag-a62)', [F]: 'var(--ag-fable)', [G]: 'var(--ag-astra)' };
const col = (r) => COL[r] || 'var(--flash)';
const MIN_BENCH = 5;   // a suite gets a row from this many core tests in the setting
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const nw = (n) => WORDS[n] || int(n);
const list = (xs) => (xs.length > 2 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs.join(' and '));
const usd = (x) => (x == null ? null : `$${Number(x).toFixed(x >= 100 ? 0 : 2)}`);
const mins = (x) => (x == null ? null : `${Math.round(x)} minutes`);

/* ---------------------------------------------------------------------------------------------- numbers */

function compute(ex, tasks, bf) {
  const sh = ex.leaderboard.shared;
  // the agents compared: every agent on the leaderboard that has finished the core set, and GPT-6.2 Astra
  const runs = sh.runs.filter((r) => r === X || !(sh.updating || []).includes(r));
  const run = Object.fromEntries(ex.runs.map((r) => [r.id, r]));
  const name = (id) => run[id]?.model || id;
  const short = (id) => name(id).replace(/^(Claude|Gemini \d|Gemini) /, '');
  const core = tasks.filter((t) => t.set === 'core');
  const ok = (t, r, m) => t.results?.[r]?.[m]?.s === 'S';
  const sat = (m) => core.filter((t) => (t.core || '').includes(m));
  const M = { p: sat('p'), s: sat('s'), t: sat('t'), o: core };
  M.a = { length: M.p.length + M.s.length + M.t.length };
  // All tasks: a core task counts once, solved only if every setting it has in the core set was solved
  const solvedIn = (t, r, m) => (m === 'o' ? [...(t.core || '')].every((c) => ok(t, r, c)) : ok(t, r, m));
  const solved = (m, r) => (m === 'a' ? solved('p', r) + solved('s', r) + solved('t', r) : M[m].filter((t) => solvedIn(t, r, m)).length);
  const board = runs.map((r) => ({ id: r, o: solved('o', r), s: solved('s', r) })).sort((x, y) => y.o - x.o || y.s - x.s);
  const order = board.map((x) => x.id);
  const others = runs.filter((r) => r !== X);
  // head to head with Claude Fable 5.2: per setting, the tests both solve, only one solves, neither solves
  const h2h = Object.fromEntries(['s', 'p', 't'].map((m) => {
    const c = { both: 0, x: 0, f: 0, none: 0, n: M[m].length };
    for (const t of M[m]) { const a = ok(t, X, m), b = ok(t, F, m); c[a && b ? 'both' : a ? 'x' : b ? 'f' : 'none'] += 1; }
    return [m, c];
  }));
  // tests GPT-6.2 Astra solves and no other agent does
  const uniq = Object.fromEntries(['p', 's', 't'].map((m) => [m, M[m].filter((t) => ok(t, X, m) && others.every((r) => !ok(t, r, m)))]));
  // the same task in two settings (core tasks with both a Privileged and a Standard test)
  const PS = core.filter((t) => (t.core || '').includes('p') && (t.core || '').includes('s'));
  const paired = [X, F, G].map((r) => ({ id: r, name: name(r), n: PS.length, a: PS.filter((t) => ok(t, r, 'p')).length,
    c: PS.filter((t) => ok(t, r, 's')).length, both: PS.filter((t) => ok(t, r, 'p') && ok(t, r, 's')).length }));
  // suites, as in the report: the IKEA assembly tasks of RoboARC are a suite of their own
  const suiteName = Object.fromEntries(ex.suites.map((x) => [x.id, x.name]));
  const benchOf = (t) => (t.suite === 'roboarc' && /ikea/i.test(t.id) ? 'ikea' : t.suite);
  const benchName = (k) => (k === 'ikea' ? 'IKEA assembly' : suiteName[k] || k);
  const suites = (m, vs = F) => {
    const g = {};
    for (const t of M[m]) (g[benchOf(t)] ??= []).push(t);
    return Object.entries(g).map(([id, L]) => ({ id, n: L.length, x: L.filter((t) => ok(t, X, m)).length, f: L.filter((t) => ok(t, vs, m)).length,
      xo: L.filter((t) => ok(t, X, m) && !ok(t, vs, m)).length, fo: L.filter((t) => ok(t, vs, m) && !ok(t, X, m)).length }))
      .sort((p, q) => (q.x - q.f) - (p.x - p.f) || q.n - p.n);
  };
  const sS = suites('s');
  const gainS = sS.filter((r) => r.n >= MIN_BENCH && r.x - r.f >= 5);
  const fableLead = (m) => suites(m).filter((r) => r.n >= MIN_BENCH && r.f > r.x).sort((p, q) => (q.f - q.x) - (p.f - p.x));
  // the tests GPT-6.2 Astra attempted and failed, by how many of the other agents solve them (the runs Section 03 reads)
  const miss = Object.fromEntries(['p', 's', 't'].map((m) => {
    const fail = M[m].filter((t) => t.results?.[X]?.[m]?.s === 'F');
    const k = (t) => others.filter((r) => ok(t, r, m)).length;
    const oth = fail.filter((t) => k(t) > 0);
    const g = {};
    for (const t of oth) (g[benchOf(t)] ??= []).push(t);
    return [m, { n: M[m].length, fail: fail.length, oth: oth.length, k0: fail.length - oth.length,
      k1: oth.filter((t) => k(t) === 1).length, k23: oth.filter((t) => k(t) >= 2 && k(t) <= 3).length, k4: oth.filter((t) => k(t) >= 4).length,
      by: Object.fromEntries(others.map((r) => [r, oth.filter((t) => ok(t, r, m)).length])),
      suites: Object.entries(g).map(([id, L]) => ({ id, n: L.length, k4: L.filter((t) => k(t) >= 4).length })).sort((p, q) => q.n - p.n || p.id.localeCompare(q.id)) }];
  }));
  const B = bf?.runs || {};
  const b = (r, m, k) => B[r]?.[m]?.[k];
  const Q = (a, n) => `${pct1(a, n)}% (${int(a)}/${int(n)})`;
  const fr = (a, n) => `${int(a)} of ${int(n)}`;
  const tests = M.a.length;   // every core test is one attempt of each agent
  const perSolve = (r, m) => (b(r, m, 'usd_total') != null && solved(m, r) ? b(r, m, 'usd_total') / solved(m, r) : null);
  const ratio = (x, y) => (x && y ? (x / y).toFixed(1) : null);
  const lead = ['p', 's', 't', 'a', 'o'].filter((m) => order.every((r) => r === X || solved(m, r) < solved(m, X)));   // a tie is not a lead
  const LEADW = { p: 'the Privileged Setting', s: 'the Standard Setting', t: 'the Realtime Setting', a: 'all tests together', o: 'all tasks' };
  const vs = (m, unit) => { const d = solved(m, X) - solved(m, F);
    return d > 0 ? `${name(X)} solves ${nw(d)} more ${unit}` : d < 0 ? `${name(F)} solves ${nw(-d)} more ${unit}` : `the two solve the same number of ${unit}`; };
  const S = {
    built: (ex.build?.at || '').slice(0, 10),
    n_s: int(M.s.length), n_p: int(M.p.length), n_t: int(M.t.length), n_a: int(M.a.length), n_o: int(M.o.length), n_ps: int(PS.length),
    n_agents: nw(runs.length), n_others: nw(others.length),
    others_list: list(order.filter((r) => r !== X).map(name)),
    lead_list: lead.length ? list(lead.map((m) => LEADW[m])) : null,
    vs_t: vs('t', 'Realtime tests'),
    // GPT-6.2 Astra (x), Claude Fable 5.2 (f) and GPT-6 Astra (g)
    ...Object.fromEntries([['x', X], ['f', F], ['g', G]].flatMap(([k, r]) => ['s', 'p', 't', 'a', 'o'].map((m) => [`${k}_${m}`, Q(solved(m, r), M[m].length)]))),
    x_s_pct: `${pct(solved('s', X), M.s.length)}%`, f_s_pct: `${pct(solved('s', F), M.s.length)}%`, g_s_pct: `${pct(solved('s', G), M.s.length)}%`,
    net_s: int(solved('s', X) - solved('s', F)), net_p: int(solved('p', X) - solved('p', F)), net_a: int(solved('a', X) - solved('a', F)),
    net_o: int(solved('o', X) - solved('o', F)), gnet_o: int(solved('o', X) - solved('o', G)),
    h_s_x: int(h2h.s.x), h_s_f: int(h2h.s.f), h_p_x: int(h2h.p.x), h_p_f: int(h2h.p.f), h_t_x: int(h2h.t.x), h_t_f: int(h2h.t.f),
    h_t_none: fr(h2h.t.none, h2h.t.n), h_s_none: fr(h2h.s.none, h2h.s.n),
    uniq_all: int(uniq.p.length + uniq.s.length + uniq.t.length), uniq_s: int(uniq.s.length), uniq_p: int(uniq.p.length), uniq_t: int(uniq.t.length),
    uniq_top: (() => { const g = {}; for (const m of 'pst') for (const t of uniq[m]) g[benchOf(t)] = (g[benchOf(t)] || 0) + 1;
      return list(Object.entries(g).sort((p, q) => q[1] - p[1]).slice(0, 3).map(([k, n]) => `${benchName(k)} (${n})`)); })(),
    keep_x: Q(paired[0].both, paired[0].a), keep_f: Q(paired[1].both, paired[1].a), keep_g: Q(paired[2].both, paired[2].a),
    gain_s: list(gainS.map((r) => `${benchName(r.id)} (${int(r.x)} of ${int(r.n)} tests, against ${int(r.f)})`)),
    gain_s_net: int(gainS.reduce((a, r) => a + r.x - r.f, 0)),
    fable_lead_s: list(fableLead('s').map((r) => benchName(r.id))), fable_lead_p: list(fableLead('p').map((r) => benchName(r.id))),
    fable_lead_s3: list(fableLead('s').filter((r) => r.f - r.x >= 3).map((r) => `${benchName(r.id)} (${int(r.f)} of ${int(r.n)}, against ${int(r.x)})`)),
    gain_p: list(suites('p').filter((r) => r.n >= MIN_BENCH && r.x - r.f >= 5).map((r) => `${benchName(r.id)} (${int(r.x)} of ${int(r.n)} tests, against ${int(r.f)})`)),
    rp_s: (() => { const r = sS.find((x) => x.id === 'robopaint'); return r ? `${int(r.x)} of ${int(r.n)}` : null; })(),
    rp_s_f: (() => { const r = sS.find((x) => x.id === 'robopaint'); return r ? int(r.f) : null; })(),
    // how the attempts went (data/blog-astra62.json)
    ...Object.fromEntries([['x', X], ['f', F], ['g', G]].flatMap(([k, r]) => [
      [`to_${k}`, b(r, 'all', 'n') != null ? fr(b(r, 'all', 'timeout') || 0, tests) : null],
      [`cost_${k}`, usd(b(r, 'all', 'usd_mean'))],
      [`wall_${k}`, mins(b(r, 'all', 'wall_med'))],
      [`out_${k}`, b(r, 'all', 'tok_out_med') != null ? `${Math.round(b(r, 'all', 'tok_out_med') / 1000)}K` : null],
      [`req_${k}`, b(r, 'all', 'req_med') != null ? int(Math.round(b(r, 'all', 'req_med'))) : null],
      [`used_${k}`, b(r, 'all', 'used_med_fail') != null ? `${Math.round(b(r, 'all', 'used_med_fail'))}%` : null],
      [`left10_${k}`, b(r, 'all', 'n_fail_used') ? fr(b(r, 'all', 'left10_fail'), b(r, 'all', 'n_fail_used')) : null],
      [`pss_${k}`, usd(perSolve(r, 's'))],
    ])),
    cost_ratio_f: ratio(b(F, 'all', 'usd_mean'), b(X, 'all', 'usd_mean')), cost_ratio_g: ratio(b(G, 'all', 'usd_mean'), b(X, 'all', 'usd_mean')),
    miss_fail_s: int(miss.s.fail), miss_none_s: int(miss.s.k0), miss_oth_s: fr(miss.s.oth, miss.s.fail), miss_one_s: int(miss.s.k1),
    miss_k4: nw(miss.p.k4 + miss.s.k4 + miss.t.k4), miss_fable_s: int(miss.s.by[F]),
    snapshot: bf?.snapshot || null,
  };
  return { S, M, board, order, h2h, paired, suites, benchName, name, short, solved, b, perSolve, miss, others, runs };
}

function fill(S) {
  $$('[data-f]').forEach((el) => { const v = S[el.dataset.f]; el.textContent = v == null ? '?' : v; });
}

/* --------------------------------------------------------------------------------------------- figures */

const cap1 = (x) => `${x[0].toUpperCase()}${x.slice(1)}`.replace(/\.?\s*$/, '.');
const head = (say, cap, how) => `<p class="fig-cap"><span class="fc-t">${cap1(cap)}</span> ${say}${how ? ` ${cap1(how)}` : ''}</p>`;
const sw = (c) => `<i class="sw" style="background:${c}"></i>`;
const numbers = (heads, rows) => `<details class="nums"><summary>The numbers</summary><div class="tscroll"><table class="nt"><thead><tr>${heads.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
  <tbody>${rows.map((r) => `<tr>${r.map((c, i) => (i ? `<td>${c}</td>` : `<th scope="row">${c}</th>`)).join('')}</tr>`).join('')}</tbody></table></div></details>`;
const frac = (a, n) => `${int(a)}/${int(n)}`;
const GREY_O = (R, r) => { const i = R.order.filter((x) => !COL[x]).indexOf(r); return COL[r] ? 1 : [1, 0.8, 0.62, 0.48, 0.36, 0.28, 0.22][i] ?? 0.2; };

/** Figure 1: grouped bars, one group per setting, all tests and all tasks, one bar per agent in the leaderboard's order. */
function figBoard(el, R) {
  const V = ['s', 'p', 't', 'a', 'o'], N = R.order.length;
  const W = 820, H = 300, L = 34, B = 46, T = 16, gw = (W - L - 8) / V.length, bw = Math.min(14, (gw - 18) / N), top = 100;
  const y = (v) => T + (H - T - B) * (1 - v / top);
  let svg = '';
  for (let g = 0; g <= top; g += 25) svg += `<line x1="${L}" x2="${W - 4}" y1="${y(g)}" y2="${y(g)}" class="gl"/><text x="${L - 6}" y="${y(g) + 3.5}" class="ax" text-anchor="end">${g}%</text>`;
  V.forEach((k, gi) => {
    const n = R.M[k].length, x0 = L + gi * gw + (gw - N * bw - (N - 1) * 2) / 2;
    R.order.forEach((r, i) => {
      const s = R.solved(k, r), v = n ? (100 * s) / n : 0, x = x0 + i * (bw + 2);
      svg += `<rect x="${x}" y="${y(v)}" width="${bw}" height="${Math.max(0.5, y(0) - y(v))}" rx="2" style="fill:${col(r)};opacity:${GREY_O(R, r)}"><title>${esc(`${R.name(r)} · ${MODE_LABEL[k]}: ${s} of ${n} (${pct1(s, n)}%)`)}</title></rect>`;
      if (COL[r]) svg += `<text x="${x + bw / 2}" y="${y(v) - 4}" class="bv" text-anchor="middle">${pct(s, n)}</text>`;
    });
    svg += `<text x="${L + gi * gw + gw / 2}" y="${H - B + 18}" class="gx ${MODE_CLS[k]}" text-anchor="middle">${MODE_LABEL[k]}</text>`
      + `<text x="${L + gi * gw + gw / 2}" y="${H - B + 33}" class="ax" text-anchor="middle">${int(n)} ${k === 'o' ? 'tasks' : 'tests'}</text>`;
  });
  const legend = `<div class="legend">${R.order.map((r) => `<span><i class="sw" style="background:${col(r)};opacity:${GREY_O(R, r)}"></i>${esc(R.name(r))}</span>`).join('')}</div>`;
  const d = (m) => R.solved(m, X) - R.solved(m, F);
  const VW = { s: 'the Standard Setting', p: 'the Privileged Setting', t: 'the Realtime Setting', a: 'all tests', o: 'all tasks' };
  const up = V.filter((m) => d(m) > 0), dn = V.filter((m) => d(m) < 0);
  const say = (up.length ? `${R.name(X)} solves more than ${R.name(F)} in ${list(up.map((m) => VW[m]))}` : `${R.name(X)} does not solve more than ${R.name(F)} in any view`)
    + (dn.length ? `; ${R.name(F)} solves more in ${list(dn.map((m) => VW[m]))}.` : '.');
  el.innerHTML = head(say,
    'Success rate of each agent on the core set, by setting',
    'each bar is the share of the core tests (or, for all tasks, the core tasks) that one agent solved, labelled in percent for the three agents the post compares; a task counts as solved only if every one of its core tests was solved.')
    + legend + `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Success rate by agent and setting">${svg}</svg></div>`
    + numbers(['Agent', ...V.map((k) => MODE_LABEL[k])], R.order.map((r) => [esc(R.name(r)), ...V.map((k) => `${pct1(R.solved(k, r), R.M[k].length)}% · ${frac(R.solved(k, r), R.M[k].length)}`)]));
}

/** A row of stacked segments (shares of n), the report's style. */
const sbRow = (who, segs, n, unit) => `<div class="sb-row"><span class="who">${who}</span><span class="sb-trk">${segs.map(([v, l, c, dk]) => (v
  ? `<span style="flex:${v} 1 0;background:${c}" title="${esc(`${l}: ${v} of ${n} ${unit}`)}">${(100 * v) / n >= 6 ? `<em${dk ? ' class="dk"' : ''}>${v}</em>` : ''}</span>` : '')).join('')}</span><span class="n">${int(n)}</span></div>`;
const sbAxis = (unit) => `<div class="sb-row ax"><span></span><span class="sb-ticks"><i style="left:0">0%</i><i style="left:50%">50%</i><i style="left:100%">100%</i></span><span class="n">${unit}</span></div>`;

/** Figure 2: the head-to-head with Claude Fable 5.2, per setting: the tests both solve, only one, neither. */
function figH2H(el, R) {
  const xN = R.short(X), fN = R.short(F);
  const segs = (c) => [[c.both, 'Both', 'var(--top)'], [c.x, `Only ${xN}`, COL[X]], [c.f, `Only ${fN}`, COL[F]], [c.none, 'Neither', 'var(--wf-none)', true]];
  const keys = [['Both', 'var(--top)'], [`Only ${xN}`, COL[X]], [`Only ${fN}`, COL[F]], ['Neither', 'var(--wf-none)']];
  el.innerHTML = head(`In the Standard Setting, ${R.name(X)} solves ${R.h2h.s.x} tests that ${R.name(F)} fails, and ${R.name(F)} ${R.h2h.s.f} that it fails; in the Privileged Setting the counts are ${R.h2h.p.x} and ${R.h2h.p.f}.`,
    `Head to head: which of ${R.name(X)} and ${R.name(F)} solved each core test, by setting`,
    'each row is one setting’s core tests; each segment is the share of tests with that pair of outcomes, and the number in it is the count.')
    + `<div class="legend">${keys.map(([l, c]) => `<span>${sw(c)}${esc(l)}</span>`).join('')}</div>`
    + `<div class="sb">${['s', 'p', 't'].map((m) => sbRow(`<b style="color:var(${INK[m]})">${MODE_LABEL[m]}</b>`, segs(R.h2h[m]), R.h2h[m].n, 'tests')).join('')}${sbAxis('tests')}</div>`
    + numbers(['Setting', 'Both', `Only ${xN}`, `Only ${fN}`, 'Neither', 'Tests'], ['s', 'p', 't'].map((m) => { const c = R.h2h[m]; return [MODE_LABEL[m], c.both, c.x, c.f, c.none, c.n]; }));
}

/** Figure 3: the same task in two settings, per agent: solved in both, only in Privileged, only in Standard, in neither. */
function figPaired(el, R) {
  const segs = (r) => [[r.both, 'Solved in both', 'var(--top)'], [r.a - r.both, 'Only in Privileged', 'var(--priv)'], [r.c - r.both, 'Only in Standard', 'var(--std)'],
    [r.n - r.a - r.c + r.both, 'In neither', 'var(--wf-none)', true]];
  const keys = [['Solved in both', 'var(--top)'], ['Only in Privileged', 'var(--priv)'], ['Only in Standard', 'var(--std)'], ['In neither', 'var(--wf-none)']];
  const [x, f, g] = R.paired;
  el.innerHTML = head(`${R.name(X)} also solves in the Standard Setting ${pct(x.both, x.a)}% of the tasks it solves with privileged access, against ${pct(f.both, f.a)}% for ${R.name(F)} and ${pct(g.both, g.a)}% for ${R.name(G)}.`,
    'The same task in two settings: each agent’s outcome on the core tasks that have both a Privileged and a Standard test',
    `each row is one agent on the ${int(x.n)} core tasks with both tests; each segment is the share of tasks with that pair of outcomes.`)
    + `<div class="legend">${keys.map(([l, c]) => `<span>${sw(c)}${esc(l)}</span>`).join('')}</div>`
    + `<div class="sb">${R.paired.map((r) => sbRow(esc(r.name), segs(r), r.n, 'tasks')).join('')}${sbAxis('tasks')}</div>`
    + numbers(['Agent', 'Both', 'Only Privileged', 'Only Standard', 'Neither', 'Tasks', 'Privileged successes kept'], R.paired.map((r) => [esc(r.name), r.both, r.a - r.both, r.c - r.both, r.n - r.a - r.c + r.both, r.n, `${pct(r.both, r.a)}% · ${frac(r.both, r.a)}`]));
}

/** Figure 4: per suite and setting, how many more tests GPT-6.2 Astra solved than Claude Fable 5.2 (a diverging bar). */
function figSuites(el, R) {
  const rowsOf = (m) => R.suites(m).filter((r) => r.n >= MIN_BENCH);
  const mx = Math.max(1, ...['s', 'p'].flatMap((m) => rowsOf(m).map((r) => Math.abs(r.x - r.f))));
  const panel = (m) => {
    const row = (r) => {
      const d = r.x - r.f, w = (50 * Math.abs(d)) / mx, c = d > 0 ? COL[X] : COL[F];
      return `<div class="dp-row"><span class="who"><b>${esc(R.benchName(r.id))}</b><small>${int(r.n)} tests · ${pct(r.x, r.n)}% vs ${pct(r.f, r.n)}%</small></span>`
        + `<span class="dp-trk dv"><i class="gl" style="left:0"></i><i class="gl" style="left:100%"></i><i class="gl mid" style="left:50%"></i>`
        + (d ? `<span class="dvb" style="${d > 0 ? 'left:50%' : `left:${50 - w}%`};width:${w}%;background:${c}" title="${esc(`${R.benchName(r.id)}: ${R.name(X)} ${r.x}, ${R.name(F)} ${r.f} of ${r.n}`)}"></span>` : '')
        + `</span><span class="dp-v"><small class="net ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d)}</small></span></div>`;
    };
    return `<div class="dp ${m}"><p class="dp-h ${MODE_CLS[m]}">${MODE_LABEL[m]}</p><div class="dp-row dp-head"><span></span><span class="dvh"><small>${esc(R.short(F))} more</small><small>${esc(R.short(X))} more</small></span><span class="dp-v"><small>${esc(R.short(X))} − ${esc(R.short(F))}</small></span></div>${rowsOf(m).map(row).join('')}
      <div class="dp-row dp-ax"><span></span><span class="dp-trk"><i style="left:0">−${mx}</i><i style="left:50%">0</i><i style="left:100%">+${mx}</i></span><span></span></div></div>`;
  };
  el.innerHTML = head(`The largest Standard gains are in ${R.S.gain_s.replace(/ \([^)]*\)/g, '')}; ${R.name(F)} solves at least three more Standard tests in ${R.S.fable_lead_s3.replace(/ \([^)]*\)/g, '')}.`,
    `Difference in solved tests between ${R.name(X)} and ${R.name(F)}, by suite and setting`,
    `each bar is how many more of a suite’s core tests one agent solved than the other, in that agent’s color; under each suite are the two success rates.`)
    + `<div class="legend"><span>${sw(COL[X])}${esc(R.name(X))} solves more</span><span>${sw(COL[F])}${esc(R.name(F))} solves more</span></div>`
    + `<div class="dps">${panel('s')}${panel('p')}</div><p class="fig-note">Suites with at least ${MIN_BENCH} core tests in the setting, by the difference in solved tests. The IKEA assembly tasks of RoboARC count as their own suite.</p>`
    + numbers(['Suite', 'Setting', 'Tests', R.short(X), R.short(F), `Only ${R.short(X)}`, `Only ${R.short(F)}`], ['s', 'p', 't'].flatMap((m) => R.suites(m).map((r) => [esc(R.benchName(r.id)), MODE_LABEL[m], r.n, r.x, r.f, r.xo, r.fo])));
}

/** Figure 6: the tests GPT-6.2 Astra fails, per setting, by how many of the other agents solve each one. */
function figMiss(el, R) {
  const K = [['k0', 'No other agent', 'var(--wf-none)', true], ['k1', 'One other agent', 'color-mix(in srgb, var(--top) 30%, var(--bg))', true],
    ['k23', 'Two or three', 'color-mix(in srgb, var(--top) 60%, var(--bg))'], ['k4', 'Four or more', 'var(--top)']];
  const nO = R.others.length;
  el.innerHTML = head(`Most of the tests ${R.name(X)} fails are solved by no other agent either; ${R.S.miss_k4} are solved by four or more.`,
    `The core tests that ${R.name(X)} fails, by how many of the other ${nw(nO)} agents solve each one`,
    'each row is one setting; each segment is the share of the tests it fails, and the number in it is the count.')
    + `<div class="legend">${K.map(([, l, c]) => `<span>${sw(c)}${esc(l)}</span>`).join('')}</div>`
    + `<div class="sb">${['s', 'p', 't'].map((m) => sbRow(`<b style="color:var(${INK[m]})">${MODE_LABEL[m]}</b>`, K.map(([k, l, c, dk]) => [R.miss[m][k], l, c, dk]), R.miss[m].fail, 'failed tests')).join('')}${sbAxis('failed')}</div>`
    + numbers(['Setting', 'Tests', 'Failed', ...K.map(([, l]) => l), ...R.others.map((r) => `Solved by ${esc(R.name(r))}`)],
      ['s', 'p', 't'].map((m) => { const x = R.miss[m]; return [MODE_LABEL[m], x.n, x.fail, x.k0, x.k1, x.k23, x.k4, ...R.others.map((r) => x.by[r])]; }))
    + numbers(['Suite', 'Setting', 'Failed but solved by another agent', 'Of these, solved by four or more'],
      ['s', 'p', 't'].flatMap((m) => R.miss[m].suites.map((r) => [esc(R.benchName(r.id)), MODE_LABEL[m], r.n, r.k4]))).replace('The numbers', 'By suite');
}

/** Figure 5: how the attempts went, per setting and agent: list-price cost, agent time, output tokens, the time limit. */
function figEffort(el, R) {
  const AG = [X, F, G];
  const metric = [
    ['usd_mean', 'Mean list-price cost of an attempt', (v) => `$${v.toFixed(v >= 10 ? 0 : 1)}`],
    ['wall_med', 'Median agent time of an attempt (minutes)', (v) => `${Math.round(v)}`],
    ['tok_out_med', 'Median output tokens of an attempt (thousands)', (v) => `${Math.round(v / 1000)}`],
    ['used_med_fail', 'Share of the time limit a failed attempt used (median, %)', (v) => `${Math.round(v)}`],
  ];
  const small = ([k, title, f]) => {
    const V = ['s', 'p', 't'], W = 360, H = 200, L = 8, B = 30, T = 18, gw = (W - L - 4) / V.length, bw = 24;
    const mx = Math.max(1, ...V.flatMap((m) => AG.map((r) => R.b(r, m, k) || 0))) * 1.12;
    const y = (v) => T + (H - T - B) * (1 - v / mx);
    let svg = `<line x1="${L}" x2="${W - 2}" y1="${y(0)}" y2="${y(0)}" class="gl"/>`;
    V.forEach((m, gi) => {
      const x0 = L + gi * gw + (gw - AG.length * bw - (AG.length - 1) * 8) / 2;
      AG.forEach((r, i) => {
        const v = R.b(r, m, k); if (v == null) return;
        const x = x0 + i * (bw + 8);
        svg += `<rect x="${x}" y="${y(v)}" width="${bw}" height="${Math.max(0.5, y(0) - y(v))}" rx="2" style="fill:${col(r)}"><title>${esc(`${R.name(r)} · ${MODE_LABEL[m]}: ${f(v)}`)}</title></rect>`
          + `<text x="${x + bw / 2}" y="${y(v) - 4}" class="bv" text-anchor="middle">${f(v)}</text>`;
      });
      svg += `<text x="${L + gi * gw + gw / 2}" y="${H - B + 18}" class="gx ${MODE_CLS[m]}" text-anchor="middle">${MODE_LABEL[m]}</text>`;
    });
    return `<div class="ef"><p class="hb-t">${esc(title)}</p><div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">${svg}</svg></div></div>`;
  };
  el.innerHTML = head(`${R.name(X)} costs less per attempt than ${R.name(F)} and ${R.name(G)} in every setting, takes less time and writes fewer output tokens; in the Standard and Realtime Settings, a failed attempt usually stops well before the time limit.`,
    'How the attempts went: cost, time, output and the time limit, by setting and agent',
    'each bar is one agent in one setting, over its counted attempts on the core tests; cost is the list price of the tokens the attempt used.')
    + `<div class="legend">${AG.map((r) => `<span>${sw(col(r))}${esc(R.name(r))}</span>`).join('')}</div>`
    + `<div class="efs">${metric.map(small).join('')}</div>`
    + `<p class="fig-note">Prices are the providers’ list prices of November 2026. Agent time is the time from the agent’s start to its end. The time limit is the test’s own.</p>`
    + numbers(['Agent', 'Setting', 'Attempts', 'Mean cost', 'Cost per solved test', 'Median cost, solved', 'Median cost, failed', 'Median minutes', 'Median minutes, solved', 'Median minutes, failed', 'Median model requests', 'Median output tokens', 'Ended by the time limit'],
      AG.flatMap((r) => ['s', 'p', 't'].map((m) => [esc(R.name(r)), MODE_LABEL[m], int(R.b(r, m, 'n')), usdC(R.b(r, m, 'usd_mean')), usdC(R.perSolve(r, m)), usdC(R.b(r, m, 'usd_med_ok')), usdC(R.b(r, m, 'usd_med_fail')),
        num0(R.b(r, m, 'wall_med')), num0(R.b(r, m, 'wall_med_ok')), num0(R.b(r, m, 'wall_med_fail')), num0(R.b(r, m, 'req_med')), num0(R.b(r, m, 'tok_out_med')), `${int(R.b(r, m, 'timeout'))}`])));
}
const usdC = (v) => (v == null ? '–' : `$${v.toFixed(2)}`);
const num0 = (v) => (v == null ? '–' : int(Math.round(v)));

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
Promise.all([getJSON(`${SNAP}exam.json`), getJSON(`${SNAP}tasks.json`), getJSON('data/blog-astra62.json').catch(() => ({}))]).then(([ex, tasks, bf]) => {
  const R = compute(ex, tasks, bf);
  fill(R.S);
  const figs = { board: figBoard, h2h: figH2H, paired: figPaired, suites: figSuites, effort: figEffort, miss: figMiss };
  for (const [k, f] of Object.entries(figs)) { const el = $(`#fig-${k}`); if (el) f(el, R); }
  $$('.fig-body[data-fig]').forEach((el) => $('.fig-cap', el)?.insertAdjacentHTML('afterbegin', `<b>Figure ${el.dataset.fig}.</b> `));
}).catch((e) => {
  console.error(e);
  $$('.fig-body').forEach((el) => { el.innerHTML = '<p class="fig-note">This figure could not be loaded.</p>'; });
}).finally(() => { toc(); clips(); settle(); zoomFigs(); });
