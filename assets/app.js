// The Embodied First Exam's pages: one module for all of them; body[data-page] says which page this is.
// Data: data/exam.json (suites, runs, the taxonomy, the head-to-head view) and data/tasks.json (every question with its
// results), refreshed by scripts/export.py. Pictures and videos are under media/. Paths are taken from the site root,
// which is worked out from where this file is served (assets/app.js), so the site works at any address.

const BASE = new URL('../', import.meta.url).pathname;
const PAGE = document.body.dataset.page || 'home';
const Q = new URLSearchParams(location.search);
const MODES = ['privileged', 'standard'];
const MK = { privileged: 'p', standard: 's' };
const MODE_LABEL = { privileged: 'Privileged', standard: 'Standard' };
const BODY_ORDER = ['arm', 'bimanual', 'mobile', 'humanoid', 'hand', 'musculoskeletal'];
const GRADED = new Set(['S', 'F', 'E']);
/** A trial's state code for scoring; undefined for a standard trial that ran with resets allowed (reported apart). */
const scored = (c) => (c && !c.r ? c.s : undefined);

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
/** Escaped text with Markdown's inline code (`x`) as <code>. */
const prose = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
const site = (p) => (!p ? '' : /^https?:/.test(p) ? p : BASE + p);   // a picture or a video
const exam = (p) => BASE + (p || '');                               // a page of this site
const int = (n) => Number(n || 0).toLocaleString('en-US');
const rate = (s, n) => (n ? s / n : null);
const pctText = (s, n) => (n ? `${Math.round((100 * s) / n)}%` : '–');

let examData, taskData;
const getJSON = (p) => fetch(exam(p), { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`); return r.json(); });
const loadExam = () => (examData ??= getJSON('data/exam.json'));
const loadTasks = () => (taskData ??= getJSON('data/tasks.json'));

/* ------------------------------------------------------------------------------------------- page chrome */

// the logo: a robot arm standing like a 1 (first) beside a check mark (an exam, marked). The stem is the upper arm, the
// round top the elbow, the flag the forearm with its gripper, the foot the base; the joints have real holes (a mask), so
// the mark sits on any background; the elbow and the check carry the two modes' colours
const MARK = `<svg viewBox="0 0 32 32" fill="none" stroke-linecap="round" stroke-linejoin="round">
  <defs><mask id="efe-holes"><rect width="32" height="32" fill="#fff"/><circle cx="15" cy="24" r="1.3" fill="#000"/><circle cx="15" cy="9" r="1.3" fill="#000"/></mask></defs>
  <g mask="url(#efe-holes)"><rect x="8.5" y="25.6" width="13" height="3.6" rx="1.8" fill="currentColor"/><rect x="12.6" y="9" width="4.8" height="15.5" fill="currentColor"/>
    <path d="M15 9L8.6 15.4" stroke="currentColor" stroke-width="4.4"/><path d="M10.3 17.1L6.9 13.7M10.3 17.1L8.5 18.9M6.9 13.7L5.1 15.5" stroke="currentColor" stroke-width="2.2"/>
    <circle cx="15" cy="24" r="3.5" fill="currentColor"/><circle cx="15" cy="9" r="3.5" fill="var(--std)"/></g>
  <path d="M21.2 20.4L24 23.2L29.2 16.8" stroke="var(--priv)" stroke-width="3.2"/></svg>`;
const MOON = '<svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
const MENU = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
const SUN = '<svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/></svg>';

function chrome() {
  const links = [['leaderboard', 'leaderboard/', 'Leaderboard'], ['suites', 'suites/', 'Suites'], ['tasks', 'tasks/', 'Tasks'], ['contribute', 'contribute/', 'Contribute']];
  const active = (n) => PAGE === n || (PAGE === 'suite' && n === 'suites');
  const nav = $('#nav');
  if (nav) {
    nav.outerHTML = `<nav class="nav always" aria-label="Sections">
      <a class="wordmark" href="${exam()}"><span class="mark" aria-hidden="true">${MARK}</span>Embodied First Exam</a>
      <div class="nav-links">${links.map(([n, p, label]) => `<a href="${exam(p)}"${active(n) ? ' class="active"' : ''}>${label}</a>`).join('')}</div>
      <span class="preview-flag" title="A preview of the site">Preview</span>
      <button class="icon-btn menu-btn" id="menu-toggle" type="button" aria-label="Menu" aria-expanded="false">${MENU}</button>
      <button class="icon-btn" id="theme-toggle" type="button" aria-label="Switch between day and night">${MOON}${SUN}</button>
    </nav>`;
  }
  $('#menu-toggle')?.addEventListener('click', (e) => {
    const bar = e.currentTarget.closest('.nav');
    const open = bar.classList.toggle('open');
    e.currentTarget.setAttribute('aria-expanded', String(open));
  });
  $('#theme-toggle')?.addEventListener('click', () => {
    const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('exam-theme', t); } catch (e) { /* private mode */ }
  });
}

function footer(ex) {
  const f = $('#footer');
  if (!f) return;
  const ts = ex.task_set || {};
  const date = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
  f.outerHTML = `<footer class="footer"><div class="footer-grid">
    <div>
      <a class="wordmark" href="${exam()}"><span class="mark" aria-hidden="true">${MARK}</span>Embodied First Exam</a>
      <p>${esc(ex.summary || '')}</p>
      <div class="prov">Questions as of ${esc(date(ts.date))} · results updated ${esc(date(ex.build?.at))}</div>
    </div>
    <div><h5>The exam</h5><ul>
      <li><a href="${exam('leaderboard/')}">Leaderboard</a></li><li><a href="${exam('suites/')}">Suites</a></li>
      <li><a href="${exam('tasks/')}">Tasks</a></li></ul></div>
    <div><h5>About</h5><ul>
      <li><a href="${exam('how/')}">How it is marked</a></li><li><a href="${exam('contribute/')}">Contribute</a></li></ul></div>
  </div></footer>`;
}

function reveal(root = document) {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }),
    { rootMargin: '0px 0px -6% 0px' });
  $$('.reveal:not(.in)', root).forEach((el) => io.observe(el));
}

/* ------------------------------------------------------------------------------------------- shared pieces */

const suiteMap = (ex) => Object.fromEntries(ex.suites.map((s) => [s.id, s]));
const runMap = (ex) => Object.fromEntries(ex.runs.map((r) => [r.id, r]));
const ranked = (ex) => ex.suites.filter((s) => !s.example);

function mixColor(color, share) {
  const p = Math.max(0, Math.min(100, Math.round(share * 100)));
  return `color-mix(in srgb, var(${color}) ${p}%, var(--cell-0))`;
}

function scoreCell(mode, a, n, best) {
  if (!n) return `<td class="score ${MK[mode]} na"><div class="top"><span class="pct">–</span></div><span class="frac">not run</span></td>`;
  const v = (100 * a) / n;
  return `<td class="score ${MK[mode]}${best ? ' best' : ''}"><div class="top"><span class="pct">${Math.round(v)}%</span><span class="frac">${a} / ${n}</span></div>
    <div class="bar"><i style="width:${v.toFixed(1)}%"></i></div></td>`;
}

function modelCell(run, extra = '', compact = false) {
  const sub = [`<span class="h">${esc(run.harness)}</span>`, esc(run.effort), compact ? '' : esc(run.route)].filter(Boolean).join(' · ');
  return `<td class="model"><b>${esc(run.model)}</b><small>${sub}</small>${extra}</td>`;
}

/** The line under a run's name when some of its standard trials ran with resets allowed (scored apart). */
function resetNote(rs) {
  if (!rs?.done) return '';
  return `<small class="rs" title="Standard trials that ran with ${rs.budget} resets allowed. PROTOCOL §4.5: reported apart, never ranked with the others.">+ ${rs.done} with ${rs.budget} resets, apart: ${rs.success} solved</small>`;
}

function codeMark(s, dash = false) {
  return `<span class="code-mark${dash ? ' dash' : ''}" title="${esc(s.name)}">${esc(s.code)}</span>`;
}

function poster(media, cls = '') {
  if (!media?.poster) return '';
  return `<img src="${esc(site(media.poster))}" alt="" loading="lazy" decoding="async"${cls ? ` class="${cls}"` : ''}>`;
}

/* --------------------------------------------------------------------------------------------- leaderboard */

/** Scores of a group of runs. view "shared": only the trials every run in `group` graded; "all": each run's own. */
function scoreGroup(group, tasks, view) {
  const out = Object.fromEntries(group.map((r) => [r.id, { privileged: [0, 0], standard: [0, 0], suites: {} }]));
  for (const t of tasks) {
    if (t.suite === 'robosuite') continue;
    for (const m of MODES) {
      const k = MK[m];
      const cells = group.map((r) => scored(t.results?.[r.id]?.[k]));
      if (view === 'shared' && cells.some((c) => !GRADED.has(c))) continue;
      group.forEach((r, i) => {
        const c = cells[i];
        if (!GRADED.has(c)) return;
        const o = out[r.id];
        o[m][0] += c === 'S';
        o[m][1] += 1;
        const ss = (o.suites[t.suite] ??= {});
        const cell = (ss[m] ??= [0, 0]);
        cell[0] += c === 'S';
        cell[1] += 1;
      });
    }
  }
  return out;
}

const pctOf = (v) => (v && v[1] ? (100 * v[0]) / v[1] : null);

/** One dumbbell: the privileged mark (a hollow ring) and the standard mark (a solid dot) on a 0–100% scale, with an arrow
 *  from the first to the second: what is lost without the simulator. `pv` and `sv` are [solved, sat]; a mode not sat has no
 *  mark. Each number sits on the outer side of its mark. `mini`: no numbers. */
function dbTrack(pv, sv, mini = false) {
  const p = pctOf(pv), q = pctOf(sv);
  const parts = [];
  const both = p != null && q != null;
  const close = both && Math.abs(p - q) < 3;                // too close for an arrow: the dot sits inside the ring
  if (both && !close) {
    const lo = Math.min(p, q), w = Math.abs(p - q);
    parts.push(`<span class="db-arrow ${q < p ? 'l' : 'r'}" style="--lo:${lo.toFixed(1)}%;--w:${w.toFixed(1)}%"></span>`);
  }
  // the standard number goes on the side away from the privileged mark, and the other way round
  const side = (self, other) => (other == null ? (self > 88 ? 'l' : 'r') : self <= other ? 'l' : 'r');
  if (p != null) parts.push(`<span class="db-dot p${close ? ' ring' : ''}" style="--x:${p.toFixed(1)}%" title="Privileged: ${pv[0]} of ${pv[1]}">${mini ? '' : `<em class="${close ? 'r' : side(p, q)}">${Math.round(p)}%</em>`}</span>`);
  if (q != null) parts.push(`<span class="db-dot s" style="--x:${q.toFixed(1)}%" title="Standard: ${sv[0]} of ${sv[1]}">${mini ? '' : `<em class="${close ? 'l' : side(q, p)}">${Math.round(q)}%</em>`}</span>`);
  return `<span class="db-track${mini ? ' mini' : ''}"><span class="db-scale">${parts.join('')}</span></span>`;
}

function dbGap(pv, sv) {
  const p = pctOf(pv), q = pctOf(sv);
  if (p == null || q == null) return '<span class="db-gap na">–</span>';
  const g = Math.round(p) - Math.round(q);
  return `<span class="db-gap" title="${Math.abs(g)} points ${g >= 0 ? 'lower' : 'higher'} in standard mode">${g >= 0 ? '−' : '+'}${Math.abs(g)}<small>points</small></span>`;
}

const DB_HEAD = `<div class="db-legend"><span><i class="dot p"></i>Privileged</span><span><i class="dot s"></i>Standard</span>
    <span class="db-key"><i></i>What it loses without the simulator</span></div>
  <div class="db-axis"><span></span><span></span><span class="db-ticks">${[0, 25, 50, 75, 100].map((v) => `<span style="left:${v}%">${v}%</span>`).join('')}</span><span class="db-gap-h">Gap</span></div>`;

const whoLine = (r) => esc([r.harness, r.effort, r.route].filter(Boolean).join(' · '));

/** A model, suite by suite: a small dumbbell per suite it sat. */
function dbDetail(ex, r, sc) {
  const minis = ranked(ex).filter((s) => sc.suites[s.id]).map((s) => {
    const v = sc.suites[s.id];
    const href = `${exam('suite/')}?id=${s.id}`;
    const val = (m) => (v[m] ? `${Math.round(pctOf(v[m]))}%` : '–');
    return `<a class="db-mini" href="${href}" title="${esc(s.name)}: privileged ${v.privileged ? `${v.privileged[0]} of ${v.privileged[1]}` : 'not sat'}, standard ${v.standard ? `${v.standard[0]} of ${v.standard[1]}` : 'not sat'}">
      <span class="nm">${codeMark(s)}<span>${esc(s.name)}</span></span>${dbTrack(v.privileged, v.standard, true)}<span class="vals"><b class="p">${val('privileged')}</b><b class="s">${val('standard')}</b></span></a>`;
  }).join('');
  const cost = r.est_n ? `about $${(r.est_usd / r.est_n).toFixed(r.est_usd / r.est_n < 1 ? 2 : 1)} of model use per question at list price` : '';
  const time = r.agent_n ? `${Math.round(r.agent_s / r.agent_n / 60)} min per attempt` : '';
  return `<div class="db-detail"><div class="db-minis">${minis || '<p class="muted">No suite marked yet.</p>'}</div>
    <p class="db-foot">${[esc(r.label), cost, time].filter(Boolean).join(' · ')}</p></div>`;
}

/** The leaderboard page: the dumbbell board with its controls, smaller runs folded away, a model's suites on a click. */
function lbBoard(ex, tasks, onDraw) {
  const lb = ex.leaderboard || {};
  const minSuites = lb.min_suites || 10;
  const board = $('#lb-board');
  const harnesses = [...new Set(ex.runs.filter((r) => (r.kind || 'agent') === 'agent').map((r) => r.harness))];
  const state = { view: Q.get('view') === 'all' ? 'all' : 'shared', sort: Q.get('mode') === 'standard' ? 'standard' : 'privileged',
    harness: 'all', kind: 'agent', open: Q.get('open'), small: false };
  const rowHTML = (r, sc, rank, part) => {
    const open = state.open === r.id;
    const total = MODES.reduce((a, m) => a + sc[m][1], 0);
    const meta = `${r.suites?.length || 0} suite${(r.suites?.length || 0) === 1 ? '' : 's'} · ${int(total)} questions`;
    const reset = part && r.standard_reset?.done ? ` · <span class="rs" title="Standard attempts with ${r.standard_reset.budget} resets allowed are not counted">+${r.standard_reset.done} with resets, not counted</span>` : '';
    return `<div class="db-row x${open ? ' open' : ''}${part ? ' part' : ''}" role="button" tabindex="0" aria-expanded="${open}" data-run="${esc(r.id)}">
        <span class="rank">${part ? '·' : rank}</span><span class="who"><b>${esc(r.model)}</b><small>${whoLine(r)}</small><small class="meta">${meta}${reset}</small></span>
        ${dbTrack(sc.privileged, sc.standard)}${dbGap(sc.privileged, sc.standard)}</div>${open ? dbDetail(ex, r, sc) : ''}`;
  };
  function draw() {
    const pool = ex.runs.filter((r) => (r.kind || 'agent') === state.kind && (state.harness === 'all' || r.harness === state.harness));
    const main = pool.filter((r) => (r.suites?.length || 0) >= minSuites);
    const partial = pool.filter((r) => (r.suites?.length || 0) < minSuites).sort((a, b) => (b.suites?.length || 0) - (a.suites?.length || 0));
    const scores = scoreGroup(main, tasks, state.view);
    const pscores = Object.fromEntries(partial.map((r) => [r.id, scoreGroup([r], tasks, 'all')[r.id]]));
    const other = state.sort === 'privileged' ? 'standard' : 'privileged';
    const key = (sc, m) => pctOf(sc[m]) ?? -1;
    main.sort((a, b) => key(scores[b.id], state.sort) - key(scores[a.id], state.sort) || key(scores[b.id], other) - key(scores[a.id], other));
    let html = '';
    if (!main.length && !partial.length) {
      html = `<div class="empty-state">${state.kind === 'vla' ? 'No VLA policy has sat the exam yet.' : 'No run with this harness yet.'}</div>`;
    } else {
      let rank = 0, prev = null;
      html = DB_HEAD + main.map((r, i) => { const k = key(scores[r.id], state.sort); if (k !== prev) { rank = i + 1; prev = k; } return rowHTML(r, scores[r.id], rank, false); }).join('');
      if (partial.length) {
        const open = state.small || partial.some((r) => r.id === state.open);
        html += `<div class="db-group"><button type="button" class="btn small" data-small>${open ? 'Hide' : 'Show'} ${partial.length} smaller run${partial.length === 1 ? '' : 's'}</button>
          <span>Fewer than ${minSuites} suites each: scored on what they sat, not ranked.</span></div>`;
        if (open) html += partial.map((r) => rowHTML(r, pscores[r.id], 0, true)).join('');
      }
    }
    board.innerHTML = html;
    const n = main.length ? MODES.map((m) => scores[main[0].id][m][1]) : [0, 0];
    $('#lb-note').innerHTML = state.view === 'shared'
      ? `Head to head: the same ${int(n[0])} privileged and ${int(n[1])} standard questions for every ranked model.`
      : 'Everything each model sat: the counts differ from row to row, so compare with care.';
    $('[data-small]', board)?.addEventListener('click', () => { state.small = !state.small; if (!state.small && partial.some((r) => r.id === state.open)) state.open = null; draw(); });
    $$('.db-row.x', board).forEach((row) => {
      const toggle = () => { state.open = state.open === row.dataset.run ? null : row.dataset.run; draw(); };
      row.addEventListener('click', toggle);
      row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    });
    if (onDraw) onDraw({ state, main, scores });
  }
  function sync() {
    $$('#lb-view button').forEach((b) => b.classList.toggle('on', b.dataset.view === state.view));
    $$('#lb-mode button').forEach((b) => b.classList.toggle('on', b.dataset.mode === state.sort));
    $$('#lb-kind button').forEach((b) => b.classList.toggle('on', b.dataset.kind === state.kind));
    $$('#lb-harness .chip').forEach((b) => b.classList.toggle('on', b.dataset.h === state.harness));
    const u = new URL(location.href);
    u.searchParams.set('view', state.view); u.searchParams.set('mode', state.sort);
    history.replaceState(null, '', u);
    draw();
  }
  $('#lb-harness').innerHTML = ['all', ...harnesses].map((h) => `<button class="chip${h === 'all' ? ' on' : ''}" data-h="${esc(h)}">${h === 'all' ? 'All harnesses' : esc(h)}</button>`).join('');
  $('#lb-harness').addEventListener('click', (e) => { const b = e.target.closest('[data-h]'); if (b) { state.harness = b.dataset.h; sync(); } });
  $('#lb-view').addEventListener('click', (e) => { const b = e.target.closest('[data-view]'); if (b) { state.view = b.dataset.view; sync(); } });
  $('#lb-mode').addEventListener('click', (e) => { const b = e.target.closest('[data-mode]'); if (b) { state.sort = b.dataset.mode; sync(); } });
  $('#lb-kind').addEventListener('click', (e) => { const b = e.target.closest('[data-kind]'); if (b) { state.kind = b.dataset.kind; sync(); } });
  $('#n-vla').textContent = ex.runs.filter((r) => r.kind === 'vla').length;
  sync();
}

/** Suite by suite: a table of numbers, one row per suite and one column per model, each cell tinted by its value.
 *  A switch picks the number: standard, privileged, or what is lost without the simulator. The best cell of a row is
 *  underlined. (It replaced bubbles sized by score, which were hard to read.) */
let SX_MODE = 'standard';
function lbSuites(el, ex, runs, scores) {
  if (!el) return;
  if (!runs.length) { el.innerHTML = '<div class="empty-state">No ranked model in this view.</div>'; return; }
  const pct = (r, s, m) => pctOf(scores[r.id]?.suites?.[s.id]?.[m]);
  const suites = ranked(ex).filter((s) => runs.some((r) => scores[r.id]?.suites?.[s.id]));
  const value = (r, s) => {
    if (SX_MODE !== 'drop') return pct(r, s, SX_MODE);
    const p = pct(r, s, 'privileged'), q = pct(r, s, 'standard');
    if (p == null || q == null) return null;
    return p === 0 && q === 0 ? NaN : Math.round(p) - Math.round(q);     // solved neither way: no loss to speak of
  };
  const cell = (r, s, best) => {
    const v = value(r, s);
    if (v == null) return '<span class="sx-cell na" title="Not sat">–</span>';
    if (Number.isNaN(v)) return '<span class="sx-cell zero" title="Solved in neither mode">0 · 0</span>';
    const sv = scores[r.id].suites[s.id];
    const of = (m) => (sv[m] ? `${sv[m][0]} of ${sv[m][1]}` : 'not sat');
    const tip = `${s.name} · ${r.model}: privileged ${of('privileged')}, standard ${of('standard')}`;
    // tints stay light enough for dark text everywhere: up to 60% of the mode colour, 44% of grey for a drop
    const tint = SX_MODE === 'drop' ? Math.round(4 + Math.min(100, Math.abs(v) * 1.4) * 0.4) : Math.round(4 + v * 0.56);
    const text = SX_MODE === 'drop' ? `${v > 0 ? '−' : v < 0 ? '+' : ''}${Math.abs(v)}` : `${Math.round(v)}<small>%</small>`;
    // where the build carries the suite's runs page (the internal site), a number opens that model's attempts there
    const href = s.pages?.runs ? `${site(s.pages.runs)}?run=${encodeURIComponent(r.id)}` : '';
    const tag = href ? `a href="${href}"` : 'span';
    return `<${tag} class="sx-cell${best ? ' best' : ''}" style="--t:${tint}%" title="${esc(tip)}">${text}</${href ? 'a' : 'span'}>`;
  };
  const head = `<div class="sx-row sx-head"><span></span>${runs.map((r) => `<span class="sx-col"><b>${esc(r.model)}</b><small>${esc(r.effort)}</small></span>`).join('')}</div>`;
  const rows = suites.map((s) => {
    const vals = runs.map((r) => value(r, s));
    const top = SX_MODE === 'drop' ? null : Math.max(...vals.filter((v) => v != null).map((v) => Math.round(v)));
    return `<div class="sx-row"><a class="sd-name" href="${exam('suite/')}?id=${s.id}">${codeMark(s)}<span>${esc(s.name)}</span></a>
      ${runs.map((r, i) => cell(r, s, top != null && vals[i] != null && Math.round(vals[i]) === top && top > 0)).join('')}</div>`;
  }).join('');
  const modes = [['standard', '<i class="dot s"></i>Standard'], ['privileged', '<i class="dot p"></i>Privileged'], ['drop', '<i class="arr"></i>What it loses']];
  const note = { standard: 'Share of each suite’s questions solved in standard mode. The best in each row is underlined.',
    privileged: 'Share of each suite’s questions solved in privileged mode. The best in each row is underlined.',
    drop: 'Points lost from privileged to standard: where the simulator matters most.' }[SX_MODE];
  el.innerHTML = `<div class="sx-bar"><div class="seg sx-${SX_MODE}" role="group" aria-label="Which number">${modes.map(([m, l]) => `<button type="button" data-m="${m}" class="${m === SX_MODE ? 'on' : ''}">${l}</button>`).join('')}</div>
    <span class="sx-note">${note}</span></div>
    <div class="sd-scroll"><div class="sx-grid sx-${SX_MODE}" style="--n:${runs.length}">${head}${rows}</div></div>`;
  el.querySelectorAll('.sx-bar button').forEach((b) => b.addEventListener('click', () => { SX_MODE = b.dataset.m; lbSuites(el, ex, runs, scores); }));
}

/** How it is counted: one icon, one rule and one line each, a small picture where it says more. */
function lbRules(el, ex) {
  if (!el) return;
  const lb = ex.leaderboard || {};
  const commit = (ex.task_set?.commit || '').slice(0, 9);
  const visual = {
    states: `<div class="rv-states"><span class="lbl">Counted</span><span class="chip-st ok">✓ solved</span><span class="chip-st">✗ failed</span><span class="chip-st">! error</span>
      <span class="lbl">Left out</span><span class="chip-st out">stopped</span><span class="chip-st out">withdrawn</span><span class="chip-st out">still running</span></div>`,
    modes: `<div class="rv-modes"><span><i class="dot p"></i>Privileged</span><span class="ne">≠</span><span><i class="dot s"></i>Standard</span></div>`,
    budget: `<div class="rv-states"><span class="chip-st">1 hour</span><span class="chip-st">100M tokens in</span><span class="chip-st">10M out</span><span class="chip-st out">no web search</span></div>`,
    venn: `<svg class="rv-venn" viewBox="0 0 120 92" aria-hidden="true"><defs><clipPath id="vv-a"><circle cx="46" cy="38" r="28"/></clipPath><clipPath id="vv-b"><circle cx="74" cy="38" r="28"/></clipPath></defs>
      <g clip-path="url(#vv-a)"><g clip-path="url(#vv-b)"><circle cx="60" cy="60" r="28" class="in"/></g></g>
      <circle cx="46" cy="38" r="28"/><circle cx="74" cy="38" r="28"/><circle cx="60" cy="60" r="28"/></svg>`,
  };
  const fill = (x) => String(x || '').replaceAll('{commit}', commit).replaceAll('{min_suites}', lb.min_suites || 10);
  el.innerHTML = (lb.notes || []).map((n) => `<div class="rule6">
      <span class="tr-ic"><svg viewBox="0 0 24 24" aria-hidden="true">${FF_ICONS[n.icon] || FF_ICONS.shield}</svg></span>
      <b>${esc(fill(n.title))}</b><p>${esc(fill(n.text))}</p>${visual[n.visual] || ''}</div>`).join('');
}

/* ---------------------------------------------------------------------------------------------- suites */

function suiteCard(ex, s) {
  const cover = s.teaser || s.preview?.find((p) => p.cover) || s.preview?.find((p) => !p.still) || s.preview?.[0];
  const robot = s.robots?.[0]?.name || '';
  const more = (s.robots?.length || 0) > 1 ? ` and ${s.robots.length - 1} more` : '';
  return `<a class="suite-card" href="${exam('suite/')}?id=${s.id}">
    <div class="media">${cover ? poster(cover, CROPS[s.id]) : `<div class="placeholder-art"><span>${esc(s.code)}</span><small>no pictures yet</small></div>`}</div>
    <div class="body"><h4>${esc(s.name)}</h4><p>${esc(s.blurb || '')}</p>
      <div class="meta">${int(s.instances)} scenes · ${esc(robot)}${more}${s.origin === 'ours' ? ' · ours' : ''}</div></div></a>`;
}

function incomingCard(x) {
  const robots = (x.robots || []).map((r) => r.name).join(', ');
  const media = x.poster ? `<img src="${esc(site(x.poster))}" alt="" loading="lazy">` : `<div class="placeholder-art"><span>${esc(x.code)}</span></div>`;
  const link = Object.values(x.links || {}).find(Boolean);
  const tag = link ? 'a' : 'div';
  return `<${tag} class="suite-card"${link ? ` href="${esc(link)}"` : ''}>
    <div class="media">${media}<span class="origin">${x.stage === 'candidate' ? 'candidate' : 'in review'}</span></div>
    <div class="body"><h4>${esc(x.name)}</h4><p>${esc(x.blurb || '')}</p>
      <div class="meta">${esc(x.size || '')} · ${esc(robots)}${x.origin === 'ours' ? ' · ours' : ''}</div></div></${tag}>`;
}

// suites whose scenes look alike, kept apart on the home page's wall as if they were one
const LOOKALIKE = { robocasa: 'kitchen', robocasa365: 'kitchen', 'robocasa-gr1': 'kitchen' };

// multi-camera posters: show the top-left camera only (the grid's layout per suite)
const CROPS = { 'robotwin-2': 'crop-3x2 col2', dextoolbench: 'crop-2x2', 'mujoco-playground': 'crop-2x2' };

function suitesGrid(el, ex, filter = {}) {
  const runs = runMap(ex);
  const bodies = ex.bodies || {};
  const list = ex.suites.filter((s) => (!filter.body || s.body === filter.body) && (!filter.origin || s.origin === filter.origin));
  const groups = BODY_ORDER.map((b) => [b, list.filter((s) => s.body === b && !s.example)]).filter(([, l]) => l.length);
  const example = list.filter((s) => s.example);
  el.innerHTML = groups.map(([b, l]) => `<div class="suite-group reveal"><h3>${esc(bodies[b] || b)} <small>${l.length} suite${l.length > 1 ? 's' : ''} · ${int(l.reduce((a, s) => a + s.instances, 0))} scenes</small></h3>
      <div class="suite-grid">${l.map((s) => suiteCard(ex, s)).join('')}</div></div>`).join('')
    + (example.length && !filter.body ? `<div class="suite-group reveal"><h3>Example <small>the task every suite starts from · not ranked</small></h3><div class="suite-grid">${example.map((s) => suiteCard(ex, s)).join('')}</div></div>` : '');
  reveal(el);
}

function incomingGrid(el, ex) {
  el.innerHTML = `<div class="suite-grid">${(ex.incoming || []).map(incomingCard).join('')}</div>`;
}

/* -------------------------------------------------------------------------------------- coverage (taxonomy) */

/** The coverage numbers: the display-tag groups, the suites that carry tags, and their scenes. */
function coverageInfo(ex) {
  const groups = ex.taxonomy || [];
  const suites = ranked(ex).filter((s) => Object.keys(s.tags || {}).length);
  return { groups, suites, total: suites.reduce((a, s) => a + s.instances, 0) };
}

/** Coverage, drawn like the home page's map: a row per suite, a column per label (capabilities, then domains), a dot on
 *  each crossing whose area is the share of the suite's scenes with that label. Pointing lights the row and the column;
 *  a click opens those scenes in the task list. */
function coverage(el, ex) {
  const info = coverageInfo(ex);
  if (!el) return info;
  const { groups, suites, total } = info;
  const D = 30;
  const cols = groups.flatMap((g, gi) => g.tags.map((t, ti) => ({ ...t, group: g.name, first: ti === 0 && gi > 0 })));
  const short = (t) => t.name.split(/[ &/]+/)[0];
  const dot = (n, of) => (n ? `<i style="--d:${Math.max(6, Math.sqrt(n / of) * D).toFixed(1)}px"></i>` : '');
  const head = `<div class="cv-row cv-head"><span class="cv-name"></span>${cols.map((t) => `<a class="cv-col${t.first ? ' gstart' : ''}" href="${exam('tasks/')}?tags=${t.id}" data-tag="${t.id}" title="${esc(t.name)}">${tagIcon(t.id)}<b>${esc(short(t))}</b></a>`).join('')}</div>`;
  const groupsRow = `<div class="cv-row cv-groups"><span class="cv-name"></span>${groups.map((g) => `<span class="cv-grp" style="grid-column: span ${g.tags.length}">${esc(g.name)}</span>`).join('')}</div>`;
  const rows = suites.map((s) => `<div class="cv-row" data-suite="${s.id}"><a class="cv-name" href="${exam('suite/')}?id=${s.id}">${codeMark(s)}<span>${esc(s.name)}</span><small>${int(s.instances)}</small></a>
      ${cols.map((t) => { const n = s.tags?.[t.id] || 0; return `<a class="cv-cell${t.first ? ' gstart' : ''}${n ? '' : ' none'}" data-tag="${t.id}" href="${exam('tasks/')}?suite=${s.id}&tags=${t.id}" title="${esc(s.name)}: ${n} of ${s.instances} scenes need ${esc(t.name)}">${dot(n, s.instances)}</a>`; }).join('')}</div>`).join('');
  const totals = `<div class="cv-row cv-total"><span class="cv-name"><b>All ${int(total)} scenes</b></span>${cols.map((t) => {
    const n = suites.reduce((a, s) => a + (s.tags?.[t.id] || 0), 0);
    return `<span class="cv-cell${t.first ? ' gstart' : ''}" data-tag="${t.id}" title="${n} of ${total} scenes">${dot(n, total)}<em>${Math.round((100 * n) / total)}%</em></span>`;
  }).join('')}</div>`;
  const legend = `<div class="sd-legend">${[0.1, 0.5, 1].map((x) => `<span><span class="cv-dot">${dot(x, 1)}</span>${Math.round(x * 100)}%</span>`).join('')}<span class="cap">of a suite’s scenes carry the label</span></div>`;
  el.innerHTML = `${legend}<div class="sd-scroll"><div class="cv-grid" style="--n:${cols.length}">${groupsRow}${head}${rows}${totals}</div></div>`;
  const grid = $('.cv-grid', el);
  const light = (tag, suite) => {
    $$('.on', grid).forEach((x) => x.classList.remove('on'));
    grid.classList.toggle('focus', !!(tag || suite));
    if (tag) $$(`[data-tag="${tag}"]`, grid).forEach((x) => x.classList.add('on'));
    if (suite) $(`.cv-row[data-suite="${suite}"]`, grid)?.classList.add('on');
  };
  grid.addEventListener('mouseover', (e) => { const c = e.target.closest('[data-tag]'); const r = e.target.closest('.cv-row[data-suite]'); light(c?.dataset.tag, r?.dataset.suite); });
  grid.addEventListener('mouseleave', () => light());
  return info;
}

function thinSpots(el, ex, info) {
  const tags = info.groups.flatMap((g) => g.tags.map((t) => ({ ...t, group: g.name, n: info.suites.reduce((a, s) => a + (s.tags?.[t.id] || 0), 0) })));
  const thin = tags.filter((t) => t.n / info.total < 0.12).sort((a, b) => a.n - b.n);
  const bodies = BODY_ORDER.map((b) => ({ b, n: ranked(ex).filter((s) => s.body === b).length })).filter((x) => x.n <= 1);
  const coming = (b) => (ex.incoming || []).filter((x) => (x.robots || []).some((r) => r.body === b))
    .map((x) => `${esc(x.name)} is ${x.stage === 'candidate' ? 'a candidate' : 'in review'}`);
  const items = [
    ...thin.map((t) => `<a href="${exam('contribute/')}#propose">${tagIcon(t.id)}<span class="label">${esc(t.group)}</span><b>${esc(t.name)}</b><span title="${esc(t.description)}">${int(t.n)} question${t.n === 1 ? '' : 's'} so far</span></a>`),
    ...bodies.map((x) => {
      const c = coming(x.b);
      return `<a href="${exam('contribute/')}#propose"><span class="ic" data-icon="arm"></span><span class="label">Robot body</span><b>${esc(ex.bodies?.[x.b] || x.b)}</b><span>${x.n ? 'One suite so far' : 'A first suite is welcome'}${c.length ? ` · on the way: ${c.map((z) => z.split(' is ')[0]).join(', ')}` : ''}</span></a>`;
    }),
  ];
  el.innerHTML = items.join('');
}

/* ----------------------------------------------------------------------------------------------- tasks */

function dots(ex, t, runs) {
  return `<span class="dots" title="${esc(runs.map((r) => `${r.model} ${r.effort}: ${MODES.map((m) => `${MODE_LABEL[m]} ${stateWord(t.results?.[r.id]?.[MK[m]]?.s)}`).join(', ')}`).join('\n'))}">${runs.map((r) => MODES.map((m) => {
    const c = scored(t.results?.[r.id]?.[MK[m]]);
    return `<i class="${GRADED.has(c) ? c + ' ' + MK[m] : 'none'}"></i>`;
  }).join('')).join('')}</span>`;
}

const STATE_WORD = { S: 'solved', F: 'not solved', E: 'error', Q: 'queued', N: 'not run', R: 'running', X: 'not counted', '-': 'no data' };
const stateWord = (c) => STATE_WORD[c] || 'not run';

function taskCard(ex, t, runs) {
  const s = ex._suites[t.suite];
  const crop = CROPS[t.suite];
  return `<button class="task-card" data-task="${esc(t.suite)}/${esc(t.id)}">
    <div class="media">${t.media?.poster ? poster(t.media, crop) : `<div class="placeholder-art">${esc(s?.code || '')}</div>`}${s ? codeMark(s) : ''}${t.media?.still ? '<span class="still">scene</span>' : ''}</div>
    <div class="body"><h4>${esc(t.title)}</h4><p>${esc(t.sentence || '')}</p>
      <div class="res">${runs.length ? dots(ex, t, runs) : ''}<span class="label" style="margin-left:auto">${esc(t.difficulty || '')}</span></div></div></button>`;
}

function openTask(ex, t, runs) {
  const s = ex._suites[t.suite] || {};
  const m = t.media || {};
  let media = '';
  if (m.video) media = `<div class="media"><video src="${esc(site(m.video))}" ${m.poster ? `poster="${esc(site(m.poster))}"` : ''} controls muted loop autoplay playsinline></video><span class="note">demo</span></div>`;
  else if (m.watch) media = `<div class="media">${m.poster ? `<img src="${esc(site(m.poster))}" alt="">` : ''}<span class="note"><a href="${esc(m.watch)}" target="_blank" rel="noopener">watch the official demo ↗</a></span></div>`;
  else if (m.poster) media = `<div class="media"><img src="${esc(site(m.poster))}" alt=""><span class="note">${m.still ? 'the scene the task starts from' : 'preview'}</span></div>`;
  const allRuns = ex.runs.filter((r) => t.results?.[r.id]);
  const res = allRuns.map((r) => {
    const cell = (mode) => {
      const c = t.results[r.id]?.[MK[mode]];
      if (!c) return '<span class="muted">–</span>';
      const word = stateWord(c.s) + (c.r ? ` · ${c.r} resets` : '');
      const cls = c.r ? `st rs` : `st ${c.s}${c.s === 'S' ? ' ' + MK[mode] : ''}`;
      return `<span class="${cls}">${word}</span>`;
    };
    return `<tr><td>${modelCell(r).replace('<td class="model">', '<div class="model">').replace(/<\/td>$/, '</div>')}</td><td>${cell('privileged')}</td><td>${cell('standard')}</td></tr>`;
  }).join('');
  const facts = [
    ['Suite', `${codeMark(s)} <a class="link" href="${exam('suite/')}?id=${s.id}">${esc(s.name)}</a>`],
    ['Robot', esc((s.robots || []).find((r) => r.id === t.robot)?.name || t.robot || '')],
    ['Modes', (t.modes || []).map((x) => `<span class="pill ${MK[x]}">${x}</span>`).join(' ')],
    ['Reference solution', esc({ full: 'Full: the oracle solves it', partial: 'Partial: the oracle reaches part of the goal', none: 'None: solvability shown in human review' }[t.oracle] || '')],
    ['Agent time', t.budget_min ? `${t.budget_min} min per attempt` : ''],
    ['Difficulty', esc(t.difficulty || '')],
    ['Family', `<span class="mono">${esc(t.family || '')}</span>`],
    ['Task directories', (t.dirs || []).map((d) => `<span class="mono" style="font-size:12px">${esc(d)}</span>`).join('<br>')],
    ['Author', esc(t.author || '')],
  ].filter(([, v]) => v);
  const tags = (t.tags || []).map((id) => ex._tags[id]).filter(Boolean).map((tg) => `<span class="pill">${esc(tg.name)}</span>`).join(' ');
  $('#drawer .drawer-inner').innerHTML = `
    <div class="drawer-top"><span class="label">${esc(s.name || '')} · task</span><button class="icon-btn" data-close aria-label="Close">✕</button></div>
    <h2>${esc(t.title)}</h2><p class="sentence">${prose(t.sentence || '')}</p>
    ${tags ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:12px">${tags}</div>` : ''}
    ${media}
    <h3>Results</h3>
    ${res ? `<table class="res-table"><thead><tr><th>Model</th><th>Privileged</th><th>Standard</th></tr></thead><tbody>${res}</tbody></table>` : '<p class="muted">No agent has run this task yet.</p>'}
    ${allRuns.some((r) => t.results[r.id]?.s?.r) ? '<p class="board-foot">A standard trial marked with resets ran with resets allowed. It is reported apart and counts in no ranking (protocol §4.5).</p>' : ''}
    <h3>About the task</h3><table class="facts-table"><tbody>${facts.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</tbody></table>
    <div class="link-list"><a class="btn small" href="${exam('suite/')}?id=${s.id}">More from ${esc(s.name)} <span class="arr">→</span></a></div>`;
  document.body.classList.add('drawer-open');
  const u = new URL(location.href);
  u.searchParams.set('task', `${t.suite}/${t.id}`);
  history.replaceState(null, '', u);
}

function closeTask() {
  document.body.classList.remove('drawer-open');
  $('#drawer video')?.pause();
  const u = new URL(location.href);
  u.searchParams.delete('task');
  history.replaceState(null, '', u);
}

function drawerShell() {
  if ($('#drawer')) return;
  document.body.insertAdjacentHTML('beforeend', '<div class="drawer-scrim" data-close></div><aside class="drawer" id="drawer" aria-label="Task"><div class="drawer-inner"></div></aside>');
  document.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeTask(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') closeTask(); });
}

function taskBrowser(el, ex, tasks, opts = {}) {
  const runs = ex.runs.filter((r) => (ex.leaderboard?.shared?.runs || []).includes(r.id));
  drawerShell();
  const index = new Map(tasks.map((t) => [`${t.suite}/${t.id}`, t]));
  const state = { q: Q.get('q') || '', suite: opts.suite || Q.get('suite') || '', body: '', tag: '', diff: '', oracle: '', result: '', limit: 60,
    tags: (opts.suite ? '' : Q.get('tags') || '').split(',').filter((x) => ex._tags[x]) };
  const f = $('.filters', el.parentElement);
  if (f && !opts.suite) {
    const suites = ranked(ex).concat(ex.suites.filter((s) => s.example));
    const tagOpts = (ex.taxonomy || []).map((g) => `<optgroup label="${esc(g.name)}">${g.tags.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</optgroup>`).join('');
    f.innerHTML = `<input type="search" placeholder="Search tasks, families, suites" value="${esc(state.q)}" data-f="q" aria-label="Search">
      <select data-f="suite" aria-label="Suite"><option value="">All suites</option>${suites.map((s) => `<option value="${s.id}"${s.id === state.suite ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
      <select data-f="body" aria-label="Robot"><option value="">Any robot</option>${BODY_ORDER.map((b) => `<option value="${b}">${esc(ex.bodies?.[b] || b)}</option>`).join('')}</select>
      <select data-f="tag" aria-label="Capability or domain"><option value="">Any capability or domain</option>${tagOpts}</select>
      <select data-f="diff" aria-label="Difficulty"><option value="">Any difficulty</option>${['easy', 'medium', 'hard', 'extreme'].map((d) => `<option>${d}</option>`).join('')}</select>
      <select data-f="result" aria-label="Results"><option value="">Any result</option><option value="solved">Solved by a model</option><option value="unsolved">Never solved</option><option value="unrun">Not run yet</option></select>
      <span class="tagset" hidden></span><span class="count"></span>`;
    f.addEventListener('input', (e) => { const k = e.target.dataset.f; if (!k) return; state[k] = e.target.value; state.limit = 60; draw(); });
    f.addEventListener('click', (e) => { if (e.target.closest('.tagset button')) { state.tags = []; state.limit = 60; draw(); } });
  }
  function match(t) {
    if (state.suite && t.suite !== state.suite) return false;
    if (state.body && t.body !== state.body) return false;
    if (state.tag && !(t.tags || []).includes(state.tag)) return false;
    if (state.tags.length && !state.tags.every((g) => (t.tags || []).includes(g))) return false;
    if (state.diff && t.difficulty !== state.diff) return false;
    if (state.result) {
      const cells = Object.values(t.results || {}).flatMap((r) => Object.values(r).map(scored));
      const solved = cells.includes('S'), graded = cells.some((c) => GRADED.has(c));
      if (state.result === 'solved' && !solved) return false;
      if (state.result === 'unsolved' && (solved || !graded)) return false;
      if (state.result === 'unrun' && graded) return false;
    }
    if (state.q) {
      const s = ex._suites[t.suite];
      const hay = `${t.title} ${t.sentence} ${t.family} ${s?.name} ${s?.code} ${t.id}`.toLowerCase();
      if (!state.q.toLowerCase().split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    return true;
  }
  const mixed = (() => {
    const by = new Map();
    for (const t of tasks) { if (!by.has(t.suite)) by.set(t.suite, []); by.get(t.suite).push(t); }
    const lists = [...by.values()], out = [];
    for (let i = 0; out.length < tasks.length; i++) for (const l of lists) if (i < l.length) out.push(l[i]);
    return out;
  })();
  function draw() {
    const narrowed = state.suite || state.q;
    const hits = (narrowed ? tasks : mixed).filter(match);
    el.innerHTML = hits.length ? `<div class="task-grid">${hits.slice(0, state.limit).map((t) => taskCard(ex, t, runs)).join('')}</div>`
      + (hits.length > state.limit ? `<div class="load-more"><button class="btn" data-more>Show ${Math.min(60, hits.length - state.limit)} more of ${int(hits.length - state.limit)}</button></div>` : '')
      : '<div class="empty-state">No task matches these filters.</div>';
    const c = f && $('.count', f);
    if (c) c.textContent = `${int(hits.length)} of ${int(tasks.length)} scenes`;
    const chip = f && $('.tagset', f);
    if (chip) chip.innerHTML = state.tags.length ? `${state.tags.map((g) => esc(ex._tags[g].name)).join(' <span>×</span> ')} <button type="button" aria-label="Clear the labels">✕</button>` : '';
    if (chip) chip.hidden = !state.tags.length;
    $('[data-more]', el)?.addEventListener('click', () => { state.limit += 60; draw(); });
    const u = new URL(location.href);
    if (!opts.suite) { state.q ? u.searchParams.set('q', state.q) : u.searchParams.delete('q'); state.suite ? u.searchParams.set('suite', state.suite) : u.searchParams.delete('suite');
      state.tags.length ? u.searchParams.set('tags', state.tags.join(',')) : u.searchParams.delete('tags'); history.replaceState(null, '', u); }
  }
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-task]');
    if (b) openTask(ex, index.get(b.dataset.task), runs);
  });
  draw();
  const want = Q.get('task');
  if (want && index.has(want)) openTask(ex, index.get(want), runs);
}

/* ------------------------------------------------------------------------------------------------ pages */

function prepare(ex) {
  ex._suites = suiteMap(ex);
  ex._tags = Object.fromEntries((ex.taxonomy || []).flatMap((g) => g.tags.map((t) => [t.id, t])));
  return ex;
}

/** The first screen's wall: the suites' scenes (exam.json `hero.tiles`, chosen at build time) dealt into columns that
 *  drift up and down. Videos play only on tiles in the open part of the wall, a few at a time; on a phone, pictures only. */
function heroWall(ex) {
  const wall = $('#wall');
  const tiles = ex.hero?.tiles || [];
  if (!wall || !tiles.length) return;
  const phone = innerWidth < 760;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gap = phone ? 12 : 16;
  // tiles a little larger on big screens if the pool would otherwise run short: every scene appears once
  let tw = Math.round(Math.max(150, Math.min(600, innerWidth * (phone ? 0.4 : 0.23))));
  let n, per;
  const fit = () => {
    wall.style.setProperty('--tw', `${tw}px`);
    n = Math.max(3, Math.ceil(wall.offsetWidth / (tw + gap)) + 1);
    // a column's period must be at least the wall's height, or its end shows before it wraps
    per = Math.ceil(wall.offsetHeight / (tw * 0.75 + gap)) + 1;
  };
  wall.style.setProperty('--wg', `${gap}px`);
  fit();
  while (n * per > tiles.length && tw < 460) { tw = Math.round(tw * 1.08); fit(); }
  // Deal the scenes column by column so that look-alikes stay apart while the columns drift past each other. Suites
  // that look the same (the three RoboCasa kitchens, the two RoboPaints) count as one group. A group appears at most
  // once in a column (a column only ever moves as a whole, so this holds at every moment), and as rarely as possible in
  // the columns next to it (which drift the other way and pass every tile of it) and two or three over.
  const groupOf = (t) => LOOKALIKE[t.suite] || t.suite;
  const pools = new Map();
  tiles.forEach((t) => { const g = groupOf(t); if (!pools.has(g)) pools.set(g, []); pools.get(g).push(t); });
  const groups = [...pools.keys()];
  const cols = Array.from({ length: n }, () => []);
  const shown = new Map();
  const uses = (c) => new Set((cols[c] || []).map(groupOf));
  for (let c = 0; c < n; c++) {
    const near = [uses(c - 1), uses(c - 2), uses(c - 3)];
    for (let r = 0; r < per; r++) {
      const here = uses(c);
      let left = groups.filter((g) => pools.get(g).length);
      if (!left.length) { tiles.forEach((t) => pools.get(groupOf(t)).push(t)); left = groups; }   // a screen too large for the pool
      // every group gets its turn: the fewer times a group is on the wall so far, the sooner it comes next
      const cost = (g) => (here.has(g) ? 1000 : 0) + (near[0].has(g) ? 60 : 0) + (near[1].has(g) ? 36 : 0) + (near[2].has(g) ? 14 : 0)
        + (shown.get(g) || 0) * 25 + ((groups.indexOf(g) - c * 5 - r * 3) % groups.length + groups.length) % groups.length / 1000;
      const g = left.reduce((a, b) => (cost(b) < cost(a) ? b : a));
      cols[c].push(pools.get(g).shift());
      shown.set(g, (shown.get(g) || 0) + 1);
    }
  }
  const tile = (t) => {
    const s = ex._suites[t.suite];
    const crop = CROPS[t.suite] ? ` class="${CROPS[t.suite]}"` : '';
    const video = t.video && !phone && !still ? `<video muted loop playsinline preload="none" data-src="${esc(site(t.video))}"${crop}></video>` : '';
    return `<a class="wt" data-suite="${esc(t.suite)}" href="${exam('tasks/')}?task=${encodeURIComponent(`${t.suite}/${t.id}`)}" tabindex="-1">
      <img src="${esc(site(t.poster))}" alt="" loading="lazy" decoding="async"${crop}>${video}
      <span class="tag">${esc(s?.code || '')}</span><span class="ttl">${esc(s?.name || '')} · ${esc(t.title)}</span></a>`;
  };
  const durs = [92, 76, 100, 84, 108, 72, 96, 80];
  wall.innerHTML = cols.map((c, i) => {
    const html = c.map(tile).join('');
    const dur = durs[i % durs.length];
    return `<div class="wall-col${i % 2 ? ' down' : ''}" style="--dur:${dur}s;--delay:-${((i * 37) % 100) / 100 * dur}s">${html}${html}</div>`;
  }).join('');
  if (!phone && !still) {
    // play the tiles in the open right part of the wall (the left part sits under the title's veil)
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      const v = $('video', e.target);
      if (e.isIntersecting && $$('.wt.playing', wall).length < 6) {
        if (!v.src) v.src = v.dataset.src;
        v.play().then(() => e.target.classList.add('playing')).catch(() => {});
      } else if (!e.isIntersecting) {
        v.pause();
        e.target.classList.remove('playing');
      }
    }), { rootMargin: '0px 0px 0px -46%', threshold: 0.7 });
    $$('.wt', wall).forEach((t) => { if ($('video', t)) io.observe(t); });
  }
  // stop the drift while the first screen is out of sight
  new IntersectionObserver(([e]) => wall.classList.toggle('paused', !e.isIntersecting)).observe($('.hero-wall'));
}

// line icons for the display tags (24-unit grid, drawn in the current colour)
const TAG_ICON = {
  'perception-understanding': '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  'planning-reasoning': '<circle cx="5" cy="12" r="2"/><circle cx="19" cy="5.5" r="2"/><circle cx="19" cy="18.5" r="2"/><path d="M7 12h3.5l6.6-6.5M10.5 12l6.6 6.5"/>',
  'control-coordination': '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>',
  'feedback-adaptation': '<path d="M19.5 9.5A8 8 0 0 0 5 8M4.5 14.5A8 8 0 0 0 19 16"/><path d="M5 3.5V8h4.5M19 20.5V16h-4.5"/>',
  manipulation: '<path d="M12 2.5v5M7.5 7.5h9M7.5 7.5v5.5L5.5 17M16.5 7.5v5.5l2 4"/><rect x="10" y="15.5" width="4" height="4" rx="1"/>',
  'locomotion-stability': '<circle cx="12" cy="4.5" r="2"/><path d="M12 6.5v6M12 12.5l-3.5 4v4M12 12.5l3.5 4v4M8 9.5h8"/>',
  'navigation-exploration': '<circle cx="12" cy="12" r="9"/><path d="M15.8 8.2l-2.4 5.2-5.2 2.4 2.4-5.2z"/>',
  'mobile-whole-body-manipulation': '<rect x="3.5" y="13" width="12" height="5" rx="1.5"/><circle cx="6.5" cy="20" r="1.5"/><circle cx="12.5" cy="20" r="1.5"/><path d="M9.5 13V7.5l6-3 3.5 2.5"/>',
  'interaction-collaboration': '<circle cx="7.5" cy="7" r="2.5"/><circle cx="16.5" cy="7" r="2.5"/><path d="M3 20c0-3.3 2-5.5 4.5-5.5S12 16.7 12 20M12 20c0-3.3 2-5.5 4.5-5.5S21 16.7 21 20"/>',
};
const tagIcon = (id) => `<svg class="ti" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TAG_ICON[id] || '<circle cx="12" cy="12" r="8"/>'}</svg>`;

/** What the exam tests: task domains (rows) by capabilities (columns), a dot on each crossing sized by the questions
 *  that carry both labels, on a light lattice so that a missing pair reads as a gap, not as a hole in the layout.
 *  Pointing at a dot or a label explains it in `panel` (beside the map) with a few of its questions; a click opens them
 *  in the task list. */
function taxonomyMap(el, panel, ex) {
  const m = ex.taxmap;
  if (!el || !m?.rows?.length) return;
  const caps = m.rows, doms = m.cols;
  const cellOf = (cap, dom) => m.cells[`${cap}|${dom}`];
  const max = Math.max(1, ...Object.values(m.cells).map((c) => c.n));
  const size = (n) => (n ? Math.max(10, Math.round(Math.sqrt(n / max) * 64)) : 0);
  const tasksFor = (...ids) => `${exam('tasks/')}?tags=${ids.map(encodeURIComponent).join(',')}`;
  const tag = (id) => [...caps, ...doms].find((t) => t.id === id);
  const cells = [`<div class="tm-corner"><span>Domain ↓</span><span>Capability →</span></div>`,
    ...caps.map((c) => `<a class="tm-head tm-col" href="${tasksFor(c.id)}" data-cap="${c.id}" title="${esc(c.name)}">${tagIcon(c.id)}<b class="full">${esc(c.name)}</b>`
      + `<b class="short">${esc(c.name.split(/[ &/]+/)[0])}</b><small>${int(c.n)}</small></a>`)];
  doms.forEach((d, r) => {
    cells.push(`<a class="tm-head tm-row" href="${tasksFor(d.id)}" data-dom="${d.id}">${tagIcon(d.id)}<span><b>${esc(d.name)}</b><small>${int(d.n)} questions</small></span></a>`);
    caps.forEach((c, k) => {
      const x = cellOf(c.id, d.id);
      const pos = [k === 0 && 'first', k === caps.length - 1 && 'last', r === 0 && 'top', r === doms.length - 1 && 'bottom'].filter(Boolean).join(' ');
      cells.push(x
        ? `<a class="tm-cell ${pos}" href="${tasksFor(c.id, d.id)}" data-cap="${c.id}" data-dom="${d.id}" aria-label="${esc(d.name)} needing ${esc(c.name)}: ${x.n} questions"><i style="--d:${size(x.n)}px"></i><em class="${size(x.n) >= 30 ? 'in' : 'out'}">${int(x.n)}</em></a>`
        : `<a class="tm-cell gap ${pos}" href="${exam('contribute/')}#propose" data-cap="${c.id}" data-dom="${d.id}" aria-label="${esc(d.name)} needing ${esc(c.name)}: no questions yet"><i></i></a>`);
    });
  });
  el.innerHTML = `<div class="tm-grid" style="--cols:${caps.length}">${cells.join('')}</div>`;

  // the reading when nothing is pointed at: how many capabilities a question needs at once, which the map's pairs
  // cannot show, and the most common mix
  const perQ = Object.entries(m.per_question || {}).map(([k, n]) => [Number(k), n]);
  const multi = perQ.filter(([k]) => k >= 2).reduce((a, [, n]) => a + n, 0);
  const mix = m.top_mix || { ids: [], n: 0 };
  const bar = perQ.map(([k, n]) => `<span class="seg k${k}" style="flex:${n}" title="${int(n)} questions need ${k} capabilit${k === 1 ? 'y' : 'ies'}"><b>${k}</b><small>${int(n)}</small></span>`).join('');
  const legend = [10, 100, 300].filter((n) => n <= max).map((n) => `<span><i style="--d:${size(n)}px"></i>${int(n)}</span>`).join('');
  const idle = `<p class="label">${int(m.total)} labelled questions</p>
    <h3><em>${Math.round((100 * multi) / m.total)}%</em> of them need two or more capabilities at once.</h3>
    <div class="tm-perq" aria-label="Capabilities needed per question">${bar}</div>
    <p class="tm-perq-cap">capabilities per question</p>
    ${mix.n ? `<div class="tm-mix"><span class="tm-mix-ic">${mix.ids.map((id) => tagIcon(id)).join('<i>+</i>')}</span>
      <p>The most common mix: <b>${mix.ids.map((id) => esc(tag(id).name.split(' & ')[0])).join(', ').replace(/, ([^,]*)$/, ' and $1')}</b>, in ${int(mix.n)} questions.</p></div>` : ''}
    <div class="tm-legend" aria-hidden="true">${legend}<span class="cap">questions per dot</span></div>
    <p class="tm-hint">Point at a dot to see its questions; click it to open them.</p>`;
  const shots = (list) => (list?.length ? `<div class="tm-ex">${list.slice(0, 3).map((e) => `<a href="${exam('tasks/')}?task=${encodeURIComponent(`${e.s}/${e.id}`)}" title="${esc(e.t)}"><img src="${esc(site(e.p))}" alt="" loading="lazy"${CROPS[e.s] ? ` class="${CROPS[e.s]}"` : ''}><span>${esc(ex._suites[e.s]?.code || '')}</span></a>`).join('')}</div>` : '');
  panel.innerHTML = idle;
  const show = (target) => {
    $$('.on, .hrow, .hcol', el).forEach((x) => x.classList.remove('on', 'hrow', 'hcol'));
    el.classList.toggle('focus', !!target);
    if (!target) { panel.innerHTML = idle; return; }
    const { cap, dom } = target.dataset;
    if (cap) $$(`[data-cap="${cap}"]`, el).forEach((e) => e.classList.add(e.classList.contains('tm-cell') ? 'hcol' : 'on'));
    if (dom) $$(`[data-dom="${dom}"]`, el).forEach((e) => e.classList.add(e.classList.contains('tm-cell') ? 'hrow' : 'on'));
    if (cap && dom) {
      target.classList.add('on');
      const c = tag(cap), d = tag(dom), x = cellOf(cap, dom);
      panel.innerHTML = x
        ? `<p class="label">Domain × capability</p><h3>${esc(d.name)} <span>×</span> ${esc(c.name)}</h3>
          <p class="tm-n"><b>${int(x.n)}</b> question${x.n === 1 ? '' : 's'} from ${int(x.suites)} suite${x.suites === 1 ? '' : 's'}</p>${shots(x.ex)}
          <a class="btn small" href="${tasksFor(cap, dom)}">Open these questions <span class="arr">→</span></a>`
        : `<p class="label">Domain × capability</p><h3>${esc(d.name)} <span>×</span> ${esc(c.name)}</h3>
          <p>No question needs this pair yet. A suite that does would fill one of the exam’s gaps.</p>
          <a class="btn small" href="${exam('contribute/')}#propose">Propose a suite <span class="arr">→</span></a>`;
    } else {
      const id = cap || dom, t = tag(id);
      $$(`.tm-cell[data-${cap ? 'cap' : 'dom'}="${id}"]`, el).forEach((e) => e.classList.add('on'));
      panel.innerHTML = `<p class="label">${cap ? 'Capability' : 'Domain'}</p><h3>${tagIcon(id)} ${esc(t.name)}</h3>
        <p class="tm-n"><b>${int(t.n)}</b> of ${int(m.total)} questions</p><p>${esc(t.description || '')}</p>
        <a class="btn small" href="${tasksFor(id)}">Open these questions <span class="arr">→</span></a>`;
    }
  };
  const grid$ = $('.tm-grid', el);
  grid$.addEventListener('mouseover', (e) => { const t = e.target.closest('[data-cap],[data-dom]'); if (t) show(t); });
  grid$.addEventListener('focusin', (e) => { const t = e.target.closest('[data-cap],[data-dom]'); if (t) show(t); });
  grid$.addEventListener('mouseleave', () => show(null));
}

// line icons for the marking diagram and the guarantees (24-unit grid; the stroke keeps its width when scaled)
const FF_ICONS = {
  terminal: '<rect x="2.5" y="4" width="19" height="16" rx="3"/><path d="M6.5 9.5l3 2.5-3 2.5M12 15h5"/>',
  cube: '<path d="M12 2.8l8.5 4.6v9.2L12 21.2 3.5 16.6V7.4z"/><path d="M3.5 7.4L12 12l8.5-4.6M12 12v9.2"/>',
  doc: '<path d="M6 2.5h8l4 4v15H6z"/><path d="M14 2.5v4h4M9 11h6M9 14.5h6M9 18h4"/>',
  arm: '<path d="M5 21h9M9.5 21v-4"/><circle cx="9.5" cy="15" r="2"/><path d="M10.8 13.4l4.6-5.2"/><circle cx="16.3" cy="7.3" r="1.7"/><path d="M17.6 6.1l2.9-1.5M17.7 8.5l2.6 1.7"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  traj: '<path d="M3.5 18.5c3-8 6 1.5 9-5s5-6.5 8-8.5"/><circle cx="3.5" cy="18.5" r="1.6"/><circle cx="20.5" cy="5" r="1.6"/>',
  rec: '<rect x="2.5" y="5" width="19" height="14" rx="3"/><circle cx="8" cy="12" r="2.3" class="fill"/><path d="M13 10h5M13 14h3"/>',
  replay: '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 3.5v4.4h-4.4"/><path d="M12 8.6l3 1.7v3.4L12 15.4l-3-1.7v-3.4z"/>',
  shield: '<path d="M12 2.5l7.5 3v6c0 4.6-3.2 8.3-7.5 10-4.3-1.7-7.5-5.4-7.5-10v-6z"/><path d="M8.6 12l2.4 2.4 4.4-4.8"/>',
  log: '<rect x="4" y="2.5" width="16" height="19" rx="2.5"/><path d="M8 7h8M8 10.5h8"/><path d="M8 17.5v-2M11 17.5v-4M14 17.5v-3M17 17.5v-5"/>',
  snow: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="M9.6 5L12 7.4 14.4 5M9.6 19L12 16.6 14.4 19"/>',
  sandbox: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 7.2l4 1.6v3.2c0 2.4-1.7 4.3-4 5.2-2.3-.9-4-2.8-4-5.2V8.8z"/>',
  nokey: '<circle cx="8" cy="12" r="3.6"/><path d="M11.6 12H21M18 12v3M21 12v2.5"/><path d="M3.5 3.5l17 17"/>',
  controls: '<rect x="2.5" y="6" width="8.5" height="12" rx="2.5"/><rect x="13" y="6" width="8.5" height="12" rx="2.5"/><ellipse cx="6.75" cy="12" rx="1.9" ry="3"/><path d="M16.2 9.6l1.6-1.1V15.5"/>',
  cheat: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21M10.5 7.4v3.6M10.5 13.6v.2"/>',
  review: '<circle cx="9" cy="7.5" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6 1.6 0 3 .4 4.1 1.2M15 18l2 2 4.5-4.5"/>',
  layers: '<path d="M12 3l9 4.5-9 4.5-9-4.5z"/><path d="M3 12l9 4.5 9-4.5M3 16.5L12 21l9-4.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  venn: '<circle cx="9" cy="9.5" r="5.5"/><circle cx="15" cy="9.5" r="5.5"/><circle cx="12" cy="14.5" r="5.5"/>',
  pair: '<circle cx="6.5" cy="12" r="3.5"/><circle cx="17.5" cy="12" r="3.5"/><path d="M10 12h4"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1.2" class="fill"/>',
  podium: '<path d="M3 20.5h18M5 20.5v-6h4v6M10 20.5V9h4v11.5M15 20.5v-8h4v8"/><path d="M12 3.5l.9 1.8 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z"/>',
};
const ffIcon = (name, x, y, size = 40, cls = '') => `<g class="ff-ic ${cls}" transform="translate(${x} ${y}) scale(${(size / 24).toFixed(4)})">${FF_ICONS[name]}</g>`;
const ffText = (x, y, text, cls, anchor = 'start') => `<text x="${x}" y="${y}" class="${cls}" text-anchor="${anchor}">${esc(text)}</text>`;
const ffArrowDefs = (id) => `<defs><marker id="${id}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
  <path d="M0.5 1L9 5 0.5 9z" class="ff-head"/></marker></defs>`;
const ffSnowBadge = (cx, cy) => `<circle cx="${cx}" cy="${cy}" r="10" class="ff-badge"/>${ffIcon('snow', cx - 7, cy - 7, 14, 'std')}`;
const ffResults = (x, y) => `<rect class="ff-res ok" x="${x}" y="${y}" width="72" height="34" rx="17"/>${ffText(x + 36, y + 22, '✓  1', 'ff-res-t ok', 'middle')}
  <rect class="ff-res no" x="${x + 82}" y="${y}" width="72" height="34" rx="17"/>${ffText(x + 118, y + 22, '✗  0', 'ff-res-t', 'middle')}`;

/** How a question is marked, drawn: the question forks into the two ways to sit it, both answers are replayed and
 *  marked, every attempt is recorded. One drawing for wide screens, one stacked for phones. */
function flowDiagram(el) {
  if (!el) return;
  const A = 'url(#ff-a-d)', B = 'url(#ff-a-m)';
  const wide = `<svg class="ff ff-d" viewBox="0 0 1280 520" role="img" aria-label="How a question is marked: the question, sat privileged or standard, replayed and marked, then recorded">${ffArrowDefs('ff-a-d')}
    <path class="ff-link" d="M197 260C232 260 228 120 262 120" marker-end="${A}"/><path class="ff-link" d="M197 260C232 260 228 400 262 400" marker-end="${A}"/>
    <path class="ff-link" d="M682 120C726 120 726 260 768 260" marker-end="${A}"/><path class="ff-link" d="M682 400C726 400 726 260 768 260" marker-end="${A}"/>
    <path class="ff-link" d="M1020 260H1078" marker-end="${A}"/>

    <rect class="ff-node" x="1" y="170" width="196" height="180" rx="20"/>
    ${ffIcon('cube', 26, 196, 38)}${ffSnowBadge(62, 200)}${ffIcon('doc', 82, 196, 38)}
    ${ffText(26, 276, 'Question', 'ff-title')}${ffText(26, 302, 'A frozen scene', 'ff-sub')}${ffText(26, 322, 'and a goal', 'ff-sub')}

    <rect class="ff-lane p" x="262" y="40" width="420" height="160" rx="20"/>
    ${ffText(284, 70, 'PRIVILEGED', 'ff-tag p')}${ffText(371, 70, 'privileged', 'ff-tag-sub')}${ffText(574, 80, 'one container', 'ff-mini', 'end')}
    <rect class="ff-box" x="284" y="86" width="290" height="96" rx="14"/>
    ${ffIcon('terminal', 306, 102, 40)}${ffText(326, 166, 'agent', 'ff-label', 'middle')}
    ${ffIcon('cube', 512, 102, 40)}${ffText(532, 166, 'simulator', 'ff-label', 'middle')}
    <path class="ff-thin" d="M356 122H502" marker-start="${A}" marker-end="${A}"/>${ffText(429, 114, 'full state · resets', 'ff-mini', 'middle')}
    <path class="ff-thin" d="M576 122H598" marker-end="${A}"/>${ffIcon('traj', 604, 102, 40, 'p')}${ffText(624, 166, 'trajectory', 'ff-label', 'middle')}

    <rect class="ff-pill" x="322" y="246" width="300" height="28" rx="14"/>${ffText(472, 265, '1 hour · 100M/10M tokens · no web search', 'ff-mini strong', 'middle')}

    <rect class="ff-lane s" x="262" y="320" width="420" height="160" rx="20"/>
    ${ffText(284, 350, 'STANDARD', 'ff-tag s')}${ffText(383, 350, 'standard', 'ff-tag-sub')}${ffText(576, 360, 'separate service', 'ff-mini', 'end')}
    <rect class="ff-box" x="284" y="366" width="104" height="96" rx="14"/>${ffIcon('terminal', 316, 382, 40)}${ffText(336, 446, 'agent', 'ff-label', 'middle')}
    <rect class="ff-box" x="472" y="366" width="104" height="96" rx="14"/>${ffIcon('arm', 504, 382, 40)}${ffText(524, 446, 'robot', 'ff-label', 'middle')}
    <path class="ff-wall" d="M430 370V458"/>
    <path class="ff-thin" d="M392 392H466" marker-end="${A}"/>${ffText(430, 385, 'actions', 'ff-mini halo-s', 'middle')}
    <path class="ff-thin" d="M466 438H392" marker-end="${A}"/>${ffText(430, 455, 'images', 'ff-mini halo-s', 'middle')}
    <circle cx="430" cy="415" r="12" class="ff-badge"/>${ffIcon('lock', 422, 407, 16)}
    <path class="ff-thin" d="M578 414H598" marker-end="${A}"/>${ffIcon('rec', 604, 382, 40, 's')}${ffText(624, 446, 'episode', 'ff-label', 'middle')}

    <rect class="ff-node strong" x="768" y="130" width="252" height="260" rx="20"/>
    ${ffText(792, 168, 'Marking', 'ff-title')}
    ${ffIcon('replay', 792, 186, 36)}${ffText(840, 202, 'fresh simulator', 'ff-label')}${ffText(840, 220, 'replayed twice', 'ff-sub')}
    <path class="ff-thin" d="M810 228V244" marker-end="${A}"/>
    ${ffIcon('shield', 792, 248, 36)}${ffText(840, 264, 'verifier', 'ff-label')}${ffText(840, 282, 'in its own sandbox', 'ff-sub')}
    <path class="ff-thin" d="M810 290V306" marker-end="${A}"/>
    ${ffResults(792, 312)}${ffText(792, 368, 'by the suite’s rule', 'ff-sub')}

    <rect class="ff-node" x="1080" y="170" width="198" height="180" rx="20"/>
    ${ffIcon('log', 1104, 196, 38)}${ffText(1104, 276, 'Record', 'ff-title')}${ffText(1104, 302, 'Every attempt', 'ff-sub')}${ffText(1104, 322, 'logged in full', 'ff-sub')}
  </svg>`;
  const tall = `<svg class="ff ff-m" viewBox="0 0 360 1000" role="img" aria-label="How a question is marked">${ffArrowDefs('ff-a-m')}
    <path class="ff-link" d="M180 111V124"/><path class="ff-link" d="M180 150C180 172 92 166 92 188" marker-end="${B}"/><path class="ff-link" d="M180 150C180 172 268 166 268 188" marker-end="${B}"/>
    <path class="ff-link" d="M92 522C92 556 180 548 180 586" marker-end="${B}"/><path class="ff-link" d="M268 522C268 556 180 548 180 586" marker-end="${B}"/>
    <path class="ff-link" d="M180 832V876" marker-end="${B}"/>

    <rect class="ff-node" x="20" y="1" width="320" height="110" rx="18"/>
    ${ffIcon('cube', 40, 30, 34)}${ffSnowBadge(72, 32)}${ffIcon('doc', 86, 30, 34)}
    ${ffText(140, 52, 'Question', 'ff-title')}${ffText(140, 76, 'A frozen scene and a goal', 'ff-sub')}
    <rect class="ff-pill" x="44" y="124" width="272" height="26" rx="13"/>${ffText(180, 141, '1 hour · 100M/10M tokens · no search', 'ff-mini strong', 'middle')}

    <rect class="ff-lane p" x="10" y="190" width="164" height="332" rx="18"/>${ffText(24, 214, 'PRIVILEGED', 'ff-tag p')}
    <rect class="ff-box" x="24" y="226" width="136" height="186" rx="14"/>
    ${ffIcon('terminal', 72, 238, 40)}${ffText(92, 292, 'agent', 'ff-label', 'middle')}
    <path class="ff-thin" d="M92 300V326" marker-start="${B}" marker-end="${B}"/>
    ${ffIcon('cube', 72, 334, 40)}${ffText(92, 390, 'simulator', 'ff-label', 'middle')}${ffText(92, 404, 'one container', 'ff-mini', 'middle')}
    <path class="ff-thin" d="M92 414V432" marker-end="${B}"/>${ffIcon('traj', 72, 438, 40, 'p')}${ffText(92, 500, 'trajectory', 'ff-label', 'middle')}

    <rect class="ff-lane s" x="186" y="190" width="164" height="332" rx="18"/>${ffText(200, 214, 'STANDARD', 'ff-tag s')}
    <rect class="ff-box" x="200" y="226" width="136" height="70" rx="14"/>${ffIcon('terminal', 250, 236, 34)}${ffText(268, 288, 'agent', 'ff-label', 'middle')}
    <path class="ff-wall" d="M206 318H330"/>
    <path class="ff-thin" d="M240 300V336" marker-end="${B}"/><path class="ff-thin" d="M296 336V300" marker-end="${B}"/>
    <circle cx="268" cy="318" r="11" class="ff-badge"/>${ffIcon('lock', 261, 311, 14)}
    <rect class="ff-box" x="200" y="340" width="136" height="72" rx="14"/>${ffIcon('arm', 251, 346, 34)}${ffText(268, 402, 'robot', 'ff-label', 'middle')}
    <path class="ff-thin" d="M268 414V432" marker-end="${B}"/>${ffIcon('rec', 248, 438, 40, 's')}${ffText(268, 500, 'episode', 'ff-label', 'middle')}

    <rect class="ff-node strong" x="20" y="588" width="320" height="244" rx="18"/>
    ${ffText(44, 622, 'Marking', 'ff-title')}
    ${ffIcon('replay', 44, 640, 34)}${ffText(90, 654, 'fresh simulator', 'ff-label')}${ffText(90, 672, 'replayed twice', 'ff-sub')}
    ${ffIcon('shield', 44, 698, 34)}${ffText(90, 712, 'verifier', 'ff-label')}${ffText(90, 730, 'in its own sandbox', 'ff-sub')}
    ${ffResults(44, 758)}${ffText(210, 780, 'by the suite’s rule', 'ff-sub')}

    <rect class="ff-node" x="20" y="878" width="320" height="110" rx="18"/>
    ${ffIcon('log', 44, 906, 34)}${ffText(96, 930, 'Record', 'ff-title')}${ffText(96, 954, 'Every attempt logged in full', 'ff-sub')}
  </svg>`;
  el.innerHTML = wide + tall;
}

/** What keeps the marks honest: one icon and a few words each, the sentence on hover or focus. */
function trustRow(el) {
  if (!el) return;
  const items = [
    ['sandbox', 'A separate marker', 'The verifier runs in its own sandbox, without network, and sees only the declared answer.'],
    ['nokey', 'No answer key', 'Reference solutions never enter the agent’s container; upstream experts are removed from the images.'],
    ['controls', 'Controls', 'Doing nothing must score 0, and a full reference solution must score 1.'],
    ['cheat', 'A cheat trial', 'An agent is told to pass without doing the task. Any success blocks the suite until the verifier is fixed.'],
    ['review', 'Human review', 'A question without a full reference solution is checked by a reviewer who did not write it.'],
    ['snow', 'Frozen questions', 'A published question never changes. Fixing a scene makes a new question.'],
  ];
  el.innerHTML = items.map(([icon, name, tip]) => `<li tabindex="0"><span class="tr-ic"><svg viewBox="0 0 24 24" aria-hidden="true">${FF_ICONS[icon]}</svg></span>
    <b>${esc(name)}</b><span class="tip" role="tooltip">${esc(tip)}</span></li>`).join('');
}

/** Numbers with their icons: [[icon, value, label], ...]. */
function iconNumbers(el, items) {
  if (!el) return;
  el.innerHTML = items.map(([icon, v, l]) => `<div><svg viewBox="0 0 24 24" aria-hidden="true">${FF_ICONS[icon]}</svg><dt>${int(v)}</dt><dd>${esc(l)}</dd></div>`).join('');
}

/** The exam in four numbers. */
function bigNumbers(el, ex) {
  const t = ex.totals || {};
  iconNumbers(el, [['doc', t.instances, 'questions'], ['layers', t.suites, 'benchmark suites'], ['arm', t.robots, 'robots'], ['cube', t.simulators, 'simulators']]);
}

/** Icons named in the markup: <span class="ic" data-icon="cube"></span>. */
function fillIcons(root = document) {
  $$('.ic[data-icon]', root).forEach((el) => { el.innerHTML = `<svg viewBox="0 0 24 24">${FF_ICONS[el.dataset.icon] || ''}</svg>`; });
}

/** The one line under the title: the command that sits the whole exam, typed out once, with a copy button. */
function heroRun(el, ex) {
  if (!el) return;
  const cmd = 'harbor run -d embodied-first-exam -a codex -m openai/gpt-6-astra';
  const paint = (s) => esc(s).replace(/(^|\s)(-\w)(?=\s|$)/g, '$1<span class="f">$2</span>');
  el.innerHTML = `<div class="hr-bar"><span class="pr" aria-hidden="true">$</span><code class="hr-cmd"></code><span class="caret" aria-hidden="true"></span>
      <button type="button" class="hr-copy" aria-label="Copy the command" title="Copy">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15"/></svg></button></div>
    <p class="hr-note">One line runs all ${int(ex.totals?.task_dirs)} questions. <a href="#run">Change one argument <span class="arr">↓</span></a></p>`;
  const code = $('.hr-cmd', el);
  code.setAttribute('aria-label', cmd);
  const done = () => { code.innerHTML = paint(cmd); };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) done();
  else {
    let i = 0;
    const tick = () => { code.textContent = cmd.slice(0, ++i); if (i < cmd.length) setTimeout(tick, 18 + Math.random() * 26); else done(); };
    setTimeout(tick, 700);
  }
  const btn = $('.hr-copy', el);
  btn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(cmd); } catch { return; }
    btn.classList.add('ok'); btn.setAttribute('aria-label', 'Copied');
    setTimeout(() => { btn.classList.remove('ok'); btn.setAttribute('aria-label', 'Copy the command'); }, 1600);
  });
}

/** Run it in one line: the command that sits the whole exam, typed out once, and switches that each add or drop one
 *  argument. Counts come from the exam's own numbers. harbor's -i takes any of several globs, so a suite and a mode are
 *  written as one pattern per suite. */
function oneLine(el, ex) {
  if (!el) return;
  const suites = (ex.suites || []).filter((s) => !s.example);
  const SCOPES = {
    humanoid: { prefixes: ['humanoidbench', 'robocasa-gr1'], ids: ['humanoidbench', 'robocasa-gr1'] },
    rc365: { prefixes: ['robocasa365'], ids: ['robocasa365'] },
  };
  const AGENTS = { codex: '-a codex -m openai/gpt-6-astra', claude: '-a claude-code -m anthropic/claude-opus-5-5' };
  const st = { mode: '', scope: '', agent: 'codex', k: '' };
  const parts = () => {
    const sc = SCOPES[st.scope];
    const tail = st.mode ? `-${st.mode}` : '';
    const pats = sc ? sc.prefixes.map((p) => `${p}-*${tail}`) : st.mode ? [`*${tail}`] : [];
    return [['base', 'harbor run -d embodied-first-exam'], ['pick', pats.map((p) => `-i '${p}'`).join(' ')],
      ['agent', AGENTS[st.agent]], ['k', st.k ? '-k 3' : '']].filter(([, t]) => t);
  };
  const tally = () => {
    const ids = SCOPES[st.scope]?.ids;
    const pool = suites.filter((s) => !ids || ids.includes(s.id));
    const modes = st.mode ? [st.mode] : ['privileged', 'standard'];
    const n = pool.reduce((a, s) => a + modes.reduce((b, m) => b + (s.modes?.[m] || 0), 0), 0);
    return { n, k: pool.filter((s) => modes.some((m) => s.modes?.[m])).length, modes };
  };
  const chip = (g, v, label, note = '') => `<button type="button" class="chip ol-chip" data-g="${g}" data-v="${v}" aria-pressed="false">${label}${note ? `<i>${note}</i>` : ''}</button>`;
  el.innerHTML = `<div class="ol-wrap">
    <div class="term"><div class="term-bar" aria-hidden="true"><i></i><i></i><i></i></div>
      <pre class="term-body"><span class="pr" aria-hidden="true">$ </span><span class="cmd"></span><span class="caret" aria-hidden="true"></span><span class="out"></span></pre></div>
    <div class="ol-groups">
      <div><span class="ol-k">Mode</span><div class="chips">${chip('mode', 'standard', 'Standard')}${chip('mode', 'privileged', 'Privileged')}</div></div>
      <div><span class="ol-k">Questions</span><div class="chips">${chip('scope', 'humanoid', 'Humanoids')}${chip('scope', 'rc365', 'RoboCasa365')}</div></div>
      <div><span class="ol-k">Agent</span><div class="chips">${chip('agent', 'claude', 'Claude Code')}${chip('k', '1', 'Three attempts')}</div></div>
      <div><span class="ol-k">Coming</span><div class="chips"><button type="button" class="chip ol-chip soon" disabled>Real-time play<i>Olympiad</i></button></div></div>
    </div></div>`;
  const cmdEl = $('.cmd', el), outEl = $('.out', el);
  const out = () => {
    const t = tally();
    outEl.innerHTML = `\n<span class="ok">▸</span> <b>${int(t.n)}</b> questions · ${t.k} suite${t.k === 1 ? '' : 's'} · ${t.modes.join(' + ')}\n`
      + `<span class="ok">▸</span> each answer marked by a fresh simulator${st.k ? ', <b>3 attempts</b> each' : ''}`;
  };
  let prev = {};
  const show = (changed) => {
    cmdEl.innerHTML = parts().map(([key, t]) => `<span class="${key === 'base' ? 'b' : 'arg'}${key === changed || (changed && prev[key] !== t && key !== 'base') ? ' new' : ''}">${esc(t)}</span>`).join(' ');
    prev = Object.fromEntries(parts());
    out();
    $$('.ol-chip[data-g]', el).forEach((b) => b.setAttribute('aria-pressed', String(st[b.dataset.g] === b.dataset.v || (b.dataset.g === 'k' && !!st.k))));
  };
  $$('.ol-chip[data-g]', el).forEach((b) => b.addEventListener('click', () => {
    const g = b.dataset.g;
    if (g === 'agent') st.agent = st.agent === 'claude' ? 'codex' : 'claude';
    else if (g === 'k') st.k = st.k ? '' : '1';
    else st[g] = st[g] === b.dataset.v ? '' : b.dataset.v;
    show(g === 'scope' || g === 'mode' ? 'pick' : g);
  }));
  // type the command once when it comes into view; at once for reduced motion
  const full = parts().map(([, t]) => t).join(' ');
  const typeIt = () => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { show(); return; }
    let i = 0;
    const tick = () => {
      cmdEl.textContent = full.slice(0, ++i);
      if (i < full.length) setTimeout(tick, 22 + Math.random() * 30); else setTimeout(() => show(), 250);
    };
    tick();
  };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); typeIt(); } }, { threshold: 0.4 });
    io.observe(el);
  } else show();
}

/** The leaderboard on the home page: one row per ranked model on the shared questions (precomputed in exam.json). */
function dumbbell(el, ex) {
  const sh = ex.leaderboard?.shared;
  const runs = runMap(ex);
  if (!el || !sh?.runs?.length) { if (el) el.innerHTML = '<div class="empty-state">No ranked runs yet.</div>'; return; }
  const key = (id, m) => pctOf(sh.scores[id][m]) ?? -1;
  const order = [...sh.runs].sort((a, b) => key(b, 'privileged') - key(a, 'privileged') || key(b, 'standard') - key(a, 'standard'));
  el.innerHTML = DB_HEAD + order.map((id, i) => {
    const r = runs[id] || { model: id };
    return `<a class="db-row" href="${exam('leaderboard/')}?open=${encodeURIComponent(id)}"><span class="rank">${i + 1}</span>
      <span class="who"><b>${esc(r.model)}</b><small>${esc([r.harness, r.effort].filter(Boolean).join(' · '))}</small></span>
      ${dbTrack(sh.scores[id].privileged, sh.scores[id].standard)}${dbGap(sh.scores[id].privileged, sh.scores[id].standard)}</a>`;
  }).join('');
}

/** The suites on the home page: a picture and a name each, and the ones on their way in. */
function gallery(el, ex) {
  if (!el) return;
  const items = ranked(ex).map((s) => {
    const cover = s.teaser || s.preview?.find((p) => p.cover) || s.preview?.find((p) => !p.still) || s.preview?.[0];
    const img = cover ? `<img src="${esc(site(cover.poster))}" alt="" loading="lazy" decoding="async"${CROPS[s.id] ? ` class="${CROPS[s.id]}"` : ''}>` : `<div class="placeholder-art"><span>${esc(s.code)}</span><small>no pictures yet</small></div>`;
    return `<a class="g-item" href="${exam('suite/')}?id=${esc(s.id)}"><div class="img">${img}</div><b>${esc(s.name)}</b>
      <span>${int(s.instances)} scenes · ${esc(ex.bodies?.[s.body] || '')}</span></a>`;
  });
  const coming = (ex.incoming || []).length;
  if (coming) items.push(`<a class="g-item more" href="${exam('suites/')}#on-the-way"><div class="img"><em>+${coming}</em></div><b>On the way in</b>
    <span>${esc((ex.incoming || []).slice(0, 3).map((x) => x.name).join(', '))}${coming > 3 ? ' and more' : ''}</span></a>`);
  el.innerHTML = items.join('');
}

async function home(ex) {
  const t = ex.totals || {};
  $('#hero-lead').textContent = ex.hero?.lead || ex.summary || '';
  heroWall(ex);
  bigNumbers($('#bignums'), ex);
  flowDiagram($('#flowfig'));
  trustRow($('#trust'));
  taxonomyMap($('#taxmap'), $('#tm-panel'), ex);
  dumbbell($('#dumbbell'), ex);
  oneLine($('#oneline'), ex);
  heroRun($('#hero-run'), ex);
  const sh = ex.leaderboard?.shared;
  if (sh) $('#bars-note').innerHTML = `Head to head on the ${int(sh.trials.privileged)} privileged and ${int(sh.trials.standard)} standard questions that every ranked model sat. <a href="${exam('leaderboard/')}">Full leaderboard, per suite and per trial →</a>`;
  gallery($('#gallery'), ex);
}

async function leaderboardPage(ex) {
  const lb = ex.leaderboard || {};
  $('#lb-pre-text').textContent = lb.note || '';
  lbRules($('#lb-rules'), ex);
  const tasks = await loadTasks();
  lbBoard(ex, tasks, (d) => lbSuites($('#lb-suites'), ex, d.main, d.scores));
}

async function suitesPage(ex) {
  const chips = $('#suite-filter');
  const bodies = BODY_ORDER.filter((b) => ex.suites.some((s) => s.body === b));
  chips.innerHTML = `<button class="chip on" data-b="">All</button>${bodies.map((b) => `<button class="chip" data-b="${b}">${esc(ex.bodies?.[b] || b)}</button>`).join('')}
    <button class="chip" data-o="ours">Ours</button>`;
  const state = {};
  chips.addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    $$('.chip', chips).forEach((c) => c.classList.toggle('on', c === b));
    state.body = b.dataset.b || ''; state.origin = b.dataset.o || '';
    suitesGrid($('#suites'), ex, state);
  });
  suitesGrid($('#suites'), ex, state);
  incomingGrid($('#incoming'), ex);
  $('#n-suites').textContent = int(ex.totals?.suites);
  $('#n-incoming').textContent = int((ex.incoming || []).length);
  coverage($('#coverage'), ex);
}

async function suitePage(ex) {
  const s = ex._suites[Q.get('id')] || ranked(ex)[0];
  document.title = `${s.name} · Embodied First Exam`;
  const runs = runMap(ex);
  const cover = s.teaser || s.preview?.find((p) => p.cover) || s.preview?.find((p) => p.video) || s.preview?.[0];
  const crop = CROPS[s.id];
  const linkLabels = { paper: 'Paper', project_page: 'Project page', repository: 'Code', dataset: 'Dataset', documentation: 'Docs', challenge: 'Challenge', leaderboard: 'Upstream leaderboard', project: 'Project page', site: 'Project site' };
  const ext = Object.entries(s.links || {}).filter(([k, v]) => v && linkLabels[k]).map(([k, v]) => `<a class="btn small" href="${esc(v)}">${linkLabels[k]} ↗</a>`).join('');
  const robots = (s.robots || []).map((r) => esc(r.name)).join(', ');
  const facts = [
    ['Origin', s.origin === 'ours' ? 'built by the lab' : `adapted from the upstream benchmark${s.edition ? ` (${esc(s.edition)})` : ''}`],
    ['Simulator', esc(s.simulator || '')], ['Robot', robots],
    ['Scenes', `${int(s.instances)} frozen scenes · ${int(s.task_dirs)} tasks (${(Object.entries(s.modes || {}).filter(([, n]) => n).map(([m, n]) => `${n} ${m}`)).join(', ')})`],
    ['Reference solution', `full ${s.oracle?.full || 0} · partial ${s.oracle?.partial || 0} · none ${s.oracle?.none || 0}`],
    ['Agent time', (s.budgets_min || []).map((b) => `${b} min`).join(', ')],
    ['Standard protocol', esc((s.protocols || []).join(', '))],
    ['Integrated by', esc((s.authors || []).join(', '))],
  ].filter(([, v]) => v);
  $('#suite-head').innerHTML = `
    <div class="suite-hero">
      <div>
        <p class="kicker">${codeMark(s)} &nbsp;${s.example ? 'example task' : 'a suite of the exam'} · ${esc(ex.bodies?.[s.body] || '')}</p>
        <h1 style="margin:10px 0 0;font:800 clamp(40px,5.6vw,76px)/.95 var(--display);letter-spacing:-.035em">${esc(s.name)}</h1>
        <p class="lead" style="margin:16px 0 0;font-size:18px;color:var(--ink-2)">${esc(s.blurb || '')}</p>
        <p class="desc">${prose(s.description || '')}</p>
        ${ext ? `<div class="link-list">${ext}</div>` : ''}
      </div>
      <div><div class="cover frame">${cover ? (cover.video ? `<video src="${esc(site(cover.video))}" poster="${esc(site(cover.poster || ''))}" muted loop autoplay playsinline${crop ? ` class="${crop}"` : ''}></video>` : poster(cover, crop)) : `<div class="placeholder-art">${esc(s.code)}</div>`}</div>
        <table class="facts-table" style="margin-top:16px"><tbody>${facts.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</tbody></table></div>
    </div>`;
  // results on this suite: a dumbbell per model, as on the leaderboard
  const rows = Object.entries(s.results || {}).filter(([, r]) => MODES.some((m) => r[m]?.done) || r.standard_reset?.done)
    .map(([id, r]) => [id, r, [r.privileged?.success || 0, r.privileged?.done || 0], [r.standard?.success || 0, r.standard?.done || 0]])
    .sort((a, b) => (pctOf(b[2]) ?? -1) - (pctOf(a[2]) ?? -1) || (pctOf(b[3]) ?? -1) - (pctOf(a[3]) ?? -1));
  $('#suite-results').innerHTML = rows.length ? DB_HEAD + rows.map(([id, r, pv, sv]) => {
    const run = runs[id] || { id, model: id };
    const reset = r.standard_reset?.done ? ` · <span class="rs">+${r.standard_reset.done} with resets, not counted</span>` : '';
    return `<div class="db-row"><span class="rank">·</span>
      <span class="who"><b>${esc(run.model)}</b><small>${whoLine(run)}</small><small class="meta">${int(pv[1] + sv[1])} questions${reset}</small></span>
      ${dbTrack(pv[1] ? pv : null, sv[1] ? sv : null)}${dbGap(pv[1] ? pv : null, sv[1] ? sv : null)}</div>`;
  }).join('') + '<p class="note">Everything each model sat in this suite. For a like-for-like comparison, see the leaderboard’s head-to-head view.</p>'
    : '<div class="empty-state">No model has sat this suite yet.</div>';
  const tasks = (await loadTasks()).filter((t) => t.suite === s.id);
  $('#suite-tasks-count').textContent = `${int(tasks.length)} scene${tasks.length === 1 ? '' : 's'}`;
  taskBrowser($('#tasks'), ex, tasks, { suite: s.id });
}

async function tasksPage(ex) {
  const tasks = await loadTasks();
  taskBrowser($('#tasks'), ex, tasks);
}

async function contributePage(ex) {
  const c = ex.contribute || {};
  const t = ex.totals || {};
  const authors = new Set(ex.suites.flatMap((s) => s.authors || []));
  iconNumbers($('#c-figures'), [['layers', t.suites, 'suites in the exam'], ['clock', t.incoming, 'on their way in'], ['review', authors.size, 'people have brought suites'], ['doc', t.instances, 'questions']]);
  $$('[data-doc]').forEach((a) => {
    if (c.docs) { a.href = c.docs + a.dataset.doc; return; }
    // no public documents yet: cards keep their place on this page, inline mentions become plain text
    if (a.classList.contains('way')) $('.go', a)?.remove();
    else a.replaceWith(document.createTextNode(a.textContent.replace(/\s*↗$/, '')));
  });
  const info = coverageInfo(ex);
  thinSpots($('#thin'), ex, info);
  // the proposal form
  const form = $('#proposal');
  const fields = ['upstream', 'scope', 'oracle', 'verification', 'difficulty', 'images', 'size'];
  const labels = { upstream: 'Upstream benchmark and version', scope: 'Scope', oracle: 'Oracle', verification: 'Verification and determinism', difficulty: 'Why it is hard', images: 'Images and resources', size: 'Expected pull request size' };
  const md = () => {
    const v = (k) => form.elements[k]?.value.trim() || '';
    const who = [v('name'), v('affiliation'), v('email')].filter(Boolean).join(' · ');
    return `# [proposal] ${v('benchmark') || '<benchmark>'}\n\n${who ? `Proposed by: ${who}\n\n` : ''}${fields.map((k) => `## ${labels[k]}\n\n${v(k) || '_(not filled in)_'}`).join('\n\n')}\n`;
  };
  const msg = $('.msg', form);
  form.addEventListener('submit', (e) => e.preventDefault());
  if (!c.proposal_issue) $('[data-act="issue"]', form).remove();
  $('[data-act="issue"]', form)?.addEventListener('click', () => {
    if (!c.proposal_issue) { msg.textContent = 'The proposal issue link is not set up.'; return; }
    const u = new URL(c.proposal_issue);
    u.searchParams.set('title', `[proposal] ${form.elements.benchmark.value.trim() || '<benchmark>'}`);
    for (const k of fields) if (form.elements[k].value.trim()) u.searchParams.set(k, form.elements[k].value.trim());
    window.open(u.toString(), '_blank', 'noopener');
    msg.textContent = 'Opened a prefilled proposal issue.';
  });
  $('[data-act="copy"]', form).addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(md()); msg.textContent = 'Copied as Markdown.'; } catch (e) { msg.textContent = 'Could not copy; select the text by hand.'; }
  });
  const send = $('[data-act="form"]', form);
  if (c.intake_form) send.addEventListener('click', () => window.open(c.intake_form, '_blank', 'noopener'));
  else send.remove();
  $('#contact').innerHTML = c.contact ? `Questions: <a class="link" href="mailto:${esc(c.contact)}">${esc(c.contact)}</a>` : '';
  // recognition (a draft for the maintainers while it says so)
  const rec = c.recognition;
  // the credit scheme is shown once the maintainers settle it (data: contribute.recognition.draft = false)
  if (!rec || rec.draft) $('#credit')?.remove();
  if (rec && !rec.draft) {
    const max = Math.max(Number(rec.threshold) || 0, ...(rec.credits || []).map((x) => Number(x.credits) || 0)) * 1.1;
    const tpos = ((100 * (Number(rec.threshold) || 0)) / max).toFixed(1);
    $('#recognition').innerHTML = `<div class="credit-top">${rec.draft ? '<span class="draft">draft · for the maintainers</span>' : ''}<p>${prose(rec.lead || '')}</p></div>
      <div class="cbars" style="--t:${tpos}%">${(rec.credits || []).map((x) => `<div class="cbar"><span class="what">${esc(x.what)}</span>
        <span class="bar"><i style="width:${((100 * (Number(x.credits) || 0)) / max).toFixed(1)}%"></i></span><b>${esc(x.credits)}</b></div>`).join('')}
        <div class="cbar cbar-t"><span></span><span class="bar"><em>authorship from ${esc(rec.threshold)} credits</em></span><span></span></div></div>
      <p class="note">${esc(rec.threshold_note || '')}</p>`;
  }
}

/* ------------------------------------------------------------------------------------------------- boot */

chrome();
loadExam().then(async (raw) => {
  const ex = prepare(raw);
  footer(ex);
  const pages = { home, leaderboard: leaderboardPage, suites: suitesPage, suite: suitePage, tasks: tasksPage, contribute: contributePage,
    how: async () => flowDiagram($('#flowfig')), notfound: async () => {} };
  await (pages[PAGE] || home)(ex);
  fillIcons();
  reveal();
}).catch((err) => {
  console.error(err);
  const m = document.querySelector('main');
  if (m) m.insertAdjacentHTML('afterbegin', `<div class="section"><div class="empty-state">The exam’s data could not be loaded (${esc(err.message)}). It is written when the site is built.</div></div>`);
});
