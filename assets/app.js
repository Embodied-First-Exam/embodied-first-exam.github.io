// The Embodied First Exam's pages: one module for all of them; body[data-page] says which page this is.
// Data: data/exam.json (suites, runs, the taxonomy, the leaderboard's scores per setting) and data/tasks.json (every task with its
// results), refreshed by scripts/export.py. Pictures and videos are on HF (the public dataset's site/ folder, see
// scripts/media.py): the data names them by their full address, the site's own ones here as media/<path> (= site/<path>).
// Pages are taken from the site root, which is worked out from where this file is served (assets/app.js), so the site
// works at any address.

const BASE = new URL('../', import.meta.url).pathname;
const MEDIA = 'https://huggingface.co/datasets/MLL-Lab/embodied-exam-media/resolve/main/site/';
const PAGE = document.body.dataset.page || 'home';
const Q = new URLSearchParams(location.search);
// suites' earlier ids, in links from before 2026-10-19: the Embodied Safety Exam was robosafe; Embodied Olympics - Fun and
// - Match were roboolympics-fun and roboolympics-match (and one suite, roboolympics, before 2026-10-18: its tasks are found
// in either, see taskKey). The address is rewritten too, so the Tasks page's filters (search.js) read the new id.
const SUITE_ALIAS = { robosafe: 'embodied-safety-exam', 'roboolympics-fun': 'embodied-olympics-fun', 'roboolympics-match': 'embodied-olympics-match',
  roboolympics: 'embodied-olympics-fun' };
const SUITE_SPLIT = { roboolympics: ['embodied-olympics-fun', 'embodied-olympics-match'] };
const suiteNow = (id) => SUITE_ALIAS[id] || id;
{
  let moved = false;
  for (const k of ['suite', 'id', 'task']) {
    const v = Q.get(k), m = v && /^([^/]+)(\/.*)?$/.exec(v);
    if (m && SUITE_ALIAS[m[1]] && !(k === 'task' && SUITE_SPLIT[m[1]])) { Q.set(k, SUITE_ALIAS[m[1]] + (m[2] || '')); moved = true; }
  }
  if (moved) history.replaceState(history.state, '', `${location.pathname}?${Q}${location.hash}`);
}
/** A task's key ("<suite>/<id>") in `index`, also from a link to a suite that was split since (roboolympics/<id>). */
const taskKey = (want, index) => {
  if (!want || index.has(want)) return want;
  const [s, id] = want.split('/');
  return (SUITE_SPLIT[s] || []).map((x) => `${x}/${id}`).find((k) => index.has(k)) || want;
};
const MODES = ['privileged', 'standard'];
const MK = { privileged: 'p', standard: 's', 'standard-realtime': 's' };   // standard-realtime is standard on a running clock
const MODE_LABEL = { privileged: 'Privileged', standard: 'Standard' };
const BODY_ORDER = ['arm', 'bimanual', 'mobile', 'humanoid', 'quadruped', 'hand', 'musculoskeletal', 'aerial'];
const GRADED = new Set(['S', 'F', 'E']);
/** A trial's state code for scoring; undefined for a standard trial that ran with resets allowed (reported apart). */
const scored = (c) => (c && !c.r ? c.s : undefined);

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
/** Escaped text with Markdown's inline code (`x`) as <code>. */
const prose = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
const site = (p) => (!p ? '' : /^https?:/.test(p) ? p : p.startsWith('media/') ? MEDIA + p.slice(6) : BASE + p);   // a picture or a video
const exam = (p) => BASE + (p || '');                               // a page of this site
const int = (n) => Number(n || 0).toLocaleString('en-US');
const rate = (s, n) => (n ? s / n : null);
const pctText = (s, n) => (n ? `${Math.round((100 * s) / n)}%` : '–');

let examData, taskData;
const getJSON = (p) => fetch(exam(p), { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`); return r.json(); });
// runs listed but not ranked (exam.json unranked_runs; GPT-6 Luna, owners, 2026-10-19): their per-task results are in
// tasks.json and show in the task drawer, marked "not ranked"; no ranking, score, square, filter or count reads them
const UNRANKED_RUNS = new Set(['codex-gpt6_luna-xhigh']);
const loadExam = () => (examData ??= getJSON('data/exam.json').then((ex) => { for (const r of ex.unranked_runs || []) UNRANKED_RUNS.add(r.id); return ex; }));
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
// the exam's repository on GitHub: the bar's icon, the footer, the hero's Get started (owners, 2026-10-19)
const GITHUB_URL = 'https://github.com/mll-lab-nu/embodied-first-exam';
const GITHUB = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>';
// the exam's Discord, an icon after GitHub in the bar, in the footer and on Contribute: the permanent invite (owners,
// 2026-10-19); this is the one place it lives, and an https:// address makes it open in a new tab
const DISCORD_URL = 'https://discord.gg/AhC6utNyfk';
const DISCORD = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.11 13.11 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .078-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.363 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>';
// the exam's WeChat group, an icon after Discord: it opens the QR code in the exam repository (owners, 2026-10-19), so
// replacing docs/assets/wechat.jpg there is all it takes
const WECHAT_URL = 'https://github.com/mll-lab-nu/embodied-first-exam/blob/main/docs/assets/wechat.jpg';
const WECHAT = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.27-.027-.407-.03zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z"/></svg>';
const DISCORD_ATTRS = /^https?:/.test(DISCORD_URL) ? ' target="_blank" rel="noopener"' : '';
const MENU = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
const SUN = '<svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/></svg>';

function chrome() {
  const links = [['leaderboard', 'leaderboard/', 'Leaderboard'], ['suites', 'suites/', 'Suites'], ['tasks', 'tasks/', 'Tasks'], ['run', 'run/', 'Runs'], ['blog', 'blogs/', 'Blogs'], ['contribute', 'contribute/', 'Contribute']];
  const active = (n) => PAGE === n || (PAGE === 'suite' && n === 'suites') || (PAGE === 'blogpost' && n === 'blog');
  const nav = $('#nav');
  if (nav) {
    nav.outerHTML = `<nav class="nav always" aria-label="Sections">
      <a class="wordmark" href="${exam()}"><span class="mark" aria-hidden="true">${MARK}</span>Embodied First Exam</a>
      <div class="nav-links">${links.map(([n, p, label]) => (p ? `<a href="${exam(p)}"${active(n) ? ' class="active"' : ''}>${label}</a>` : `<a class="soon" aria-disabled="true" title="Coming soon">${label}</a>`)).join('')}</div>
      <a class="icon-btn gh-btn${GITHUB_URL ? '' : ' soon'}"${GITHUB_URL ? ` href="${GITHUB_URL}"` : ' aria-disabled="true"'} aria-label="The exam on GitHub" title="${GITHUB_URL ? 'GitHub' : 'GitHub: coming soon'}">${GITHUB}</a>
      <a class="icon-btn gh-btn dc-btn" data-discord href="${DISCORD_URL}"${DISCORD_ATTRS} aria-label="Discord" title="Discord">${DISCORD}</a>
      <a class="icon-btn gh-btn dc-btn wc-btn" data-wechat href="${WECHAT_URL}" target="_blank" rel="noopener" aria-label="WeChat group" title="WeChat group">${WECHAT}</a>
      <button class="icon-btn menu-btn" id="menu-toggle" type="button" aria-label="Menu" aria-expanded="false">${MENU}</button>
      <button class="icon-btn" id="theme-toggle" type="button" aria-label="Switch between day and night">${MOON}${SUN}</button>
    </nav>`;
  }
  $('#menu-toggle')?.addEventListener('click', (e) => {
    const bar = e.currentTarget.closest('.nav');
    const open = bar.classList.toggle('open');
    e.currentTarget.setAttribute('aria-expanded', String(open));
  });
  // links to Discord written in a page (Contribute): the address lives here only
  $$('a[data-discord]').forEach((a) => { a.href = DISCORD_URL; if (DISCORD_ATTRS) { a.target = '_blank'; a.rel = 'noopener'; } });
  wechat();
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
  // the links stay; no paragraph about the exam (user, 2026-10-18)
  f.outerHTML = `<footer class="footer"><div class="footer-grid">
    <div>
      <a class="wordmark" href="${exam()}"><span class="mark" aria-hidden="true">${MARK}</span>Embodied First Exam</a>
      <div class="prov">Questions as of ${esc(date(ts.date))} · results updated ${esc(date(ex.build?.at))}</div>
      <div class="copy">© 2026 Embodied First Exam</div>
    </div>
    <div><h5>The exam</h5><ul>
      <li><a href="${exam('leaderboard/')}">Leaderboard</a></li><li><a href="${exam('suites/')}">Suites</a></li>
      <li><a href="${exam('tasks/')}">Tasks</a></li><li><a href="${exam('run/')}">Runs</a></li></ul></div>
    <div><h5>About</h5><ul>
      <li><a href="${exam('blogs/')}">Blogs</a></li>
      <li><a href="${exam('how/')}">How it is marked</a></li><li><a href="${exam('contribute/')}">Contribute</a></li></ul></div>
    <div><h5>Community</h5><ul>
      ${GITHUB_URL ? `<li><a href="${GITHUB_URL}">GitHub</a></li>` : ''}<li><a data-discord href="${DISCORD_URL}"${DISCORD_ATTRS}>Discord</a></li>
      <li><a data-wechat href="${WECHAT_URL}" target="_blank" rel="noopener">WeChat group</a></li></ul></div>
  </div></footer>`;
}

/** Every [data-wechat] element (bar, footer, Contribute) opens the WeChat group's QR code in the exam repository. */
function wechat() {
  $$('[data-wechat]').forEach((b) => b.removeAttribute('aria-haspopup'));
  document.addEventListener('click', (e) => {
    if (!e.target.closest?.('[data-wechat]')) return;
    e.preventDefault();
    open(WECHAT_URL, '_blank', 'noopener');
  });
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

function codeMark(s, dash = false) {
  return `<span class="code-mark${dash ? ' dash' : ''}" title="${esc(s.name)}">${esc(s.code)}</span>`;
}

function poster(media, cls = '') {
  if (!media?.poster) return '';
  return `<img src="${esc(site(media.poster))}" alt="" loading="lazy" decoding="async"${cls ? ` class="${cls}"` : ''}>`;
}

/* --------------------------------------------------------------------------------------------- leaderboard */

/** The leaderboard's settings, shown one at a time behind a switch (owners, 2026-10-19). Core is the core set as the
 *  default command runs it, each core task once in its default mode, and it is the default view; then standard,
 *  standard-realtime and privileged, each the core set's tests in that one mode (real time is no longer standard).
 *  `key` is the result key of a task's cell (data/tasks.json); Core takes each task's own default key. */
const LB_SETTINGS = [
  { id: 'core', label: 'Core', key: null },
  { id: 'standard', label: 'Standard', key: 's' },
  { id: 'standard-realtime', label: 'Standard-realtime', key: 't' },
  { id: 'privileged', label: 'Privileged', key: 'p' },
];
const lbSetting = (id) => LB_SETTINGS.find((s) => s.id === id) || LB_SETTINGS[0];
/** One line under the switch saying what the setting shown measures (owners, 2026-10-19); n is its number of tests. */
const LB_DESC = {
  core: (n) => `We run each of the ${int(n)} core tasks once in its default mode: standard mode for static environments, standard-realtime mode for dynamic ones. The core set is the harder part of the exam: we use human judgment and an initial run with GPT-6 Luna to filter out easier tasks.`,
  standard: (n) => `${int(n)} core tasks have a standard mode. The agent and simulator run in separate containers and communicate only through predefined APIs. The agent can receive sensor data (RGB, RGB-D, etc.) and proprioceptive information, but can't access object poses.`,
  'standard-realtime': (n) => `Tasks with dynamic environments, ${int(n)} of them in the core set, run in standard-realtime mode: the rules follow standard mode, but the world keeps running while the agent thinks.`,
  privileged: (n) => `In privileged mode (${int(n)} core tasks), the agent and simulator run in the same container, giving the agent access to the full simulator state and letting it reset the simulator as often as needed.`,
};
const lbDesc = (id, n) => (LB_DESC[id] ? LB_DESC[id](n) : '');

/** Scores of a group of runs in one setting, on all the core tests of that setting: the denominator is fixed, and a test
 *  without a finished result counts as failed (owners, 2026-10-19). {tests: the setting's core tests,
 *  scores: {run: {v: [solved, tests], suites: {suite: [solved, the suite's tests]}}}} */
function scoreGroup(group, tasks, set) {
  const scores = Object.fromEntries(group.map((r) => [r.id, { v: [0, 0], suites: {} }]));
  let tests = 0;
  for (const t of tasks) {
    if (t.suite === 'robosuite') continue;
    const k = set.key ?? t.default;
    if (!k || !t.core || !t.core.includes(k)) continue;   // the core set only (owners, 2026-10-18)
    tests += 1;
    for (const r of group) {
      const ok = scored(t.results?.[r.id]?.[k]) === 'S';
      const o = scores[r.id];
      o.v[0] += ok;
      o.v[1] += 1;
      const ss = (o.suites[t.suite] ??= [0, 0]);
      ss[0] += ok;
      ss[1] += 1;
    }
  }
  return { tests, scores };
}

const pctOf = (v) => (v && v[1] ? (100 * v[0]) / v[1] : null);
const solvedOf = (v) => (v?.[1] ? `${int(v[0])}/${int(v[1])}` : '–');

/** The switch between the settings: one button each, the chosen one pressed; arrow keys move along it. */
function settingSwitch(el, current, pick, list = LB_SETTINGS) {
  el.setAttribute('role', 'group');
  el.setAttribute('aria-label', 'Setting');
  el.innerHTML = list.map((s) => `<button type="button" data-set="${s.id}" aria-pressed="${s.id === current}" class="${s.id === current ? 'on' : ''}">${s.label}</button>`).join('');
  const buttons = $$('button', el);
  const press = (id) => buttons.forEach((b) => { const on = b.dataset.set === id; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  el.addEventListener('click', (e) => { const b = e.target.closest('[data-set]'); if (b) { press(b.dataset.set); pick(b.dataset.set); } });
  el.addEventListener('keydown', (e) => {
    const i = buttons.indexOf(document.activeElement);
    if (i < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[j].focus();
    buttons[j].click();
  });
  return press;
}

/** A model, suite by suite, in one setting: a bar and the share solved, the counts beside it. */
function suiteBars(ex, suites, set) {
  const minis = ranked(ex).filter((s) => suites[s.id]?.[1]).map((s) => {
    const v = suites[s.id], q = pctOf(v);
    const k = Math.round(38 + 62 * (q ?? 0) / 100);
    return `<a class="lbh-mini" href="${exam('suite/')}?id=${s.id}" style="--i:0" title="${esc(s.name)}, ${esc(set.label)}: ${v[0]} of ${v[1]} solved">
      <span class="nm">${codeMark(s)}<span>${esc(s.name)}</span></span>
      <span class="lbh-track"><span class="lbh-s" style="--w:${q.toFixed(1)}%;--k:${k}%"></span></span>
      <span class="lbh-val" style="--k:${k}%"><b>${Math.round(q)}<small>%</small></b><em>${solvedOf(v)}</em></span></a>`;
  }).join('');
  return `<div class="lbh-minis">${minis || '<p class="muted">No suite marked yet.</p>'}</div>`;
}

/** One ranked row in one setting: place (gold, silver, bronze), maker's mark, model and harness, the share solved as an
 *  ink bar (deeper for higher, relative to `best`), then the share and solved / sat. `part`: a smaller run, not ranked. */
function lbRow(r, v, rank, best, set, { part = false, open = false, still = false } = {}) {
  const q = pctOf(v);
  const k = Math.round(38 + 62 * (q ?? 0) / Math.max(best || 0, 1));
  const tag = still ? 'div' : 'button';
  return `<${still ? 'div' : 'button type="button"'} class="lbh-row lb1${part ? ' part' : ''}${open ? ' on' : ''}${still ? ' still' : ''}" data-id="${esc(r.id)}" style="--i:${Math.min(rank || 12, 12)}"${still ? '' : ` aria-expanded="${open}"`}
      aria-label="${esc(r.model)}${part ? '' : `, place ${rank}`}: ${esc(set.label)}, ${v?.[1] ? `${v[0]} of ${v[1]} solved, ${Math.round(q)}%` : 'not sat'}">
    <span class="rk r${part ? 0 : rank}">${part ? '·' : rank}</span>${makerMark(r.model)}
    <span class="lbh-name"><span class="lbh-nl"><b>${esc(r.model)}</b><span class="lbh-set">${esc([r.harness, r.effort].filter(Boolean).join(' · '))}</span></span></span>
    <span class="lbh-track">${q != null ? `<span class="lbh-s" style="--w:${q.toFixed(1)}%;--k:${k}%"></span>` : ''}</span>
    <span class="lbh-val" style="--k:${k}%"><b>${q != null ? `${Math.round(q)}<small>%</small>` : '–'}</b><em>${solvedOf(v)}</em></span>
  </${tag}>`;
}

/** A model opened under its row, in one setting: its share and count, cost and time, then its suites one by one. */
function lbDetail(ex, r, sc, set, href = true) {
  const usd = r.est_n ? r.est_usd / r.est_n : null;
  const q = pctOf(sc.v);
  return `<div class="lbh-detail in"><div class="lbh-dh">${makerMark(r.model)}<div class="lbh-nl"><b>${esc(r.model)}</b><span class="lbh-set">${esc([r.harness, r.effort].filter(Boolean).join(' · '))}</span></div>
      <div class="lbh-pair"><span class="s"><b>${q != null ? Math.round(q) : '–'}%</b>${esc(set.label)}</span>
        <span class="s"><b>${solvedOf(sc.v)}</b>Solved</span>
        ${usd != null ? `<span class="x" title="Model use per test at list price"><b>$${usd.toFixed(usd < 1 ? 2 : 1)}</b>Per test</span>` : ''}
        ${r.agent_n ? `<span class="x"><b>${Math.round(r.agent_s / r.agent_n / 60)} min</b>Per attempt</span>` : ''}</div>
      ${href ? `<a class="btn small" href="${exam('leaderboard/')}?${set.id === 'core' ? '' : `mode=${set.id}&`}open=${encodeURIComponent(r.id)}">On the leaderboard →</a>` : ''}</div>
    ${suiteBars(ex, sc.suites || {}, set)}</div>`;
}
/** The scale over the rows, and the setting's fixed denominator at its end: every agent is counted on all these tests. */
const lbAxis = (tests) => `<div class="lbh-axis lb1"><span></span><span class="lbh-ticks" aria-hidden="true">${[0, 25, 50, 75, 100].map((v) => `<i style="left:${v}%">${v}%</i>`).join('')}</span><span class="lbh-n">${int(tests)} test${tests === 1 ? '' : 's'}</span></div>`;

/** The leaderboard page: the setting switch (remembered in ?mode=), the ranked board, a model's suites on a click. */
function lbBoard(ex, tasks, onDraw) {
  const lb = ex.leaderboard || {};
  const minSuites = lb.min_suites || 10;
  const board = $('#lb-board');
  const harnesses = [...new Set(ex.runs.filter((r) => (r.kind || 'agent') === 'agent').map((r) => r.harness))];
  // all the core tests of the chosen setting, a missing result counted as failed (owners, 2026-10-19)
  const state = { set: lbSetting(Q.get('mode')).id, harness: 'all', kind: 'agent', open: Q.get('open'), small: false };
  function draw() {
    const set = lbSetting(state.set);
    const pool = ex.runs.filter((r) => (r.kind || 'agent') === state.kind && (state.harness === 'all' || r.harness === state.harness));
    const main = pool.filter((r) => (r.suites?.length || 0) >= minSuites);
    const partial = pool.filter((r) => (r.suites?.length || 0) < minSuites).sort((a, b) => (b.suites?.length || 0) - (a.suites?.length || 0));
    const g = scoreGroup([...main, ...partial], tasks, set);
    const scores = g.scores, pscores = g.scores;
    const key = (sc) => pctOf(sc.v) ?? -1;
    main.sort((a, b) => key(scores[b.id]) - key(scores[a.id]) || a.model.localeCompare(b.model));
    const row = (r, sc, rank, part, best) => lbRow(r, sc.v, rank, best, set, { part, open: state.open === r.id }) + (state.open === r.id ? lbDetail(ex, r, sc, set, false) : '');
    let html = '';
    if (!main.length && !partial.length) {
      html = `<div class="empty-state">${state.kind === 'vla' ? 'No VLA policy has sat the exam yet.' : 'No run with this harness yet.'}</div>`;
    } else {
      let rank = 0, prev = null;
      const best = Math.max(0, ...main.map((r) => pctOf(scores[r.id].v) ?? 0));
      { const d = $('#lb-desc'); if (d) d.textContent = lbDesc(set.id, g.tests); }
      html = lbAxis(g.tests) + main.map((r, i) => { const k = key(scores[r.id]); if (k !== prev) { rank = i + 1; prev = k; } return row(r, scores[r.id], rank, false, best); }).join('');
      if (partial.length) {
        const open = state.small || partial.some((r) => r.id === state.open);
        html += `<div class="db-group"><button type="button" class="btn small" data-small>${open ? 'Hide' : 'Show'} ${partial.length} smaller run${partial.length === 1 ? '' : 's'}, under ${minSuites} suites, not ranked</button></div>`;
        if (open) html += partial.map((r) => row(r, pscores[r.id], 0, true, best)).join('');
      }
    }
    board.innerHTML = html;
    $('[data-small]', board)?.addEventListener('click', () => { state.small = !state.small; if (!state.small && partial.some((r) => r.id === state.open)) state.open = null; draw(); });
    $$('.lbh-row', board).forEach((row) => row.addEventListener('click', () => { state.open = state.open === row.dataset.id ? null : row.dataset.id; draw(); }));
    if (onDraw) onDraw({ state, main, scores, set });
  }
  function sync() {
    $('#lb-harness').value = state.harness;
    // the setting in the address, so a link can point at a view; Core, the default, needs none
    const u = new URL(location.href);
    if (state.set === 'core') u.searchParams.delete('mode'); else u.searchParams.set('mode', state.set);
    history.replaceState(null, '', u);
    draw();
  }
  // the harness: one choice from a list (owners, 2026-10-19)
  $('#lb-harness').innerHTML = ['all', ...harnesses].map((h) => `<option value="${esc(h)}">${h === 'all' ? 'All harnesses' : esc(h)}</option>`).join('');
  $('#lb-harness').addEventListener('change', (e) => { state.harness = e.target.value; sync(); });
  settingSwitch($('#lb-mode'), state.set, (id) => { state.set = id; sync(); });
  // (no code agent / VLA policy switch: only code agents sit the exam; owners, 2026-10-19)
  sync();
}

/** Suite by suite: a table of numbers, one row per suite and one column per model, each cell tinted by its value, in the
 *  setting the board shows (on the same tests). The best cell of a row is underlined. */
function lbSuites(el, ex, runs, scores, set) {
  if (!el) return;
  const h = $('#lb-suites-set');
  if (h) h.textContent = set.label;
  // a note on why some suites have few tests in a setting (readers' question, 2026-10-19)
  const sn = $('#lb-suites-note');
  if (sn) sn.textContent = set.id === 'standard-realtime' ? 'Standard-realtime covers only tasks with dynamic environments, so some suites have just one or a few tests here; the number of tests is under each suite’s name.'
    : 'The number of tests each suite has in this setting is under its name.';
  if (!runs.length) { el.innerHTML = '<div class="empty-state">No ranked model in this view.</div>'; return; }
  const value = (r, s) => pctOf(scores[r.id]?.suites?.[s.id]);
  const suites = ranked(ex).filter((s) => runs.some((r) => scores[r.id]?.suites?.[s.id]));
  const cell = (r, s, best) => {
    const v = value(r, s);
    if (v == null) return '<span class="sx-cell na" title="Not sat">–</span>';
    const sv = scores[r.id].suites[s.id];
    const tip = `${s.name} · ${r.model}, ${set.label}: ${sv[0]} of ${sv[1]} solved`;
    // tints stay light enough for dark text everywhere: up to 60% of the colour
    const tint = Math.round(4 + v * 0.56);
    // where the build carries the suite's runs page (the internal site), a number opens that model's attempts there
    const href = s.pages?.runs ? `${site(s.pages.runs)}?run=${encodeURIComponent(r.id)}` : '';
    const tag = href ? `a href="${href}"` : 'span';
    return `<${tag} class="sx-cell${best ? ' best' : ''}" style="--t:${tint}%" title="${esc(tip)}">${Math.round(v)}<small>%</small></${href ? 'a' : 'span'}>`;
  };
  // no small effort line under a model's name (owner, 2026-10-19): the harness joins the name only where a model appears twice
  const twice = (r) => runs.filter((x) => x.model === r.model).length > 1;
  const head = `<div class="sx-row sx-head"><span></span>${runs.map((r) => `<span class="sx-col" title="${esc([r.harness, r.effort].filter(Boolean).join(' · '))}"><b>${esc(r.model)}${twice(r) && r.harness ? ` · ${esc(r.harness)}` : ''}</b></span>`).join('')}</div>`;
  const row = (s) => {
    const vals = runs.map((r) => value(r, s));
    const top = Math.max(...vals.filter((v) => v != null).map((v) => Math.round(v)));
    // how many tests the suite has in this setting, so a 100% on one test reads as one test (owners' readers, 2026-10-19)
    const n = Math.max(0, ...runs.map((r) => scores[r.id]?.suites?.[s.id]?.[1] || 0));
    return `<div class="sx-row"><a class="sd-name" href="${exam('suite/')}?id=${s.id}">${codeMark(s)}<span>${esc(s.name)}<small class="sd-n">${n} test${n === 1 ? '' : 's'}</small></span></a>
      ${runs.map((r, i) => cell(r, s, vals[i] != null && Math.round(vals[i]) === top && top > 0)).join('')}</div>`;
  };
  // the team's own suites and the others under their headings, as on the Suites page (owner, 2026-10-19)
  const rows = suiteGroups(suites).map(([title, list]) => `<div class="sx-grp">${title}</div>${list.map(row).join('')}`).join('');
  el.innerHTML = `<div class="sd-scroll"><div class="sx-grid sx-${set.id}" style="--n:${runs.length}">${head}${rows}</div></div>`;
}

/** How it is counted: one icon, one rule and one line each, a small picture where it says more. */
function lbRules(el, ex) {
  if (!el) return;
  const lb = ex.leaderboard || {};
  const commit = (ex.task_set?.commit || '').slice(0, 9);
  const visual = {
    states: `<div class="rv-states"><span class="lbl">Counted</span><span class="chip-st ok">✓ solved</span><span class="chip-st">✗ failed</span><span class="chip-st">! error</span>
      <span class="lbl">Left out</span><span class="chip-st out">stopped</span><span class="chip-st out">withdrawn</span><span class="chip-st out">still running</span></div>`,
    modes: `<div class="rv-modes">${LB_SETTINGS.map((x) => `<span>${x.label}</span>`).join('<span class="ne">≠</span>')}</div>`,
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
  const cover = coverOf(s);
  const robot = s.robots?.[0]?.name || '';
  const more = (s.robots?.length || 0) > 1 ? ` and ${s.robots.length - 1} more` : '';
  return `<a class="suite-card" href="${exam('suite/')}?id=${s.id}">
    <div class="media">${cover ? poster(cover, cropFor(s.id, cover.task)) : `<div class="placeholder-art"><span>${esc(s.code)}</span><small>no pictures yet</small></div>`}${hoverVideo(s, cropFor(s.id, cover?.task))}${releaseTag(s)}</div>
    <div class="body"><h4>${esc(s.name)}${nameTag(s)}</h4><p>${esc(s.blurb || '')}</p>
      <div class="meta">${tasksTests(s.instances, s.task_dirs)} · ${s.robots_label ? esc(s.robots_label) : `${esc(robot)}${more}`}</div></div></a>`;
}

// suites whose scenes look alike, kept apart on the home page's wall as if they were one
const LOOKALIKE = { robocasa: 'kitchen', robocasa365: 'kitchen', 'robocasa-gr1': 'kitchen' };

// multi-camera posters: show the top-left camera only (the grid's layout per suite)
// suites whose demos are still multi-view grids: the crop shows one view. A suite leaves the list once its demos are
// re-rendered as one view (MuJoCo Playground and RoboTwin 2.0, 2026-10-08; DexToolBench, 2026-10-18: the old crop showed only
// a corner of its new single-view renders).
const CROPS = {};
// tasks of a cropped suite whose media is already one view (re-rendered since): shown whole
const SINGLE_VIEW = new Set();
const cropFor = (suite, task) => (SINGLE_VIEW.has(`${suite}/${task}`) ? '' : CROPS[suite] || '');
/** A suite's cover: its teaser, else a preview marked as cover, else (for a cropped suite) one already re-rendered as one view,
 *  else the first preview with motion, else the first. */
const coverOf = (s) => s.teaser || s.preview?.find((p) => p.cover)
  || (CROPS[s.id] && s.preview?.find((p) => SINGLE_VIEW.has(`${s.id}/${p.task}`))) || s.preview?.find((p) => !p.still) || s.preview?.[0];

function suitesGrid(el, ex, filter = {}) {
  const list = ex.suites.filter((s) => (!filter.body || s.body === filter.body) && (!filter.origin || (filter.origin === 'ours' ? isOurs(s) : s.origin === filter.origin)));
  // no headings by robot body (user, 2026-10-18), but the team's own suites and the others apart (owner, 2026-10-19);
  // the example task comes last
  const shown = [...list.filter((s) => !s.example), ...(filter.body ? [] : list.filter((s) => s.example))];
  el.innerHTML = suiteGroups(shown).map(([title, items]) => `<div class="suite-group reveal">${groupHead(title, items.length)}
    <div class="suite-grid">${items.map((s) => suiteCard(ex, s)).join('')}</div></div>`).join('') || '<div class="empty-state">No suite here.</div>';
  // the demo plays on hover, as on the home page; a click goes straight to the suite's page, no dialog (owner, 2026-10-19)
  hoverPlay($$('.suite-card', el));
  reveal(el);
}

/** The suites in two groups, each with its heading (owner, 2026-10-19): the exam team's own (isOurs), then the rest;
 *  the order inside a group is the one prepare() gave. An empty group is left out. */
function suiteGroups(list) {
  return [['EFE Suites', list.filter((s) => isOurs(s))], ['Existing Suites', list.filter((s) => !isOurs(s))]].filter(([, l]) => l.length);
}
const groupHead = (title, n) => `<h3 class="sg-head">${title}<small>${n} suite${n === 1 ? '' : 's'}</small></h3>`;

/* -------------------------------------------------------------------------------------- coverage (taxonomy) */

/** The coverage numbers: the display-tag groups, the suites that carry tags, and their scenes. */
function coverageInfo(ex) {
  const groups = ex.taxonomy || [];
  const suites = ranked(ex).filter((s) => Object.keys(s.tags || {}).length);
  return { groups, suites, total: suites.reduce((a, s) => a + s.instances, 0) };
}

function thinSpots(el, ex, info) {
  const tags = info.groups.flatMap((g) => g.tags.map((t) => ({ ...t, group: g.name, n: info.suites.reduce((a, s) => a + (s.tags?.[t.id] || 0), 0) })));
  const thin = tags.filter((t) => t.n / info.total < 0.12).sort((a, b) => a.n - b.n);
  const bodies = BODY_ORDER.map((b) => ({ b, n: ranked(ex).filter((s) => s.body === b).length })).filter((x) => x.n <= 1);
  const items = [
    ...thin.map((t) => `<a href="${exam('contribute/')}#propose">${tagIcon(t.id)}<span class="label">${esc(t.group)}</span><b>${esc(t.name)}</b><span title="${esc(t.description)}">${int(t.n)} task${t.n === 1 ? '' : 's'} so far</span></a>`),
    ...bodies.map((x) => `<a href="${exam('contribute/')}#propose"><span class="ic" data-icon="arm"></span><span class="label">Robot body</span><b>${esc(ex.bodies?.[x.b] || x.b)}</b><span>${x.n ? 'One suite so far' : 'A first suite is welcome'}</span></a>`),
  ];
  el.innerHTML = items.join('');
}

/* ----------------------------------------------------------------------------------------------- tasks */

// A card's squares: one per ranked model (columns, in leaderboard order) and per setting of the task (rows: privileged,
// standard, standard-realtime), filled in the setting's colour when that model solved that test (owners, 2026-10-19)
const RKEY = { privileged: 'p', standard: 's', 'standard-realtime': 't' };
const RKEY_LABEL = { p: 'Privileged', s: 'Standard', t: 'Standard-realtime' };
const cardKeys = (t) => { const ks = ['p', 's', 't'].filter((k) => (t.modes || []).some((m) => RKEY[m] === k)); return ks.length ? ks : ['p', 's']; };
function dots(ex, t, runs) {
  const ks = cardKeys(t);
  let won = 0;
  const cells = runs.map((r) => ks.map((k) => {
    const raw = t.results?.[r.id]?.[k], c = scored(raw);
    won += c === 'S';
    const word = raw?.r ? 'ran with resets, not counted' : stateWord(raw?.s);
    return `<i class="${GRADED.has(c) ? c + ' ' + k : 'none'}" title="${esc(`${r.model} · ${RKEY_LABEL[k]}: ${word}`)}"></i>`;
  }).join('')).join('');
  return `<span class="dots" style="--rows:${ks.length}">${cells}</span><span class="sr-only">${won} of ${runs.length * ks.length} model-setting results solved</span>`;
}
/** The line above the cards that says how to read their squares. */
const dotsKey = () => `<p class="dots-key"><span class="dk-lab">Squares</span> Each square is one ranked model in one setting, filled if it solved that test:
  <span class="dk"><i class="S p"></i>privileged</span> <span class="dk"><i class="S s"></i>standard</span> <span class="dk"><i class="S t"></i>standard (real-time)</span> <span class="dk"><i class="F"></i>not solved</span> <span class="dk"><i class="none"></i>not run</span>.</p>`;
/** The ranked runs, best first in the Core setting; hidden runs left out. */
function boardRuns(ex) {
  const ids = (ex.leaderboard?.shared?.runs || []).filter((id) => !HIDDEN_RUNS.has(id) && !UNRANKED_RUNS.has(id));
  const sc = ex.leaderboard?.shared?.views?.core?.scores || {};
  const v = (id) => (sc[id]?.[1] ? sc[id][0] / sc[id][1] : 0);
  return ex.runs.filter((r) => ids.includes(r.id)).sort((a, b) => v(b.id) - v(a.id));
}

const STATE_WORD = { S: 'solved', F: 'not solved', E: 'error', Q: 'queued', N: 'not run', R: 'running', X: 'not counted', '-': 'no data' };
const stateWord = (c) => STATE_WORD[c] || 'not run';

// a card's "▶ run" mark comes from the task's own results (data/tasks.json), so no runs index is fetched to draw cards;
// the runs themselves are looked up only when the task's drawer opens (watchable)
const hasRuns = (t) => Object.keys(t.results || {}).length > 0;

function taskCard(ex, t, runs) {
  const s = ex._suites[t.suite];
  const crop = cropFor(t.suite, t.id);
  return `<button class="task-card" data-task="${esc(t.suite)}/${esc(t.id)}">
    <div class="media">${t.media?.poster ? poster(t.media, crop) : `<div class="placeholder-art">${esc(s?.code || '')}</div>`}${s ? codeMark(s) : ''}${t.media?.still ? '<span class="still">scene</span>' : ''}${t.set === 'core' ? '<span class="core-mark" title="In the core set: the leaderboard counts this task">Core</span>' : ''}${hasRuns(t) ? '<span class="watch-mark" title="Agents sat this task: open it to watch a run step by step">▶ run</span>' : ''}</div>
    <div class="body"><h4>${esc(t.title)}</h4>${t.code ? `<span class="t-code">${esc(t.code)}</span>` : ''}
      ${runs.length && resultOf(t) !== 'unrun' ? `<div class="res">${dots(ex, t, runs)}</div>` : ''}</div></button>`;
}

// Where the step-by-step runs live: the public HF dataset MLL-Lab/embodied-exam-media (runs/), previews included
// (no probe for a local copy, which logged a 404 on every page that reads runs).
const RUNS_REMOTE = 'https://huggingface.co/datasets/MLL-Lab/embodied-exam-media/resolve/main/runs/';
const runBase = async () => RUNS_REMOTE;
let RUN_BASE = RUNS_REMOTE;
const runURL = (p) => RUN_BASE + p;
const runJSON = async (p) => { RUN_BASE = await runBase(); const r = await fetch(runURL(p)); if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`); return r.json(); };

// The runs' index comes in two layouts. v2 (index.json has "v": 2): index.json is a summary (counts by suite and by
// setting) and index/<suite>.json holds one suite's rows, so a page fetches only the suites it shows. v1 (older
// uploads): index.json holds every row. A v1 index is split into suites here, so everything below reads both alike.
/** The site's suite id of a run row: its site link ("<suite>/<task id>"), else its bench under the site's name. */
const runSuite = (r) => (r.site ? r.site.split('/')[0] : BENCH_SUITE[r.bench] || r.bench);
// The runs' files on HF keep the names they were built with (owners, 2026-10-19: no run is moved or rebuilt for a rename),
// so an index built before a suite was renamed lists its shard, and its rows' site, under the earlier id
// (roboolympics-fun, roboolympics-match). They are read here under the suite's id now; the slugs stay as they are, and
// runPage finds a run by either name. An index built after the rename has the new ids and none of this applies.
const RUN_SUITE_RENAMED = { 'roboolympics-fun': 'embodied-olympics-fun', 'roboolympics-match': 'embodied-olympics-match' };
const shardFile = new Map();   // the site's suite id -> the shard's name in the index, where they differ
const siteNow = (r) => { const [s, id] = (r.site || '').split('/'); return RUN_SUITE_RENAMED[s] ? { ...r, site: `${RUN_SUITE_RENAMED[s]}/${id}` } : r; };
function renameSuites(sum) {
  for (const [old, now] of Object.entries(RUN_SUITE_RENAMED)) {
    if (!sum.suites?.[old] || sum.suites[now]) continue;
    sum.suites[now] = sum.suites[old];
    delete sum.suites[old];
    if (sum.solved && old in sum.solved) { sum.solved[now] = sum.solved[old]; delete sum.solved[old]; }
    shardFile.set(now, old);
  }
  return sum;
}
let runSummaryP;
const runShards = new Map();   // suite id -> promise of its rows
/** index.json: {v, total, suites: {id: n}, solved, settings: {run id: n}}; a v1 index is summarised the same way. */
// runs the owners took off the site: not listed, not counted as a setting, not watched (none since 2026-10-19: GPT-6 Luna
// is listed with all its runs, every task of the All set, and only kept out of the rankings, UNRANKED_RUNS)
const HIDDEN_RUNS = new Set();
const shown = (rows) => (rows || []).filter((r) => !HIDDEN_RUNS.has(r.run));
const runSummary = () => (runSummaryP ??= runJSON('index.json').then((d) => {
  for (const id of HIDDEN_RUNS) if (d.settings) delete d.settings[id];
  if (d.runs) d.runs = shown(d.runs).map(siteNow);
  if (d.v >= 2) return splitSuites(renameSuites(d));
  const by = {}, settings = {};
  for (const r of d.runs || []) { (by[runSuite(r)] ??= []).push(r); settings[r.run] = (settings[r.run] || 0) + 1; }
  for (const [s, rows] of Object.entries(by)) runShards.set(s, Promise.resolve(rows));
  return splitSuites({ v: 1, total: (d.runs || []).length, suites: Object.fromEntries(Object.entries(by).map(([s, rows]) => [s, rows.length])), settings });
}).catch((e) => { runSummaryP = null; throw e; }));   // a failed fetch is tried again next time, not remembered
// Embodied Olympics is two suites on this site since 2026-10-19 (Fun and Match); an index built before files both under
// 'roboolympics'. Its rows go to the suite their task is in (data/tasks.json), with their counts; under the old id the
// same rows stay reachable, for a run page whose bench is the old one.
const SPLIT_SUITES = { roboolympics: ['embodied-olympics-fun', 'embodied-olympics-match'] };
async function splitSuites(sum) {
  for (const [old, parts] of Object.entries(SPLIT_SUITES)) {
    if (!sum.suites?.[old] || parts.some((p) => sum.suites[p])) continue;
    try {
      const [rows, tasks] = await Promise.all([runShards.get(old) || runJSON(`index/${encodeURIComponent(old)}.json`).then((x) => shown(x.runs)), loadTasks()]);
      const home = new Map(tasks.filter((t) => parts.includes(t.suite)).map((t) => [t.id, t.suite]));
      const moved = rows.map((r) => { const id = (r.site || '').split('/')[1], s = home.get(id); return s ? { ...r, site: `${s}/${id}` } : r; });
      runShards.set(old, Promise.resolve(moved));
      delete sum.suites[old];
      for (const p of parts) {
        const mine = moved.filter((r) => r.site?.startsWith(`${p}/`));
        runShards.set(p, Promise.resolve(mine));
        if (mine.length) sum.suites[p] = mine.length;
        if (sum.solved) sum.solved[p] = mine.filter((r) => r.success === 1 || r.state === 'success').length;
      }
    } catch (e) { console.warn('runs', old, e); }
  }
  return sum;
}
/** One suite's rows, fetched once; [] for a suite without runs. A failed fetch rejects and is not cached. */
const runShard = (suite) => runSummary().then((sum) => {
  if (runShards.has(suite)) return runShards.get(suite);
  if (!sum.suites?.[suite]) return [];
  const p = runJSON(`index/${encodeURIComponent(shardFile.get(suite) || suite)}.json`).then((d) => shown(d.runs).map(siteNow));
  runShards.set(suite, p);
  p.catch(() => runShards.delete(suite));
  return p;
});
const watchP = new Map();
/** A suite's runs that can be watched step by step, by the site's "<suite>/<task id>"; fetched when first asked for
 *  (a drawer of that suite opens, a run page needs its siblings). An empty map, marked failed, if they cannot be loaded. */
const watchable = (suite) => {
  if (!watchP.has(suite)) watchP.set(suite, runShard(suite).then((rows) => {
    const m = new Map();
    for (const r of rows) { if (!r.site) continue; if (!m.has(r.site)) m.set(r.site, []); m.get(r.site).push(r); }
    for (const v of m.values()) v.sort((a, b) => UNRANKED_RUNS.has(a.run) - UNRANKED_RUNS.has(b.run));   // unranked runs last
    return m;
  }).catch((e) => { console.warn('runs', suite, e); watchP.delete(suite); return Object.assign(new Map(), { failed: true }); }));
  return watchP.get(suite);
};

function openTask(ex, t, runs) {
  const s = ex._suites[t.suite] || {};
  const m = t.media || {};
  let media = '';
  if (m.video) media = `<div class="media"><video src="${esc(site(m.video))}" ${m.poster ? `poster="${esc(site(m.poster))}"` : ''} controls muted loop autoplay playsinline></video><span class="note">demo</span></div>`;
  else if (m.watch) media = `<div class="media">${m.poster ? `<img src="${esc(site(m.poster))}" alt="">` : ''}<span class="note"><a href="${esc(m.watch)}" target="_blank" rel="noopener">watch the official demo ↗</a></span></div>`;
  else if (m.poster) media = `<div class="media"><img src="${esc(site(m.poster))}" alt=""><span class="note">${m.still ? 'the scene the task starts from' : 'preview'}</span></div>`;
  const allRuns = [...ex.runs.filter((r) => t.results?.[r.id]),
    ...(ex.unranked_runs || []).filter((r) => t.results?.[r.id]).map((r) => ({ ...r, unranked: true }))];
  // one row per model, as the ranked rows: its maker's mark, then each mode's verdict, standard in ink, privileged grey hatched
  // a column per mode the task has: standard, standard-realtime, privileged (owners, 2026-10-19)
  const RK = { standard: 's', 'standard-realtime': 't', privileged: 'p' };
  const cols = ['standard', 'standard-realtime', 'privileged'].filter((m) => (t.modes || []).includes(m) || allRuns.some((r) => t.results[r.id]?.[RK[m]]));
  const res = allRuns.map((r) => {
    const cell = (mode) => {
      const c = t.results[r.id]?.[RK[mode]];
      if (!c) return '<span class="lbh-c"><span class="lbh-v na">–</span></span>';
      const cls = c.r ? 'rs' : c.s === 'S' ? `S ${RK[mode]}` : c.s;
      return `<span class="lbh-c"><span class="lbh-v ${cls}">${stateWord(c.s)}</span>${c.r ? `<small>with ${c.r} resets</small>` : ''}</span>`;
    };
    return `<div class="lbh-res${r.unranked ? ' unranked' : ''}">${makerMark(r.model)}<span class="lbh-name"><b>${esc(r.model)}${r.unranked ? ' <span class="unranked-tag" title="Not ranked: the screening run that chose the core set. It counts in no ranking or score.">not ranked</span>' : ''}</b><small>${esc([r.harness, r.effort].filter(Boolean).join(' · '))}</small></span>${cols.map(cell).join('')}</div>`;
  }).join('');
  const facts = [
    ['Suite', `${codeMark(s)} <a class="link" href="${exam('suite/')}?id=${s.id}">${esc(s.name)}</a>`],
    ['Robot', esc((s.robots || []).find((r) => r.id === t.robot)?.name || t.robot || '')],
    ['Modes', (t.modes || []).map((x) => `<span class="pill ${MK[x]}">${x}</span>`).join(' ')],
    ['Reference solution', esc({ full: 'Full: the oracle solves it', partial: 'Partial: the oracle reaches part of the goal', none: 'None: solvability shown in human review' }[t.oracle] || '')],
    ['Agent time', t.budget_min ? `${t.budget_min} min per attempt` : ''],
    ['Family', `<span class="mono">${esc(t.family || '')}</span>`],
    ['Tests', (t.dirs || []).map((d) => `<span class="mono" style="font-size:12px">${esc(d)}</span>`).join('<br>')],
  ].filter(([, v]) => v);
  const tags = (t.tags || []).map((id) => ex._tags[id]).filter(Boolean).map((tg) => `<span class="pill">${esc(tg.name)}</span>`).join(' ');
  $('#drawer .drawer-inner').innerHTML = `
    <div class="drawer-top"><span class="label">${esc(s.name || '')} · task${t.set === 'core' ? ' <span class="core-mark" title="In the core set: the leaderboard counts this task">Core</span>' : ''}</span><button class="icon-btn" data-close aria-label="Close">✕</button></div>
    <h2>${esc(t.title)}</h2>${t.code ? `<p class="t-code">${esc(t.code)}</p>` : ''}<p class="sentence">${prose(t.sentence || '')}</p>
    ${tags ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:12px">${tags}</div>` : ''}
    ${media}
    <div id="drawer-watch" data-task="${esc(t.suite)}/${esc(t.id)}">${hasRuns(t) ? '<p class="watch-run wait"><span class="spin"></span>Looking for runs to watch…</p>' : ''}</div>
    <div id="drawer-atlas"></div>
    ${res ? `<h3>Results</h3><div class="lbh-task" style="--ncol:${cols.length}"><div class="lbh-res lbh-rh"><span></span><span>Model</span>${cols.map((m) => `<span><i class="sw ${RK[m]}"></i>${{ standard: 'Standard', 'standard-realtime': 'Standard-realtime', privileged: 'Privileged' }[m]}</span>`).join('')}</div>${res}</div>` : ''}
    ${allRuns.some((r) => t.results[r.id]?.s?.r) ? '<p class="board-foot">A standard trial marked with resets ran with resets allowed. It is reported apart and counts in no ranking (protocol §4.5).</p>' : ''}
    <h3>About the task</h3><table class="facts-table"><tbody>${facts.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</tbody></table>
    <div id="drawer-related"></div>
    <div class="link-list" id="drawer-links"><a class="btn small" href="${exam('suite/')}?id=${s.id}">More from ${esc(s.name)} <span class="arr">→</span></a></div>`;
  // the runs to watch: this suite's runs index, fetched when the drawer opens; a placeholder holds the place meanwhile
  const key = `${t.suite}/${t.id}`;
  watchable(t.suite).then((m) => {
    const slot = $('#drawer-watch');
    if (!slot || slot.dataset.task !== key) return;   // another task's drawer opened meanwhile
    const mine = m.get(key) || [];
    slot.innerHTML = !mine.length ? (m.failed && hasRuns(t) ? '<p class="watch-run wait">The runs could not be loaded just now. Reopen the task to try again.</p>' : '')
      : `<a class="watch-run" href="${exam('run/')}?r=${encodeURIComponent(mine[0].slug)}">${runIcon('robot')}<span><b>${mine[0].success === 1 || mine[0].state === 'success' ? 'Watch an agent solve it, step by step' : 'Watch an agent try it, step by step'}</b><small>${esc(settingOf(mine[0]))}${mine.length > 1 ? ` and ${mine.length - 1} more` : ''} · every command, every picture it looked at, and the replay</small></span><span class="arr">→</span></a>`;
    if (mine.length) $('#drawer-links')?.insertAdjacentHTML('afterbegin', mine.map((r) => `<a class="btn small primary" href="${exam('run/')}?r=${encodeURIComponent(r.slug)}">Watch ${esc(settingOf(r))} (${/-standard/.test(r.task) ? 'standard' : 'privileged'}) <span class="arr">→</span></a>`).join(''));
  });
  // [task search] the Task Atlas part of the drawer (summary, task type and capability, steps, related tasks): search.js
  import('./search.js?v=fad66359').then((m) => m.drawerAtlas?.(t, { tasks: loadTasks, open: (k) => loadTasks().then((all) => {
    const x = all.find((y) => `${y.suite}/${y.id}` === k);
    if (x) { openTask(ex, x, runs); $('#drawer').scrollTop = 0; }
  }) })).catch((e) => console.error(e));
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

/** A task's results over every model: 'solved' (by some model), 'unsolved' (graded, never solved) or 'unrun'. */
function resultOf(t) {
  const cells = Object.entries(t.results || {}).filter(([id]) => !UNRANKED_RUNS.has(id)).flatMap(([, r]) => Object.values(r).map(scored));
  return cells.includes('S') ? 'solved' : cells.some((c) => GRADED.has(c)) ? 'unsolved' : 'unrun';
}

function taskBrowser(el, ex, tasks, opts = {}) {
  const runs = boardRuns(ex);
  drawerShell();
  if (runs.length && !$('.dots-key', el.parentElement)) el.insertAdjacentHTML('beforebegin', dotsKey());
  const index = new Map(tasks.map((t) => [`${t.suite}/${t.id}`, t]));
  const state = { q: Q.get('q') || '', suite: opts.suite || Q.get('suite') || '', body: '', tag: '', oracle: '', result: '', limit: 60,
    tags: (opts.suite ? '' : Q.get('tags') || '').split(',').filter((x) => ex._tags[x]) };
  const f = $('.filters', el.parentElement);
  if (f && !opts.suite) {
    const suites = ranked(ex).concat(ex.suites.filter((s) => s.example));
    const tagOpts = (ex.taxonomy || []).map((g) => `<optgroup label="${esc(g.name)}">${g.tags.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</optgroup>`).join('');
    f.innerHTML = `<input type="search" placeholder="Search tasks, families, suites" value="${esc(state.q)}" data-f="q" aria-label="Search">
      <select data-f="suite" aria-label="Suite"><option value="">All suites</option>${suites.map((s) => `<option value="${s.id}"${s.id === state.suite ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
      <select data-f="body" aria-label="Robot"><option value="">Any robot</option>${BODY_ORDER.map((b) => `<option value="${b}">${esc(ex.bodies?.[b] || b)}</option>`).join('')}</select>
      <select data-f="tag" aria-label="Capability or domain"><option value="">Any capability or domain</option>${tagOpts}</select>

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
    if (state.result && resultOf(t) !== state.result) return false;
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
    if (c) c.textContent = `${int(hits.length)} of ${int(tasks.length)} tasks`;
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
  // [task search] tasks whose title is only a code get the Atlas short name as their title (search.js); then redraw
  import('./search.js?v=fad66359').then((m) => m.nameCodedTasks?.(tasks)).then((n) => n && draw()).catch((e) => console.error(e));
  const want = taskKey(Q.get('task'), index);
  if (want && index.has(want)) openTask(ex, index.get(want), runs);
}

/* ------------------------------------------------------------------------------------------------ pages */

/** The suites the exam's team built and releases with the exam (owners, 2026-10-18): first everywhere, in this order,
 *  each with the EFE Original tag beside its name. */
const OUR_RELEASE = ['robopaint', 'roboarc', 'pandadyn', 'embodied-olympics-fun', 'embodied-olympics-match', 'dexhand', 'roboengineer', 'embodied-safety-exam', 'ispatialgym'];   // the nine original suites (owner, 2026-10-19)
const isOurs = (s) => OUR_RELEASE.includes(s?.id);
// beside the name, small (nameTag), and on the picture's top right corner, as a frosted chip (owners, 2026-10-18)
const nameTag = (s) => (isOurs(s) ? `<span class="name-tag" title="Built by the Embodied First Exam team and released with the exam"><i aria-hidden="true">✦</i>EFE Original</span>` : '');
const releaseTag = (s, big = false) => (isOurs(s)
  ? `<span class="rel-tag${big ? ' big' : ''}" title="Built by the Embodied First Exam team and released with the exam"><i aria-hidden="true">✦</i>EFE Original</span>` : '');

function prepare(ex) {
  // the team's own suites first, then the others, each group in alphabetical order (owners, 2026-10-19); an example last
  const group = (s) => (s.example ? 2 : isOurs(s) ? 0 : 1);
  ex.suites = [...ex.suites].sort((a, b) => group(a) - group(b) || a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
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
  const gap = phone ? 10 : 12;
  // tiles a little larger on big screens if the pool would otherwise run short: every scene appears once
  let tw = Math.round(Math.max(130, Math.min(320, innerWidth * (phone ? 0.3 : 0.13))));
  let n, per;
  const fit = () => {
    wall.style.setProperty('--tw', `${tw}px`);
    n = Math.max(3, Math.ceil(wall.offsetWidth / (tw + gap)) + 1);
    // a column's period must be at least the wall's height, or its end shows before it wraps
    per = Math.ceil(wall.offsetHeight / (tw * 0.75 + gap)) + 1;
  };
  wall.style.setProperty('--wg', `${gap}px`);
  fit();
  while (n * per > tiles.length * 1.5 && tw < 320) { tw = Math.round(tw * 1.08); fit(); }
  // Deal the scenes column by column so that look-alikes stay apart while the columns drift past each other. Suites
  // that look the same (the three RoboCasa kitchens, the two RoboPaints) count as one group. A group appears at most
  // once in a column (a column only ever moves as a whole, so this holds at every moment), and as rarely as possible in
  // the columns next to it (which drift the other way and pass every tile of it) and two or three over.
  const groupOf = (t) => LOOKALIKE[t.suite] || t.suite;
  const pools = new Map();
  tiles.forEach((t) => { const g = groupOf(t); if (!pools.has(g)) pools.set(g, []); pools.get(g).push(t); });
  const centreKey0 = ex.hero?.centre || '';
  for (const [g, list] of pools) {   // a fresh order of every suite's scenes on each visit; the centre scene stays first
    for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
    const ci = list.findIndex((t) => `${t.suite}/${t.id}` === centreKey0);
    if (ci > 0) list.unshift(list.splice(ci, 1)[0]);
  }
  const groups = [...pools.keys()];
  const size = new Map(groups.map((g) => [g, pools.get(g).length]));   // a suite with more scenes shows proportionally more often
  const shownP = new Map();   // how often each suite is on the playing side: there, every suite takes its turn (RoboARC twice as often)
  const cols = Array.from({ length: n }, () => []);
  const shown = new Map();
  const uses = (c) => new Set((cols[c] || []).map(groupOf));
  // The open part of the hero, right of the title, is dealt first, so the suites that lead the order (hero.order: our
  // own, with every task replayed) are the first thing people see; then the columns further from it.
  const frontOrder = (ex.hero?.front || []).map((s) => LOOKALIKE[s] || s);
  const front = new Set(frontOrder);
  // suites kept to the left, behind the title (hero.back); the columns right of the middle are where tiles play
  const back = new Set((ex.hero?.back || []).map((s) => LOOKALIKE[s] || s));
  const centreSuite = (ex.hero?.centre || '').split('/')[0];
  const leadOrder = new Map();
  // a fresh order on every visit; `first`, when given, leads
  const shuffle = (a, first) => { const o = a.filter((x) => x !== first); for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return first && a.includes(first) ? [first, ...o] : o; };
  const wr = wall.getBoundingClientRect();
  const focus = phone ? innerWidth / 2 : innerWidth * 0.72;
  const colX = (c) => wr.left + c * (tw + gap) + tw / 2;
  const seq = [...cols.keys()].sort((a, b) => Math.abs(colX(a) - focus) - Math.abs(colX(b) - focus));
  // the columns dealt first gather the showcase suites, the later ones the suites kept back; the columns are placed on
  // screen by what they hold once their positions are measured (below)
  const playing = (c) => !phone && seq.indexOf(c) < Math.ceil(seq.length * 0.55);
  for (const c of seq) {
    const near = [1, 2, 3].map((d) => new Set([...uses(c - d), ...uses(c + d)]));
    for (let r = 0; r < per; r++) {
      const here = uses(c);
      let left = groups.filter((g) => pools.get(g).length);
      // the two columns people see first lead with the front suites (hero.front), one scene of each
      // on the playing side RoboARC sits only in the centre column and the third (at most two on screen, none still)
      if (playing(c) && seq.indexOf(c) !== 0 && seq.indexOf(c) !== 2) left = left.filter((g) => g !== centreSuite);
      // the two lead columns: one scene of each front suite, in an order shuffled anew on every visit (the first column
      // opens with the centre scene's suite), never next to the same suite in the other lead column
      const isLead = c === seq[0] || c === seq[1];
      const other = c === seq[0] ? cols[seq[1]] : cols[seq[0]];
      const besideOther = (g) => [r - 1, r, r + 1].some((k) => other && other[k] && groupOf(other[k]) === g);
      const fr = isLead ? left.filter((g) => front.has(g) && !here.has(g)) : [];
      if (fr.length) {
        const ord = leadOrder.get(c) ?? (leadOrder.set(c, shuffle(frontOrder, c === seq[0] ? centreSuite : '')), leadOrder.get(c));
        const g = [...fr].sort((a, b) => (besideOther(a) - besideOther(b)) || (ord.indexOf(a) - ord.indexOf(b)))[0];
        cols[c].push(pools.get(g).shift());
        shown.set(g, (shown.get(g) || 0) + 1);
        if (playing(c)) shownP.set(g, (shownP.get(g) || 0) + 1);
        continue;
      }
      if (!left.length) { tiles.forEach((t) => pools.get(groupOf(t)).push(t)); left = groups; }   // a screen too large for the pool
      // when only RoboARC is left the other suites' scenes come round again, rather than a column of RoboARC alone
      if (centreSuite && left.every((g) => g === centreSuite)) {
        tiles.forEach((t) => { if (groupOf(t) !== centreSuite) pools.get(groupOf(t)).push(t); });
        left = groups.filter((g) => pools.get(g).length);
      }
      // every group gets its turn: the fewer times a group is on the wall so far, the sooner it comes next; ties go to the
      // group that leads the order
      // where tiles play, the showcase suites (hero.front) come first and hero.back never shows; behind the title, the rest
      // a look-alike group (the kitchens) counts as front when any of its suites is: front wins over back
      const place = (g) => (playing(c) ? (front.has(g) ? 0 : back.has(g) ? 800 : 40) : (front.has(g) ? 30 : back.has(g) ? 0 : 10));
      // RoboARC sits in two columns only (the centre one and the third), so at most two of it are on screen at once and
      // none of them stands still waiting for a turn to play
      const rare = () => 0;
      // a suite with many distinct scenes (RoboARC) may sit in neighbouring columns and twice in one column
      const cost = (g) => {
        // behind the title a suite with many distinct scenes (RoboARC) may sit in neighbouring columns and twice in a column
        const big = false, inCol = cols[c].filter((t) => groupOf(t) === g).length, soft = big ? 0.25 : 1;
        const nk = playing(c) ? 4 : 1;   // where tiles play, neighbouring columns keep apart much more strongly
        return (inCol && (!big || inCol >= 2) ? 1000 : inCol ? 90 : 0) + rare(g)
          + soft * nk * ((near[0].has(g) ? 60 : 0) + (near[1].has(g) ? 36 : 0) + (near[2].has(g) ? 14 : 0))
          + (playing(c) ? (shownP.get(g) || 0) * 120 : ((shown.get(g) || 0) / size.get(g)) * 150) + place(g) + Math.random() * 6;
      };
      const g = left.reduce((a, b) => (cost(b) < cost(a) ? b : a));
      cols[c].push(pools.get(g).shift());
      shown.set(g, (shown.get(g) || 0) + 1);
      if (playing(c)) shownP.set(g, (shownP.get(g) || 0) + 1);
    }
  }
  const tile = (t) => {
    const s = ex._suites[t.suite];
    const crop = cropFor(t.suite, t.id) ? ` class="${cropFor(t.suite, t.id)}"` : '';
    const video = t.video && !phone && !still ? `<video muted loop playsinline preload="none" data-src="${esc(site(t.video))}"${crop}></video>` : '';
    return `<a class="wt" data-suite="${esc(t.suite)}" href="${exam('tasks/')}?task=${encodeURIComponent(`${t.suite}/${t.id}`)}" tabindex="-1">
      <img src="${esc(site(t.poster))}" alt="" loading="lazy" decoding="async"${crop}>${video}
      <span class="tag">${esc(s?.code || '')}</span><span class="ttl">${esc(s?.name || '')} · ${esc(t.title)}</span></a>`;
  };
  const durs = [92, 76, 100, 84, 108, 72, 96, 80];
  let lead = new Set([seq[0], seq[1]]);
  const render = () => {
    wall.innerHTML = cols.map((c, i) => {
      const html = c.map(tile).join('');
      const dur = durs[i % durs.length];
      // the front columns start at their top, where the front suites' scenes are
      const delay = lead.has(i) ? 0 : ((i * 37) % 100) / 100 * dur;
      return `<div class="wall-col${i % 2 ? ' down' : ''}" style="--dur:${dur}s;--delay:-${delay}s">${html}${html}</div>`;
    }).join('');
    // a column moves one copy of itself per loop: its duration follows its length, so every column drifts at about the
    // speed of the old wall (some 9 px/s, a little faster or slower per column)
    $$('.wall-col', wall).forEach((el, i) => { const half = el.offsetHeight / 2; if (half > 0) el.style.setProperty('--dur', `${(half / 9 * durs[i % durs.length] / 84).toFixed(1)}s`); });
  };
  render();
  // The wall is tilted, so where a column shows on screen is measured rather than computed: the front columns move to
  // the two places nearest the open part of the hero.
  if (front.size && !phone) {
    const shownX = (el) => {
      const xs = [...el.querySelectorAll('.wt')].map((t) => t.getBoundingClientRect())
        .filter((r) => r.bottom > 0 && r.top < innerHeight).map((r) => r.left + r.width / 2);
      return xs.length ? xs.reduce((a, b) => a + b) / xs.length : Infinity;
    };
    // Where each column shows on screen (measured: the wall is tilted). The columns are then placed by what they hold:
    // the two lead columns (the front suites, one each) nearest the open part of the hero, then the columns richest in
    // showcase suites (hero.front) on the rest of the playing side, and those with the suites kept back (hero.back) on
    // the left, behind the title.
    const xs = $$('.wall-col', wall).map(shownX);
    // the slots in the order they get columns: the playing side nearest the open part first (those past the right edge,
    // which the tilt still shows in part, after the rest of it), then the left, farthest left last
    const rank = (x) => (x >= innerWidth * 0.46 ? Math.abs(x - focus) : 1e4 + (innerWidth * 0.46 - x));
    const slots = [...cols.keys()].sort((a, b) => rank(xs[a]) - rank(xs[b]));
    const score = (col) => { const seenG = new Set(); return col.reduce((n, t) => { const g = LOOKALIKE[t.suite] || t.suite; const first = !seenG.has(g); seenG.add(g); return n + (g === centreSuite ? (t.suite + '/' + t.id === (ex.hero?.centre || '') ? 50 : -8) : front.has(g) ? (first ? 1 : 0.5) : back.has(g) ? -3 : 0); }, 0); };
    const leadCols = [seq[0], seq[1]].map((i) => cols[i]);
    const others = cols.filter((_, i) => i !== seq[0] && i !== seq[1]).sort((p, q) => score(q) - score(p));
    const placed = [...leadCols, ...others];
    const next = new Array(cols.length);
    slots.forEach((slot, k) => { next[slot] = placed[k]; });
    next.forEach((c, i) => { cols[i] = c; });
    lead = new Set(slots.slice(0, 2));
    render();
    // Start each front column where its front scenes sit in the open part of the hero: try phases and keep the best.
    // The second column favours the front suites the first does not show, and the first front suite counts a little more.
    const order = ex.hero?.front || [];
    const frontEl = (el) => front.has(LOOKALIKE[el.dataset.suite] || el.dataset.suite);
    const inView = (el) => {
      const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      return x > innerWidth * 0.5 && x < innerWidth && y > innerHeight * 0.1 && y < innerHeight * 0.9;
    };
    // The phases are set once the wall is laid out: before that its columns have no height, so no phase moves anything.
    const align = () => {
      const seen = new Set();
      // hero.centre: the scene that opens in the middle of the playing side (owners, 2026-10-18). Its column takes the slot
      // nearest the open part, and starts where that scene sits at the centre of it.
      // a column's phase, set on its running animation (a changed --delay is not measurable in the same frame)
      const phase = (col, d) => { const a = col.getAnimations?.()[0]; if (a) a.currentTime = d * 1000; else col.style.setProperty('--delay', `-${d}s`); };
      const centreKey = ex.hero?.centre || '';
      const centreSel = centreKey ? `.wt[href$="task=${encodeURIComponent(centreKey)}"]` : '';
      const centreAt = () => {
        const hc = centreSel && wall.querySelector(centreSel);
        if (!hc) return;
        let ci = $$('.wall-col', wall).indexOf(hc.closest('.wall-col'));
        if (ci !== slots[0]) {   // swap it into the slot nearest the open part
          [cols[ci], cols[slots[0]]] = [cols[slots[0]], cols[ci]];
          lead = new Set([slots[0], ...[...lead].filter((x) => x !== slots[0] && x !== ci), ...(lead.has(ci) ? [] : [])]);
          render();
          ci = slots[0];
        }
        const col = $$('.wall-col', wall)[ci], dur = (col.getAnimations?.()[0]?.effect.getTiming().duration || durs[ci % durs.length] * 1000) / 1000;
        const tx = focus, ty = innerHeight * (col.classList.contains('down') ? 0.3 : 0.62);
        let bestD = 0, bestE = Infinity;
        for (let k = 0; k < 96; k++) {
          const d = (k / 96) * dur;
          phase(col, d);
          const e = Math.min(...$$(centreSel, col).map((el) => { const r = el.getBoundingClientRect(); return Math.hypot(r.left + r.width / 2 - tx, r.top + r.height / 2 - ty); }));
          if (e < bestE) { bestE = e; bestD = d; }
        }
        phase(col, bestD);
        return ci;
      };
      const centreCol = centreAt();
      [...lead].filter((i) => i !== centreCol).forEach((i) => {
        const col = $$('.wall-col', wall)[i];
        const dur = (col.getAnimations?.()[0]?.effect.getTiming().duration || durs[i % durs.length] * 1000) / 1000;
        let bestD = 0, bestN = -1;
        for (let k = 0; k < 32; k++) {
          const d = (k / 32) * dur;
          phase(col, d);
          const n = $$('.wt', col).filter((el) => frontEl(el) && inView(el))
            .reduce((a, el) => a + (seen.has(el.dataset.suite) ? 1 : 2) + (el.dataset.suite === order[0] && !seen.has(el.dataset.suite) ? 1.5 : 0), 0);
          if (n > bestN) { bestN = n; bestD = d; }
        }
        phase(col, bestD);
        $$('.wt', col).filter((el) => frontEl(el) && inView(el)).forEach((el) => seen.add(el.dataset.suite));
      });
    };
    let tries = 0;
    const whenLaidOut = () => { if ($('.wall-col', wall)?.offsetHeight > innerHeight || ++tries > 60) align(); else requestAnimationFrame(whenLaidOut); };
    requestAnimationFrame(whenLaidOut);
  }
  if (!phone && !still) {
    // play every tile in the open right part of the wall (the left part sits under the title's veil): eight to eleven
    // are there at a time, so all of them move; past twelve, the front suites' tiles go first. Whenever a tile comes or
    // goes, the set is worked out again, so no tile in the open part stays still waiting for another to leave.
    const isFront = (el) => front.has(LOOKALIKE[el.dataset.suite] || el.dataset.suite);
    const inZone = new Set();
    // at most two RoboARC tiles play at a time
    const centreSel0 = ex.hero?.centre ? `.wt[href$="task=${encodeURIComponent(ex.hero.centre)}"]` : '';
    const PER_SUITE = (sid) => (sid === 'roboarc' ? 2 : 99);   // RoboARC: two at a time (owners, 2026-10-18); the dealing keeps the rest apart
    const schedule = () => {
      const per = new Map(), pick = [];
      const isCentre = (el) => !!centreSel0 && el.matches(centreSel0);
      for (const t of [...inZone].sort((a, b) => isCentre(b) - isCentre(a) || isFront(b) - isFront(a))) {
        const n = per.get(t.dataset.suite) || 0;
        if (n >= PER_SUITE(t.dataset.suite) || pick.length >= 30) continue;
        per.set(t.dataset.suite, n + 1); pick.push(t);
      }
      const want = new Set(pick);
      $$('.wt.playing', wall).forEach((t) => { if (!want.has(t)) { $('video', t).pause(); t.classList.remove('playing'); } });
      want.forEach((t) => {
        if (t.classList.contains('playing')) return;
        const v = $('video', t);
        if (!v.src) v.src = v.dataset.src;
        t.classList.add('playing');
        v.play().catch(() => t.classList.remove('playing'));
      });
    };
    const onSee = (es) => {
      es.forEach((e) => (e.isIntersecting ? inZone.add(e.target) : inZone.delete(e.target)));
      schedule();
    };
    // a tile plays once a third of it is in the open part
    const io = new IntersectionObserver(onSee, { rootMargin: '0px 0px 0px -46%', threshold: 0.35 });
    $$('.wt', wall).forEach((t) => { if ($('video', t)) io.observe(t); });
  }
  // stop the drift while the first screen is out of sight
  new IntersectionObserver(([e]) => wall.classList.toggle('paused', !e.isIntersecting)).observe($('.hero-wall'));
}

/** The inner pages' heads: a small, quiet copy of the first screen's wall on the right, pictures only, so the title
 *  sits on the same paper as the home page's. Each page deals the scenes in its own order; a phone gets none. */
function headWall(ex) {
  const head = $('.page-head');
  const tiles = ex.hero?.tiles || [];
  if (!head || PAGE === 'suite' || PAGE === 'run' || !tiles.length || innerWidth < 760) return;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // a page's own order: a seeded shuffle, then look-alikes spread apart
  let seed = [...PAGE].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const pool = tiles.map((t) => [rnd(), t]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  const n = 6, per = 8;
  const cols = Array.from({ length: n }, (_, c) => pool.slice(c * per, c * per + per));
  const tile = (t) => {
    const s = ex._suites[t.suite];
    const crop = cropFor(t.suite, t.id) ? ` class="${cropFor(t.suite, t.id)}"` : '';
    return `<a class="wt" href="${exam('tasks/')}?task=${encodeURIComponent(`${t.suite}/${t.id}`)}" tabindex="-1">
      <img src="${esc(site(t.poster))}" alt="" loading="lazy" decoding="async"${crop}>
      <span class="tag">${esc(s?.code || '')}</span><span class="ttl">${esc(s?.name || '')} · ${esc(t.title)}</span></a>`;
  };
  const durs = [150, 124, 168, 136, 176, 118];
  head.insertAdjacentHTML('afterbegin', `<div class="head-paper" aria-hidden="true"></div><div class="head-deco" aria-hidden="true">
    <div class="wall head-wall${still ? ' paused' : ''}">${cols.map((c, i) => {
      const html = c.map(tile).join('');
      return `<div class="wall-col${i % 2 ? ' down' : ''}" style="--dur:${durs[i]}s;--delay:-${((i * 37) % 100) / 100 * durs[i]}s">${html}${html}</div>`;
    }).join('')}</div></div>`);
  const wall = $('.head-wall', head);
  // the wall fades in only past the end of the title and the lead, measured on their text (a long title takes more)
  const clear = () => {
    const r = document.createRange();
    const right = Math.max(0, ...$$('h1, .lead, .kicker', head).map((el) => { r.selectNodeContents(el); return r.getBoundingClientRect().right; }));
    head.style.setProperty('--clear', `${Math.round(right + 48)}px`);
  };
  clear();
  addEventListener('resize', clear);
  document.fonts?.ready.then(clear);
  new IntersectionObserver(([e]) => wall.classList.toggle('paused', still || !e.isIntersecting)).observe(head);
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
  cloud: '<path d="M7 18.5h10.5a4 4 0 0 0 .6-8 6 6 0 0 0-11.5-1.4A4.5 4.5 0 0 0 7 18.5z"/>',
  camera: '<rect x="2.5" y="6.5" width="19" height="13" rx="3"/><path d="M8.5 6.5l1.5-2.5h4l1.5 2.5"/><circle cx="12" cy="13" r="3.4"/>',
  code: '<path d="M8.5 7.5L4 12l4.5 4.5M15.5 7.5L20 12l-4.5 4.5M13.5 5l-3 14"/>',
  net: '<circle cx="5" cy="7" r="1.8"/><circle cx="5" cy="17" r="1.8"/><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/><circle cx="19" cy="12" r="1.8"/><path d="M6.7 7.6l3.6 3.6M6.7 6.4l3.6-1M6.7 16.4l3.6-3.6M6.7 17.6l3.6 1M13.8 5.7l3.6 5.4M13.8 12h3.4M13.8 18.3l3.6-5.4"/>',
  mix: '<path d="M3 7h4c4 0 6 10 10 10h4M3 17h4c4 0 6-10 10-10h4"/><path d="M18.5 4.5L21 7l-2.5 2.5M18.5 14.5L21 17l-2.5 2.5"/>',
  wave: '<path d="M2.5 12c2-5 4-5 6 0s4 5 6 0 4-5 6.5 0"/>',
  eyeoff: '<path d="M3 12s3.5-6.5 9-6.5S21 12 21 12s-3.5 6.5-9 6.5S3 12 3 12z"/><circle cx="12" cy="12" r="2.8"/><path d="M4 4l16 16"/>',
  podium: '<path d="M3 20.5h18M5 20.5v-6h4v6M10 20.5V9h4v11.5M15 20.5v-8h4v8"/><path d="M12 3.5l.9 1.8 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z"/>',
};

/** How a question is marked, as a stack of layers inside Harbor: the model, the harness, the agent's code, the interface
 *  (standard: the robot API behind a locked wall; privileged: the simulator's API), the simulators. The question enters
 *  twice (its goal is the harness's prompt, its frozen scene is loaded into the simulator); the verifier marks what the
 *  interface recorded. One row style, colour only for the two modes; details in the tooltips. */
function flowDiagram(el, ex) {
  if (!el) return;
  const t = ex?.totals || {};
  const ic = (n, cls = '') => `<svg class="fx-ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${FF_ICONS[n]}</svg>`;
  const run = (slug) => `${exam('run/')}?r=${encodeURIComponent(slug)}`;
  const way = (k) => `<a class="fx-way" href="${run(WAYS[k].slug)}" data-way="${k}" title="${esc(WAYS[k].def || WAYS[k].line)} Click to see it in a real run.">${esc(WAYS[k].tab)}</a>`;
  const layer = (row, name, icon, body, tip, cls = '') => `<div class="fx-layer ${cls}" style="grid-row:${row}" title="${esc(tip)}"><span class="fx-ln">${ic(icon)}${name}</span><div class="fx-lb">${body}</div></div>`;
  const sims = ['MuJoCo', 'Isaac Sim', 'OmniGibson', 'SAPIEN', 'Genesis'];
  const soa = (k) => `<span class="fx-soa"><i>s<sub>${k}</sub></i><i>o<sub>${k}</sub></i><i>a<sub>${k}</sub></i></span>`;
  el.innerHTML = `<div class="fx"><span class="fx-tag">Harbor · one command</span>
    <div class="fx-grid">
      <div class="fx-qcard" style="grid-row:1 / 6"></div>
      <div class="fx-qh" style="grid-row:1"><b>${ic('snow')}Question</b></div>
      <div class="fx-in fx-goal" style="grid-row:2 / 4" title="The goal written for a person, with every convention the agent cannot guess (frames, units, the action layout, the time limit): the harness’s prompt">
        <span class="fx-ih">${ic('doc')}goal in words</span>
        <q>Completely separate the two claw pieces and briefly hold both still.</q></div>
      <i class="fx-arrow" style="grid-row:2"></i>
      <div class="fx-in fx-scene" style="grid-row:4 / 6" title="A simulation scene rebuilt bit for bit and checked against its starting state">
        <span class="fx-ih">${ic('cube')}frozen scene</span>
        <img src="${esc(site('media/ways/scene_start.jpg?v=bcb9718e'))}" alt="The scene at the start: two arms hold two interlocked claw pieces, orange and teal" loading="lazy">
        <ul class="fx-checks"><li>rebuilt bit for bit</li><li>start state checked</li><li>same scene in both modes</li></ul></div>
      <i class="fx-arrow" style="grid-row:5"></i>
      ${layer(1, 'Model', 'cloud', `${['gpt', 'claude', 'gemini', 'qwen', 'deepseek', 'kimi'].map((m) => makerMark(m)).join('')}<span class="fx-more">any model</span>`, 'Any model the harness can call, through its API')}
      ${layer(2, 'Harness', 'terminal', `<span class="fx-pick">${makerMark('gpt')}Codex</span><span class="fx-pick">${makerMark('claude')}Claude Code</span><span class="fx-more">any harness</span>`, 'The agent program, unchanged; the task is its prompt; web search off')}
      ${layer(3, `<span class="fx-lname">Coding agents<small>as policy</small></span>`, 'code', `${WAY_ORDER.map(way).join('')}<span class="fx-way fx-etc" aria-hidden="true">…</span>`, 'The coding agent is the policy: what it writes turns what the robot senses into actions')}
      <div class="fx-iface" style="grid-row:4">
        <span class="fx-ln">${ic('layers')}Interface<small>how the code reaches the robot, per mode</small></span>
        <div class="fx-mode s" data-rt="standard" role="button" tabindex="0" title="Standard, the exam. The robot runs in a service the agent cannot open; the eai-standard protocol is the only way in: /spec declares the action types, /observe returns images, depth and proprioception, /submit runs one chunk of actions (a float32 array of shape (T, dim), rows dt apart, at most max_chunk_s), /kinematics answers FK and IK. Never given: object poses, segmentation, contact forces, the success checker.">
          <div class="fx-mh"><span class="fx-lock">${ic('lock')}</span><b>Standard</b><em data-rt="realtime" title="Real-time variant: the clock never stops">${ic('clock')}real-time</em></div>
          <dl><div><dt>reach</dt><dd><span class="fx-pipe" title="The agent’s code reaches the simulator only through the eai-standard API: /spec, /observe, /submit, /kinematics"><i class="b">${ic('code')}</i><i class="ln"></i><i class="api">${ic('lock')}API</i><i class="ln"></i><i class="b">${ic('cube')}</i></span><small>robot API only</small></dd></div>
            <div><dt>sees</dt><dd><span class="fx-chips"><i>${ic('camera')}RGB</i><i>${ic('layers')}depth</i><i>${ic('arm')}joints</i></span><small title="Never given: object poses, segmentation, contact forces, the success checker">no object poses</small></dd></div>
            <div><dt>sends</dt><dd><span class="fx-chunk" title="joint_position or ee_pose rows, dt apart: a (T, dim) array per /submit" aria-hidden="true">${'<i></i>'.repeat(15)}</span><small>action chunks <code>(T, dim)</code></small></dd></div></dl>
          <span class="fx-how">How it runs underneath →</span>
        </div>
        <div class="fx-mode p" data-rt="privileged" role="button" tabindex="0" title="Privileged, the reference. Agent and simulator share one container; the suite’s own tooling gives the simulator’s full state and unlimited resets. The deliverable is /app/output/trajectory.npz, or code for a policy task; it is replayed in a fresh simulator.">
          <div class="fx-mh"><span class="fx-lock p">${ic('cube')}</span><b>Privileged</b></div>
          <dl><div><dt>reach</dt><dd><span class="fx-pipe p" title="Agent and simulator share one container; the suite’s own tools"><i class="b both">${ic('code')}${ic('cube')}</i></span><small>inside the simulator</small></dd></div>
            <div><dt>sees</dt><dd><span class="fx-chips p"><i>${ic('cube')}full state</i><i>${ic('replay')}resets ∞</i></span><small>everything, at will</small></dd></div>
            <div><dt>sends</dt><dd><span class="fx-file" title="The same action space, delivered as /app/output/trajectory.npz (or code for a policy task), replayed in a fresh simulator">${ic('doc')}trajectory.npz</span><small>replayed fresh</small></dd></div></dl>
          <span class="fx-how">How it runs underneath →</span>
        </div>
      </div>
      ${layer(5, `<span class="fx-lname">Simulators<small>${int(t.robots || 40)} robots</small></span>`, 'cube', `${sims.map((x) => `<span class="fx-sim">${x}</span>`).join('')}`, 'Each suite’s original simulation setup, behind the same interface')}
      <i class="fx-arrow out" style="grid-row:4"><em>recorded</em></i>
      <div class="fx-ver" title="Its own sandbox, no network">
        <span class="fx-vh">${ic('shield')}Verifier</span>
        <div class="fx-vi" title="Its own sandbox, no network; it sees only the trajectory">${ic('sandbox')}sandbox</div>
        <div class="fx-vi s" title="Standard: the service judges the live episode it ran">${ic('rec', 's')}live verdict</div>
        <div class="fx-vi p" title="Privileged: the trajectory replayed in a fresh simulator from the frozen start">${ic('replay', 'p')}replay</div>
        <div class="fx-res"><b>1</b><span>0</span></div>
        <div class="fx-rec" title="Every step, its tokens and cost, and a video">${ic('log')}steps · cost · video</div>
      </div>
      <button type="button" class="fx-traj" title="The episode, step by step: the simulator's state, what the robot observed and the action it took (privileged mode reads the state; the standard settings see only the observation). Click for an example.">
        <span class="fx-vh">${ic('traj')}Episode trajectory</span>
        <span class="fx-pomdp">recorded step by step</span>
        <span class="fx-seq">${soa(0)}<b>→</b>${soa(1)}<b>→</b><span class="fx-dots">…</span></span>
        <span class="fx-legend"><span><i>s</i>simulator state</span><span><i>o</i>RGB(-D)</span><span><i>a</i>action</span></span>
        <img class="fx-obs" src="${esc(site('media/ways/traj_frame.jpg?v=3bf6e22a'))}" title="Rendered from the reference solution" alt="Mid-episode: the two claw pieces sliding apart" loading="lazy">
        <span class="fx-ex">See an example →</span>
      </button>
    </div>
  </div>`;
  $$('.fx-way[data-way]', el).forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); wayDemo(a.dataset.way, a); }));
  $('.fx-traj', el).addEventListener('click', (e) => trajDemo(e.currentTarget));
  const rt = (e) => { const m = e.target.closest('[data-rt]'); if (m) runtimeDemo(m.dataset.rt, m.closest('.fx-mode')); };
  $$('.fx-mode', el).forEach((m) => {
    m.addEventListener('click', rt);
    m.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); rt(e); } });
  });
}

/** Opens one of the page's dialogs (an .ol-modal) growing from the element that asked; Escape, a click on the fog or
 *  the close button closes it and gives the focus back. */
function showModal(dlg, opener) {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const onClick = (e) => { if (!e.target.closest('.ol-card') || e.target.closest('.ol-x')) close(); };
  function close() {
    dlg.classList.remove('on');
    document.documentElement.classList.remove('ol-lock');
    removeEventListener('keydown', onKey);
    dlg.removeEventListener('click', onClick);
    setTimeout(() => { if (!dlg.classList.contains('on')) dlg.hidden = true; }, still ? 0 : 320);
    opener?.focus({ preventScroll: true });
  }
  dlg.hidden = false;
  const card = $('.ol-card', dlg), b = opener?.getBoundingClientRect(), c = card.getBoundingClientRect();
  if (b) card.style.transformOrigin = `${b.left + b.width / 2 - c.left}px ${b.top + b.height / 2 - c.top}px`;
  document.documentElement.classList.add('ol-lock');
  requestAnimationFrame(() => dlg.classList.add('on'));
  addEventListener('keydown', onKey);
  dlg.addEventListener('click', onClick);
}

/** How a trial runs underneath, per mode, as the protocol (docs/protocol on main) has it: the containers of one trial,
 *  what each holds, what crosses between them, what happens when the time is up, and how the verifier decides. */
const RT_MON = '<code>rcb_monitor</code> sidecar: samples CPU, memory and GPU, and shows the agent its clock in <code>/run/rcb-limits/usage.json</code> (read-only)';
const RT_NET = 'Out of the agent’s container: the model’s API (through the usage gateway) and the package registries (PyPI, apt), nothing else. GitHub, Hugging Face and the web do not answer.';
const RUNTIME = {
  standard: {
    tab: 'Standard', proto: 'eai-standard/2.x · robot as a service',
    lead: 'The exam’s own mode. The simulator runs in a sidecar container the agent cannot open; the agent drives the robot over HTTP, as it would drive a real one, and the sidecar marks the episode it ran.',
    agent: ['the harness (Codex, Claude Code, …) calling its model', 'everything the agent writes: controller, planner, any model it trains', 'the shipped client, <code>rcb_client.py</code>', 'no simulator, no scene, no simulation code'],
    link: ['/spec', '/observe', '/submit', '/kinematics'],
    sim: ['the simulator, the frozen scene, the seed and the success checker', 'checks the start state when the episode begins and after every reset', 'runs each chunk of actions; resets within the budget <i>N</i>', 'keeps a journal of every call'],
    stop: ['every process the agent left running is killed (<code>kill -9 -1</code>)', 'the monitor seals its record', 'the sidecar refuses any more physics and finalizes the episode: <code>final.json</code>, the journal, the trajectory'],
    verify: ['receives only the sidecar’s evidence', 'transcribes its verdict on the live episode: <code>graded_by_live = 1</code>, no replay', 'writes <code>reward.txt</code> (1 or 0) and <code>reward.json</code>', 'renders the video after the verdict, never from it'],
  },
  realtime: {
    tab: 'Standard · real-time', proto: 'eai-standard/2.3 · a clock that does not stop',
    lead: 'Standard mode in real time. Once the episode starts the robot keeps moving whatever the agent is doing, so the agent’s controller has to run as a program in its own container, not as a chat.',
    agent: ['the harness calling its model', 'the agent’s controller: a program in this container that streams action chunks and reads observations', 'the shipped client, <code>rcb_client.py</code>', 'no simulator, no scene, no simulation code'],
    link: ['/spec', '/observe', '/submit', '/kinematics'],
    sim: ['the simulator, the frozen scene, the seed and the success checker', 'runs at 1/<i>S</i> of real speed from the first action, whatever the agent does', 'holds the last targets while the agent thinks', 'resets within the budget (10 by default); a journal of every call'],
    stop: ['every process the agent left running is killed (<code>kill -9 -1</code>)', 'the monitor seals its record', 'the sidecar refuses any more physics and finalizes the episode: <code>final.json</code>, the journal, the trajectory'],
    verify: ['receives only the sidecar’s evidence', 'transcribes its verdict on the live episode: <code>graded_by_live = 1</code>, no replay', 'writes <code>reward.txt</code> (1 or 0) and <code>reward.json</code>', 'renders the video after the verdict, never from it'],
  },
  privileged: {
    tab: 'Privileged', proto: 'open book · the reference',
    lead: 'The reference mode. Agent and simulator share one container: the agent reads the full simulator state, resets at will and plans offline. Only its deliverable leaves the container, and a fresh simulator replays it.',
    agent: ['the harness calling its model', 'the simulator, the frozen scene and the suite’s own tools', 'the full simulator state; resets at will', 'writes <code>/app/output/trajectory.npz</code>, or code for a policy task'],
    stop: ['the harness stops the agent', 'only <code>/app/output/</code> is collected; nothing else the agent did counts'],
    verify: ['empties <code>/logs/verifier</code>; drops links, pipes and devices from <code>/app/output</code>', 'rebuilds the frozen scene from its own byte-identical copy (another start state: no verdict, an infrastructure failure)', 'replays the trajectory in a fresh process, twice; the final-state hashes must match', 'judges success on the end state: <code>reward.txt</code> (1 or 0), <code>reward.json</code>', 'a policy task’s code runs as an unprivileged user, in its own process, with no network, unable to read the simulator or the grader'],
  },
};
const RT_RULES = ['one Docker Compose project per trial, run by Harbor', 'every image pinned: <code>eai-<em>suite</em>:<em>version</em></code>', 'the cutoff is wall-clock time, the same in both modes', 'one full retry for an infrastructure failure, nothing more', 'a verdict, once written, is never rewritten'];
let rtDlg;
function runtimeDemo(mode, opener) {
  const ic = (n) => `<svg class="fx-ic" viewBox="0 0 24 24" aria-hidden="true">${FF_ICONS[n]}</svg>`;
  const li = (a) => `<ul>${a.map((x) => `<li>${x}</li>`).join('')}</ul>`;
  const box = (cls, icon, name, tag, items, extra = '') => `<div class="rt-box ${cls}"><div class="rt-bh">${ic(icon)}<b>${name}</b><em>${tag}</em></div>${li(items)}${extra}</div>`;
  const body = (m) => {
    const r = RUNTIME[m], priv = m === 'privileged';
    const agent = box(priv ? 'agent p' : 'agent', 'terminal', 'Agent container', 'the agent is root here', r.agent);
    const inner = priv ? agent : `${agent}
      <div class="rt-link"><span class="rt-wire" aria-hidden="true"></span><b>HTTP</b><span class="rt-eps">${r.link.map((x) => `<code>${x}</code>`).join('')}</span><small>every other path: 404</small><span class="rt-trust">trust boundary</span></div>
      ${box('sim', 'shield', '<code>sim</code> sidecar', 'trusted', r.sim, '<p class="rt-bf">publishes no port; its volumes are <code>*_trusted</code>, never mounted by the agent</p>')}`;
    return `<p class="rt-lead"><span class="rt-proto">${r.proto}</span>${r.lead}</p>
      <div class="rt-flow${priv ? ' p' : ''}">
        <section class="rt-stage s1"><h4><i>1</i>The agent’s time<small>the cutoff, wall clock</small></h4>
          <div class="rt-host"><span class="rt-hl">${ic('net')}one trial’s Docker network</span>
            <div class="rt-row">${inner}</div>
            <div class="rt-mon">${ic('controls')}<span>${RT_MON}</span></div></div>
          <div class="rt-net">${ic('cloud')}<span>${RT_NET}</span></div></section>
        <span class="rt-arrow" aria-hidden="true"></span>
        <section class="rt-stage s2"><h4><i>2</i>Time is up</h4><ol>${r.stop.map((x) => `<li>${x}</li>`).join('')}</ol>
          ${priv ? '<p class="rt-cross">crosses to the verifier: <code>trajectory.npz</code> (or the policy code) only</p>' : '<p class="rt-cross">crosses to the verifier: the sidecar’s record only</p>'}</section>
        <span class="rt-arrow" aria-hidden="true"></span>
        <section class="rt-stage s3"><h4><i>3</i>Marking</h4>
          ${box('ver', 'sandbox', 'Verifier container', 'its own image · no network', r.verify)}
          <div class="rt-res"><b>1</b><span>0</span></div></section>
      </div>`;
  };
  if (!rtDlg) {
    rtDlg = document.createElement('div');
    rtDlg.className = 'ol-modal rt-modal';
    rtDlg.hidden = true;
    rtDlg.innerHTML = `<div class="ol-fog"></div>
      <div class="ol-card rt-card" role="dialog" aria-modal="true" aria-labelledby="rt-title">
        <button type="button" class="ol-x" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        <h3 id="rt-title">How a trial runs</h3>
        <div class="way-tabs rt-tabs" role="tablist">${Object.entries(RUNTIME).map(([k, r]) => `<button type="button" class="way-tab" role="tab" data-m="${k}">${esc(r.tab)}</button>`).join('')}</div>
        <div class="rt-body"></div>
        <div class="rt-rules">${RT_RULES.map((x) => `<span>${x}</span>`).join('')}</div>
        <div class="way-foot"><span>From the exam’s task protocol: the modes, the trust boundary, the verifier’s isolation.</span></div>
      </div>`;
    document.body.append(rtDlg);
    $('.rt-tabs', rtDlg).addEventListener('click', (e) => { const b = e.target.closest('[data-m]'); if (b) show(b.dataset.m); });
  }
  function show(m) {
    $$('.rt-tabs .way-tab', rtDlg).forEach((b) => { b.classList.toggle('on', b.dataset.m === m); b.setAttribute('aria-selected', b.dataset.m === m); });
    $('.rt-body', rtDlg).innerHTML = body(m);
  }
  show(mode);
  showModal(rtDlg, opener);
}

/** The episode as a POMDP trajectory, with one real example: what the state, the observation and the action are in a
 *  RoboTwin 2.0 run (standard mode). Opens as a dialog over a fogged page, like the other demos. */
let trajDlg;
function trajDemo(opener) {
  if (!trajDlg) {
    trajDlg = document.createElement('div');
    trajDlg.className = 'ol-modal traj-modal';
    trajDlg.hidden = true;
    trajDlg.innerHTML = `<div class="ol-fog"></div>
      <div class="ol-card traj-card" role="dialog" aria-modal="true" aria-labelledby="traj-title">
        <button type="button" class="ol-x" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        <h3 id="traj-title">Episode trajectory</h3>
        <p class="ol-sub">An episode is a partially observed Markov decision process: at every step <i>t</i> the simulator has a state <i>s<sub>t</sub></i>, the robot observes <i>o<sub>t</sub></i>, and the agent’s code sends an action <i>a<sub>t</sub></i>. The trajectory (<i>s<sub>0</sub>, o<sub>0</sub>, a<sub>0</sub></i>), (<i>s<sub>1</sub>, o<sub>1</sub>, a<sub>1</sub></i>), … is what the verifier marks.</p>
        <div class="traj-grid">
          <figure><span class="traj-k">s<sub>t</sub></span><b>State</b><p>The simulator’s full state: both claw pieces’ poses and velocities, both arms’ joints, every contact. It stays inside the simulator; in standard mode the agent never sees it.</p>
            <pre><code>pieces = claw_0, claw_1 (pose, velocity)
robot  = 2 × ALOHA arm (6 joints + gripper)
engine = MuJoCo 3.14, CPU float64
tick   = 2.5 ms, 10 ticks per control step</code></pre></figure>
          <figure><span class="traj-k">o<sub>t</sub></span><b>Observation</b><p>What the robot senses: an RGB image from each of its 4 cameras (480 × 848), z-depth on request, and its own state (72 proprioception columns).</p>
            <div class="traj-img"><img src="${esc(site('media/ways/obs_head.jpg?v=58e32b0f'))}" alt="The high camera's view: two arms hold the interlocked claws"><img src="${esc(site('media/ways/obs_front.jpg?v=3d817aff'))}" alt="The high camera later in the episode"></div>
            <small>the high camera at two moments, as the agent saw them; + depth (optional), + proprioception</small></figure>
          <figure><span class="traj-k">a<sub>t</sub></span><b>Action</b><p>What the simulator executes, in the robot’s own terms: <code>joint_position</code>, 14 numbers per row (6 joints and a gripper per arm), rows <i>dt</i> apart and streamed at 40 Hz with linear interpolation. Or <code>ee_pose</code>: 16 numbers per row, tool-frame targets solved by inverse kinematics.</p>
            <pre><code>A = rows of [q1 … q6, g | q1 … q6, g]   # (T, 14)
r.submit("joint_position", A, dt=0.1)</code></pre></figure>
        </div>
        <div class="way-foot"><span>RoboARC · Interlocked Claws 05 · standard · Codex · GPT-6 Astra</span><a class="btn small" href="${exam('run/')}?r=${encodeURIComponent('roboarc-interlocked-claws-05-i01-standard--vquy4fi')}">Watch the whole run <span class="arr">→</span></a></div>
      </div>`;
    document.body.append(trajDlg);
  }
  showModal(trajDlg, opener);
}

/** The four ways an agent answers, each shown by a real solved run: what the robot did (the run's replay, or for direct
 *  control what the agent saw) beside the agent's own words, quoted as it wrote them: a few lines of its code, or for
 *  direct control (`log`) the commands it typed and the looks it took, with their times in the run (owners, 2026-10-19:
 *  direct control = the agent itself sends the final actions, look by look; code to control = the agent writes a
 *  program that turns goals into actions through IK, planners or controllers and runs on its own). */
const WAY_ORDER = ['a', 'b', 'c'];   // the owner's order (2026-10-18): direct control, code to control, train a model to control
const wayMedia = (vid, ext) => site(`media/ways/${vid}.${ext}`);
const WAYS = {
  a: { tab: 'Direct Control', title: 'Direct control', def: 'The agent picks every action itself.', vid: 'a_put_bottles_cola_2k', aspect: '16 / 9',
    cap: 'This run, 06:00–08:45, every command marked',
    line: 'No controller is written in advance. The agent types one move or grip into a live robot session, looks at the camera image, and then picks the next target: 69 commands and 41 looks in 29 minutes.',
    slug: 'robotwin_2_0_put_bottles_dustbin-standard--ydhsp73', who: 'RoboTwin 2.0 · Put bottles in dustbin · standard · Codex · GPT-6 Astra',
    // steps 39-50 of the run; times are the steps' start times, a blank time is the same step as the row above
    log: { cap: 'The agent’s own commands and looks, 06:08–08:00', rows: [
      ['06:08', 'type', "move('r',[.102,.114,.88],qr,1)"],
      ['06:22', 'type', "grip('r',0)"],
      ['', 'look', 'world_camera1'],
      ['06:40', 'look', 'world_camera1, head_camera'],
      ['', 'type', "move('r',[.102,.114,1.04],qr,0)"],
      ['07:02', 'look', 'world_camera1, head_camera'],
      ['07:08', 'say', 'The cola bottle tipped during the grasp.'],
      ['07:24', 'look', 'world_camera1, front_camera, right_camera'],
      ['07:40', 'type', "points('front_camera',[(65,118),(85,109),…])"],
      ['', 'out', '(65,118) depth 0.786 → world [-.208 .332 .776]'],
      ['08:00', 'type', "move('r',[-.09,.325,.96],qdown,1)"]] } },
  b: { tab: 'Code to Control', title: 'Code to control', def: 'The agent writes the controller; IK and planners turn its goals into actions.',
    vid: 'b_bbq_sauce', cap: 'This run, replayed', step: 20,
    line: 'Its own inverse kinematics, straight-line moves between IK waypoints, and pick and place on top. From then on the agent names only goals, and its code turns them into all 614 actions, replayed twice in fresh simulators.',
    slug: 'robolab-bbq-sauce-in-bin-i00-privileged--4pbsnmo', who: 'RoboLab · BBQ sauce in bin · privileged · Claude Code · Claude Opus 5.5',
    code: `def ik(pos, q):
    seed = list(s.hold_action()[:7])
    r = s.kinematics({"op":"ik","targets":{"tcp": list(pos)+list(q)},"seed":seed})
    ...
def line(pos, q, step=0.01, max_dq=0.02, settle=8):
    ...
    for i in range(1, n+1):
        p["move_joints"](ik(cur+(pos-cur)*i/n, q), max_dq=max_dq)
def pick(xy, z_grasp, yaw=0.0, z_above=0.25):
    ...
    line([x, y, z_grasp], q)
    p["close_gripper"](20)` },
  c: { tab: 'Train Model to Control', title: 'Train a model to control', def: 'The agent trains a policy that produces the actions.', vid: 'c_hurdle', step: 10,
    line: 'A neural controller trained from scratch on parallel rollouts with taller and taller hurdles, then refined by rollout search.',
    slug: 'humanoidbench-loco-hurdle-i00-privileged--ev8v9za', who: 'HumanoidBench · Hurdle · privileged · Codex · GPT-6 Astra',
    code: `class Agent(nn.Module):
 def __init__(self):
  super().__init__();self.actor=nn.Sequential(nn.Linear(74,128),nn.ELU(),…,nn.Linear(128,19))
  …
   delta=rw[t]+.99*vv*(1-nd)-va[t];last=delta+.99*.95*(1-nd)*last;adv[t]=last
  …
  for epoch in range(5):` },
  d: { tab: 'mix', title: 'Mix them', vid: 'd_volleyball_spike', step: 56,
    line: 'Its own inverse kinematics by least squares for the striking palm, combined with a balance controller and a search over the jump and the strike.',
    slug: 'roboolympics-fun-volleyball-spike-i00-privileged--aeefd7j', who: 'Embodied Olympics - Fun · Volleyball spike · privileged · Codex · GPT-6 Astra',
    code: `from scipy.optimize import least_squares
...
n=np.array([.74,-.45,.5]);n/=np.linalg.norm(n)
for sign in [1,-1]:
 def fun(x):
  q[24:27]=x;d.qpos[r.qadr]=q;mujoco.mj_forward(w.m,d)
  return np.r_[d.site_xmat[r.palm['right']].reshape(3,3)[:,0]-sign*n,.01*x]` },
};
/** A little Python colouring for the quoted code: keywords, strings, numbers, comments, calls. */
function pyHL(src) {
  const KW = /^(def|class|return|for|in|if|else|elif|while|import|from|as|with|not|and|or|None|True|False|lambda|self|super)$/;
  return src.split('\n').map((line) => {
    const out = [];
    const re = /(#.*$)|('[^']*'|"[^"]*")|(\b\d+(?:\.\d+)?\b|\.\d+)|([A-Za-z_]\w*)(?=\s*\()|([A-Za-z_]\w*)|([^A-Za-z_\d#'"]+)/g;
    let m;
    while ((m = re.exec(line))) {
      const [t, com, str, num, call, word] = m;
      if (com) out.push(`<span class="hl-c">${esc(com)}</span>`);
      else if (str) out.push(`<span class="hl-s">${esc(str)}</span>`);
      else if (num) out.push(`<span class="hl-n">${esc(num)}</span>`);
      else if (call) out.push(KW.test(call) ? `<span class="hl-k">${esc(call)}</span>` : `<span class="hl-f">${esc(call)}</span>`);
      else if (word) out.push(KW.test(word) ? `<span class="hl-k">${esc(word)}</span>` : esc(word));
      else out.push(esc(t));
    }
    return out.join('');
  }).join('\n');
}
/** One row of a direct-control log: [time, kind, text]; kind is type (a line typed into the live session), look (the
 *  camera images it viewed), say (its own words) or out (what the session printed). */
const WAY_LOG_ICON = { type: '<path d="M5 7l5 5-5 5M12 17h7"/>', look: '<path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  say: '<path d="M4 5.5h16v10H9.5L5 19.5v-4H4z"/>', out: '' };
const wayLogRow = ([t, kind, text]) => `<li class="wl-${kind}"><time>${esc(t)}</time><svg viewBox="0 0 24 24" aria-hidden="true">${WAY_LOG_ICON[kind] || ''}</svg>${
  kind === 'type' ? `<code>${pyHL(text)}</code>` : kind === 'look' ? `<span><b>look</b> ${esc(text)}</span>` : kind === 'say' ? `<q>${esc(text)}</q>` : `<samp>${esc(text)}</samp>`}</li>`;
let wayDlg;
async function wayDemo(k, opener) {
  const w = WAYS[k]; if (!w) return;
  if (!wayDlg) {
    wayDlg = document.createElement('div');
    wayDlg.className = 'ol-modal way-modal';
    wayDlg.hidden = true;
    document.body.append(wayDlg);
    wayDlg.addEventListener('click', (e) => { if (!e.target.closest('.ol-card') || e.target.closest('.ol-x')) close(); });
  }
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  function close() {
    wayDlg.classList.remove('on');
    document.documentElement.classList.remove('ol-lock');
    removeEventListener('keydown', onKey);
    $('video', wayDlg)?.pause();
    setTimeout(() => { if (!wayDlg.classList.contains('on')) wayDlg.hidden = true; }, still() ? 0 : 320);
    opener?.focus({ preventScroll: true });
  }
  const tabs = WAY_ORDER.map((key) => `<button type="button" class="way-tab${key === k ? ' on' : ''}" data-k="${key}">${esc(WAYS[key].tab)}</button>`).join('');
  wayDlg.innerHTML = `<div class="ol-fog"></div>
    <div class="ol-card way-card" role="dialog" aria-modal="true" aria-labelledby="way-title">
      <button type="button" class="ol-x" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      <div class="way-tabs">${tabs}</div>
      <h3 id="way-title">${esc(w.title)}</h3>
      ${w.def ? `<p class="way-def">${esc(w.def)}</p>` : ''}
      <p class="ol-sub">${esc(w.line)}</p>
      <div class="way-body${w.log ? ' log' : ''}">
        <figure class="way-vid"><video src="${esc(wayMedia(w.vid, 'mp4'))}" poster="${esc(wayMedia(w.vid, 'jpg'))}"${w.aspect ? ` style="aspect-ratio:${w.aspect}"` : ''} autoplay muted loop playsinline></video>
          <figcaption>${esc(w.cap || 'This run, rendered')}</figcaption></figure>
        ${w.log ? `<figure class="way-code"><ol class="way-log">${w.log.rows.map(wayLogRow).join('')}</ol><figcaption>${esc(w.log.cap)}</figcaption></figure>`
    : `<figure class="way-code"><pre><code>${pyHL(w.code)}</code></pre><figcaption>The agent’s own code, step ${w.step}</figcaption></figure>`}
      </div>
      <div class="way-foot"><span>${esc(w.who)}</span><a class="btn small" href="${exam('run/')}?r=${encodeURIComponent(w.slug)}">Watch the whole run <span class="arr">→</span></a></div>
    </div>`;
  $$('.way-tab', wayDlg).forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); wayDemo(b.dataset.k, opener); }));
  if (wayDlg.hidden) {
    wayDlg.hidden = false;
    const card = $('.ol-card', wayDlg), b = opener?.getBoundingClientRect(), c = card.getBoundingClientRect();
    if (b) card.style.transformOrigin = `${b.left + b.width / 2 - c.left}px ${b.top + b.height / 2 - c.top}px`;
    document.documentElement.classList.add('ol-lock');
    requestAnimationFrame(() => wayDlg.classList.add('on'));
    addEventListener('keydown', onKey);
  } else {
    wayDlg.classList.add('on');
  }
}

/** What keeps the marks honest: one icon and a few words each, the sentence on hover or focus. */
function trustRow(el) {
  if (!el) return;
  const items = [
    ['sandbox', 'A separate marker', 'The verifier runs in its own sandbox, without network, and sees only the declared answer.'],
    ['nokey', 'No answer key', 'Reference solutions never enter the agent’s container; upstream experts are removed from the images.'],
    ['controls', 'Controls', 'Doing nothing must score 0, and a full reference solution must score 1.'],
    ['cheat', 'A cheat trial', 'An agent is told to pass without doing the task. Any success blocks the suite until the verifier is fixed.'],
    ['review', 'Human review', 'A task without a full reference solution is checked by a reviewer who did not write it.'],
    ['snow', 'Frozen tasks', 'A published task never changes. Fixing a scene makes a new task.'],
  ];
  el.innerHTML = items.map(([icon, name, tip]) => `<li tabindex="0"><span class="tr-ic"><svg viewBox="0 0 24 24" aria-hidden="true">${FF_ICONS[icon]}</svg></span>
    <b>${esc(name)}</b><span class="tip" role="tooltip">${esc(tip)}</span></li>`).join('');
}

/** Numbers with their icons: [[icon, value, label], ...]. */
function iconNumbers(el, items) {
  if (!el) return;
  el.innerHTML = items.map(([icon, v, l, sub]) => `<div><svg viewBox="0 0 24 24" aria-hidden="true">${FF_ICONS[icon]}</svg><dt>${int(v)}</dt><dd>${esc(l)}${sub ? `<small>${esc(sub)}</small>` : ''}</dd></div>`).join('');
}
// a task is one scene with all its modes; a test is one of its modes, a task dir of the repository (owners, 2026-10-19)
const tasksTests = (tasks, tests) => `${int(tasks)} task${tasks === 1 ? '' : 's'} · ${int(tests)} test${tests === 1 ? '' : 's'}`;

/** The exam in four numbers. */
function bigNumbers(el, ex) {
  const t = ex.totals || {};
  // tasks first, then tests: a task is one scene with all its modes, a test one of its modes (owners, 2026-10-19)
  iconNumbers(el, [['doc', t.instances, 'tasks', `${int(t.task_dirs)} tests`], ['layers', t.suites, 'benchmark suites'], ['arm', t.robots, 'robots']]);   // no simulator count: the task.toml labels are not engines (owners, 2026-10-19)
  // one line under them: our own suites and tasks, and the core set (owners, 2026-10-19)
  const ours = new Set((ex.suites || []).filter((s) => s.origin === 'ours').map((s) => s.id));
  const ourTasks = (ex.suites || []).filter((s) => ours.has(s.id)).reduce((a, s) => a + (s.instances || 0), 0);
  el.parentElement?.querySelector('.nums-line')?.remove();
  el.insertAdjacentHTML('afterend', `<p class="nums-line reveal"><span><b>${int(ours.size)}</b> original suites</span><i aria-hidden="true">·</i><span><b>${int(ourTasks)}</b> original tasks</span><i aria-hidden="true">·</i><span><b>${int(t.core_tasks)}</b> core tasks</span></p>`);
}

/** Icons named in the markup: <span class="ic" data-icon="cube"></span>. */
function fillIcons(root = document) {
  $$('[data-gh]', root).forEach((el) => {
    if (GITHUB_URL) el.href = GITHUB_URL; else { el.removeAttribute('href'); el.classList.add('soon'); el.setAttribute('aria-disabled', 'true'); el.title = 'Coming soon'; }
    el.insertAdjacentHTML('afterbegin', GITHUB);
  });
  $$('.ic[data-icon]', root).forEach((el) => { el.innerHTML = `<svg viewBox="0 0 24 24">${FF_ICONS[el.dataset.icon] || ''}</svg>`; });
}

/** The one line under the title: the command that sits the whole exam, typed out once, with a copy button. */
function heroRun(el, ex) {
  if (!el) return;
  const cmd = 'harbor run -d embodied-first-exam -a codex -m openai/gpt-6-astra';   // the repository's README (2026-10-19): the core set, each task in its default mode
  const paint = (s) => esc(s).replace(/(^|\s)(-\w)(?=\s|$)/g, '$1<span class="f">$2</span>');
  el.innerHTML = `<div class="hr-bar"><span class="pr" aria-hidden="true">$</span><code class="hr-cmd"></code><span class="caret" aria-hidden="true"></span>
      <button type="button" class="hr-copy" aria-label="Copy the command" title="Copy">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15"/></svg></button></div>
    <p class="hr-note"><button type="button" class="ol-open" aria-haspopup="dialog">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/></svg>Change one argument</button></p>`;
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

/** Change one argument: a dialog over a fogged page with the command that sits the whole exam and switches that each add
 *  or drop one argument, and a copy button for the result. It grows out of the button that opens it and closes on ×, a
 *  click outside or Esc. Counts come from the exam's own numbers. harbor's -i takes any of several globs, so a suite and a
 *  mode are written as one pattern per suite. */
function oneLine(opener, ex) {
  if (!opener) return;
  // the flags of the repository's README (2026-10-19): -d embodied-first-exam is the core set, each task in its default
  // mode; a mode flag runs the core tasks that have that mode; -d embodied-first-exam@all is every task dir, and one
  // benchmark (-p tasks/<benchmark>) is taken from it; -a oracle for the reference solutions. Counts from the exam's own numbers
  const F = ex.folders || {};
  const AGENTS = { codex: '-a codex -m openai/gpt-6-astra', claude: '-a claude-code -m anthropic/claude-opus-5-5', oracle: '-a oracle' };
  const st = { set: '', mode: '', bench: '', agent: 'codex' };
  const all = () => !!(st.set || st.bench);
  const parts = () => [['base', 'harbor run'], ['set', `-d embodied-first-exam${all() ? '@all' : ''}`], ['mode', st.mode ? `--${st.mode}` : ''],
    ['bench', st.bench ? `-p tasks/${st.bench}` : ''], ['agent', AGENTS[st.agent]]].filter(([, t]) => t);
  const command = () => parts().map(([, t]) => t).join(' ');
  const tally = () => {
    const pool = st.bench ? [st.bench] : Object.keys(F);
    const modes = st.mode ? [st.mode] : ['privileged', 'standard', 'standard-realtime'];
    // tasks (a scene with all its modes); with a mode chosen, the tasks that have that mode
    const i = all() ? 1 : 0;
    const at = (f) => (st.mode ? F[f]?.modes?.[st.mode] : F[f]?.tasks) || [0, 0];
    const n = pool.reduce((a, f) => a + at(f)[i], 0);
    // the core set without a mode flag runs each task once, in its default mode; otherwise every chosen mode of each task
    const tests = !all() && !st.mode ? n : pool.reduce((a, f) => a + modes.reduce((b, m) => b + (F[f]?.modes?.[m] || [0, 0])[i], 0), 0);
    // suites as the site counts them: the repository's ikea-mujoco folder is part of RoboARC (owners, 2026-10-19: said
    // once, here, where a reader compares with the repository's folders)
    const used = pool.filter((f) => at(f)[i]);
    return { n, tests, k: new Set(used.map((f) => (f === 'ikea-mujoco' ? 'roboarc' : f))).size, folders: used.length,
      modes: !all() && !st.mode ? ['each in its default mode'] : modes };
  };
  const opt = (g, v, label, note) => `<button type="button" class="ol-opt" data-g="${g}" data-v="${v}" aria-pressed="false"><b>${label}</b><small>${note}</small></button>`;
  const dlg = document.createElement('div');
  dlg.className = 'ol-modal';
  dlg.hidden = true;
  dlg.innerHTML = `<div class="ol-fog"></div>
    <div class="ol-card" role="dialog" aria-modal="true" aria-labelledby="ol-title">
      <button type="button" class="ol-x" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      <h3 id="ol-title">Change one argument</h3>
      <p class="ol-sub">Pick what to change. The command follows; copy it and run.</p>
      <div class="term"><div class="term-bar"><i></i><i></i><i></i>
          <button type="button" class="ol-copy"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15"/></svg><span>Copy</span></button></div>
        <pre class="term-body"><span class="pr" aria-hidden="true">$ </span><span class="cmd"></span><span class="caret" aria-hidden="true"></span><span class="out"></span></pre></div>
      <div class="ol-groups">
        <div class="ol-g"><span class="ol-k">Tasks</span>${opt('set', 'all', 'Every task', '@all, not only the core set')}${opt('bench', 'roboarc', 'RoboARC', '@all -p tasks/roboarc')}${opt('bench', 'robocasa365', 'RoboCasa365', '@all -p tasks/robocasa365')}</div>
        <div class="ol-g"><span class="ol-k">Mode</span>${opt('mode', 'standard', 'Standard', 'robot’s own sensors')}${opt('mode', 'privileged', 'Privileged', 'open book')}${opt('mode', 'standard-realtime', 'Real-time', 'a clock that does not stop')}</div>
        <div class="ol-g"><span class="ol-k">Agent</span>${opt('agent', 'claude', 'Claude Code', 'Opus 5.5')}${opt('agent', 'oracle', 'Reference solution', '-a oracle')}</div>
      </div></div>`;
  document.body.append(dlg);
  const card = $('.ol-card', dlg), cmdEl = $('.cmd', dlg), outEl = $('.out', dlg), copy = $('.ol-copy', dlg);
  const out = () => {
    const t = tally();
    outEl.innerHTML = `\n<span class="ok">▸</span> <b>${int(t.n)}</b> tasks · <b>${int(t.tests)}</b> tests${all() ? '' : ' of the core set'} · ${t.k} suite${t.k === 1 ? '' : 's'}${st.set && !st.mode && t.folders !== t.k ? ` (${t.folders} folders in the repository: ikea-mujoco is part of RoboARC)` : ''} · ${t.modes.join(' + ')}\n`
      + `<span class="ok">▸</span> ${st.agent === 'oracle' ? 'the reference solutions, marked like any answer' : 'each answer marked by a fresh simulator'}`;
  };
  let prev = {};
  const show = (changed) => {
    cmdEl.innerHTML = parts().map(([key, t]) => `<span class="${key === 'base' ? 'b' : 'arg'}${key === changed || (changed && prev[key] !== t && key !== 'base') ? ' new' : ''}">${esc(t)}</span>`).join(' ');
    prev = Object.fromEntries(parts());
    out();
    $$('.ol-opt', dlg).forEach((b) => b.setAttribute('aria-pressed', String(st[b.dataset.g] === b.dataset.v)));
  };
  $$('.ol-opt', dlg).forEach((b) => b.addEventListener('click', () => {
    const g = b.dataset.g;
    if (g === 'agent') st.agent = st.agent === b.dataset.v ? 'codex' : b.dataset.v;
    else st[g] = st[g] === b.dataset.v ? '' : b.dataset.v;
    show(g);
  }));
  copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(command()); } catch { return; }
    copy.classList.add('ok'); $('span', copy).textContent = 'Copied';
    setTimeout(() => { copy.classList.remove('ok'); $('span', copy).textContent = 'Copy'; }, 1600);
  });
  // the command types itself out the first time the dialog opens; at once for reduced motion
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  let typed = false;
  const typeIt = () => {
    typed = true;
    if (still()) { show(); return; }
    const full = command();
    let i = 0;
    const tick = () => {
      cmdEl.textContent = full.slice(0, ++i);
      if (i < full.length) setTimeout(tick, 14 + Math.random() * 20); else setTimeout(() => show(), 200);
    };
    setTimeout(tick, 260);
  };
  const open = () => {
    // the card grows out of the button: its transform origin is the button's centre
    const b = opener.getBoundingClientRect();
    dlg.hidden = false;
    const c = card.getBoundingClientRect();
    card.style.transformOrigin = `${b.left + b.width / 2 - c.left}px ${b.top + b.height / 2 - c.top}px`;
    document.documentElement.classList.add('ol-lock');
    requestAnimationFrame(() => dlg.classList.add('on'));
    if (!typed) typeIt();
    setTimeout(() => $('.ol-opt', dlg).focus({ preventScroll: true }), 60);
    addEventListener('keydown', onKey);
  };
  const close = () => {
    dlg.classList.remove('on');
    document.documentElement.classList.remove('ol-lock');
    removeEventListener('keydown', onKey);
    setTimeout(() => { if (!dlg.classList.contains('on')) dlg.hidden = true; }, still() ? 0 : 320);
    opener.focus({ preventScroll: true });
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') {   // keep the focus inside the dialog
      const f = $$('button', card);
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  };
  opener.addEventListener('click', open);
  $('.ol-x', dlg).addEventListener('click', close);
  dlg.addEventListener('click', (e) => { if (!card.contains(e.target)) close(); });
}

/** Who made a model: its maker's mark beside its name (LobeHub's monochrome icons, MIT; the marks belong to their
 *  owners). */
const MAKERS = [
  [/gpt|openai|\bo\d/i, 'OpenAI', `<path d="M9.205 8.658v-2.26c0-.19.072-.333.238-.428l4.543-2.616c.619-.357 1.356-.523 2.117-.523 2.854 0 4.662 2.212 4.662 4.566 0 .167 0 .357-.024.547l-4.71-2.759a.797.797 0 00-.856 0l-5.97 3.473zm10.609 8.8V12.06c0-.333-.143-.57-.429-.737l-5.97-3.473 1.95-1.118a.433.433 0 01.476 0l4.543 2.617c1.309.76 2.189 2.378 2.189 3.948 0 1.808-1.07 3.473-2.76 4.163zM7.802 12.703l-1.95-1.142c-.167-.095-.239-.238-.239-.428V5.899c0-2.545 1.95-4.472 4.591-4.472 1 0 1.927.333 2.712.928L8.23 5.067c-.285.166-.428.404-.428.737v6.898zM12 15.128l-2.795-1.57v-3.33L12 8.658l2.795 1.57v3.33L12 15.128zm1.796 7.23c-1 0-1.927-.332-2.712-.927l4.686-2.712c.285-.166.428-.404.428-.737v-6.898l1.974 1.142c.167.095.238.238.238.428v5.233c0 2.545-1.974 4.472-4.614 4.472zm-5.637-5.303l-4.544-2.617c-1.308-.761-2.188-2.378-2.188-3.948A4.482 4.482 0 014.21 6.327v5.423c0 .333.143.571.428.738l5.947 3.449-1.95 1.118a.432.432 0 01-.476 0zm-.262 3.9c-2.688 0-4.662-2.021-4.662-4.519 0-.19.024-.38.047-.57l4.686 2.71c.286.167.571.167.856 0l5.97-3.448v2.26c0 .19-.07.333-.237.428l-4.543 2.616c-.619.357-1.356.523-2.117.523zm5.899 2.83a5.947 5.947 0 005.827-4.756C22.287 18.339 24 15.84 24 13.296c0-1.665-.713-3.282-1.998-4.448.119-.5.19-.999.19-1.498 0-3.401-2.759-5.947-5.946-5.947-.642 0-1.26.095-1.88.31A5.962 5.962 0 0010.205 0a5.947 5.947 0 00-5.827 4.757C1.713 5.447 0 7.945 0 10.49c0 1.666.713 3.283 1.998 4.448-.119.5-.19 1-.19 1.499 0 3.401 2.759 5.946 5.946 5.946.642 0 1.26-.095 1.88-.309a5.96 5.96 0 004.162 1.713z"></path>`],
  [/claude|opus|sonnet|haiku|fable|anthropic/i, 'Anthropic', `<path d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z"></path>`],
  [/gemini|gemma|google/i, 'Google', `<path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z"></path>`],
  [/qwen/i, 'Qwen', `<path d="M12.604 1.34c.393.69.784 1.382 1.174 2.075a.18.18 0 00.157.091h5.552c.174 0 .322.11.446.327l1.454 2.57c.19.337.24.478.024.837-.26.43-.513.864-.76 1.3l-.367.658c-.106.196-.223.28-.04.512l2.652 4.637c.172.301.111.494-.043.77-.437.785-.882 1.564-1.335 2.34-.159.272-.352.375-.68.37-.777-.016-1.552-.01-2.327.016a.099.099 0 00-.081.05 575.097 575.097 0 01-2.705 4.74c-.169.293-.38.363-.725.364-.997.003-2.002.004-3.017.002a.537.537 0 01-.465-.271l-1.335-2.323a.09.09 0 00-.083-.049H4.982c-.285.03-.553-.001-.805-.092l-1.603-2.77a.543.543 0 01-.002-.54l1.207-2.12a.198.198 0 000-.197 550.951 550.951 0 01-1.875-3.272l-.79-1.395c-.16-.31-.173-.496.095-.965.465-.813.927-1.625 1.387-2.436.132-.234.304-.334.584-.335a338.3 338.3 0 012.589-.001.124.124 0 00.107-.063l2.806-4.895a.488.488 0 01.422-.246c.524-.001 1.053 0 1.583-.006L11.704 1c.341-.003.724.032.9.34zm-3.432.403a.06.06 0 00-.052.03L6.254 6.788a.157.157 0 01-.135.078H3.253c-.056 0-.07.025-.041.074l5.81 10.156c.025.042.013.062-.034.063l-2.795.015a.218.218 0 00-.2.116l-1.32 2.31c-.044.078-.021.118.068.118l5.716.008c.046 0 .08.02.104.061l1.403 2.454c.046.081.092.082.139 0l5.006-8.76.783-1.382a.055.055 0 01.096 0l1.424 2.53a.122.122 0 00.107.062l2.763-.02a.04.04 0 00.035-.02.041.041 0 000-.04l-2.9-5.086a.108.108 0 010-.113l.293-.507 1.12-1.977c.024-.041.012-.062-.035-.062H9.2c-.059 0-.073-.026-.043-.077l1.434-2.505a.107.107 0 000-.114L9.225 1.774a.06.06 0 00-.053-.031zm6.29 8.02c.046 0 .058.02.034.06l-.832 1.465-2.613 4.585a.056.056 0 01-.05.029.058.058 0 01-.05-.029L8.498 9.841c-.02-.034-.01-.052.028-.054l.216-.012 6.722-.012z"></path>`],
  [/deepseek/i, 'DeepSeek', `<path d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 01-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 00-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 01-.465.137 9.597 9.597 0 00-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 001.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763.09.288.207.486.371.739.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.696 4.696 0 011.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914.348.292.625.514.891.677-.802.09-2.14.11-3.054-.614zm1-6.44a.306.306 0 01.415-.287.302.302 0 01.2.288.306.306 0 01-.31.307.303.303 0 01-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.245 1.245 0 01-.798-.254c-.274-.23-.47-.358-.552-.758a1.73 1.73 0 01.016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.559.559 0 01-.254-.078c-.11-.054-.2-.19-.114-.358.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452z"></path>`],
  [/kimi|moonshot/i, 'Moonshot AI', `<path d="M21.846 0a1.923 1.923 0 110 3.846H20.15a.226.226 0 01-.227-.226V1.923C19.923.861 20.784 0 21.846 0z"></path><path d="M11.065 11.199l7.257-7.2c.137-.136.06-.41-.116-.41H14.3a.164.164 0 00-.117.051l-7.82 7.756c-.122.12-.302.013-.302-.179V3.82c0-.127-.083-.23-.185-.23H3.186c-.103 0-.186.103-.186.23V19.77c0 .128.083.23.186.23h2.69c.103 0 .186-.102.186-.23v-3.25c0-.069.025-.135.069-.178l2.424-2.406a.158.158 0 01.205-.023l6.484 4.772a7.677 7.677 0 003.453 1.283c.108.012.2-.095.2-.23v-3.06c0-.117-.07-.212-.164-.227a5.028 5.028 0 01-2.027-.807l-5.613-4.064c-.117-.078-.132-.279-.028-.381z"></path>`],
  [/glm|zhipu/i, 'Zhipu AI', `<path d="M11.991 23.503a.24.24 0 00-.244.248.24.24 0 00.244.249.24.24 0 00.245-.249.24.24 0 00-.22-.247l-.025-.001zM9.671 5.365a1.697 1.697 0 011.099 2.132l-.071.172-.016.04-.018.054c-.07.16-.104.32-.104.498-.035.71.47 1.279 1.186 1.314h.366c1.309.053 2.338 1.173 2.286 2.523-.052 1.332-1.152 2.38-2.478 2.327h-.174c-.715.018-1.274.64-1.239 1.368 0 .124.018.23.053.337.209.373.54.658.96.8.75.23 1.517-.125 1.9-.782l.018-.035c.402-.64 1.17-.96 1.92-.711.854.284 1.378 1.226 1.099 2.167a1.661 1.661 0 01-2.077 1.102 1.711 1.711 0 01-.907-.711l-.017-.035c-.2-.323-.463-.58-.851-.711l-.056-.018a1.646 1.646 0 00-1.954.746 1.66 1.66 0 01-1.065.764 1.677 1.677 0 01-1.989-1.279c-.209-.906.332-1.83 1.257-2.043a1.51 1.51 0 01.296-.035h.018c.68-.071 1.151-.622 1.116-1.333a1.307 1.307 0 00-.227-.693 2.515 2.515 0 01-.366-1.403 2.39 2.39 0 01.366-1.208c.14-.195.21-.444.227-.693.018-.71-.506-1.261-1.186-1.332l-.07-.018a1.43 1.43 0 01-.299-.07l-.05-.019a1.7 1.7 0 01-1.047-2.114 1.68 1.68 0 012.094-1.101zm-5.575 10.11c.26-.264.639-.367.994-.27.355.096.633.379.728.74.095.362-.007.748-.267 1.013-.402.41-1.053.41-1.455 0a1.062 1.062 0 010-1.482zm14.845-.294c.359-.09.738.024.992.297.254.274.344.665.237 1.025-.107.36-.396.634-.756.718-.551.128-1.1-.22-1.23-.781a1.05 1.05 0 01.757-1.26zm-.064-4.39c.314.32.49.753.49 1.206 0 .452-.176.886-.49 1.206-.315.32-.74.5-1.185.5-.444 0-.87-.18-1.184-.5a1.727 1.727 0 010-2.412 1.654 1.654 0 012.369 0zm-11.243.163c.364.484.447 1.128.218 1.691a1.665 1.665 0 01-2.188.923c-.855-.36-1.26-1.358-.907-2.228a1.68 1.68 0 011.33-1.038c.593-.08 1.183.169 1.547.652zm11.545-4.221c.368 0 .708.2.892.524.184.324.184.724 0 1.048a1.026 1.026 0 01-.892.524c-.568 0-1.03-.47-1.03-1.048 0-.579.462-1.048 1.03-1.048zm-14.358 0c.368 0 .707.2.891.524.184.324.184.724 0 1.048a1.026 1.026 0 01-.891.524c-.569 0-1.03-.47-1.03-1.048 0-.579.461-1.048 1.03-1.048zm10.031-1.475c.925 0 1.675.764 1.675 1.706s-.75 1.705-1.675 1.705-1.674-.763-1.674-1.705c0-.942.75-1.706 1.674-1.706zm-2.626-.684c.362-.082.653-.356.761-.718a1.062 1.062 0 00-.238-1.028 1.017 1.017 0 00-.996-.294c-.547.14-.881.7-.752 1.257.13.558.675.907 1.225.783zm0 16.876c.359-.087.644-.36.75-.72a1.062 1.062 0 00-.237-1.019 1.018 1.018 0 00-.985-.301 1.037 1.037 0 00-.762.717c-.108.361-.017.754.239 1.028.245.263.606.377.953.305l.043-.01zM17.19 3.5a.631.631 0 00.628-.64c0-.355-.279-.64-.628-.64a.631.631 0 00-.628.64c0 .355.28.64.628.64zm-10.38 0a.631.631 0 00.628-.64c0-.355-.28-.64-.628-.64a.631.631 0 00-.628.64c0 .355.279.64.628.64zm-5.182 7.852a.631.631 0 00-.628.64c0 .354.28.639.628.639a.63.63 0 00.627-.606l.001-.034a.62.62 0 00-.628-.64zm5.182 9.13a.631.631 0 00-.628.64c0 .355.279.64.628.64a.631.631 0 00.628-.64c0-.355-.28-.64-.628-.64zm10.38.018a.631.631 0 00-.628.64c0 .355.28.64.628.64a.631.631 0 00.628-.64c0-.355-.279-.64-.628-.64zm5.182-9.148a.631.631 0 00-.628.64c0 .354.279.639.628.639a.631.631 0 00.628-.64c0-.355-.28-.64-.628-.64zm-.384-4.992a.24.24 0 00.244-.249.24.24 0 00-.244-.249.24.24 0 00-.244.249c0 .142.122.249.244.249zM11.991.497a.24.24 0 00.245-.248A.24.24 0 0011.99 0a.24.24 0 00-.244.249c0 .133.108.236.223.247l.021.001zM2.011 6.36a.24.24 0 00.245-.249.24.24 0 00-.244-.249.24.24 0 00-.244.249.24.24 0 00.244.249zm0 11.263a.24.24 0 00-.243.248.24.24 0 00.244.249.24.24 0 00.244-.249.252.252 0 00-.244-.248zm19.995-.018a.24.24 0 00-.245.248.24.24 0 00.245.25.24.24 0 00.244-.25.252.252 0 00-.244-.248z"></path>`],
  [/grok|xai/i, 'xAI', `<path d="M9.27 15.29l7.978-5.897c.391-.29.95-.177 1.137.272.98 2.369.542 5.215-1.41 7.169-1.951 1.954-4.667 2.382-7.149 1.406l-2.711 1.257c3.889 2.661 8.611 2.003 11.562-.953 2.341-2.344 3.066-5.539 2.388-8.42l.006.007c-.983-4.232.242-5.924 2.75-9.383.06-.082.12-.164.179-.248l-3.301 3.305v-.01L9.267 15.292M7.623 16.723c-2.792-2.67-2.31-6.801.071-9.184 1.761-1.763 4.647-2.483 7.166-1.425l2.705-1.25a7.808 7.808 0 00-1.829-1A8.975 8.975 0 005.984 5.83c-2.533 2.536-3.33 6.436-1.962 9.764 1.022 2.487-.653 4.246-2.34 6.022-.599.63-1.199 1.259-1.682 1.925l7.62-6.815"></path>`],
  [/mistral|devstral|codestral/i, 'Mistral AI', `<path clip-rule="evenodd" d="M3.428 3.4h3.429v3.428h3.429v3.429h-.002 3.431V6.828h3.427V3.4h3.43v13.714H24v3.429H13.714v-3.428h-3.428v-3.429h-3.43v3.428h3.43v3.429H0v-3.429h3.428V3.4zm10.286 13.715h3.428v-3.429h-3.427v3.429z"></path>`],
  [/minimax/i, 'MiniMax', `<path d="M16.278 2c1.156 0 2.093.927 2.093 2.07v12.501a.74.74 0 00.744.709.74.74 0 00.743-.709V9.099a2.06 2.06 0 012.071-2.049A2.06 2.06 0 0124 9.1v6.561a.649.649 0 01-.652.645.649.649 0 01-.653-.645V9.1a.762.762 0 00-.766-.758.762.762 0 00-.766.758v7.472a2.037 2.037 0 01-2.048 2.026 2.037 2.037 0 01-2.048-2.026v-12.5a.785.785 0 00-.788-.753.785.785 0 00-.789.752l-.001 15.904A2.037 2.037 0 0113.441 22a2.037 2.037 0 01-2.048-2.026V18.04c0-.356.292-.645.652-.645.36 0 .652.289.652.645v1.934c0 .263.142.506.372.638.23.131.514.131.744 0a.734.734 0 00.372-.638V4.07c0-1.143.937-2.07 2.093-2.07zm-5.674 0c1.156 0 2.093.927 2.093 2.07v11.523a.648.648 0 01-.652.645.648.648 0 01-.652-.645V4.07a.785.785 0 00-.789-.78.785.785 0 00-.789.78v14.013a2.06 2.06 0 01-2.07 2.048 2.06 2.06 0 01-2.071-2.048V9.1a.762.762 0 00-.766-.758.762.762 0 00-.766.758v3.8a2.06 2.06 0 01-2.071 2.049A2.06 2.06 0 010 12.9v-1.378c0-.357.292-.646.652-.646.36 0 .653.29.653.646V12.9c0 .418.343.757.766.757s.766-.339.766-.757V9.099a2.06 2.06 0 012.07-2.048 2.06 2.06 0 012.071 2.048v8.984c0 .419.343.758.767.758.423 0 .766-.339.766-.758V4.07c0-1.143.937-2.07 2.093-2.07z"></path>`],
  [/doubao|seed/i, 'ByteDance', `<path d="M5.31 15.756c.172-3.75 1.883-5.999 2.549-6.739-3.26 2.058-5.425 5.658-6.358 8.308v1.12C1.501 21.513 4.226 24 7.59 24a6.59 6.59 0 002.2-.375c.353-.12.7-.248 1.039-.378.913-.899 1.65-1.91 2.243-2.992-4.877 2.431-7.974.072-7.763-4.5l.002.001z" fill-opacity=".5"></path><path d="M22.57 10.283c-1.212-.901-4.109-2.404-7.397-2.8.295 3.792.093 8.766-2.1 12.773a12.782 12.782 0 01-2.244 2.992c3.764-1.448 6.746-3.457 8.596-5.219 2.82-2.683 3.353-5.178 3.361-6.66a2.737 2.737 0 00-.216-1.084v-.002zM14.303 1.867C12.955.7 11.248 0 9.39 0 7.532 0 5.883.677 4.545 1.807 2.791 3.29 1.627 5.557 1.5 8.125v9.201c.932-2.65 3.097-6.25 6.357-8.307.5-.318 1.025-.595 1.569-.829 1.883-.801 3.878-.932 5.746-.706-.222-2.83-.718-5.002-.87-5.617h.001z"></path><path d="M17.305 4.961a199.47 199.47 0 01-1.08-1.094c-.202-.213-.398-.419-.586-.622l-1.333-1.378c.151.615.648 2.786.869 5.617 3.288.395 6.185 1.898 7.396 2.8-1.306-1.275-3.475-3.487-5.266-5.323z" fill-opacity=".5"></path>`],
  [/llama|meta/i, 'Meta', `<path d="M6.897 4c1.915 0 3.516.932 5.43 3.376l.282-.373c.19-.246.383-.484.58-.71l.313-.35C14.588 4.788 15.792 4 17.225 4c1.273 0 2.469.557 3.491 1.516l.218.213c1.73 1.765 2.917 4.71 3.053 8.026l.011.392.002.25c0 1.501-.28 2.759-.818 3.7l-.14.23-.108.153c-.301.42-.664.758-1.086 1.009l-.265.142-.087.04a3.493 3.493 0 01-.302.118 4.117 4.117 0 01-1.33.208c-.524 0-.996-.067-1.438-.215-.614-.204-1.163-.56-1.726-1.116l-.227-.235c-.753-.812-1.534-1.976-2.493-3.586l-1.43-2.41-.544-.895-1.766 3.13-.343.592C7.597 19.156 6.227 20 4.356 20c-1.21 0-2.205-.42-2.936-1.182l-.168-.184c-.484-.573-.837-1.311-1.043-2.189l-.067-.32a8.69 8.69 0 01-.136-1.288L0 14.468c.002-.745.06-1.49.174-2.23l.1-.573c.298-1.53.828-2.958 1.536-4.157l.209-.34c1.177-1.83 2.789-3.053 4.615-3.16L6.897 4zm-.033 2.615l-.201.01c-.83.083-1.606.673-2.252 1.577l-.138.199-.01.018c-.67 1.017-1.185 2.378-1.456 3.845l-.004.022a12.591 12.591 0 00-.207 2.254l.002.188c.004.18.017.36.04.54l.043.291c.092.503.257.908.486 1.208l.117.137c.303.323.698.492 1.17.492 1.1 0 1.796-.676 3.696-3.641l2.175-3.4.454-.701-.139-.198C9.11 7.3 8.084 6.616 6.864 6.616zm10.196-.552l-.176.007c-.635.048-1.223.359-1.82.933l-.196.198c-.439.462-.887 1.064-1.367 1.807l.266.398c.18.274.362.56.55.858l.293.475 1.396 2.335.695 1.114c.583.926 1.03 1.6 1.408 2.082l.213.262c.282.326.529.54.777.673l.102.05c.227.1.457.138.718.138.176.002.35-.023.518-.073.338-.104.61-.32.813-.637l.095-.163.077-.162c.194-.459.29-1.06.29-1.785l-.006-.449c-.08-2.871-.938-5.372-2.2-6.798l-.176-.189c-.67-.683-1.444-1.074-2.27-1.074z"></path>`],
];
function makerMark(model) {
  const m = MAKERS.find(([re]) => re.test(model || ''));
  if (!m) return `<span class="mk txt">${esc((model || '?').slice(0, 2))}</span>`;
  return `<span class="mk" title="${m[1]}"><svg viewBox="0 0 24 24" role="img" aria-label="${m[1]}">${m[2]}</svg></span>`;
}

/** The leaderboard on the home page, the same rule as the leaderboard page (owners, 2026-10-19): one setting at a time,
 *  Core first, a compact switch for the others; one bar per ranked model, longest first, with its maker's mark and its
 *  place. A click on a bar opens that model's suites in the setting shown. The numbers are the generator's
 *  (leaderboard.shared.views: all the core tests of each setting, a missing result counted as failed). */
function homeBoard(el, ex) {
  const sh = ex.leaderboard?.shared;
  const runs = runMap(ex);
  const note = $('#bars-note');
  if (!el || !sh?.runs?.length || !sh.views) { if (el) el.innerHTML = '<div class="empty-state">No ranked runs yet.</div>'; return; }
  el.innerHTML = `<div class="lbh-top"><div class="seg lb-set" id="lbh-set"></div></div>
    <p class="lb-desc" id="lbh-desc"></p>
    <div class="lbh-chart"><div class="lbh-ax"></div><div class="lbh-rows"></div></div>
    <p class="lbh-hint">Click a model to see its suites one by one.</p>
    <div class="lbh-detail" hidden></div>`;
  const list = $('.lbh-rows', el), det = $('.lbh-detail', el);
  let set = LB_SETTINGS[0];
  const draw = () => {
    const vw = sh.views[set.id] || { scores: {}, suites: {} };
    const P = (id) => pctOf(vw.scores?.[id]) ?? -1;
    const order = [...sh.runs].sort((a, b) => P(b) - P(a) || (runs[a]?.model || a).localeCompare(runs[b]?.model || b));
    const best = Math.max(0, P(order[0]));
    let rank = 0, prev = null;
    list.innerHTML = order.map((id, i) => { if (P(id) !== prev) { rank = i + 1; prev = P(id); } return lbRow(runs[id] || { id, model: id }, vw.scores?.[id], rank, best, set); }).join('');
    det.hidden = true;
    el.classList.remove('picked');
    $('.lbh-ax', el).innerHTML = lbAxis(vw.tests || 0);
    $('#lbh-desc', el).textContent = lbDesc(set.id, vw.tests || 0);
    if (note) note.innerHTML = `<a href="${exam('leaderboard/')}${set.id === 'core' ? '' : `?mode=${set.id}`}">Full leaderboard, per suite →</a>`;
  };
  settingSwitch($('#lbh-set', el), set.id, (id) => { set = lbSetting(id); draw(); });
  list.addEventListener('click', (e) => {
    const b = e.target.closest('.lbh-row'); if (!b) return;
    const was = b.getAttribute('aria-expanded') === 'true';
    $$('.lbh-row', el).forEach((c) => { c.setAttribute('aria-expanded', 'false'); c.classList.remove('on'); });
    el.classList.toggle('picked', !was);
    if (was) { det.hidden = true; return; }
    b.setAttribute('aria-expanded', 'true'); b.classList.add('on');
    const id = b.dataset.id, r = runs[id] || { model: id }, vw = sh.views[set.id] || {};
    det.innerHTML = lbDetail(ex, r, { v: vw.scores?.[id], suites: vw.suites?.[id] || {} }, set).replace(/^<div class="lbh-detail in">|<\/div>$/g, '');
    b.after(det);
    det.hidden = false;
    det.classList.remove('in'); void det.offsetWidth; det.classList.add('in');
  });
  draw();
}

/** The suites on the home page: a picture and a name each. */
function gallery(el, ex) {
  if (!el) return;
  const item = (s) => {
    const cover = coverOf(s), demo = demoOf(s), crop = cropFor(s.id, cover?.task);
    const img = cover ? `<img src="${esc(site(cover.poster))}" alt="" loading="lazy" decoding="async"${crop ? ` class="${crop}"` : ''}>` : `<div class="placeholder-art"><span>${esc(s.code)}</span><small>no pictures yet</small></div>`;
    return `<a class="g-item" href="${exam('suite/')}?id=${esc(s.id)}" data-suite="${esc(s.id)}" aria-haspopup="dialog"><div class="img">${img}${hoverVideo(s, crop)}${releaseTag(s)}</div><b>${esc(s.name)}${nameTag(s)}</b>
      <span>${int(s.instances)} tasks · ${esc(bodyLabel(ex, s))}</span></a>`;
  };
  // the team's own suites and the others under their headings (owner, 2026-10-19)
  el.innerHTML = suiteGroups(ranked(ex)).map(([title, list]) => `<div class="suite-group">${groupHead(title, list.length)}<div class="gallery">${list.map(item).join('')}</div></div>`).join('');
  hoverPlay($$('.g-item', el));
  // a plain left click opens the suite's card in a dialog; ctrl-, cmd-, shift- and middle clicks still follow the link
  el.addEventListener('click', (e) => {
    const a = e.target.closest('.g-item[data-suite]');
    if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.defaultPrevented) return;
    const s = ex._suites[a.dataset.suite];
    if (!s) return;
    e.preventDefault();
    suiteDialog(ex, s, a);
  });
}

/** A suite's demo: its teaser, else its cover if that has a video, else its first task video. */
const demoOf = (s) => [s.teaser, coverOf(s), ...(s.preview || [])].find((m) => m?.video);

/** A suite card's demo, played on hover (home and Suites page, owner 2026-10-19): nothing of it loads before the first
 *  hover (data-src, preload none). */
const hoverVideo = (s, crop = '') => { const d = demoOf(s); return d?.video ? `<video muted loop playsinline preload="none" data-src="${esc(site(d.video))}" aria-hidden="true"${crop ? ` class="${crop}"` : ''}></video>` : ''; };
/** Hover plays a card's demo, on a pointer that hovers and without reduced motion; touch has no hover play; never while
 *  a dialog is open. */
function hoverPlay(cards) {
  const canHover = matchMedia('(hover: hover) and (pointer: fine)'), still = matchMedia('(prefers-reduced-motion: reduce)');
  cards.forEach((a) => {
    const v = $('video[data-src]', a);
    if (!v) return;
    a.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'touch' || !canHover.matches || still.matches || document.documentElement.classList.contains('ol-lock')) return;
      if (!v.src) v.src = v.dataset.src;
      a.classList.add('playing');
      v.play().catch(() => {});
    });
    a.addEventListener('pointerleave', () => { a.classList.remove('playing'); v.pause(); });
  });
}
const stopHoverPlay = () => $$('.playing').forEach((a) => { a.classList.remove('playing'); $('video[data-src]', a)?.pause(); });

/** A suite in a dialog on the home page (owner, 2026-10-19): name and tag, the brief, its demo video, the numbers, the
 *  suite page and its own links. Closes on ×, Esc or a click on the fog; the focus stays inside while it is open; on a
 *  phone it is a sheet from the bottom. */
let suiteDlg;
function suiteDialog(ex, s, opener) {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  stopHoverPlay();   // the card's demo stops behind the fog
  if (!suiteDlg) {
    suiteDlg = document.createElement('div');
    suiteDlg.className = 'ol-modal sm-modal';
    suiteDlg.hidden = true;
    suiteDlg.innerHTML = '<div class="ol-fog"></div><div class="ol-card sm-card" role="dialog" aria-modal="true" aria-labelledby="sm-title"></div>';
    document.body.append(suiteDlg);
  }
  const card = $('.sm-card', suiteDlg);
  const demo = demoOf(s), cover = coverOf(s), crop = cropFor(s.id, (demo || cover)?.task);
  const L = s.links || {};
  const ext = [['Paper', L.paper], ['Website', L.website || L.project_page || L.project || L.site], ['Code', L.repository]]
    .filter(([, v]) => v).map(([label, v]) => `<a class="btn small" href="${esc(v)}" target="_blank" rel="noopener">${label} ↗</a>`).join('');
  const media = demo ? `<video src="${esc(site(demo.video))}"${demo.poster ? ` poster="${esc(site(demo.poster))}"` : ''} muted loop playsinline controls${still ? ' preload="metadata"' : ' autoplay'}${crop ? ` class="${crop}"` : ''}></video>`
    : cover ? poster(cover, crop) : `<div class="placeholder-art"><span>${esc(s.code)}</span><small>no pictures yet</small></div>`;
  const robots = (s.robots || []).map((r) => r.name).filter(Boolean);
  // the numbers big; the robots and the simulator (its name, without the notes in brackets) as text beside them
  const nums = [[int(s.instances), `task${s.instances === 1 ? '' : 's'}`], [int(s.task_dirs), `test${s.task_dirs === 1 ? '' : 's'}`],
    [esc(robots.join(', ')), `robot${robots.length === 1 ? '' : 's'}`, 'tx'], [esc((s.simulator || '').replace(/\s*\(.*$/, '')), 'simulator', 'tx']].filter(([v]) => v);
  card.innerHTML = `<button type="button" class="ol-x" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    <div class="sm-media">${media}</div>
    <div class="sm-body">
      <p class="sm-kicker">${codeMark(s)}<span>${esc(bodyLabel(ex, s))}</span></p>
      <h3 id="sm-title">${esc(s.name)}${nameTag(s)}</h3>
      ${s.blurb ? `<p class="sm-lead">${esc(s.blurb)}</p>` : ''}
      ${s.description ? `<p class="sm-desc">${prose(s.description)}</p>` : ''}
      <dl class="sm-nums">${nums.map(([v, k, cls]) => `<div${cls ? ` class="${cls}"` : ''}><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
      <div class="sm-cta"><a class="btn primary" href="${exam('suite/')}?id=${esc(s.id)}">Open suite page <span class="arr">→</span></a>${ext}</div>
    </div>`;
  const video = $('video', card);
  const focusables = () => $$('a[href], button, video[controls]', card);
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const f = focusables(), first = f[0], last = f[f.length - 1];
    if (!card.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  const onClick = (e) => { if (!e.target.closest('.sm-card') || e.target.closest('.ol-x')) close(); };
  function close() {
    suiteDlg.classList.remove('on');
    document.documentElement.classList.remove('ol-lock');
    removeEventListener('keydown', onKey);
    suiteDlg.removeEventListener('click', onClick);
    video?.pause();
    setTimeout(() => { if (!suiteDlg.classList.contains('on')) { suiteDlg.hidden = true; card.innerHTML = ''; } }, still ? 0 : 320);
    opener?.focus({ preventScroll: true });
  }
  suiteDlg.hidden = false;
  card.scrollTop = 0;
  const b = opener?.getBoundingClientRect(), c = card.getBoundingClientRect();
  if (b && !matchMedia('(max-width: 640px)').matches) card.style.transformOrigin = `${b.left + b.width / 2 - c.left}px ${b.top + b.height / 2 - c.top}px`;
  else card.style.transformOrigin = '';
  document.documentElement.classList.add('ol-lock');
  requestAnimationFrame(() => suiteDlg.classList.add('on'));
  addEventListener('keydown', onKey);
  suiteDlg.addEventListener('click', onClick);
  setTimeout(() => $('.ol-x', card).focus({ preventScroll: true }), 60);
}

/** The three ways an agent can control the robot, one row each, a + opening a sentence on it (owners' meeting,
 *  2026-10-19: readers from language models do not know these terms). Drawn wherever an element #ways exists. */
const CONTROL_WAYS = [
  ['Direct control', 'Agent', '⇄', 'Robot', 'The agent is the controller: it sends a command, reads what the robot sensed, and chooses the next command, step by step, inside its own reasoning loop. Most standard-mode attempts work this way.'],
  ['Code to control', 'Code', '→', 'Robot', 'The agent writes a program that turns goals into actions through tools such as inverse kinematics, a motion planner or a feedback controller, and the program drives the robot on its own; between runs the agent reads the outcome and fixes the code. Most privileged and standard-realtime attempts work this way.'],
  ['Train model to control', 'Model', '→', 'Robot', 'The agent trains a policy, for example with reinforcement learning in simulation, and lets the trained model drive the robot. The model can be any policy, not only a vision-language-action model. This is the rarest of the three.'],
];
function ways(el) {
  if (!el) return;
  el.innerHTML = `<p class="cw-lead">An agent can steer the robot itself (direct control), write the code that controls it (code to control), or train a model that controls it (train model to control). The exam does not prescribe which, and agents mix them.</p>
    <div class="cw-head"><span></span><span>While the robot acts</span><span></span></div>
    ${CONTROL_WAYS.map(([n, a, ar, b, txt], i) => { const w = WAYS[WAY_ORDER[i]]; return `<details class="cw-row"><summary><span class="cw-n">${n}</span><span class="cw-f"><b>${a}</b><i>${ar}</i><b>${b}</b></span><span class="cw-x" aria-hidden="true"></span></summary><p>${txt}${w?.slug ? ` <a href="${exam('run/')}?r=${encodeURIComponent(w.slug)}">See it in a real run →</a>` : ''}</p></details>`; }).join('')}`;
}

/** Time and compute: what one attempt gets, from the tasks' own budgets (data/tasks.json) and their declared resources. */
function budgets(el, tasks) {
  if (!el) return;
  const mins = (tasks || []).map((t) => t.budget_min).filter(Boolean);
  const h = (m) => (m % 60 ? `${m} minutes` : `${m / 60} hour${m > 60 ? 's' : ''}`);
  const lo = mins.length ? Math.min(...mins) : 30, hi = mins.length ? Math.max(...mins) : 240;
  el.innerHTML = `<b>Budgets.</b> Every attempt gets real time and real compute, as an engineer would: from ${h(lo)} to ${h(hi)} of agent time per task, depending on the suite, and a container with 2 to 16 CPU cores and 6 to 40 GB of memory. Suites built on GPU simulation backends (Isaac Sim, OmniGibson, SAPIEN) give the agent a GPU, and some tasks in Embodied Olympics - Fun and RoboEngineer offer one for training a policy.`;
}

/** The blog: the report and short analyses, newest first, from data/blogs.json ({slug, title, date, kind, summary, tags});
 *  each lives at blogs/<slug>/. */
async function blogPage() {
  const el = $('#posts');
  if (!el) return;
  let posts = [];
  try { posts = await getJSON('data/blogs.json'); } catch (e) { /* none yet */ }
  posts = (posts || []).filter((p) => p?.slug && p?.title).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  el.innerHTML = posts.length ? posts.map((p) => `<a class="post-card${p.featured ? ' featured' : ''}" href="${exam(`blogs/${encodeURIComponent(p.slug)}/`)}">
      <span class="pc-text">${p.badge ? `<span class="release-badge"><i aria-hidden="true">✦</i>${esc(p.badge)}</span>` : ''}<span class="pc-date">${esc([p.kind, p.date].filter(Boolean).join(' · '))}</span><h3>${esc(p.title)}</h3>${p.summary ? `<p>${esc(p.summary)}</p>` : ''}
      ${(p.tags || []).length ? `<span class="pc-tags">${p.tags.map((t) => `<i>${esc(t)}</i>`).join('')}</span>` : ''}${p.featured ? '<span class="pc-read">Read the report →</span>' : ''}</span>
      ${p.featured && p.video ? `<span class="pc-media"><video src="${esc(p.video)}"${p.poster ? ` poster="${esc(p.poster)}"` : ''} autoplay muted loop playsinline preload="metadata"></video></span>` : ''}</a>`).join('')
    : '<div class="empty-state">The first posts are on their way.</div>';
}

/** A suite's robots in a few words: its own label if it has one, else every kind of body it uses, most tasks first
 *  (owners, 2026-10-19: the Embodied Safety Exam has one-arm, two-arm and mobile robots, not only "One arm"). */
function bodyLabel(ex, s) {
  if (s.embodiment_label) return s.embodiment_label;
  const kinds = Object.entries(s.bodies || {}).sort((a, b) => b[1] - a[1]).map(([k]) => ex.bodies?.[k] || k);
  if (kinds.length < 2) return ex.bodies?.[s.body] || kinds[0] || '';
  const low = kinds.map((k, i) => (i ? k.charAt(0).toLowerCase() + k.slice(1) : k));
  return `${low.slice(0, -1).join(', ')} and ${low[low.length - 1]}`;
}

async function home(ex) {
  const t = ex.totals || {};
  $('#hero-lead').textContent = ex.hero?.lead || ex.summary || '';
  heroWall(ex);
  bigNumbers($('#bignums'), ex);
  flowDiagram($('#flowfig'), ex);
  ways($('#ways'));
  trustRow($('#trust'));
  homeBoard($('#lbh'), ex);
  heroRun($('#hero-run'), ex);
  oneLine($('.ol-open'), ex);
  gallery($('#gallery'), ex);
  getJSON('data/tasks.json').then((tasks) => budgets($('#budgets'), tasks)).catch(() => budgets($('#budgets'), []));
  // the task search (a small box under the title) and the task sphere: modules of their own, loaded when needed
  import('./search.js?v=fad66359').then((m) => m.homeSearch?.($('#home-search'), ex)).catch((e) => console.error(e));
  import('./sphere.js?v=8f724915').then((m) => m.homeSphere?.($('#sphere'), ex)).catch((e) => console.error(e));
}

async function leaderboardPage(ex) {
  const lb = ex.leaderboard || {};
  { const pre = $('#lb-pre-text'); if (pre) pre.textContent = lb.note || ''; }
  lbRules($('#lb-rules'), ex);
  const tasks = await loadTasks();
  lbBoard(ex, tasks, (d) => lbSuites($('#lb-suites'), ex, d.main, d.scores, d.set));
}

async function suitesPage(ex) {
  const chips = $('#suite-filter');
  const bodies = BODY_ORDER.filter((b) => ex.suites.some((s) => s.body === b));
  chips.innerHTML = `<button class="chip on" data-b="">All</button>${bodies.map((b) => `<button class="chip" data-b="${b}">${esc(ex.bodies?.[b] || b)}</button>`).join('')}
    <button class="chip" data-o="ours">EFE Originals</button>`;
  const state = {};
  chips.addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    $$('.chip', chips).forEach((c) => c.classList.toggle('on', c === b));
    state.body = b.dataset.b || ''; state.origin = b.dataset.o || '';
    suitesGrid($('#suites'), ex, state);
  });
  suitesGrid($('#suites'), ex, state);
}

/** A suite's results, as on the leaderboard (owners, 2026-10-19): the ranked agents, one setting at a time behind a
 *  switch (the settings this suite has core tests in, Core first), each on all the suite's core tests of the setting, a
 *  test without a result counted as failed. */
function suiteResults(el, ex, tasks) {
  if (!el) return;
  const runs = runMap(ex);
  const group = (ex.leaderboard?.shared?.runs || []).map((id) => runs[id] || { id, model: id });
  const sets = LB_SETTINGS.map((set) => ({ set, g: scoreGroup(group, tasks, set) })).filter((x) => x.g.tests);
  if (!group.length || !sets.length) { el.innerHTML = `<div class="empty-state">${sets.length ? 'No ranked agent yet.' : 'No core test in this suite.'}</div>`; return; }
  el.innerHTML = `<div class="lbh-top"><div class="seg lb-set"></div></div><div class="lbh-chart"><div class="lbh-ax"></div><div class="lbh-rows"></div></div>`;
  const draw = (id) => {
    const { set, g } = sets.find((x) => x.set.id === id) || sets[0];
    const P = (r) => pctOf(g.scores[r.id].v) ?? -1;
    const order = [...group].sort((a, b) => P(b) - P(a) || a.model.localeCompare(b.model));
    const best = Math.max(0, P(order[0]));
    let rank = 0, prev = null;
    $('.lbh-rows', el).innerHTML = order.map((r, i) => { if (P(r) !== prev) { rank = i + 1; prev = P(r); } return lbRow(r, g.scores[r.id].v, rank, best, set, { still: true }); }).join('');
    $('.lbh-ax', el).innerHTML = lbAxis(g.tests);
  };
  const sw = $('.lb-set', el);
  sw.innerHTML = '';
  settingSwitch(sw, sets[0].set.id, draw, sets.map((x) => x.set));
  draw(sets[0].set.id);
}

async function suitePage(ex) {
  const s = ex._suites[Q.get('id')] || ranked(ex)[0];
  document.title = `${s.name} · Embodied First Exam`;
  const cover = coverOf(s);
  const crop = cropFor(s.id, cover?.task);
  // the suite's own pages, always in this order: paper, website, code, then the rest (owners, 2026-10-18)
  const L = s.links || {};
  const ic = (n) => `<svg class="lk-ic" viewBox="0 0 24 24" aria-hidden="true">${FF_ICONS[n]}</svg>`;
  const ext = [['Paper', L.paper, ic('doc')], ['Website', L.website || L.project_page || L.project || L.site, '<svg class="lk-ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.5 3.9 5.5 3.9 9s-1.3 6.5-3.9 9c-2.6-2.5-3.9-5.5-3.9-9S9.4 5.5 12 3z"/></svg>'],
    ['Code', L.repository, `<span class="lk-gh" aria-hidden="true">${GITHUB}</span>`], ['Dataset', L.dataset], ['Docs', L.documentation],
    ['Challenge', L.challenge], ['Upstream leaderboard', L.leaderboard]]
    .filter(([, v]) => v).map(([label, v, icon]) => `<a class="btn small lk" href="${esc(v)}" target="_blank" rel="noopener">${icon || ''}${label} ↗</a>`).join('');
  const robots = (s.robots || []).map((r) => esc(r.name)).join(', ');
  const facts = [
    ['Origin', isOurs(s) ? 'built by the exam’s team, released with the exam' : s.origin === 'ours' ? 'built by the lab' : `adapted from the upstream benchmark${s.edition ? ` (${esc(s.edition)})` : ''}`],
    ['Simulator', esc(s.simulator || '')], ['Robot', robots],
    ['Tasks', tasksTests(s.instances, s.task_dirs)],   // tasks, then tests; no count per mode (owners, 2026-10-18/19)
    ['Reference solution', `full ${s.oracle?.full || 0} · partial ${s.oracle?.partial || 0} · none ${s.oracle?.none || 0}`],
    ['Agent time', (s.budgets_min || []).map((b) => `${b} min`).join(', ')],
  ].filter(([, v]) => v);
  $('#suite-head').innerHTML = `
    <div class="suite-hero">
      <div>
        <p class="kicker">${codeMark(s)} &nbsp;${s.example ? 'example task' : 'a suite of the exam'} · ${esc(bodyLabel(ex, s))}</p>
        <h1 style="margin:10px 0 0;font:800 clamp(40px,5.6vw,76px)/.95 var(--display);letter-spacing:-.035em">${esc(s.name)}${nameTag(s)}</h1>
        <p class="lead" style="margin:16px 0 0;font-size:18px;color:var(--ink-2)">${esc(s.blurb || '')}</p>
        <p class="desc">${prose(s.description || '')}</p>
        ${ext ? `<div class="link-list">${ext}</div>` : ''}
      </div>
 <div><div class="cover frame">${releaseTag(s, true)}${cover ? (cover.video ? `<video src="${esc(site(cover.video))}" poster="${esc(site(cover.poster || ''))}" muted loop autoplay playsinline${crop ? ` class="${crop}"` : ''}></video>` : poster(cover, crop)) : `<div class="placeholder-art">${esc(s.code)}</div>`}</div>
        <table class="facts-table" style="margin-top:16px"><tbody>${facts.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</tbody></table></div>
    </div>`;
  const tasks = (await loadTasks()).filter((t) => t.suite === s.id);
  $('#suite-tasks-count').textContent = tasksTests(tasks.length, tasks.reduce((n, t) => n + (t.modes?.length || 0), 0));
  suiteResults($('#suite-results'), ex, tasks);
  taskBrowser($('#tasks'), ex, tasks, { suite: s.id });
}

async function tasksPage(ex) {
  // [task search] search.js draws this page's search, filters and ranking (taskBrowser stays for a suite's page, and
  // here if the module fails to load); app.js lends it the cards, the results and the drawer.
  const mod = import('./search.js?v=fad66359').then((m) => { m.loadSearch(); return m; });
  const tasks = await loadTasks();
  const m = await mod.catch((e) => { console.error(e); });
  if (!m?.tasksSearch) return taskBrowser($('#tasks'), ex, tasks);
  const el = $('#tasks'), runs = boardRuns(ex);
  const index = new Map(tasks.map((t) => [`${t.suite}/${t.id}`, t]));
  drawerShell();
  // the models of the results filter: the ranked runs, by name (with the harness when two share a name), with their marks
  const named = (r) => runs.filter((x) => x.model === r.model).length > 1 ? `${r.model} (${r.harness})` : r.model;
  m.tasksSearch(el, ex, tasks, { card: (t) => taskCard(ex, t, runs), close: closeTask,
    result: resultOf, bodies: BODY_ORDER, legend: dotsKey(),
    models: runs.map((r) => ({ id: r.id, name: named(r), title: [r.model, r.harness, r.effort].filter(Boolean).join(' · '), mark: makerMark(r.model) })) });
  el.addEventListener('click', (e) => { const b = e.target.closest('[data-task]'); if (b && index.has(b.dataset.task)) openTask(ex, index.get(b.dataset.task), runs); });
  const want = taskKey(Q.get('task'), index);
  if (want && index.has(want)) openTask(ex, index.get(want), runs);
}

async function contributePage(ex) {
  const c = ex.contribute || {};
  const t = ex.totals || {};
  iconNumbers($('#c-figures'), [['layers', t.suites, 'suites in the exam'], ['arm', t.robots, 'robots'], ['doc', t.instances, 'tasks', `${int(t.task_dirs)} tests`]]);
  // (the five ways in and their links to the repository's documents are gone: owner, 2026-10-19)
  const info = coverageInfo(ex);
  thinSpots($('#thin'), ex, info);
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

/* ------------------------------------------------------------------------------------------------- one run */

// what a tool call did, one colour each (the strip's lanes, the log's rows, the filters)
const RUN_KINDS = {
  robot: { name: 'Robot', verb: 'drives the robot', icon: '<path d="M12 3v3M8 6h8a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"/><circle cx="9.5" cy="11" r="1.2"/><circle cx="14.5" cy="11" r="1.2"/><path d="M9 20h6M12 16v4"/>' },
  look: { name: 'Look', verb: 'looks at a picture', icon: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>' },
  edit: { name: 'Edit', verb: 'edits its code', icon: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="M13.5 6.5l4 4"/>' },
  shell: { name: 'Shell', verb: 'runs a command', icon: '<rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M7 10l3 2.5L7 15M12.5 15H17"/>' },
  other: { name: 'Tool', verb: 'calls a tool', icon: '<circle cx="12" cy="12" r="7"/>' },
};
const KIND_ORDER = ['robot', 'look', 'edit', 'shell'];
const runIcon = (k) => `<svg class="rk-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(RUN_KINDS[k] || RUN_KINDS.other).icon}</svg>`;
const clock = (s) => { s = Math.max(0, Math.round(s || 0)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`; };
const kTok = (n) => (n == null ? '–' : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n));
// the evaluation's bench names that differ from the site's suite ids
const BENCH_SUITE = { behavior: 'behavior-1k', mujoco_playground: 'mujoco-playground', robotwin_2_0: 'robotwin-2', cell: 'embodied-safety-exam', rsb: 'embodied-safety-exam', ese: 'embodied-safety-exam', ikea: 'roboarc',
  'roboolympics-fun': 'embodied-olympics-fun', 'roboolympics-match': 'embodied-olympics-match' };
// a run's setting, harness · model · effort, from the eval's run id (harness-model-effort, e.g. claude_code-opus_5_5-high)
const HARNESS_NAME = { codex: 'Codex', claude_code: 'Claude Code', antigravity_cli: 'Antigravity CLI', dsh: 'DSH' };
const RUN_MODEL_NAME = { gpt6_astra: 'GPT-6 Astra', gpt6_luna: 'GPT-6 Luna', gpt6_sol: 'GPT-6 Sol', gpt6_1_sol: 'GPT-6.1 Sol', opus_5_5: 'Claude Opus 5.5',
  glm_5_3_flash: 'GLM-5.3 Flash', qwen3_8_27b: 'Qwen3.8 27B', gemini_3_8_flash: 'Gemini 3.8 Flash', gemini_4_argon: 'Gemini 4 Argon', deepseek_v4_1_flash: 'DeepSeek V4.1 Flash' };
const settingOf = (r) => {
  const id = r.run || '';
  const h = Object.keys(HARNESS_NAME).find((k) => id.startsWith(k + '-'));
  if (!h) {   // no run id (older builds): the harness, model and effort fields
    const hn = /^codex/.test(r.agent || '') ? 'Codex' : /claude/.test(r.agent || '') ? 'Claude Code' : /antigravity/i.test(r.agent || '') ? 'Antigravity CLI' : /dsh/i.test(r.agent || '') ? 'DSH' : r.agent;
    const mn = MODEL_NAME[(r.model || '').replace(/-\d$/, '')] || r.model;
    return [hn, mn, r.effort].filter(Boolean).join(' · ');
  }
  const rest = id.slice(h.length + 1), effort = rest.slice(rest.lastIndexOf('-') + 1), model = rest.slice(0, rest.lastIndexOf('-'));
  return `${HARNESS_NAME[h]} · ${RUN_MODEL_NAME[model] || model} · ${effort}`;
};
const MODEL_NAME = { 'gpt-6-astra': 'GPT-6 Astra', 'gpt-6-luna': 'GPT-6 Luna', 'gpt-6-sol': 'GPT-6 Sol', 'gpt-6.1-sol': 'GPT-6.1 Sol', 'claude-opus-5-5': 'Claude Opus 5.5',
  'glm-5.3-flash': 'GLM-5.3 Flash', 'qwen3.8-27b': 'Qwen3.8 27B', 'gemini-3.8-flash': 'Gemini 3.8 Flash', 'gemini-4-argon': 'Gemini 4 Argon', 'deepseek-v4.1-flash': 'DeepSeek V4.1 Flash' };

/** A setting's name from its run id alone (the summary has no rows to fall back on); the id itself if it is not one. */
const settingName = (id) => (Object.keys(HARNESS_NAME).some((h) => id.startsWith(h + '-')) ? settingOf({ run: id }) : id);

/** The list of runs that can be watched step by step. The summary (index.json) comes first and fills the menus with
 *  the suites and their counts; then only the chosen suite's rows load (index/<suite>.json), the first suite in the
 *  site's own order unless ?suite= says otherwise. "All suites" loads every suite, a few at a time, and the list grows
 *  as they come in. The filters and pages work on the rows loaded. */
async function runIndex(ex, head) {
  head.innerHTML = '<p class="kicker">Runs</p><h1>Watch an agent work</h1>';
  $('#run-strip').remove();
  $('#run-side').remove();
  $('#run-log').innerHTML = '<div class="run-loading"><span class="spin"></span>Loading the runs…</div>';
  let sum;
  try { sum = await runSummary(); } catch (e) {
    $('#run-log').innerHTML = `<div class="empty-state">The list of runs could not be loaded (${esc(e.message)}). <a class="link" href="${esc(location.href)}">Try again</a></div>`;
    return;
  }
  const titleOf = (r) => r.task.replace(/-(privileged|standard|standard-realtime)$/, '').replace(new RegExp(`^${r.bench}[-_]`), '').replace(/-i\d\d$/, '')
    .replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const modeOf = (t) => (/-standard-realtime$/.test(t) ? 'standard-realtime' : /-standard$/.test(t) ? 'standard' : 'privileged');
  $('#run-log').classList.add('run-index');
  const suiteOf = (r) => ex._suites[runSuite(r)] || {};
  const okOf = (r) => r.success === 1 || r.state === 'success';
  // the suites with runs in the site's order (the team's suites first), then any the site does not list, by id
  const counts = sum.suites || {};
  const order = [...ex.suites.map((s) => s.id).filter((id) => counts[id]), ...Object.keys(counts).filter((id) => counts[id] && !ex._suites[id]).sort()];
  const nameOf = (id) => ex._suites[id]?.name || id;
  let view = 'list';
  try { view = localStorage.getItem('exam-runs-view') || 'list'; } catch (e) { /* private mode */ }
  const per = () => (view === 'list' ? 50 : 24);
  const want = Q.get('suite');
  const st = { suite: want === 'all' || order.includes(want) ? want : order[0] || 'all', setting: Q.get('setting') || '', out: '', mode: '', q: '', page: Math.max(1, +Q.get('page') || 1) };
  const settings = Object.keys(sum.settings || {}).filter((id) => id && id !== 'undefined').map((id) => [id, settingName(id)]).sort((a, b) => a[1].localeCompare(b[1]));
  // what has loaded: rows by suite, the error of each suite that failed, the suites on their way
  const got = new Map(), bad = new Map(), coming = new Set();
  const scope = () => (st.suite === 'all' ? order : [st.suite]);
  const load = (id) => {
    if (got.has(id) || coming.has(id)) return Promise.resolve();
    coming.add(id); bad.delete(id);
    return runShard(id).then((rows) => { got.set(id, rows); }, (e) => { bad.set(id, e.message); }).finally(() => { coming.delete(id); draw(); });
  };
  // all suites: four at a time, in the site's order
  const loadScope = () => {
    const queue = scope().filter((id) => !got.has(id));
    const next = () => (queue.length ? load(queue.shift()).then(next) : null);
    return Promise.all(Array.from({ length: Math.min(4, queue.length) }, next));
  };
  // the rows to show: the suites in order up to the first one still loading, so rows already shown never move as
  // later suites arrive (a suite that failed is skipped, and said so)
  const loaded = () => { const out = []; for (const id of scope()) { if (got.has(id)) out.push(...got.get(id)); else if (!bad.has(id)) break; } return out; };
  const row = (r) => {
    const s = suiteOf(r), ok = okOf(r);
    return `<a class="rr" href="${exam('run/')}?r=${encodeURIComponent(r.slug)}">
      <span class="rr-pic">${r.poster ? `<img loading="lazy" src="${esc(runURL(r.poster))}" alt="">` : ''}</span>
      <span class="rr-task"><b>${esc(titleOf(r))}</b><small>${s.code ? codeMark(s) : ''} ${esc(s.name || r.bench)} · ${esc(modeOf(r.task))}</small></span>
      <span class="rr-model">${esc(settingOf(r))}</span>
      <span class="run-verdict ${ok ? 'ok' : 'no'}">${ok ? 'Solved' : 'Not solved'}</span>
      <span class="rr-n">${clock(r.wall_s)}</span><span class="rr-n">${int(r.steps)}</span>
      <span class="ri-bars rr-bars">${KIND_ORDER.map((k) => `<span class="k-${k}" style="flex:${r.kinds?.[k] || 0}" title="${esc(RUN_KINDS[k].name)}: ${int(r.kinds?.[k] || 0)}"></span>`).join('')}</span>
      <span class="rr-n">$${(r.usd ?? 0).toFixed(2)}</span></a>`;
  };
  const card = (r) => {
    const s = suiteOf(r), ok = okOf(r);
    return `<a class="ri-card" href="${exam('run/')}?r=${encodeURIComponent(r.slug)}">
      <div class="ri-pic">${r.poster ? `<img loading="lazy" src="${esc(runURL(r.poster))}" alt="">` : ''}<span class="run-verdict ${ok ? 'ok' : 'no'}">${ok ? 'Solved' : 'Not solved'}</span></div>
      <div class="ri-body"><div class="ri-k">${s.code ? codeMark(s) : ''} ${esc(s.name || r.bench)} · ${esc(modeOf(r.task))}</div><h4>${esc(titleOf(r))}</h4>
        <div class="ri-meta">${esc(settingOf(r))} · ${clock(r.wall_s)} · ${int(r.steps)} steps</div>
        <div class="ri-bars">${KIND_ORDER.map((k) => `<span class="k-${k}" style="flex:${r.kinds?.[k] || 0}" title="${esc(RUN_KINDS[k].name)}: ${int(r.kinds?.[k] || 0)}"></span>`).join('')}</div></div></a>`;
  };
  $('#run-log').innerHTML = `<div class="ri-tools">
      <input type="search" id="ri-q" placeholder="Search tasks" aria-label="Search tasks">
      <select id="ri-setting" aria-label="Setting"><option value="">All settings</option>${settings.map(([id, n]) => `<option value="${esc(id)}"${id === st.setting ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>
      <select id="ri-suite" aria-label="Suite">${order.map((id) => `<option value="${esc(id)}"${id === st.suite ? ' selected' : ''}>${esc(nameOf(id))} (${int(counts[id])})</option>`).join('')}
        <option value="all"${st.suite === 'all' ? ' selected' : ''}>All suites (${int(sum.total ?? order.reduce((n, id) => n + counts[id], 0))})</option></select>
      <select id="ri-mode" aria-label="Mode"><option value="">Both modes</option><option value="privileged">Privileged</option><option value="standard">Standard</option><option value="standard-realtime">Standard, real time</option></select>
      <div class="ri-out">${[['', 'All'], ['ok', 'Solved'], ['no', 'Not solved']].map(([v, n]) => `<button type="button" class="chip${v === '' ? ' on' : ''}" data-out="${v}">${n}</button>`).join('')}</div>
      <span class="ri-count" id="ri-count"></span>
      <div class="ri-view" role="group" aria-label="View">${[['list', 'List'], ['grid', 'Cards']].map(([v, n]) => `<button type="button" class="chip${v === view ? ' on' : ''}" data-view="${v}">${n}</button>`).join('')}</div></div>
    <div class="ri-grid" id="ri-grid"></div><nav class="ri-pager" id="ri-pager" aria-label="Pages"></nav>`;
  const draw = () => {
    const q = st.q.toLowerCase();
    const waiting = scope().filter((id) => !got.has(id) && !bad.has(id)), failed = scope().filter((id) => bad.has(id));
    const list = loaded().filter((r) => (!st.setting || r.run === st.setting) && (!st.mode || modeOf(r.task) === st.mode)
      && (!st.out || (st.out === 'ok') === okOf(r)) && (!q || `${titleOf(r)} ${r.task} ${suiteOf(r).name || ''}`.toLowerCase().includes(q)));
    const pages = Math.max(1, Math.ceil(list.length / per()));
    if (!waiting.length) st.page = Math.min(st.page, pages);   // while suites still arrive, a page asked for may not exist yet
    const g = $('#ri-grid');
    g.className = view === 'list' ? 'ri-list' : 'ri-grid';
    const shown = list.slice((st.page - 1) * per(), st.page * per());
    const more = waiting.length && st.page >= pages
      ? `<div class="ri-wait"><span class="spin"></span>${st.suite === 'all' ? `Loading ${waiting.length === order.length ? 'the runs' : `${int(waiting.length)} more suite${waiting.length > 1 ? 's' : ''}`}…` : `Loading the runs of ${esc(nameOf(st.suite))}…`}</div>` : '';
    const fail = failed.length ? `<div class="ri-wait bad">The runs of ${failed.map((id) => esc(nameOf(id))).join(', ')} could not be loaded (${esc(bad.get(failed[0]))}).<button type="button" class="btn small" data-retry>Try again</button></div>` : '';
    g.innerHTML = (view === 'list' && shown.length ? '<div class="rr rr-head"><span></span><span>Task</span><span>Setting</span><span>Result</span><span class="rr-n">Time</span><span class="rr-n">Steps</span><span>What it did</span><span class="rr-n">Cost</span></div>' : '')
      + shown.map(view === 'list' ? row : card).join('') + more + fail
      + (!shown.length && !more && !fail ? '<p class="muted">No run matches.</p>' : '');
    const from = shown.length ? (st.page - 1) * per() + 1 : 0, to = from ? from + shown.length - 1 : 0;
    $('#ri-count').textContent = (waiting.length || failed.length) && !list.length ? '' : `${int(from)}–${int(to)} of ${int(list.length)} runs${waiting.length ? ' so far' : ''}`;
    // page numbers: the first, the last, and two either side of the current one; gaps as an ellipsis
    const nums = [...new Set([1, pages, ...Array.from({ length: 5 }, (_, k) => st.page - 2 + k)])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
    const btn = (n, label, extra = '') => `<button type="button" class="pg${n === st.page && !extra ? ' on' : ''}" data-page="${n}"${extra}>${label}</button>`;
    $('#ri-pager').innerHTML = pages < 2 ? '' : `${btn(st.page - 1, '← Previous', st.page === 1 ? ' disabled' : ' data-nav="1"')}
      <span class="pg-nums">${nums.map((n, k) => `${k && n - nums[k - 1] > 1 ? '<span class="pg-gap">…</span>' : ''}${btn(n, int(n))}`).join('')}</span>
      ${btn(st.page + 1, 'Next →', st.page >= pages ? ' disabled' : ' data-nav="1"')}
      <label class="pg-jump">Page <input type="number" min="1" max="${pages}" value="${st.page}" aria-label="Go to page"> of ${int(pages)}</label>`;
    const u = new URL(location.href);
    u.searchParams.set('suite', st.suite);
    st.setting ? u.searchParams.set('setting', st.setting) : u.searchParams.delete('setting');
    st.page > 1 ? u.searchParams.set('page', st.page) : u.searchParams.delete('page');
    history.replaceState(null, '', u);
  };
  $('#ri-q').addEventListener('input', (e) => { st.q = e.target.value; st.page = 1; draw(); });
  $('#ri-suite').addEventListener('change', (e) => { st.suite = e.target.value; st.page = 1; draw(); loadScope(); });
  $('#ri-setting').addEventListener('change', (e) => { st.setting = e.target.value; st.page = 1; draw(); });
  $('#ri-mode').addEventListener('change', (e) => { st.mode = e.target.value; st.page = 1; draw(); });
  $$('.ri-out .chip').forEach((c) => c.addEventListener('click', () => { $$('.ri-out .chip').forEach((d) => d.classList.toggle('on', d === c)); st.out = c.dataset.out; st.page = 1; draw(); }));
  const go = (n) => { st.page = n; draw(); $('#run-log').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  $('#ri-pager').addEventListener('click', (e) => { const b = e.target.closest('button[data-page]'); if (b && !b.disabled) go(+b.dataset.page); });
  $('#ri-pager').addEventListener('change', (e) => { if (e.target.matches('.pg-jump input')) go(Math.max(1, Math.round(+e.target.value) || 1)); });
  $('#ri-grid').addEventListener('click', (e) => { if (e.target.closest('[data-retry]')) { [...bad.keys()].forEach((id) => bad.delete(id)); draw(); loadScope(); } });
  $$('.ri-view .chip').forEach((c) => c.addEventListener('click', () => {
    view = c.dataset.view; $$('.ri-view .chip').forEach((d) => d.classList.toggle('on', d === c));
    try { localStorage.setItem('exam-runs-view', view); } catch (e) { /* private mode */ }
    st.page = 1; draw();
  }));
  draw();
  loadScope();
}

// a run's slug under its suite's other name (runs built before a rename keep theirs; a rebuilt index may use the new one)
const SLUG_RENAMED = [['roboolympics-fun-', 'embodied-olympics-fun-'], ['roboolympics-match-', 'embodied-olympics-match-']];
const otherSlug = (slug) => { for (const [a, b] of SLUG_RENAMED) { if (slug.startsWith(a)) return b + slug.slice(a.length); if (slug.startsWith(b)) return a + slug.slice(b.length); } return null; };
async function runPage(ex) {
  let slug = Q.get('r');
  const head = $('#run-head');
  if (!slug) return runIndex(ex, head);
  let r;
  head.innerHTML = '<p class="kicker">Run</p><h1>&nbsp;</h1>';
  $('#run-log').innerHTML = '<div class="run-loading"><span class="spin"></span>Loading the run: every step, command and picture…</div>';
  try { r = await runJSON(`${slug}.json`).catch((e) => { const alt = otherSlug(slug); if (!alt) throw e; return runJSON(`${alt}.json`).then((x) => { slug = alt; return x; }, () => { throw e; }); }); } catch (e) { head.innerHTML = `<p class="kicker">Run</p><h1>Run not found</h1><p class="lead">${esc(slug)}</p>`; $('#run-log').innerHTML = `<div class="empty-state">This run could not be loaded. <a href="${exam('run/')}">All runs →</a></div>`; return; }
  const s = ex._suites[BENCH_SUITE[r.bench] || r.bench] || {};
  const mode = /-standard-realtime$/.test(r.task) ? 'standard-realtime' : /-standard$/.test(r.task) ? 'standard' : 'privileged';
  const title = (r.task.replace(/-(privileged|standard|standard-realtime)$/, '').replace(new RegExp(`^${r.bench}[-_]`), '').replace(/-i\d\d$/, '')
    .replace(/[-_]+/g, ' ')).replace(/\b\w/g, (c) => c.toUpperCase());
  document.title = `${title} · run · Embodied First Exam`;
  const steps = r.steps || [];
  const total = Math.max(r.wall_s || 0, (steps[steps.length - 1]?.t || 0) + 5);
  const count = (k) => steps.reduce((a, st) => a + st.calls.filter((c) => c.kind === k).length, 0);
  // a run's own totals (sim_total) count every robot command even where a step cannot be matched to it
  const submits = Math.max(r.sim_total?.submit || 0, steps.reduce((a, st) => a + (st.sim?.submit || 0), 0)), resets = Math.max(r.sim_total?.reset || 0, steps.reduce((a, st) => a + (st.sim?.reset || 0), 0));
  // some harnesses do not record when each step happened: their step times are estimated, shown with ≈
  const est = r.step_times === 'estimated', at = (t) => `${est ? '≈' : ''}${clock(t)}`, estTip = est ? ' title="Estimated: this harness does not record when each step happened"' : '';
  const solved = r.success === 1 || r.state === 'success';
  const model = settingOf(r);
  head.innerHTML = `<p class="kicker">${s.code ? codeMark(s) : ''} ${esc(s.name || r.bench)} · ${esc(mode)} · one run</p>
    <h1>${esc(title)}</h1>
    <div class="run-who"><span class="run-model">${esc(model)}</span><span class="run-verdict ${solved ? 'ok' : 'no'}">${solved ? 'Solved' : 'Not solved'}</span>
      <span class="run-links" id="run-links"><a class="btn small" href="${exam('run/')}">All runs</a></span></div>
    <dl class="run-stats">
      <div><dt>Time</dt><dd>${clock(r.wall_s)}</dd></div>
      <div><dt>Model calls</dt><dd>${int(steps.length)}</dd></div>
      <div><dt>Robot commands</dt><dd>${int(submits)}${resets ? `<small> · ${resets} reset${resets > 1 ? 's' : ''}</small>` : ''}</dd></div>
      <div><dt>Pictures seen</dt><dd>${int(count('look'))}</dd></div>
      <div><dt>Tokens</dt><dd>${kTok(r.tokens?.in)}<small> in · ${kTok(r.tokens?.out)} out</small></dd></div>
      <div><dt>Cost</dt><dd>$${(r.tokens?.usd ?? 0).toFixed(2)}</dd></div>
    </dl>
    ${r.task_text ? `<details class="run-task"><summary>The task, as the agent read it</summary><pre>${esc(r.task_text)}</pre></details>` : ''}`;

  // the task this run sat and the other runs of it: from the run's suite's rows only (watchable), not the whole index
  watchable(BENCH_SUITE[r.bench] || r.bench).then((m) => {
    const mine = [...m.values()].find((rows) => rows.some((x) => x.slug === slug)) || [];
    const me = mine.find((x) => x.slug === slug);
    if (!me?.site || !$('#run-links')) return;
    const others = mine.filter((x) => x.slug !== slug);
    $('#run-links').insertAdjacentHTML('afterbegin', `<a class="btn small primary" href="${exam('tasks/')}?task=${encodeURIComponent(me.site)}">Open the task <span class="arr">→</span></a>`
      + others.map((o) => `<a class="btn small" href="${exam('run/')}?r=${encodeURIComponent(o.slug)}">${esc(settingOf(o))} · ${/-standard/.test(o.task) ? 'standard' : 'privileged'}</a>`).join(''));
  });

  // ---- the strip: one lane per kind of action over the run's clock, the context growing behind, a playhead
  const W = 1000, laneH = 15, top = 8, lanes = KIND_ORDER.length, H = top + lanes * laneH + 30;
  const x = (t) => ((t / total) * W).toFixed(1);
  const maxIn = Math.max(1, ...steps.map((st) => st.tok?.in || 0));
  const area = steps.length > 1 ? `M0,${H - 4} ${steps.map((st) => `L${x(st.t)},${(H - 4 - ((st.tok?.in || 0) / maxIn) * 24).toFixed(1)}`).join(' ')} L${x(steps[steps.length - 1].t)},${H - 4} Z` : '';
  const marks = steps.flatMap((st, i) => {
    const kinds = [...new Set(st.calls.map((c) => c.kind))];
    return kinds.filter((k) => KIND_ORDER.includes(k)).map((k) => `<rect class="lane-mark k-${k}" data-i="${i}" x="${x(st.t)}" y="${top + KIND_ORDER.indexOf(k) * laneH + 2}" width="${Math.max(2.4, ((steps[i + 1]?.t ?? st.t + 4) - st.t) / total * W - 1).toFixed(1)}" height="${laneH - 4}" rx="2"/>`);
  }).join('');
  const resetMarks = steps.map((st, i) => (st.sim?.reset ? `<line class="lane-reset" x1="${x(st.t)}" x2="${x(st.t)}" y1="${top - 4}" y2="${top + lanes * laneH}"/>` : '')).join('');
  $('#run-strip').innerHTML = `<div class="run-strip">
    <div class="rs-ctrl"><button class="rs-play" type="button" aria-label="Play the run"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="pl" d="M8 5v14l11-7z"/><path class="pa" d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg></button>
      <div class="rs-time"><b id="rs-now">0:00</b> / ${clock(total)}</div></div>
    <div class="rs-lanes">${KIND_ORDER.map((k) => `<span class="k-${k}">${runIcon(k)}${RUN_KINDS[k].name}</span>`).join('')}<span class="rs-ctx">context</span></div>
    <svg class="rs-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      ${KIND_ORDER.map((k, j) => `<rect class="lane-bg" x="0" y="${top + j * laneH}" width="${W}" height="${laneH}"/>`).join('')}
      <path class="rs-area" d="${area}"/>${marks}${resetMarks}
      <line class="rs-head" id="rs-head" x1="0" x2="0" y1="0" y2="${H}"/>
    </svg></div>`;

  // ---- the side: what the agent saw at this moment, and what the robot finally did
  $('#run-side').innerHTML = `<div class="rv-card rv-eye"><div class="rv-label">${runIcon('look')} What the agent was looking at</div>
      <div class="rv-pic"><img id="rv-img" alt=""><div class="rv-none" id="rv-none">No picture yet: the agent has not looked at the robot.</div></div>
      <div class="rv-cap" id="rv-cap"></div></div>
    ${r.replay ? `<div class="rv-card rv-out"><div class="rv-label">${runIcon('robot')} What the robot did</div>
      <video src="${esc(runURL(r.replay))}" ${r.replay_last ? `poster="${esc(runURL(r.replay_last))}"` : ''} controls muted loop playsinline preload="metadata"></video>
      <div class="rv-cap">The verifier replays the agent's final trajectory in a fresh simulator; this is that replay.</div></div>` : ''}`;

  // ---- the log
  const filters = ['all', 'say', ...KIND_ORDER];
  const fname = { all: 'Everything', say: 'Messages', robot: 'Robot', look: 'Pictures', edit: 'Edits', shell: 'Shell' };
  const stepHTML = (st, i) => {
    const kinds = [...new Set(st.calls.map((c) => c.kind))];
    const calls = st.calls.map((c, j) => `<details class="rc k-${c.kind}"><summary>${runIcon(c.kind)}<span class="rc-verb">${esc(RUN_KINDS[c.kind]?.verb || 'calls a tool')}</span><span class="rc-lab">${esc(c.label)}</span></summary><pre class="rc-code">${esc(c.code)}</pre></details>`).join('');
    const o = st.out || {};
    const bad = (o.exit || []).some((e) => e !== 0);
    const outLines = (o.text || '').split('\n');
    const out = o.text || o.pics?.length ? `<div class="ro ${bad ? 'bad' : ''}"><div class="ro-head"><span>Back to the agent</span>${(o.exit || []).length ? `<span class="ro-exit">exit ${o.exit.map((e) => esc(e)).join(', ')}</span>` : ''}</div>
      ${o.text ? (outLines.length > 6 || o.text.length > 520 ? `<details class="ro-more"><summary><pre>${esc(outLines.slice(0, 5).join('\n').slice(0, 480))}</pre><span class="ro-expand">show all ${int(outLines.length)} lines</span></summary><pre>${esc(o.text)}</pre></details>` : `<pre>${esc(o.text)}</pre>`) : ''}
      ${o.pics?.length ? `<div class="ro-pics">${o.pics.map((p) => `<img loading="lazy" src="${esc(runURL(p))}" alt="what the agent saw">`).join('')}</div>` : ''}</div>` : '';
    const sim = st.sim?.submit || st.sim?.reset ? `<span class="rt-sim">${st.sim.submit ? `${st.sim.submit} command${st.sim.submit > 1 ? 's' : ''} to the robot` : ''}${st.sim.reset ? ` · reset` : ''}</span>` : '';
    return `<article class="rstep" data-i="${i}" data-kinds="${['all', ...(st.say ? ['say'] : []), ...kinds].join(' ')}">
      <div class="rt"><span class="rt-time"${estTip}>${at(st.t)}</span><span class="rt-n">step ${i + 1}</span>${sim}<span class="rt-tok" title="prompt tokens · new output tokens · cost">${kTok(st.tok?.in)} ctx · +${int(st.tok?.out)} · $${(st.tok?.usd || 0).toFixed(2)}</span></div>
      ${st.say ? `<div class="rsay">${prose(st.say)}</div>` : ''}${calls}${out}</article>`;
  };
  $('#run-log').innerHTML = `<div class="rl-head"><div class="rl-bar">${filters.map((f) => `<button type="button" class="chip${f === 'all' ? ' on' : ''}" data-f="${f}">${f !== 'all' && f !== 'say' ? runIcon(f) : ''}${fname[f]}</button>`).join('')}</div><button type="button" class="chip rl-follow" hidden>↓ Current step</button></div>
    <div class="rl-steps">${steps.map(stepHTML).join('')}</div>
    <div class="rl-end ${solved ? 'ok' : 'no'}">${solved ? 'The verifier replayed the final trajectory and the task was solved.' : 'The run ended without solving the task.'}</div>`;

  // ---- behaviour: the current step drives the strip's playhead and the agent's view
  // The strip, the agent's view and the replay stay on screen (one screen-high stage); only the log scrolls, inside its
  // own box. Playing follows the current step there and never moves the page; scrolling the log by hand stops the following.
  $('#run-stage').classList.add('on');
  const log = $('#run-log'), followBtn = $('.rl-follow');
  const arts = $$('.rstep');
  let follow = true, quietIO = 0;
  const showStep = (a, smooth = true) => {
    if (!a || a.hidden) return;
    const bar = $('.rl-head', log).offsetHeight, room = log.clientHeight - bar;
    const off = Math.min(room * 0.3, Math.max(12, room - a.offsetHeight - 12));
    quietIO = performance.now() + 900;
    log.scrollTo({ top: Math.max(0, log.scrollTop + a.getBoundingClientRect().top - log.getBoundingClientRect().top - bar - off), behavior: smooth ? 'smooth' : 'instant' });
  };
  const picAt = (i) => { for (let k = i; k >= 0; k--) if (steps[k].out?.pics?.length) return [k, steps[k].out.pics[steps[k].out.pics.length - 1]]; return [-1, null]; };
  let cur = -1;
  const setStep = (i, scroll) => {
    if (i === cur || i < 0 || i >= steps.length) return;
    cur = i;
    arts.forEach((a, k) => a.classList.toggle('on', k === i));
    $('#rs-head').setAttribute('x1', x(steps[i].t)); $('#rs-head').setAttribute('x2', x(steps[i].t));
    $('#rs-now').textContent = at(steps[i].t);
    $$('.lane-mark').forEach((m) => m.classList.toggle('on', +m.dataset.i === i));
    const [k, p] = picAt(i);
    const img = $('#rv-img');
    if (p && img.dataset.src !== p) { img.classList.remove('in'); img.parentElement.classList.add('loading'); img.onload = () => { img.classList.add('in'); img.parentElement.classList.remove('loading'); }; img.src = runURL(p); img.dataset.src = p; }
    $('#rv-none').hidden = !!p; img.hidden = !p;
    $('#rv-cap').textContent = p ? `Step ${k + 1} · ${at(steps[k].t)}${k < i ? ` (the latest picture by step ${i + 1})` : ''}` : '';
    if (scroll) showStep(arts[i]);
  };
  const io = new IntersectionObserver((es) => {
    if (playing || performance.now() < quietIO) return;
    const vis = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
    if (vis.length) setStep(+vis[0].target.dataset.i);
  }, { root: log, rootMargin: '-35% 0px -55% 0px' });
  arts.forEach((a) => io.observe(a));
  setStep(0);
  // a link to one step (?s=<step number>) opens the log there
  const s0 = parseInt(Q.get('s'), 10) - 1;
  if (s0 > 0 && s0 < steps.length) { setStep(s0); requestAnimationFrame(() => showStep(arts[s0], false)); }
  // the strip: click or drag to a moment
  const svg = $('.rs-svg');
  const seek = (ev) => {
    const b = svg.getBoundingClientRect(), t = ((ev.clientX - b.left) / b.width) * total;
    let i = 0; while (i + 1 < steps.length && steps[i + 1].t <= t) i++;
    const hidden = arts[i].hidden; if (hidden) { $$('.rl-bar .chip[data-f]').forEach((c) => c.classList.toggle('on', c.dataset.f === 'all')); arts.forEach((a) => { a.hidden = false; }); }
    follow = true; followBtn.hidden = true;
    setStep(i, true);
  };
  let drag = false;
  svg.addEventListener('pointerdown', (e) => { drag = true; svg.setPointerCapture(e.pointerId); seek(e); });
  svg.addEventListener('pointermove', (e) => { if (drag) seek(e); });
  svg.addEventListener('pointerup', () => { drag = false; });
  // play: walk through the steps, a beat each (longer where the agent wrote something or looked at a picture)
  let playing = false, timer = null;
  const btn = $('.rs-play');
  const tick = () => {
    if (!playing) return;
    const n = cur + 1;
    if (n >= steps.length) { playing = false; btn.classList.remove('on'); followBtn.hidden = true; return; }
    setStep(n, follow);
    const st = steps[n];
    timer = setTimeout(tick, 900 + (st.say ? 1400 : 0) + (st.out?.pics?.length ? 700 : 0));
  };
  btn.addEventListener('click', () => {
    playing = !playing; btn.classList.toggle('on', playing);
    clearTimeout(timer);
    follow = true; followBtn.hidden = true;
    if (playing) { if (cur >= steps.length - 1) cur = -1; tick(); }
  });
  // the viewer scrolls the log while it plays: stop following until Play is pressed again or "Current step"
  const byHand = (e) => {
    if (!playing || !follow || (e.type === 'pointerdown' && e.target !== log)) return;
    if (e.type === 'keydown' && !['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) return;
    follow = false; followBtn.hidden = false;
  };
  ['wheel', 'touchmove', 'pointerdown', 'keydown'].forEach((t) => log.addEventListener(t, byHand, { passive: true }));
  followBtn.addEventListener('click', () => { follow = true; followBtn.hidden = true; showStep(arts[cur]); });
  // filters
  $$('.rl-bar .chip[data-f]').forEach((c) => c.addEventListener('click', () => {
    $$('.rl-bar .chip[data-f]').forEach((d) => d.classList.toggle('on', d === c));
    arts.forEach((a) => { a.hidden = !a.dataset.kinds.split(' ').includes(c.dataset.f); });
  }));
  // a picture in the log opens large
  $('#run-log').addEventListener('click', (e) => {
    // a click on a step makes it the current one (the playhead, the agent's view); the page stays where it is
    const a = e.target.closest('.rstep');
    if (a) setStep(+a.dataset.i);
    const im = e.target.closest('.ro-pics img');
    if (!im) return;
    document.body.insertAdjacentHTML('beforeend', `<div class="rv-zoom" role="dialog"><img src="${esc(im.src)}" alt=""></div>`);
    $('.rv-zoom').addEventListener('click', (ev) => ev.currentTarget.remove());
  });
}

/* ------------------------------------------------------------------------------------------------- boot */

chrome();
loadExam().then(async (raw) => {
  const ex = prepare(raw);
  footer(ex);
  headWall(ex);
  const pages = { home, leaderboard: leaderboardPage, suites: suitesPage, suite: suitePage, tasks: tasksPage, contribute: contributePage,
    how: async (ex) => flowDiagram($('#flowfig'), ex), run: runPage, blogpost: async (ex) => { flowDiagram($('#flowfig'), ex); ways($('#ways')); }, blog: blogPage, notfound: async () => {} };
  await (pages[PAGE] || home)(ex);
  fillIcons();
  reveal();
}).catch((err) => {
  console.error(err);
  const m = document.querySelector('main');
  if (m) m.insertAdjacentHTML('afterbegin', `<div class="section"><div class="empty-state">The exam’s data could not be loaded (${esc(err.message)}). It is written when the site is built.</div></div>`);
});
