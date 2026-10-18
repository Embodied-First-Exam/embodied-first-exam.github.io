/** The task sphere on the home page: every task of the exam a dot on a sphere, placed by what its description means
 * (data/atlas.json: a spherical t-SNE of the tasks' text embeddings, so close dots are similar tasks), coloured by body,
 * task type, capability or suite. Canvas 2D, one draw per frame, nothing drawn while the section is off screen.
 *
 * homeSphere(el, ex): el is the empty #sphere box, ex is data/exam.json. data/atlas.json and data/tasks.json are fetched
 * only when the box comes near the viewport. */

const STYLE = new URL('./sphere.css?v=ae7b4a80', import.meta.url);
const DATA = (p) => new URL(`../${p}`, import.meta.url).href;
const PAGE = (p) => new URL(`../${p}`, import.meta.url).href;
const BODY_ORDER = ['arm', 'bimanual', 'mobile', 'humanoid', 'quadruped', 'hand', 'musculoskeletal', 'aerial'];
const SLOTS = 9;                    // colour slots in the stylesheet (--sph-c1 .. --sph-c9); a mode with more categories folds the rest
const SUITE_SLOTS = 8;              // suites beyond the eight largest share one neutral "other" entry
const SPIN = 0.00006;               // auto-rotation, rad/ms (a slow turn, about 1 min 45 s)
const HAZE_SCALE = 1 / 3;          // the density haze is drawn at this fraction of the canvas size (CSS px)
const IDLE = 18000;                 // ms after the last click, drag, zoom or key before the rotation resumes (owners, 2026-10-18)
const int = (n) => Number(n || 0).toLocaleString('en-US');

/* ---------- small quaternion kit (w, x, y, z) ---------- */
const qmul = (a, b) => [a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3], a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
  a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1], a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0]];
const qaxis = (x, y, z, ang) => { const s = Math.sin(ang / 2); return [Math.cos(ang / 2), x * s, y * s, z * s]; };
const qnorm = (q) => { const n = Math.hypot(q[0], q[1], q[2], q[3]); return [q[0] / n, q[1] / n, q[2] / n, q[3] / n]; };
function qmat(q, M) {
  const [w, x, y, z] = q;
  M[0] = 1 - 2 * (y * y + z * z); M[1] = 2 * (x * y - w * z); M[2] = 2 * (x * z + w * y);
  M[3] = 2 * (x * y + w * z); M[4] = 1 - 2 * (x * x + z * z); M[5] = 2 * (y * z - w * x);
  M[6] = 2 * (x * z - w * y); M[7] = 2 * (y * z + w * x); M[8] = 1 - 2 * (x * x + y * y);
  return M;
}
function slerp(a, b, t) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  if (d < 0) { b = b.map((x) => -x); d = -d; }
  if (d > 0.9995) return qnorm(a.map((x, i) => x + t * (b[i] - x)));
  const th = Math.acos(d), sn = Math.sin(th);
  return a.map((x, i) => (Math.sin((1 - t) * th) * x + Math.sin(t * th) * b[i]) / sn);
}
function fromTo(u, v) {
  const d = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  return qnorm([1 + d, u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]);
}

/** A CSS colour as [r, g, b], whatever notation the stylesheet uses. */
function rgb(c) {
  const x = document.createElement('canvas').getContext('2d');
  x.fillStyle = '#000'; x.fillStyle = c;
  const v = x.fillStyle;
  if (v[0] === '#') return [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16));
  return (v.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).map(Number);
}
const el$ = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

export function homeSphere(el, ex) {
  if (!el || el.dataset.sph) return;
  el.dataset.sph = '1';
  el.classList.add('sph');
  let link = document.querySelector('link[data-sph]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = STYLE.href; link.dataset.sph = '1';
    document.head.appendChild(link);
  }
  // the colours live in the stylesheet: wait for it before the first draw
  const styled = link.sheet ? Promise.resolve() : new Promise((res) => { link.addEventListener('load', res, { once: true }); link.addEventListener('error', res, { once: true }); });
  // keep the space while the data is on its way, so nothing below jumps
  const stage0 = el$('div', 'sph-stage');
  stage0.appendChild(el$('div', 'sph-load'));
  el.appendChild(stage0);

  let started = false;
  const go = () => {
    if (started) return;
    started = true;
    // a busy connection can drop a request while the page's pictures and videos load: try twice more before giving up
    const get = (p, left = 2) => fetch(DATA(p)).then((r) => { if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`); return r.json(); })
      .catch((e) => { if (left <= 0) throw e; return new Promise((res) => setTimeout(res, 1200)).then(() => get(p, left - 1)); });
    Promise.all([get('data/atlas.json'), get('data/tasks.json'), styled])
      .then(([atlas, tasks]) => { el.textContent = ''; build(el, ex || {}, atlas, tasks, 'all'); })
      .catch((e) => console.error(e));
  };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); go(); } }, { rootMargin: '900px 0px' });
    io.observe(el);
  } else go();
}

/** The tasks as flat arrays, and the four ways to colour them. */
function prepare(ex, atlas, tasks) {
  const byKey = new Map(tasks.map((t) => [`${t.suite}/${t.id}`, t]));
  const keys = Object.keys(atlas.tasks || {}).filter((k) => Array.isArray(atlas.tasks[k].xyz));
  const N = keys.length;
  const P = new Float32Array(N * 3);
  const rec = keys.map((k, i) => {
    const a = atlas.tasks[k], t = byKey.get(k) || {};
    const [x, y, z] = a.xyz, n = Math.hypot(x, y, z) || 1;
    P[i * 3] = x / n; P[i * 3 + 1] = y / n; P[i * 3 + 2] = z / n;
    const suite = t.suite || k.slice(0, k.indexOf('/'));
    return { key: k, suite, id: k.slice(suite.length + 1), title: a.n || t.title || k,   // the Atlas's short name: many site titles are bare codes ("B06", "A23 I03")
      body: t.body || '', tt: a.tt || [], cap: a.cap || [] };
  });
  const tax = atlas.taxonomy || {};
  const suiteName = Object.fromEntries((ex.suites || []).map((s) => [s.id, s.name]));
  const count = (f) => { const c = new Map(); rec.forEach((r) => f(r).forEach((v) => c.set(v, (c.get(v) || 0) + 1))); return c; };

  // a mode: its categories (id, name, count, slot) and, per task, the slot of its colour (-1 = none of them)
  function mode(id, label, values, order, names, opts = {}) {
    const c = count(values);
    let ids = order.filter((v) => c.has(v));
    if (opts.byCount) ids = [...ids].sort((a, b) => c.get(b) - c.get(a));
    const shown = ids.slice(0, opts.slots ?? SLOTS), rest = ids.slice(shown.length);
    const cats = shown.map((v, j) => ({ id: v, name: names[v] || v, n: c.get(v), slot: j, members: new Set([v]) }));
    if (rest.length) cats.push({ id: '_rest', name: `${rest.length} more ${opts.restName || 'others'}`, n: rest.reduce((s, v) => s + c.get(v), 0), slot: -1, members: new Set(rest), rest: true });
    const slotOf = new Map(shown.map((v, j) => [v, j]));
    const col = new Int8Array(N);
    const memb = cats.map(() => new Uint8Array(N));
    rec.forEach((r, i) => {
      const vs = values(r);
      // a task with several labels takes the colour of its rarest one, so small categories stay visible
      let pickV;
      for (const v of vs) if (slotOf.has(v) && (pickV === undefined || c.get(v) < c.get(pickV))) pickV = v;
      col[i] = pickV === undefined ? -1 : slotOf.get(pickV);
      cats.forEach((cat, j) => { if (vs.some((v) => cat.members.has(v))) memb[j][i] = 1; });
    });
    const none = rec.reduce((s, r) => s + (values(r).length ? 0 : 1), 0);
    if (none && opts.noneName) { cats.push({ id: '_none', name: opts.noneName, n: none, slot: -1, none: true }); memb.push(Uint8Array.from(rec, (r) => (values(r).length ? 0 : 1))); }
    return { id, label, cats, col, memb, distinct: ids.length };
  }
  const bodyNames = { ...(tax.body || {}), ...(ex.bodies || {}) };
  const modes = [
    mode('body', 'bodies', (r) => (r.body ? [r.body] : []), [...BODY_ORDER, ...Object.keys(bodyNames)].filter((v, i, a) => a.indexOf(v) === i), bodyNames),
    mode('tt', 'task types', (r) => r.tt, Object.keys(tax.tt || {}), tax.tt || {}, { byCount: true, noneName: 'No type' }),
    mode('cap', 'capabilities', (r) => r.cap, Object.keys(tax.cap || {}), tax.cap || {}, { byCount: true, noneName: 'None of the four' }),
    mode('suite', 'suites', (r) => [r.suite], [...new Set(rec.map((r) => r.suite))], suiteName, { byCount: true, slots: SUITE_SLOTS, restName: 'suites' }),
  ];
  const regions = (atlas.regions || []).map((g) => { const [x, y, z] = g.xyz, n = Math.hypot(x, y, z) || 1; return { name: g.n, size: g.size || 50, v: [x / n, y / n, z / n] }; })
    .sort((a, b) => b.size - a.size);
  return { N, P, rec, modes, regions, suiteName };
}

/** The side to show first: the one where the near half mixes the most bodies (the entropy of the body colours,
 * weighted towards the centre of the view), so the first look already says "varied". */
function bestSide(D) {
  const { N, P } = D, col = D.modes[0].col, K = D.modes[0].cats.length + 1;
  let best = [0, 0, 1], bs = -1;
  const w = new Float64Array(K);
  for (let k = 0, n = 400; k < n; k++) {
    const y = 1 - (2 * (k + 0.5)) / n, r = Math.sqrt(1 - y * y), t = k * 2.399963229728653;
    const d = [r * Math.cos(t), y, r * Math.sin(t)];
    w.fill(0);
    for (let i = 0; i < N; i++) {
      const z = P[i * 3] * d[0] + P[i * 3 + 1] * d[1] + P[i * 3 + 2] * d[2];
      if (z > 0.25) w[col[i] + 1] += z * z;
    }
    let tot = 0, h = 0;
    for (let j = 0; j < K; j++) tot += w[j];
    for (let j = 0; j < K; j++) if (w[j] > 0) { const p = w[j] / tot; h -= p * Math.log(p); }
    if (h > bs) { bs = h; best = d; }
  }
  return best;
}

function build(el, ex, atlas, tasks, set = 'all') {
  // the core set (main's easy_set.toml left out: the easy set is reported apart) or every task
  const isCore = (a) => !a.easy;
  const nAll = Object.values(atlas.tasks || {}).filter((a) => Array.isArray(a.xyz)).length;
  const nCore = Object.values(atlas.tasks || {}).filter((a) => Array.isArray(a.xyz) && isCore(a)).length;
  const A = set === 'core' ? { ...atlas, tasks: Object.fromEntries(Object.entries(atlas.tasks || {}).filter(([, a]) => isCore(a))) } : atlas;
  const D = prepare(ex, A, tasks);
  const { N, P, rec, modes, regions } = D;
  if (!N) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = matchMedia('(pointer: coarse)').matches;

  /* ---------- markup ---------- */
  const setEl = el$('div', 'seg sph-set');
  setEl.setAttribute('role', 'group'); setEl.setAttribute('aria-label', 'Which tasks');
  setEl.innerHTML = `<button type="button" data-set="all" class="${set === 'all' ? 'on' : ''}">All set <i>${int(nAll)}</i></button>`
    + `<button type="button" data-set="core" class="${set === 'core' ? 'on' : ''}" title="The core set: the tasks the headline counts; the easy set is reported apart">Core set <i>${int(nCore)}</i></button>`;
  setEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-set]');
    if (!b || b.dataset.set === set) return;
    el.textContent = '';
    build(el, ex, atlas, tasks, b.dataset.set);
  });
  const total = el$('p', 'sph-total');
  total.append(el$('b', null, int(N)), el$('span', null, set === 'core' ? 'core tasks, each a dot; the easy set is counted apart. Near dots are similar tasks.' : 'tasks, each a dot. Near dots are similar tasks.'));
  const modesEl = el$('div', 'sph-modes');
  modesEl.setAttribute('role', 'group'); modesEl.setAttribute('aria-label', 'Colour the dots by');
  modesEl.appendChild(el$('p', 'label', 'Colour by'));
  const legend = el$('ul', 'sph-leg');
  const stage = el$('div', 'sph-stage');
  const cv = el$('canvas', 'sph-canvas');
  cv.tabIndex = 0;
  cv.setAttribute('role', 'img');
  cv.setAttribute('aria-label', `A sphere of ${int(N)} tasks; tasks with similar descriptions sit close together. Drag or use the arrow keys to turn it.`);
  const tip = el$('a', 'sph-tip');
  tip.setAttribute('aria-hidden', 'true'); tip.tabIndex = -1;
  // a hint that it moves (it would read as a still picture otherwise), gone after the first touch
  const hint = el$('p', 'sph-hint');
  hint.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 11.5V4a1.5 1.5 0 0 1 3 0v7.5M14 11.5V6a1.5 1.5 0 0 1 3 0v8c0 4-2.5 7-6.5 7S5 18.5 4 15l-1.2-3.4a1.4 1.4 0 0 1 2.5-1.2L8 13"/></svg>`
    + `<span>${coarse ? 'Drag to rotate · pinch to zoom · tap a dot' : 'Drag to rotate · scroll to zoom · click a dot'}</span>`;
  // zoom, inside the stage only: the canvas is the window, the globe grows behind it
  const zoomEl = el$('div', 'sph-zoom');
  zoomEl.innerHTML = `<button type="button" data-z="in" aria-label="Zoom in">+</button><button type="button" data-z="out" aria-label="Zoom out">−</button>`
    + `<button type="button" data-z="reset" aria-label="Reset the view"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5"/></svg></button>`;
  stage.append(cv, tip, hint, zoomEl);
  el.append(setEl, total, modesEl, stage, legend);

  /* ---------- state ---------- */
  let modeI = 0, hlCat = -1, pinCat = -1, hover = -1, pinned = -1;
  let rot = qnorm(qmul(qaxis(1, 0, 0, 0.22), fromTo(bestSide(D), [0, 0, 1])));
  // the graticule's pole is the first view's vertical, so the auto-rotation turns the globe about its own axis
  const G = (() => {
    const B = qmat([rot[0], -rot[1], -rot[2], -rot[3]], new Float64Array(9)), rings = [];
    const add = (fn) => { const a = new Float32Array(121 * 3); for (let k = 0; k <= 120; k++) { const p = fn((k / 120) * Math.PI * 2);
      a[k * 3] = B[0] * p[0] + B[1] * p[1] + B[2] * p[2]; a[k * 3 + 1] = B[3] * p[0] + B[4] * p[1] + B[5] * p[2]; a[k * 3 + 2] = B[6] * p[0] + B[7] * p[1] + B[8] * p[2]; } rings.push(a); };
    for (const lat of [-1.05, -0.52, 0, 0.52, 1.05]) add((t) => [Math.cos(lat) * Math.cos(t), Math.sin(lat), Math.cos(lat) * Math.sin(t)]);
    for (let k = 0; k < 6; k++) { const lon = (k * Math.PI) / 6; add((t) => [Math.cos(t) * Math.cos(lon), Math.sin(t), Math.cos(t) * Math.sin(lon)]); }
    return rings;
  })();
  let vel = [0, 0], drag = null, lastInput = -1e9, spinAmt = reduce.matches ? 0 : 1, over = false;
  let visible = false, raf = 0, dirty = true, last = 0;
  const M = new Float64Array(9);
  const X = new Float32Array(N), Y = new Float32Array(N), Z = new Float32Array(N);
  let W = 0, H = 0, DPR = 1, R = 0, cx = 0, cy = 0, baseR = 0, zoom = 1;
  const ZMIN = 1, ZMAX = 4;
  const ctx = cv.getContext('2d');
  const hz = document.createElement('canvas'), hctx = hz.getContext('2d');
  const stats = { frames: 0, ms: 0, max: 0, recent: [] };
  // for tests and the console: frame times, and where a task's dot is on screen (x, y in CSS px of the canvas, z > 0 = near side)
  el.__sph = { stats, dot: (i) => [X[i], Y[i], Z[i]], n: N };

  /* ---------- colours from the stylesheet ---------- */
  let K = {}, sprites = [];
  function readColours() {
    const cs = getComputedStyle(el), g = (k) => cs.getPropertyValue(k).trim();
    K = { slot: Array.from({ length: SLOTS }, (_, j) => g(`--sph-c${j + 1}`)), none: g('--sph-none'), ink: g('--ink'), ink2: g('--ink-2'), ink3: g('--ink-3'),
      bg: g('--bg'), bg2: g('--bg-2'), surface: g('--surface'), line: g('--line'), line2: g('--line-2'),
      glow: parseFloat(g('--sph-glow')) || 0.05, back: parseFloat(g('--sph-back')) || 0.15, dark: document.documentElement.dataset.theme === 'dark',
      font: cs.getPropertyValue('--body').trim() || 'sans-serif' };
    // the haze: one soft Gaussian sprite per colour
    sprites = [...K.slot, K.none].map((c) => {
      const s = document.createElement('canvas'); s.width = s.height = 96;
      const x = s.getContext('2d'), gr = x.createRadialGradient(48, 48, 0, 48, 48, 48), [r, g, b] = rgb(c);
      for (let k = 0; k <= 10; k++) { const t = k / 10; gr.addColorStop(t, `rgba(${r},${g},${b},${(Math.exp(-((t * 2.4) ** 2)) * (1 - t)).toFixed(4)})`); }
      x.fillStyle = gr; x.fillRect(0, 0, 96, 96);
      return s;
    });
    paintSide();
    kick();
  }
  const colourOf = (slot) => (slot >= 0 ? K.slot[slot] : K.none);

  /* ---------- the numbers, which switch the colouring, and the legend ---------- */
  const modeBtns = modes.map((m, i) => {
    const b = el$('button', 'sph-mode');
    b.type = 'button';
    b.append(el$('b', null, int(m.distinct)), el$('span', null, m.label), el$('i'));
    b.addEventListener('click', () => setMode(i));
    modesEl.appendChild(b);
    return b;
  });
  function paintSide() {
    modeBtns.forEach((b, i) => {
      b.setAttribute('aria-pressed', String(i === modeI));
      const bar = b.querySelector('i'); bar.textContent = '';
      const cats = modes[i].cats.filter((c) => !c.none), tot = cats.reduce((s, c) => s + c.n, 0);
      cats.forEach((c) => { const u = el$('u'); u.style.flex = `${c.n / tot} 1 0`; u.style.background = colourOf(c.slot); bar.appendChild(u); });
    });
    legend.textContent = '';
    const m = modes[modeI], max = Math.max(...m.cats.map((c) => c.n));
    m.cats.forEach((c, j) => {
      const li = el$('li'), b = el$('button', c.none ? 'none' : '');
      b.type = 'button';
      const sw = el$('span', 'sw'); sw.style.background = colourOf(c.slot);
      if (c.none) { sw.style.background = 'transparent'; sw.style.boxShadow = `inset 0 0 0 1.5px ${K.none}`; }
      const bar = el$('span', 'bar'), u = el$('u'); u.style.width = `${(100 * c.n) / max}%`; u.style.background = colourOf(c.slot); bar.appendChild(u);
      b.append(sw, el$('span', 'nm', c.name), el$('span', 'ct', int(c.n)), bar);
      b.title = c.rest ? [...c.members].map((v) => D.suiteName[v] || v).join(', ') : c.name;
      b.setAttribute('aria-pressed', String(pinCat === j));
      b.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') setHl(j); });
      b.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') setHl(-1); });
      b.addEventListener('focus', () => setHl(j));
      b.addEventListener('blur', () => setHl(-1));
      b.addEventListener('click', () => { pinCat = pinCat === j ? -1 : j; setHl(-1); });
      li.appendChild(b); legend.appendChild(li);
    });
    markLegend();
  }
  const activeCat = () => (hlCat >= 0 ? hlCat : pinCat);
  function markLegend() {
    const a = activeCat();
    legend.classList.toggle('hl', a >= 0);
    [...legend.querySelectorAll('button')].forEach((b, j) => { b.classList.toggle('on', j === a); b.setAttribute('aria-pressed', String(j === pinCat)); });
  }
  function setHl(j) { hlCat = j; markLegend(); clearTimeout(turnT); if (activeCat() >= 0) turnT = setTimeout(turnToCat, 160); kick(); }
  let turnT = 0, anim = null;
  // bring a highlighted category round to the front, when its tasks gather on one side
  function turnToCat() {
    const a = activeCat(); if (a < 0) return;
    const mem = modes[modeI].memb[a];
    let x = 0, y = 0, z = 0, n = 0;
    for (let i = 0; i < N; i++) if (mem[i]) { x += P[i * 3]; y += P[i * 3 + 1]; z += P[i * 3 + 2]; n++; }
    const l = Math.hypot(x, y, z);
    if (!n || l / n < 0.18) return;
    qmat(rot, M);
    const u = [x / l, y / l, z / l], v = [M[0] * u[0] + M[1] * u[1] + M[2] * u[2], M[3] * u[0] + M[4] * u[1] + M[5] * u[2], M[6] * u[0] + M[7] * u[1] + M[8] * u[2]];
    if (v[2] > 0.8) return;
    const to = qnorm(qmul(fromTo(v, [0, 0.12, 0.99]), rot));
    vel = [0, 0]; lastInput = performance.now();
    if (reduce.matches) { rot = to; kick(); return; }
    anim = { from: rot, to, t0: performance.now(), dur: 800 };
    kick();
  }
  function setMode(i) { if (i === modeI) return; modeI = i; hlCat = pinCat = -1; paintSide(); hideTip(); kick(); }

  /* ---------- size ---------- */
  function resize() {
    const r = stage.getBoundingClientRect();
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(10, r.width); H = Math.max(10, r.height);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    baseR = Math.min(W, H) * 0.47; R = baseR * zoom; cx = W / 2; cy = H / 2;
    hz.width = Math.ceil(W * HAZE_SCALE); hz.height = Math.ceil(H * HAZE_SCALE);
    kick();
  }

  /* ---------- drawing ---------- */
  const buckets = Array.from({ length: (SLOTS + 1) * 5 }, () => new Int32Array(N));
  const bn = new Int32Array((SLOTS + 1) * 5);
  function ring(a) {
    ctx.beginPath(); let pen = false;
    for (let k = 0; k < a.length; k += 3) {
      const x = M[0] * a[k] + M[1] * a[k + 1] + M[2] * a[k + 2], y = M[3] * a[k] + M[4] * a[k + 1] + M[5] * a[k + 2], z = M[6] * a[k] + M[7] * a[k + 1] + M[8] * a[k + 2];
      if (z > -0.02) { const px = cx + R * x, py = cy - R * y; if (pen) ctx.lineTo(px, py); else ctx.moveTo(px, py); pen = true; } else pen = false;
    }
    ctx.stroke();
  }

  function draw() {
    const t0 = performance.now();
    qmat(rot, M);
    const m = modes[modeI], col = m.col, a = activeCat(), mem = a >= 0 ? m.memb[a] : null;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // the globe: a lit disc, a hairline rim, a faint graticule on the near side
    const g = ctx.createRadialGradient(cx - R * 0.38, cy - R * 0.42, R * 0.05, cx, cy, R);
    g.addColorStop(0, K.surface); g.addColorStop(1, K.bg2);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = K.line2; ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = K.line; ctx.lineWidth = 0.75;
    G.forEach(ring);

    for (let i = 0; i < N; i++) {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      X[i] = cx + R * (M[0] * x + M[1] * y + M[2] * z);
      Y[i] = cy - R * (M[3] * x + M[4] * y + M[5] * z);
      Z[i] = M[6] * x + M[7] * y + M[8] * z;
    }

    // the far side, seen through the globe: small and faint
    const s = Math.max(0.8, Math.min(1.5, R / 300));
    bn.fill(0);
    for (let i = 0; i < N; i++) {
      if (Z[i] >= 0) continue;
      const sl = mem && !mem[i] ? SLOTS : col[i] < 0 ? SLOTS : col[i];
      buckets[sl * 5][bn[sl * 5]++] = i;
    }
    for (let sl = 0; sl <= SLOTS; sl++) {
      const n = bn[sl * 5]; if (!n) continue;
      const B = buckets[sl * 5];
      const lit = mem && sl !== SLOTS;
      ctx.globalAlpha = mem ? (lit ? Math.min(0.6, K.back * 2.6) : K.back * 0.5) : K.back;
      ctx.fillStyle = colourOf(sl === SLOTS ? -1 : sl);
      ctx.beginPath();
      for (let k = 0; k < n; k++) { const i = B[k], r = (lit ? 2.0 : 1.45) * s; ctx.moveTo(X[i] + r, Y[i]); ctx.arc(X[i], Y[i], r, 0, Math.PI * 2); }
      ctx.fill();
    }

    // the near side: a coloured haze where tasks crowd, then the dots, brighter and larger towards the viewer
    // (drawn at a third of the resolution on its own canvas: it is soft anyway, and that keeps the fill cost tiny)
    const hs = HAZE_SCALE, gs = R * 0.34 * hs;
    hctx.setTransform(1, 0, 0, 1, 0, 0);
    hctx.globalCompositeOperation = 'source-over';
    hctx.clearRect(0, 0, hz.width, hz.height);
    hctx.globalCompositeOperation = K.dark ? 'lighter' : 'source-over';
    const H_ = haze(m, a, mem);
    for (let g = 0; g < H_.n; g++) {
      const x = H_.v[g * 3], y = H_.v[g * 3 + 1], z0 = H_.v[g * 3 + 2];
      const z = M[6] * x + M[7] * y + M[8] * z0; if (z < 0.04) continue;
      const px = cx + R * (M[0] * x + M[1] * y + M[2] * z0), py = cy - R * (M[3] * x + M[4] * y + M[5] * z0);
      hctx.globalAlpha = 1 - Math.pow(1 - K.glow * z * (mem ? 1.5 : 1), H_.w[g]);
      hctx.drawImage(sprites[H_.c[g]], px * hs - gs / 2, py * hs - gs / 2, gs, gs);
    }
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R - 0.5, 0, Math.PI * 2); ctx.clip();
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(hz, 0, 0, hz.width, hz.height, 0, 0, hz.width / hs, hz.height / hs);
    ctx.restore();
    bn.fill(0);
    for (let i = 0; i < N; i++) {
      const z = Z[i]; if (z < 0) continue;
      const sl = mem && !mem[i] ? SLOTS : col[i] < 0 ? SLOTS : col[i];
      const d = Math.min(4, (z * 5) | 0), k = sl * 5 + d;
      buckets[k][bn[k]++] = i;
    }
    for (let sl = 0; sl <= SLOTS; sl++) {
      const dim = sl === SLOTS;
      ctx.fillStyle = colourOf(sl === SLOTS ? -1 : sl);
      for (let d = 0; d < 5; d++) {
        const k = sl * 5 + d, n = bn[k]; if (!n) continue;
        const depth = 0.3 + 0.7 * ((d + 0.5) / 5);
        ctx.globalAlpha = mem ? (sl === SLOTS ? 0.32 * depth : Math.min(1, 0.25 + depth)) : dim ? 0.55 * depth : Math.min(1, 0.2 + depth);
        const r = (mem && sl !== SLOTS ? 3.3 : sl === SLOTS ? 2.0 : 2.8) * s * (0.72 + 0.28 * depth);
        const B = buckets[k];
        ctx.beginPath();
        for (let q = 0; q < n; q++) { const i = B[q]; ctx.moveTo(X[i] + r, Y[i]); ctx.arc(X[i], Y[i], r, 0, Math.PI * 2); }
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // region names on the near side, fading towards the rim; larger regions first, no overlaps
    const boxes = [];
    const fs = R < 220 ? 12 : 14;
    ctx.font = `600 ${fs}px ${K.font}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    for (const rg of regions) {
      const [x, y, z0] = rg.v;
      const z = M[6] * x + M[7] * y + M[8] * z0;
      if (z < 0.28) continue;
      const px = cx + R * (M[0] * x + M[1] * y + M[2] * z0), py = cy - R * (M[3] * x + M[4] * y + M[5] * z0);
      const w = ctx.measureText(rg.name).width;
      const b = [px - w / 2 - 5, py - fs / 2 - 4, px + w / 2 + 5, py + fs / 2 + 4];
      const inside = (x, y) => (x - cx) ** 2 + (y - cy) ** 2 < (R * 0.97) ** 2;
      if (!inside(b[0], b[1]) || !inside(b[2], b[1]) || !inside(b[0], b[3]) || !inside(b[2], b[3]) || boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])) continue;
      boxes.push(b);
      ctx.globalAlpha = Math.min(1, (z - 0.28) / 0.32) * (a >= 0 ? 0.4 : 0.92);
      ctx.strokeStyle = K.surface; ctx.lineWidth = 4; ctx.strokeText(rg.name, px, py);
      ctx.fillStyle = K.ink2; ctx.fillText(rg.name, px, py);
    }
    ctx.globalAlpha = 1;

    // the dot under the pointer (or the tapped one)
    const h = pinned >= 0 ? pinned : hover;
    if (h >= 0 && Z[h] > 0) {
      ctx.strokeStyle = K.ink; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(X[h], Y[h], 6.5 * Math.max(1, s * 0.9), 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = colourOf(col[h]); ctx.beginPath(); ctx.arc(X[h], Y[h], 3.8 * s, 0, Math.PI * 2); ctx.fill();
      placeTip(h);
    }

    const dt = performance.now() - t0;
    stats.frames++; stats.ms += dt; stats.max = Math.max(stats.max, dt);
    stats.recent.push(dt); if (stats.recent.length > 120) stats.recent.shift();
  }

  /* ---------- the haze, pooled: tasks of one colour in one small patch of the sphere share one sprite ---------- */
  const CELL = 14, cellOf = new Int32Array(N);
  for (let i = 0; i < N; i++) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
    let f, u, v;
    if (ax >= ay && ax >= az) { f = x > 0 ? 0 : 1; u = y / ax; v = z / ax; } else if (ay >= az) { f = y > 0 ? 2 : 3; u = x / ay; v = z / ay; } else { f = z > 0 ? 4 : 5; u = x / az; v = y / az; }
    cellOf[i] = (f * CELL + Math.min(CELL - 1, ((u + 1) / 2) * CELL | 0)) * CELL + Math.min(CELL - 1, ((v + 1) / 2) * CELL | 0);
  }
  let hazeKey = '', hazeVal = null;
  function haze(m, a, mem) {
    const key = `${m.id}/${a}`;
    if (key === hazeKey) return hazeVal;
    const acc = new Map();
    for (let i = 0; i < N; i++) {
      if (mem && !mem[i]) continue;
      const c = m.col[i];
      if (c < 0 && !mem) continue;
      const sl = c < 0 ? SLOTS : c, k = cellOf[i] * (SLOTS + 1) + sl;
      let e = acc.get(k);
      if (!e) acc.set(k, (e = [0, 0, 0, 0, sl]));
      e[0] += P[i * 3]; e[1] += P[i * 3 + 1]; e[2] += P[i * 3 + 2]; e[3]++;
    }
    const n = acc.size, v = new Float32Array(n * 3), w = new Float32Array(n), c = new Uint8Array(n);
    let g = 0;
    for (const e of acc.values()) { const l = Math.hypot(e[0], e[1], e[2]) || 1; v[g * 3] = e[0] / l; v[g * 3 + 1] = e[1] / l; v[g * 3 + 2] = e[2] / l; w[g] = e[3]; c[g] = e[4]; g++; }
    hazeKey = key; hazeVal = { n, v, w, c };
    return hazeVal;
  }

  /* ---------- the loop: runs only while the sphere is on screen and something moves ---------- */
  function frame(now) {
    raf = 0;
    const dt = Math.min(50, now - (last || now)); last = now;
    let moving = false;
    if (anim && !drag) {
      const t = Math.min(1, (now - anim.t0) / anim.dur), e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      rot = slerp(anim.from, anim.to, e); lastInput = now;
      if (t >= 1) anim = null;
      moving = dirty = true;
    } else if (!drag && (Math.abs(vel[0]) > 1e-6 || Math.abs(vel[1]) > 1e-6)) {
      rot = qnorm(qmul(qmul(qaxis(0, 1, 0, vel[0] * dt), qaxis(1, 0, 0, vel[1] * dt)), rot));
      const f = Math.exp(-dt / 420); vel = [vel[0] * f, vel[1] * f];
      if (Math.abs(vel[0]) < 2e-6 && Math.abs(vel[1]) < 2e-6) vel = [0, 0];
      moving = dirty = true;
    }
    // it turns slowly by default; a click, drag, zoom or key stops it, and it starts again after IDLE (hovering does not stop it)
    const wantSpin = !reduce.matches && !drag && pinned < 0 && now - lastInput > IDLE;
    spinAmt = wantSpin ? Math.min(1, spinAmt + dt / 1500) : 0;
    if (spinAmt > 0) { rot = qnorm(qmul(qaxis(0, 1, 0, SPIN * dt * spinAmt * spinAmt), rot)); moving = dirty = true; }
    if (wantSpin) moving = true;   // the first frame after a wake has dt = 0: keep the loop going so the spin can ease in
    if (dirty && W > 10) { dirty = false; draw(); }
    // keep going while moving; otherwise wake up when the idle time is over
    if (visible && !document.hidden) {
      if (moving || dirty) raf = requestAnimationFrame(frame);
      else if (!reduce.matches && !drag && pinned < 0) { clearTimeout(wake); wake = setTimeout(kick, Math.max(50, IDLE - (now - lastInput) + 30)); }
    }
  }
  let wake = 0;
  function kick() { dirty = true; if (!raf && visible && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } }

  /* ---------- picking ---------- */
  function pick(mx, my, radius) {
    const m = modes[modeI], a = activeCat(), mem = a >= 0 ? m.memb[a] : null;
    let best = -1, bd = radius * radius;
    for (let i = 0; i < N; i++) {
      if (Z[i] < 0.02 || (mem && !mem[i])) continue;
      const dx = X[i] - mx, dy = Y[i] - my, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  const taskUrl = (i) => PAGE(`tasks/?task=${encodeURIComponent(rec[i].suite)}/${encodeURIComponent(rec[i].id)}`);
  function placeTip(i) {
    const r = rec[i], m = modes[modeI], c = m.col[i];
    if (tip.dataset.i !== String(i) || tip.dataset.m !== String(modeI)) {
      tip.dataset.i = String(i); tip.dataset.m = String(modeI);
      tip.textContent = '';
      const cat = c >= 0 ? m.cats.find((x) => x.slot === c) : null;
      const line = el$('span'), key = el$('i'); key.style.background = colourOf(c);
      const parts = [D.suiteName[r.suite] || r.suite];
      if (m.id !== 'suite' && cat) parts.push(cat.name);
      line.append(key, document.createTextNode(parts.join(' · ')));
      tip.append(el$('b', null, r.title), line, el$('em', null, 'Open the task →'));
      tip.href = taskUrl(i);
    }
    tip.classList.add('show');
    tip.classList.toggle('pin', pinned === i);
    const w = tip.offsetWidth, hh = tip.offsetHeight;
    let left = X[i] + 14, top = Y[i] + 14;
    if (left + w > W - 4) left = X[i] - w - 14;
    if (top + hh > H - 4) top = Y[i] - hh - 14;
    tip.style.left = `${Math.max(4, left)}px`; tip.style.top = `${Math.max(4, top)}px`;
  }
  function hideTip() { tip.classList.remove('show', 'pin'); pinned = -1; hover = -1; cv.classList.remove('pt'); kick(); }

  /* ---------- input ---------- */
  const local = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const touched = () => { lastInput = performance.now(); hint.classList.add('gone'); };
  function setZoom(z) {
    const nz = Math.min(ZMAX, Math.max(ZMIN, z));
    if (nz === zoom) return false;
    zoom = nz; R = baseR * zoom;
    zoomEl.querySelector('[data-z="in"]').disabled = zoom >= ZMAX;
    zoomEl.querySelector('[data-z="out"]').disabled = zoom <= ZMIN;
    stage.classList.toggle('zoomed', zoom > 1.001);
    if (hover >= 0 || pinned >= 0) hideTip();
    touched(); kick();
    return true;
  }
  // the wheel zooms only while there is room to zoom; at either end it scrolls the page as usual
  cv.addEventListener('wheel', (e) => {
    const f = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0018));
    if ((f > 1 && zoom >= ZMAX) || (f < 1 && zoom <= ZMIN)) return;
    e.preventDefault();
    setZoom(zoom * f);
  }, { passive: false });
  zoomEl.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const z = b.dataset.z;
    if (z === 'in') setZoom(zoom * 1.4);
    else if (z === 'out') setZoom(zoom / 1.4);
    else { setZoom(1); hlCat = pinCat = -1; }
  });
  zoomEl.querySelector('[data-z="out"]').disabled = true;
  // two fingers pinch
  const pts = new Map(); let pinch = null;
  const spread = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  cv.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 2) { pinch = { d0: spread(), z0: zoom }; drag = null; } } }, true);
  cv.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pts.size === 2) { e.stopImmediatePropagation(); setZoom(pinch.z0 * spread() / Math.max(1, pinch.d0)); }
  }, true);
  const unpinch = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; };
  cv.addEventListener('pointerup', unpinch, true); cv.addEventListener('pointercancel', unpinch, true);
  cv.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || pinch) return;
    const [mx, my] = local(e);
    drag = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0, mx, my, type: e.pointerType, id: e.pointerId };
    vel = [0, 0]; anim = null;
    touched(); kick();
  });
  cv.addEventListener('pointermove', (e) => {
    const [mx, my] = local(e);
    if (drag && e.pointerId === drag.id) {
      const now = performance.now(), dx = e.clientX - drag.x, dy = e.clientY - drag.y, dt = Math.max(1, now - drag.t);
      drag.moved += Math.abs(dx) + Math.abs(dy);
      if (drag.moved > 4 && !drag.cap) { drag.cap = true; try { cv.setPointerCapture(e.pointerId); } catch (_) { /* fine */ } cv.classList.add('drag'); }
      if (drag.cap) {
        const k = 1 / R;
        rot = qnorm(qmul(qmul(qaxis(0, 1, 0, dx * k), qaxis(1, 0, 0, dy * k)), rot));
        const vx = (dx * k) / dt, vy = (dy * k) / dt;
        vel = [0.6 * vx + 0.4 * vel[0], 0.6 * vy + 0.4 * vel[1]];
        if (hover >= 0 || pinned >= 0) { tip.classList.remove('show', 'pin'); hover = pinned = -1; }
      }
      drag.x = e.clientX; drag.y = e.clientY; drag.t = now;
      touched(); kick();
      return;
    }
    if (e.pointerType === 'touch') return;
    over = true;
    const h = pick(mx, my, 12);
    if (h !== hover) {
      hover = h;
      cv.classList.toggle('pt', h >= 0);
      if (h < 0 && pinned < 0) tip.classList.remove('show');
      kick();
    }
  });
  const end = (e, cancelled) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    cv.classList.remove('drag');
    // a release after the pointer rested for a moment does not fling
    if (cancelled || reduce.matches || performance.now() - d.t > 80) vel = [0, 0];
    if (!cancelled && d.moved < 6) {
      const [mx, my] = local(e);
      const i = pick(mx, my, d.type === 'touch' ? 22 : 12);
      if (d.type === 'touch') {
        if (i >= 0 && i === pinned) { location.href = taskUrl(i); return; }
        pinned = i; hover = -1;
        if (i < 0) tip.classList.remove('show', 'pin');
      } else if (i >= 0) { location.href = taskUrl(i); return; }
    }
    touched(); kick();
  };
  cv.addEventListener('pointerup', (e) => end(e, false));
  cv.addEventListener('pointercancel', (e) => end(e, true));
  cv.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'touch') return;
    over = false;
    if (!drag && hover >= 0) { hover = -1; tip.classList.remove('show'); cv.classList.remove('pt'); }
    kick();
  });
  cv.addEventListener('keydown', (e) => {
    const st = 0.14, mv = { ArrowLeft: [0, -st], ArrowRight: [0, st], ArrowUp: [-st, 0], ArrowDown: [st, 0] }[e.key];
    if (!mv) return;
    e.preventDefault();
    rot = qnorm(qmul(mv[0] ? qaxis(1, 0, 0, mv[0]) : qaxis(0, 1, 0, mv[1]), rot));
    touched(); kick();
  });
  document.addEventListener('pointerdown', (e) => { if (pinned >= 0 && !stage.contains(e.target)) { hideTip(); } });

  /* ---------- lifecycle ---------- */
  new ResizeObserver(resize).observe(stage);
  new IntersectionObserver((es) => { visible = es.some((x) => x.isIntersecting); if (visible) kick(); }, { rootMargin: '80px 0px' }).observe(stage);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
  new MutationObserver(readColours).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', readColours);
  reduce.addEventListener?.('change', kick);
  readColours();
  resize();
}
