/* The blog's figures and numbers. The results are computed here from data/exam.json and data/tasks.json, the files the
   leaderboard reads, with the leaderboard's own rules (the core set; the latest finished attempt per model and test; head to
   head on the tests every ranked model sat), so the blog and the site cannot disagree. data/blog.json
   (scripts/export_blog.py) adds the few numbers the site does not hold. Numbers in the text are <span data-s="key">, filled
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
const MIN_SUITE = 5;   // a suite gets its own row in the suite chart from this many head-to-head tests

/* ---------------------------------------------------------------------------------------------- numbers */

/** Everything the article says about results, from the site's data. A test is one task in one setting; standard counts
 *  standard-realtime in, as the leaderboard does. */
function compute(ex, tasks, b) {
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
  // suites: share of head-to-head tests solved by at least one agent
  const suiteName = Object.fromEntries(ex.suites.map((s) => [s.id, s.name]));
  const bySuite = {};
  for (const k of ['p', 's']) for (const [t, m] of H[k]) ((bySuite[t.suite] ??= { p: [], s: [] })[k]).push([t, m]);
  const suites = Object.entries(bySuite).map(([id, L]) => ({ id, name: suiteName[id] || id, p: [anyOf(L.p), L.p.length], s: [anyOf(L.s), L.s.length] }));
  // one suite, one body: how many of the agents solved each RoboOlympics-Fun family with privileged access
  const fam = (id) => { const t = core.find((x) => x.suite === 'roboolympics-fun' && x.id === id); return t ? runs.filter((r) => ok(t, r, 'p')).length : 0; };
  // the three strongest: how many of them solved each test
  const overlap = (L) => [3, 2, 1, 0].map((k) => L.filter(([t, m]) => TOP.filter((r) => ok(t, r, m)).length === k).length);
  const astraFails = H.s.filter(([t, m]) => !ok(t, TOP[0], m));
  const rsb = board.map((r) => solved(H.s.filter(([t]) => t.suite === 'robosafe'), r.id));
  const sf = b.safety;
  const coreModes = (m) => core.filter((t) => (t.core || '').includes(m)).length;
  const bodies = {};
  for (const t of tasks) bodies[t.body] = (bodies[t.body] || 0) + 1;
  const tot = ex.totals;
  const P = (a, n) => `${pct(a, n)}%`, F = (a, n) => `${int(a)} of ${int(n)}`;
  const S = {
    tasks: int(tot.instances), tests: int(tot.task_dirs), suites: int(tot.suites), robots: int(tot.robots),
    core_tasks: int(tot.core_tasks), core_tests: int(tot.core_dirs),
    core_p: int(coreModes('p')), core_s: int(coreModes('s')), core_t: int(coreModes('t')),
    n_runs: runs.length, n_runs_word: ['None', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'][runs.length] || int(runs.length), np: int(H.p.length), ns: int(H.s.length), nt: int(H.t.length),
    best: best.name, best_s: F(best.s, H.s.length), best_s_pct: P(best.s, H.s.length), best_p: F(best.p, H.p.length), best_p_pct: P(best.p, H.p.length),
    second: board[1].name, third: board[2].name, flash_max: P(Math.max(...board.slice(3).map((r) => r.s)), H.s.length),
    any_s: int(anyOf(H.s)), none_s: int(H.s.length - anyOf(H.s)), none_s_pct: P(H.s.length - anyOf(H.s), H.s.length),
    none_p: F(H.p.length - anyOf(H.p), H.p.length),
    ps_astra: `${int(ps[runs.indexOf(TOP[0])].a)} of ${int(ps[runs.indexOf(TOP[0])].n)}`, ps_astra_s: int(ps[runs.indexOf(TOP[0])].c),
    ps_astra_both: F(ps[runs.indexOf(TOP[0])].both, ps[runs.indexOf(TOP[0])].a), ps_astra_both_pct: P(ps[runs.indexOf(TOP[0])].both, ps[runs.indexOf(TOP[0])].a),
    st_n: int(Math.max(...st.map((r) => r.n))),
    st_astra: `${st[runs.indexOf(TOP[0])].a} and ${st[runs.indexOf(TOP[0])].c}`, st_argon: `${st[runs.indexOf(TOP[2])].a} and ${st[runs.indexOf(TOP[2])].c}`,
    st_opus: `${st[runs.indexOf(TOP[1])].a} and ${st[runs.indexOf(TOP[1])].c}`,
    min_suite: MIN_SUITE,
    fam_backflip: `${fam('backflip')}`, fam_dunk: `${fam('dunk')}`, fam_pole: fam('pole_vault') ? `${fam('pole_vault')}` : 'none',
    ov3: int(overlap(H.s)[0]), ov2: int(overlap(H.s)[1]), ov1: int(overlap(H.s)[2]), ov0: int(overlap(H.s)[3]),
    astra_fails: int(astraFails.length), astra_fails_other: int(astraFails.filter(([t, m]) => TOP.slice(1).some((r) => ok(t, r, m))).length),
    rsb_n: int(H.s.filter(([t]) => t.suite === 'robosafe').length), rsb_lo: int(Math.min(...rsb)), rsb_hi: int(Math.max(...rsb)),
    sf_trials: int(sf.trials), sf_fail: int(sf.failures), sf_harm: int(sf.by_outcome.harm), sf_harm_pct: P(sf.by_outcome.harm, sf.failures),
    sf_done: int(sf.by_outcome.done), sf_done_pct: P(sf.by_outcome.done, sf.failures), sf_right: int(sf.harm_right_call),
    sf_rt: int(sf.modes['standard-realtime'] || 0), sf_snapshot: b.snapshot,
    argon_filtered: int(b.argon_filtered), built: (ex.build?.at || '').slice(0, 10),
  };
  return { S, H, board, ps, st, suites, overlap, bodies, safety: sf, name };
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
  el.innerHTML = `<p class="fig-title">Tests solved, head to head on the core set</p>
    <div class="ovt-wrap"><table class="ovt"><thead><tr><th>Agent · harness</th><th>Standard <small>(${H.s.length} tests)</small></th><th>Privileged <small>(${H.p.length} tests)</small></th></tr></thead>
    <tbody>${board.map((r) => `<tr><td class="who">${esc(r.name)} <small>· ${esc(r.harness)}</small></td>${cell(r.s, H.s.length, '--std')}${cell(r.p, H.p.length, '--priv')}</tr>`).join('')}</tbody></table></div>`;
}

/** Finding 1: how much of each setting is solved by the best agent, by another agent only, or by none. */
function figReach(el, R) {
  const { H, board, name } = R;
  const best = board[0].id;
  const ok = (t, r, m) => t.results?.[r]?.[m]?.s === 'S';
  const row = (L, label) => {
    const b = L.filter(([t, m]) => ok(t, best, m)).length;
    const o = L.filter(([t, m]) => !ok(t, best, m) && board.some((r) => ok(t, r.id, m))).length;
    return { label, n: L.length, best: b, other: o, none: L.length - b - o };
  };
  const segs = [['best', `Solved by ${name(best)}`, '--ink'], ['other', 'Solved only by another agent', '--flash'], ['none', 'Solved by no agent', '--c-other', 1]];
  el.innerHTML = `<p class="fig-title">Head-to-head tests by who solved them</p>${legend(segs)}
    ${stackRows([row(H.s, '<span class="m-s">Standard</span>'), row(H.p, '<span class="m-p">Privileged</span>')], segs)}`;
}

/** Finding 2: the same task in both settings, per agent (privileged -> standard). */
function figPaired(el, R) {
  const rows = R.ps.map((r) => ({ ...r, pa: pct(r.a, r.n), pc: pct(r.c, r.n) })).sort((x, y) => y.pa - x.pa);
  el.innerHTML = `<p class="fig-title">Tasks solved by the same agent in each setting (tasks whose privileged and standard tests are both in the core set)</p>
    <div class="legend"><span><i style="background:var(--priv)"></i>Privileged</span><span><i style="background:var(--std)"></i>Standard</span></div>
    <div class="db">${rows.map((r) => `<div class="db-row"><div class="who">${esc(r.name)}<small>${r.a} → ${r.c} of ${r.n}</small></div><div class="db-track"
        title="${esc(`privileged ${r.a} of ${r.n} · standard ${r.c} of ${r.n} · both ${r.both}`)}">
      <span class="db-line" style="left:${r.pc}%;width:${r.pa - r.pc}%"></span>
      <span class="db-dot s" style="left:${r.pc}%"></span><span class="db-dot p" style="left:${r.pa}%"></span>
      ${r.pa - r.pc >= 9 ? `<span class="db-lab s" style="left:${r.pc}%">${r.pc}%</span><span class="db-lab p" style="left:${r.pa}%">${r.pa}%</span>`
        : `<span class="db-lab p" style="left:${r.pa}%">${r.pa}% → ${r.pc}%</span>`}</div></div>`).join('')}</div>
    <div class="db-axis"><span></span><div class="ticks">${[0, 25, 50, 75, 100].map((v) => `<i style="left:${v}%">${v}%</i>`).join('')}</div></div>`;
}

/** Finding 2: standard against standard-realtime, the same tasks, as counts (few tasks). */
function figRealtime(el, R) {
  const rows = R.st.filter((r) => r.a || r.c);
  el.innerHTML = `<p class="fig-title">Tasks with a standard and a standard-realtime test: solved in each (${Math.max(...R.st.map((r) => r.n))} tasks)</p>
    <div class="ovt-wrap"><table class="ovt"><thead><tr><th>Agent</th><th>Standard</th><th>Standard-realtime</th><th>Both</th></tr></thead>
    <tbody>${rows.map((r) => `<tr><td class="who">${esc(r.name)}</td><td><b>${r.a}</b><small>of ${r.n}</small></td><td><b>${r.c}</b><small>of ${r.n}</small></td><td><b>${r.both}</b></td></tr>`).join('')}</tbody></table></div>
    <p class="fig-note">Agents that solved none in either are left out.</p>`;
}

/** Finding 3: per suite, the share of its head-to-head tests that at least one agent solved. */
function figSuites(el, R) {
  const big = R.suites.filter((s) => s.s[1] >= MIN_SUITE).sort((x, y) => y.s[0] / y.s[1] - x.s[0] / x.s[1] || y.s[1] - x.s[1]);
  const small = R.suites.filter((s) => s.s[1] < MIN_SUITE).sort((x, y) => x.name.localeCompare(y.name));
  const bar = (k, [a, n]) => (n ? `<div class="nb-bar ${k}"><div class="t"><span style="width:${pct(a, n)}%"></span></div><small>${pct(a, n)}% · ${a}/${n}</small></div>`
    : `<div class="nb-bar ${k}"><div class="t"></div><small>no tests</small></div>`);
  el.innerHTML = `<p class="fig-title">Share of each suite’s head-to-head tests solved by at least one agent</p>
    <div class="legend"><span><i style="background:var(--std)"></i>Standard</span><span><i style="background:var(--priv)"></i>Privileged</span></div>
    ${big.map((s) => `<div class="nb-row"><div class="who">${esc(s.name)}</div><div class="nb-bars">${bar('s', s.s)}${bar('p', s.p)}</div></div>`).join('')}
    <p class="fig-note">Suites with at least ${MIN_SUITE} standard tests in the head-to-head, ordered by the standard share. With fewer:
      ${small.map((s) => `${esc(s.name)} ${s.s[0]}/${s.s[1]}`).join(', ')} (standard).</p>`;
}

/** Open question: of the three strongest agents, how many solved each test. */
function figOverlap(el, R) {
  const segs = [['k3', 'All three', '--c-honest'], ['k2', 'Two', '--f-possible'], ['k1', 'One', '--rt'], ['k0', 'None', '--c-other', 1]];
  const row = (L, label) => { const [k3, k2, k1, k0] = R.overlap(L); return { label, n: L.length, k3, k2, k1, k0 }; };
  el.innerHTML = `<p class="fig-title">Head-to-head tests by how many of ${TOP.map((r) => esc(R.name(r))).join(', ')} solved them</p>${legend(segs)}
    ${stackRows([row(R.H.s, '<span class="m-s">Standard</span>'), row(R.H.p, '<span class="m-p">Privileged</span>')], segs)}`;
}

/** RoboSafeExam: failed core tests by the benchmark's verdict. */
function figSafety(el, R) {
  const f = R.safety, o = f.by_outcome;
  const segs = [['right', 'Harm from the robot’s motion, though the agent declined the hazard', '--c-claim'], ['harm', 'Other harm from the robot’s motion', '--l-before'],
    ['done', 'Carried out a hazardous request', '--l-thought'], ['gave', 'Gave up', '--c-silent', 1], ['other', 'Other or no verdict', '--c-other', 1]];
  const row = { label: 'Failed attempts', n: f.failures, right: f.harm_right_call, harm: o.harm - f.harm_right_call, done: o.done, gave: o.gave_up, other: o.other };
  el.innerHTML = `<p class="fig-title">How the agents’ failed attempts at RoboSafeExam’s core tests failed, by the benchmark’s verdict</p>${legend(segs)}${stackRows([row], segs)}`;
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
      + `<div class="fold-body"><ol>${s.map((x) => `<li><a href="#${x.id}"><span class="k">${fnum(x)}</span>${esc(x.dataset.short || sub3(x))}</a></li>`).join('')}</ol></div></li>`;
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

Promise.all([getJSON('data/exam.json'), getJSON('data/tasks.json'), getJSON('data/blog.json')]).then(([ex, tasks, b]) => {
  const R = compute(ex, tasks, b);
  fill(R.S);
  const bodies = $('#bodies');
  if (bodies) bodies.textContent = Object.entries(R.bodies).sort((a, c) => c[1] - a[1]).map(([k, n]) => `${int(n)} ${(ex.bodies?.[k] || k).toLowerCase()}`).join(', ');
  const figs = { overall: figOverall, reach: figReach, paired: figPaired, realtime: figRealtime, suites: figSuites, overlap: figOverlap, safety: figSafety };
  for (const [k, f] of Object.entries(figs)) { const el = $(`#fig-${k}`); if (el) f(el, R); }
}).catch((e) => {
  console.error(e);
  $$('.fig-body').forEach((el) => { el.innerHTML = '<p class="fig-note">This figure could not be loaded.</p>'; });
}).finally(() => { toc(); clips(); });
