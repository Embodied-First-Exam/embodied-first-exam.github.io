/* A static blog post (blogs/failure-analysis/ and its language versions): the contents rail built from the article's h2 and h3 heads, the replay clips that
   play while on screen, and an Enlarge button on every figure. The nav, footer and theme come from app.js. */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** The contents rail in the left margin: one entry per part (h2), its subsections (h3) folded under it. */
function toc() {
  const heads = $$('.post h2[id]');
  if (!heads.length) return;
  const subs0 = (h) => { const out = []; for (let el = h.nextElementSibling; el && el.tagName !== 'H2'; el = el.nextElementSibling) if (el.tagName === 'H3' && el.id) out.push(el); return out; };
  const textOf = (el) => [...el.childNodes].filter((n) => !n.classList?.contains('num')).map((n) => n.textContent).join('').trim();
  // parts are numbered in order (a part without subsections, such as a summary, gets no number); subsections by position
  let partNo = 0;
  const nums = new Map(heads.map((h) => [h, (h.querySelector('.num')?.textContent || '').trim()]));
  heads.forEach((h) => { if (!nums.get(h) && subs0(h).length) nums.set(h, String(++partNo)); });
  const label = (h) => `<span class="k">${esc(nums.get(h) || '')}</span>${esc(h.dataset.short || textOf(h))}`;
  const subs = (h) => {
    const out = [];
    for (let el = h.nextElementSibling; el && el.tagName !== 'H2'; el = el.nextElementSibling) if (el.tagName === 'H3' && el.id) out.push(el);
    return out;
  };
  const items = heads.map((h) => {
    const s = subs(h);
    if (!s.length) return `<li><a href="#${h.id}">${label(h)}</a></li>`;
    return `<li class="fold"><div class="fold-head"><a href="#${h.id}">${label(h)}</a><button type="button" aria-expanded="false" aria-label="Show subsections">${s.length}</button></div>`
      + `<div class="fold-body"><ol>${s.map((x, i) => `<li><a href="#${x.id}"><span class="k">${i + 1}</span>${esc(x.dataset.short || textOf(x))}</a></li>`).join('')}</ol></div></li>`;
  }).join('');
  document.body.insertAdjacentHTML('beforeend', `<nav class="toc-rail" aria-label="Contents"><p>Contents</p><ol>${items}</ol></nav>`);
  const rail = $('.toc-rail');
  const marks = [...heads, ...$$('.post h3[id]')];
  const links = marks.flatMap((h) => $$(`a[href="#${h.id}"]`)).filter(Boolean);
  const folds = $$('.fold', rail).map((li) => ({ li, h: document.getElementById($('a', li).getAttribute('href').slice(1)), manual: null, inside: false }));
  const paint = () => folds.forEach((f) => {
    const open = f.manual ?? f.inside;
    f.li.classList.toggle('open', open);
    $('button', f.li)?.setAttribute('aria-expanded', String(open));
  });
  folds.forEach((f) => {
    $('button', f.li)?.addEventListener('click', () => { f.manual = !f.li.classList.contains('open'); paint(); });
    $('a', f.li)?.addEventListener('click', () => { f.manual = true; paint(); });
  });
  const onScroll = () => {
    const y = 120;
    let cur = null;
    for (const h of marks) if (h.getBoundingClientRect().top <= y) cur = h;
    links.forEach((a) => a.classList.toggle('on', !!(cur && a.getAttribute('href') === `#${cur.id}`)));
    folds.forEach((f) => {
      const next = heads[heads.indexOf(f.h) + 1];
      const top = f.h?.getBoundingClientRect().top ?? 1;
      const bottom = next ? next.getBoundingClientRect().top : 1e9;
      f.inside = top <= y && bottom > y;
    });
    paint();
    rail.classList.toggle('show', window.scrollY > 200);
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/** Replay clips play muted while on screen and pause off screen; data-rate sets the playback speed. */
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
    if (!fb.querySelector('img')) return;
    fb.classList.add('fig-zoom-host');
    const b = document.createElement('button'); b.type = 'button'; b.className = 'zoom-btn'; b.innerHTML = `${ICON}Enlarge`;
    b.addEventListener('click', (e) => { e.stopPropagation(); open(fb); });
    fb.append(b);
    fb.addEventListener('click', (e) => { if (e.target.closest('details, summary, a, button, .zoom-ov') || fb.closest('.zoom-ov')) return; open(fb); });
  });
}

toc();
clips();
zoomFigs();
