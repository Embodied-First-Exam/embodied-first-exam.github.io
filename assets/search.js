/* The task search, over the Task Atlas index (data/search.json, read by search_core.js):
 *   homeSearch(el, ex)                 the small box on the home page: five matches in a dropdown, Enter for all of them
 *   tasksSearch(grid, ex, tasks, kit)  the Tasks page: one search box ranking the cards, "Read as" chips, the filters
 *                                      with live counts, related words, one card per family
 *   drawerAtlas(t, opts)               a task drawer's Atlas part: summary, task type and capability, steps, related tasks
 *   nameCodedTasks(tasks)              tasks whose site title is only a code ("A31 I13") get the Atlas short name
 * The index (3.7 MB) is fetched on first use, the Atlas records (data/atlas.json) when a drawer first needs them. */
import { makeSearch } from './search_core.js?v=478c35f2';

const ROOT = new URL('../', import.meta.url);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const int = (n) => Number(n || 0).toLocaleString('en-US');
const page = (p) => new URL(p, ROOT).pathname;            // a page of this site
const media = (p) => (!p ? '' : /^https?:/.test(p) ? p : new URL(p, ROOT).href);
const keyOf = (t) => `${t.suite}/${t.id}`;
const ICON = '<svg class="ts-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>';

let styled;
function styles() {
  if (styled) return;
  styled = document.createElement('link');
  styled.rel = 'stylesheet';
  // until the stylesheet is in, the search's parts stay hidden (an unstyled icon drew as a large black circle)
  document.documentElement.classList.add('search-css-wait');
  styled.addEventListener('load', () => document.documentElement.classList.remove('search-css-wait'), { once: true });
  styled.addEventListener('error', () => document.documentElement.classList.remove('search-css-wait'), { once: true });
  styled.href = new URL('./search.css?v=5c633d2c', import.meta.url).href;
  document.head.append(styled);
}

const getJSON = (p) => fetch(new URL(p, ROOT)).then((r) => { if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`); return r.json(); });
let searchP, atlasP, tasksP;
/** The search engine: makeSearch over data/search.json, built once. S.D is the index, S.at(key) a task's index row. */
export const loadSearch = () => (searchP ??= getJSON('data/search.json').then((D) => {
  const S = makeSearch(D), pos = new Map(D.keys.map((k, i) => [k, i]));
  return Object.assign(S, { D, pos, at: (k) => D.tasks[pos.get(k)] });
}));
export const loadAtlas = () => (atlasP ??= getJSON('data/atlas.json'));
const loadTaskList = () => (tasksP ??= getJSON('data/tasks.json'));

const TYPE_LABEL = { task_type: 'Task type', capability: 'Capability', body: 'Robot', bench: 'Suite', kw: 'Keyword', act: 'Step', robot: 'Robot model' };
const TYPE_ORDER = { task_type: 0, capability: 0, body: 1, bench: 2, act: 3, kw: 4, robot: 5 };
const tidy = (s) => String(s || '').replace(/\s*\[[^\]]*\]\s*$/, '');      // a reason without its bracketed restatement
const words = (s) => String(s || '').replace(/-/g, ' ');

// A site title that is only a code ("A31 I13", "C06", "01": RoboSafeBench's) is shown as the Atlas short name, the code
// kept as t.code for a small second line. Titles that are real titles stay as they are.
const CODE = /^[A-Za-z]{0,2}\d+(\s+I\d+)?$/;
const coded = (t) => !t.code && CODE.test(String(t.title || '').trim());
function applyNames(tasks, nameOf) {
  let n = 0;
  for (const t of tasks) if (coded(t)) { const nm = nameOf(keyOf(t)); if (nm) { t.code = t.title; t.title = nm; n++; } }
  if (n) styles();
  return n;
}
/** Rename the coded tasks of a list in place from data/atlas.json (fetched only if one is there); resolves to how many. */
export async function nameCodedTasks(tasks) {
  if (!tasks.some(coded)) return 0;
  const AT = await loadAtlas();
  return applyNames(tasks, (k) => AT.tasks?.[k]?.n);
}

/* ============================================================================================== home page */

/** The home page's search: a small box under the hero buttons. Typing shows up to five tasks; a result opens the task on
 *  the Tasks page, Enter (or "See all") the Tasks page with the query. The index loads on first focus. */
export function homeSearch(el, ex) {
  if (!el) return;
  styles();
  const n = ex?.totals?.instances;
  el.innerHTML = `<label class="hs">${ICON}<input type="search" placeholder="Search ${n ? int(n) + ' ' : 'the '}tasks" aria-label="Search the tasks"
    autocomplete="off" spellcheck="false" role="combobox" aria-expanded="false" aria-controls="hs-list" aria-autocomplete="list"></label>`;
  const input = el.querySelector('input');
  const drop = document.createElement('div');           // on <body>, so the hero's clipping and the next sections never cover it
  drop.className = 'hs-drop'; drop.id = 'hs-list'; drop.setAttribute('role', 'listbox'); drop.hidden = true;
  document.body.append(drop);
  let S, byKey, suites = Object.fromEntries((ex?.suites || []).map((s) => [s.id, s])), active = -1;
  const ready = () => Promise.all([loadSearch(), loadTaskList()]).then(([s, t]) => { S = s; byKey = new Map(t.map((x) => [keyOf(x), x])); });
  const all = () => `${page('tasks/')}?q=${encodeURIComponent(input.value.trim())}`;
  function place() {   // always below the box; it may cover the next section
    const r = el.firstElementChild.getBoundingClientRect();
    drop.style.left = `${Math.max(8, r.left)}px`;
    drop.style.width = `${Math.min(innerWidth - 16, Math.max(r.width, 340))}px`;
    drop.style.top = `${r.bottom + 6}px`;
    drop.style.maxHeight = `${Math.max(160, innerHeight - r.bottom - 18)}px`;
  }
  function makeRoom() {   // on focus: without room for the dropdown below, bring the box to a third of the screen
    const r = el.firstElementChild.getBoundingClientRect();
    if (innerHeight - r.bottom >= 360) return;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    scrollTo({ top: Math.max(0, scrollY + r.top - innerHeight / 3), behavior: still ? 'instant' : 'smooth' });
  }
  function show(on) { drop.hidden = !on; input.setAttribute('aria-expanded', String(on)); if (on) place(); }
  function render() {
    const q = input.value.trim();
    if (!q) { show(false); return; }
    if (!S) { drop.innerHTML = '<div class="hs-note">Loading the search…</div>'; show(true); ready().then(render); return; }
    const res = S.search(q);
    // the five best families, each by its best scene (a family's scenes differ only in their setup)
    const fam = new Map();
    for (const i of res.hits) {
      const t = byKey.get(S.keys[i]); if (!t) continue;
      const k = `${t.suite}|${t.family}`;
      if (fam.has(k)) fam.get(k).n++; else if (fam.size < 5) fam.set(k, { t, n: 1 });
    }
    const rows = [...fam.values()];
    active = -1;
    drop.innerHTML = (rows.length ? rows.map(({ t, n }, i) => {
      const s = suites[t.suite], name = S.at(keyOf(t))?.n || t.title;
      return `<a class="hs-row" role="option" id="hs-o${i}" href="${page('tasks/')}?task=${encodeURIComponent(keyOf(t))}">
        <b>${esc(name)}</b><small>${s ? `<span class="code-mark">${esc(s.code)}</span>` : ''}${esc(s?.name || t.suite)}${name.toLowerCase() !== t.title.toLowerCase() ? ` · ${esc(t.title)}` : ''}${n > 1 ? ` · ${n} scenes` : ''}</small></a>`;
    }).join('') : '<div class="hs-note">No task matches.</div>')
      + `<a class="hs-all" href="${all()}">${res.hits.length ? `See all ${int(res.hits.length)} tasks` : 'Search on the Tasks page'} <span class="arr">→</span></a>`;
    show(true);
  }
  function move(d) {
    const opts = [...drop.querySelectorAll('.hs-row, .hs-all')];
    if (!opts.length) return;
    active = (active + 1 + d + opts.length + 1) % (opts.length + 1) - 1;   // -1 = back in the box
    opts.forEach((o, i) => o.classList.toggle('on', i === active));
    input.setAttribute('aria-activedescendant', active >= 0 && opts[active].id ? opts[active].id : '');
  }
  input.addEventListener('focus', () => { makeRoom(); ready().then(() => input.value.trim() && render()); if (input.value.trim()) render(); }, { passive: true });
  input.addEventListener('input', render);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (drop.hidden) render(); move(e.key === 'ArrowDown' ? 1 : -1); }
    else if (e.key === 'Escape') { show(false); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const on = drop.querySelector('.on');
      if (on) location.href = on.href; else if (input.value.trim()) location.href = all();
    }
  });
  drop.addEventListener('mousedown', (e) => e.preventDefault());       // keep the focus in the box while clicking a row
  document.addEventListener('pointerdown', (e) => { if (!el.contains(e.target) && !drop.contains(e.target)) show(false); });
  input.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== input) show(false); }, 120));
  addEventListener('resize', () => !drop.hidden && place());
  addEventListener('scroll', () => !drop.hidden && place(), { passive: true });
}

/* ============================================================================================== Tasks page */

let pickTag = null;   // set by the Tasks page: a drawer's category chip filters the page in place instead of reloading it

/** The Tasks page. `grid` is #tasks; the box goes into #task-search and the filters into .filters, both above it.
 *  kit (from app.js): card(t) → the card's HTML, close() the drawer, mark(root) → watch marks,
 *  result(t) → 'solved' | 'unsolved' | 'unrun', bodies → the robot bodies in their order. */
export function tasksSearch(grid, ex, tasks, kit) {
  styles();
  const box = document.getElementById('task-search'), f = grid.parentElement.querySelector('.filters');
  const byKey = new Map(tasks.map((t) => [keyOf(t), t]));
  const Q = new URLSearchParams(location.search);
  const SETS = [['core', 'Core set'], ['all', 'All set']];   // no easy-set view of its own (owners, 2026-10-18)
  const state = { q: Q.get('q') || '', limit: 60, one: Q.get('one') !== '0', set: Q.get('set') === 'all' ? 'all' : 'core',
    more: false,
    tags: (Q.get('tags') || '').split(',').filter((x) => ex._tags?.[x]) };
  let S = null, failed = false, res = null, A = new Map();   // A: key -> the task's Atlas index row (tt, cap, n, …)

  // the filters: id, URL parameter, "any" label, options [{id, name}], test(t, v)
  const suites = ex.suites.filter((s) => !s.example).concat(ex.suites.filter((s) => s.example));
  const domain = (ex.taxonomy || []).find((g) => g.id === 'domain');
  const G = [
    { id: 'suite', any: 'All suites', opts: () => suites.map((s) => ({ id: s.id, name: s.name })), test: (t, v) => t.suite === v },
    { id: 'body', any: 'Any robot', opts: () => kit.bodies.map((b) => ({ id: b, name: ex.bodies?.[b] || b })), test: (t, v) => t.body === v },
    { id: 'result', any: 'Any result', opts: () => [{ id: 'solved', name: 'Solved by a model' }, { id: 'unsolved', name: 'Never solved' }],
      test: (t, v) => kit.result(t) === v },
    { id: 'tt', more: true, any: 'Any task type', opts: () => (S ? S.D.concepts.task_type.map((c) => ({ id: c.id, name: c.en })) : []), test: (t, v) => !!A.get(keyOf(t))?.tt.includes(v) },
    { id: 'cap', more: true, any: 'Any capability', opts: () => (S ? S.D.concepts.capability.map((c) => ({ id: c.id, name: c.en })) : []), test: (t, v) => !!A.get(keyOf(t))?.cap.includes(v) },
    ...(domain ? [{ id: 'domain', more: true, any: `Any ${domain.name.toLowerCase().replace('task ', '')}`, opts: () => domain.tags.map((x) => ({ id: x.id, name: x.name })), test: (t, v) => (t.tags || []).includes(v) }] : []),
  ];
  for (const g of G) state[g.id] = Q.get(g.id) || '';
  if (G.some((g) => g.more && state[g.id])) state.more = true;
  const inSet = (t) => state.set === 'all' || (t.set || 'core') === state.set;
  // tasks: one scene with all its modes (owners, 2026-10-19), in the core set when any mode is
  const setCount = (k) => (k === 'all' ? tasks.length : tasks.filter((t) => (t.set || 'core') === k).length);
  // and its tests (a task's modes; in the core set, its core modes)
  const setTests = (k) => tasks.reduce((n, t) => n + (k === 'all' ? (t.modes?.length || 0) : t.core && t.core !== '-' ? t.core.length : 0), 0);
  const needsIndex = () => state.q.trim() || state.tt || state.cap;

  // ---- the box and the filter row
  box.innerHTML = `<label class="ts-box">${ICON}<input type="search" value="${esc(state.q)}" aria-label="Search the tasks"
      placeholder="Search ${int(tasks.length)} tasks — fold cloth, open a drawer, humanoid, tool use…" autocomplete="off" spellcheck="false">
      <kbd>/</kbd><button type="button" class="ts-clear" aria-label="Clear the search" hidden>Clear</button></label>
    <div class="ts-read" hidden></div>`;
  const input = box.querySelector('input'), read = box.querySelector('.ts-read'), clear = box.querySelector('.ts-clear');
  f.classList.add('ts-filters');
  f.innerHTML = `<div class="seg ts-set" role="group" aria-label="Which tasks">${SETS.map(([k, name]) => `<button type="button" data-set="${k}" class="${state.set === k ? 'on' : ''}"
      title="${k === 'core' ? 'The core set: the tasks the headline counts' : 'Every task'}">${name} <i>${int(setCount(k))}</i><small class="ts-tests">${int(setTests(k))} tests</small></button>`).join('')}</div>`
    + `<button type="button" class="chip ts-ftoggle" aria-expanded="false">Filters</button>`
    + G.map((g) => `<select data-f="${g.id}" aria-label="${esc(g.any)}"${g.more ? ' class="ts-more"' : ''}></select>`).join('')
    + `<button type="button" class="chip ts-moreb" aria-expanded="${state.more}">More filters</button>`
    + `<span class="tagset" hidden></span><span class="ts-end"><button type="button" class="chip ts-one" aria-pressed="${state.one}" title="Show each task family once, by its best scene">One per family</button><span class="count"></span></span>`;
  const sel = Object.fromEntries(G.map((g) => [g.id, f.querySelector(`[data-f="${g.id}"]`)]));

  // ---- one computation per change: rank, filter, count
  const mixed = (() => {   // the order without a query: the suites dealt in turn, as before
    const by = new Map();
    for (const t of tasks) { if (!by.has(t.suite)) by.set(t.suite, []); by.get(t.suite).push(t); }
    const lists = [...by.values()], out = [];
    for (let i = 0; out.length < tasks.length; i++) for (const l of lists) if (i < l.length) out.push(l[i]);
    return out;
  })();
  function ranked() {
    const q = state.q.trim();
    res = null;
    if (!q) return state.suite ? tasks : mixed;
    if (S) { res = S.search(q); return res.hits.map((i) => byKey.get(S.keys[i])).filter(Boolean); }
    const ws = q.toLowerCase().split(/\s+/);   // until the index is in: the words as typed, in titles and sentences
    return tasks.filter((t) => { const h = `${t.title} ${t.sentence} ${t.family} ${t.id}`.toLowerCase(); return ws.every((w) => h.includes(w)); });
  }
  const passes = (t, skip) => inSet(t) && G.every((g) => g.id === skip || !state[g.id] || g.test(t, state[g.id]))
    && (!state.tags.length || state.tags.every((x) => (t.tags || []).includes(x)));

  function drawFilters(order) {
    for (const g of G) {
      const opts = g.opts(), n = new Map();
      for (const t of order) if (passes(t, g.id)) for (const o of opts) if (g.test(t, o.id)) n.set(o.id, (n.get(o.id) || 0) + 1);
      const s = sel[g.id];
      s.innerHTML = `<option value="">${esc(g.any)}</option>` + opts.map((o) => {
        const c = n.get(o.id) || 0;
        return `<option value="${esc(o.id)}"${c || state[g.id] === o.id ? '' : ' disabled'}>${esc(o.name)} (${int(c)})</option>`;
      }).join('');
      s.value = state[g.id];
      s.classList.toggle('on', !!state[g.id]);
      s.disabled = !opts.length;
    }
    const on = G.filter((g) => state[g.id]).length + (state.tags.length ? 1 : 0);
    f.querySelector('.ts-ftoggle').textContent = on ? `Filters · ${on}` : 'Filters';
    const chip = f.querySelector('.tagset');
    chip.hidden = !state.tags.length;
    chip.innerHTML = state.tags.length ? `${state.tags.map((x) => esc(ex._tags[x].name)).join(' <span>×</span> ')} <button type="button" aria-label="Clear the labels">✕</button>` : '';
  }

  function drawRead() {
    clear.hidden = !state.q;
    if (!res) { read.hidden = true; read.innerHTML = ''; return; }
    const P = res.P, parts = [];
    const cs = [...P.concepts].map(([k, c]) => ({ k, ...c, ...S.CONCEPT.get(k) })).sort((a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || b.w - a.w);
    for (const c of cs) {
      // a keyword or a step read from the same words as a category says nothing more
      if ((c.type === 'kw' || c.type === 'act') && cs.some((o) => o !== c && o.via === c.via && TYPE_ORDER[o.type] < TYPE_ORDER[c.type])) continue;
      const fid = { task_type: 'tt', capability: 'cap', body: 'body', bench: 'suite' }[c.type];
      const v = c.type === 'bench' ? S.D.bench_ids[c.id] : c.id;
      const name = c.type === 'body' ? ex.bodies?.[c.id] || c.en : c.type === 'kw' || c.type === 'act' ? words(c.id) : c.en;
      if (fid && G.some((g) => g.id === fid)) {
        const on = state[fid] === String(v);
        parts.push(`<button type="button" class="ts-c${c.w < 0.6 ? ' weak' : ''}${on ? ' on' : ''}" data-pin="${fid}|${esc(v)}" aria-pressed="${on}"
          title="${on ? 'Remove this filter' : 'Show only this'}"><span>${TYPE_LABEL[c.type]}</span>${esc(name)}</button>`);
      } else parts.push(`<span class="ts-c plain" title="Read from “${esc(c.via)}”"><span>${TYPE_LABEL[c.type]}</span>${esc(name)}</span>`);
    }
    for (const u of P.units) if (u.how === 'fuzzy' || u.how === 'prefix')
      parts.push(`<span class="ts-c plain" title="${u.how === 'fuzzy' ? 'Read as the closest known word' : 'Completed'}">${u.how === 'fuzzy' ? `≈ ${esc(u.label)}` : `${esc(u.label)}…`}</span>`);
    const rel = S.relatedTerms(res.qv, P, 6);
    read.innerHTML = (parts.length ? `<span class="ts-lab">Read as</span>${parts.join('')}` : '')
      + (rel.length ? `<span class="ts-rel"><span class="ts-lab">Related</span>${rel.map((r) => `<button type="button" class="ts-add" data-add="${esc(r.text)}">+ ${esc(r.text)}</button>`).join('')}</span>` : '');
    read.hidden = !read.innerHTML;
  }

  function draw() {
    const order = ranked();
    let hits = order.filter((t) => passes(t));
    let more = null;
    if (state.one) {   // each family once, by its best scene, with how many scenes it has in this result
      const seen = new Map();
      more = new Map();
      hits = hits.filter((t) => { const k = `${t.suite}|${t.family}`; if (seen.has(k)) { more.set(seen.get(k), more.get(seen.get(k)) + 1); return false; } seen.set(k, keyOf(t)); more.set(keyOf(t), 1); return true; });
    }
    drawFilters(order);
    drawRead();
    const waiting = needsIndex() && !S && !failed;
    grid.innerHTML = waiting ? '<div class="empty-state">Loading the search…</div>'
      : hits.length ? `<div class="task-grid">${hits.slice(0, state.limit).map((t) => kit.card(t)).join('')}</div>`
        + (hits.length > state.limit ? `<div class="load-more"><button class="btn" data-more>Show ${Math.min(60, hits.length - state.limit)} more of ${int(hits.length - state.limit)}</button></div>` : '')
      : `<div class="empty-state">No task matches ${state.q.trim() ? 'this search' : ''}${state.q.trim() && G.some((g) => state[g.id]) ? ' and ' : ''}${G.some((g) => state[g.id]) ? 'these filters' : ''}.</div>`;
    if (more) for (const c of grid.querySelectorAll('.task-card')) {
      const m = more.get(c.dataset.task);
      if (m > 1) c.querySelector('.media')?.insertAdjacentHTML('beforeend', `<span class="ts-fam" title="This family has ${m} scenes in the result">${m} scenes</span>`);
    }
    kit.mark?.(grid);
    const nSet = setCount(state.set);
    f.querySelector('.count').textContent = waiting ? '' : `${state.one ? `${int(hits.length)} families` : `${int(hits.length)} of ${int(nSet)} tasks`}`;
    f.querySelectorAll('.ts-set button').forEach((b) => b.classList.toggle('on', b.dataset.set === state.set));
    f.classList.toggle('more', state.more);
    f.querySelector('.ts-moreb').setAttribute('aria-expanded', String(state.more));
    f.querySelector('.ts-moreb').textContent = state.more ? 'Fewer filters' : `More filters${G.some((g) => g.more && state[g.id]) ? ' ·' : ''}`;
    if (res && !waiting) f.querySelector('.count').insertAdjacentHTML('beforeend', '<span class="ts-by"> · by relevance</span>');
    f.querySelector('.ts-one').setAttribute('aria-pressed', String(state.one));
    const u = new URL(location.href);
    for (const [k, v] of [['q', state.q.trim()], ['set', state.set === 'core' ? '' : state.set], ...G.map((g) => [g.id, state[g.id]]), ['tags', state.tags.join(',')], ['one', state.one ? '' : '0']])
      v ? u.searchParams.set(k, v) : u.searchParams.delete(k);
    history.replaceState(null, '', u);
  }
  let queued = 0;
  const redraw = () => { state.limit = 60; if (!queued) queued = requestAnimationFrame(() => { queued = 0; draw(); }); };

  // ---- events
  input.addEventListener('input', () => { state.q = input.value; redraw(); });
  clear.addEventListener('click', () => { input.value = state.q = ''; redraw(); input.focus(); });
  f.addEventListener('change', (e) => { const k = e.target.dataset?.f; if (k) { state[k] = e.target.value; redraw(); } });
  f.addEventListener('click', (e) => {
    if (e.target.closest('.tagset button')) { state.tags = []; redraw(); }
    else if (e.target.closest('.ts-one')) { state.one = !state.one; redraw(); }
    else if (e.target.closest('[data-set]')) { state.set = e.target.closest('[data-set]').dataset.set; redraw(); }
    else if (e.target.closest('.ts-moreb')) { state.more = !state.more; if (!state.more) for (const g of G) if (g.more) state[g.id] = ''; redraw(); }
    else if (e.target.closest('.ts-ftoggle')) { const o = f.classList.toggle('open'); e.target.setAttribute('aria-expanded', String(o)); }
  });
  read.addEventListener('click', (e) => {
    const pin = e.target.closest('[data-pin]'), add = e.target.closest('[data-add]');
    if (pin) { const [k, v] = pin.dataset.pin.split('|'); state[k] = state[k] === v ? '' : v; redraw(); }
    if (add) { input.value = state.q = `${state.q.trim()} ${add.dataset.add}`; redraw(); }
  });
  grid.addEventListener('click', (e) => { if (e.target.closest('[data-more]')) { state.limit += 60; draw(); } });
  addEventListener('keydown', (e) => {
    if (e.key === '/' && !e.metaKey && !e.ctrlKey && !/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName) && !document.body.classList.contains('drawer-open')) { e.preventDefault(); input.focus(); }
  });
  pickTag = (k, v) => { kit.close?.(); state[k] = v; redraw(); scrollTo({ top: box.getBoundingClientRect().top + scrollY - 90, behavior: 'smooth' }); };

  draw();
  loadSearch().then((s) => {
    S = s;
    for (const k of S.keys) A.set(k, S.at(k));
    applyNames(tasks, (k) => S.at(k)?.n);
    draw();
    setTimeout(loadAtlas, 1200);   // the drawers' Atlas part, ahead of the first click
  }).catch((e) => { console.error(e); failed = true; state.tt = state.cap = ''; draw(); });   // the words-as-typed search stays
}

/* ============================================================================================== the drawer */

/** Fill a task drawer's Atlas slots (#drawer-atlas before the results, #drawer-related after the facts) for task t.
 *  opts.open(key) opens another task's drawer; opts.tasks() resolves to every task (for related tasks' names and pictures). */
export function drawerAtlas(t, opts = {}) {
  styles();
  const k = keyOf(t);
  const top = document.getElementById('drawer-atlas'), low = document.getElementById('drawer-related');
  if (!top || !low) return;
  top.dataset.key = low.dataset.key = k;
  Promise.all([loadAtlas(), (opts.tasks || loadTaskList)()]).then(([AT, all]) => {
    if (top.dataset.key !== k || !top.isConnected) return;   // another task was opened meanwhile
    const a = AT.tasks?.[k];
    if (!a) return;
    applyNames(all, (x) => AT.tasks?.[x]?.n);
    applyNames([t], (x) => AT.tasks?.[x]?.n);
    const h2 = document.querySelector('#drawer h2');
    if (t.code && h2) {   // the drawer was drawn before the names were in
      h2.textContent = t.title;
      if (!h2.nextElementSibling?.classList.contains('t-code')) h2.insertAdjacentHTML('afterend', `<p class="t-code">${esc(t.code)}</p>`);
    }
    const tx = AT.taxonomy || {};
    const byKey = new Map(all.map((x) => [keyOf(x), x]));
    const chip = (g, id) => `<a class="da-tag" href="${page('tasks/')}?${g}=${encodeURIComponent(id)}" data-pick="${g}|${esc(id)}"${a.why?.[id] ? ` title="${esc(tidy(a.why[id]))}"` : ''}>${esc(tx[g]?.[id] || words(id))}</a>`;
    const rows = [['Task type', (a.tt || []).map((x) => chip('tt', x))], ['Capability', (a.cap || []).map((x) => chip('cap', x))]].filter(([, v]) => v.length);
    const steps = (a.steps || []).map((s) => {
      const [act, obj, to, n] = s;
      return `<li><b>${esc(words(act))}</b> ${esc(obj || '')}${to ? ` <span class="da-to">→ ${esc(to)}</span>` : ''}${n > 1 ? ` <i>×${n}</i>` : ''}</li>`;
    }).join('');
    top.innerHTML = `<h3>At a glance</h3>
      ${a.tldr ? `<p class="da-tldr">${esc(a.tldr)}</p>` : ''}
      ${rows.length ? `<dl class="da-tags">${rows.map(([h, v]) => `<dt>${h}</dt><dd>${v.join('')}</dd>`).join('')}</dl>` : ''}
      ${steps ? `<div class="da-steps"><span class="label">Steps</span><ol>${steps}</ol></div>` : ''}`;
    // related tasks and the other scenes of this family
    const fam = all.filter((x) => x.suite === t.suite && x.family === t.family && keyOf(x) !== k);
    const rel = (a.rel || []).map((r) => byKey.get(r)).filter(Boolean);
    const relRow = (x) => {
      const p = x.media?.poster;
      return `<a class="da-rel" href="${page('tasks/')}?task=${encodeURIComponent(keyOf(x))}" data-rel="${esc(keyOf(x))}">
        <span class="da-thumb">${p ? `<img src="${esc(media(p))}" alt="" loading="lazy">` : ''}</span>
        <span><b>${esc(x.title)}</b><small>${esc(x.code || AT.tasks?.[keyOf(x)]?.n || '')}</small></span></a>`;
    };
    low.innerHTML = (rel.length ? `<h3>Related tasks</h3><div class="da-rels">${rel.map(relRow).join('')}</div>` : '')
      + (fam.length ? `<h3>Same family <span class="da-n">${fam.length + 1} scenes</span></h3><div class="da-fam">${fam.slice(0, 24).map((x) => `<a href="${page('tasks/')}?task=${encodeURIComponent(keyOf(x))}" data-rel="${esc(keyOf(x))}">${esc(x.code || x.title)}</a>`).join('')}${fam.length > 24 ? `<span>+${fam.length - 24}</span>` : ''}</div>` : '');
    const go = (e) => {
      const r = e.target.closest('[data-rel]'), p = e.target.closest('[data-pick]');
      if (r && opts.open && !e.metaKey && !e.ctrlKey) { e.preventDefault(); opts.open(r.dataset.rel); }
      else if (p && pickTag && !e.metaKey && !e.ctrlKey) { e.preventDefault(); const [g, v] = p.dataset.pick.split('|'); pickTag(g, v); }
    };
    top.onclick = go; low.onclick = go;
  }).catch((e) => console.error(e));
}
