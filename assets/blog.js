/* The blog's figures and numbers, drawn from data/blog.json (scripts/export_blog.py: the counts of the cross-benchmark
   analysis, frozen) and data/exam.json (the exam's totals). One script for both languages: the page's <html lang> picks
   the labels. Numbers in the text are <span data-f="key" data-fmt="pct|frac|num|den"> and are filled from the same data,
   so the English and Chinese pages cannot drift apart. app.js draws the navigation, the footer and the wall. */

const BASE = new URL('../', import.meta.url).pathname;
const ZH = document.documentElement.lang.startsWith('zh');
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
const int = (n) => Number(n || 0).toLocaleString('en-US');
const getJSON = (p) => fetch(BASE + p, { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`); return r.json(); });

const T = ZH ? {
  of: (a, b) => `${a}/${b}`, tasks: '个任务', trials: '次', failures: '次失败',
  priv: 'Privileged', std: 'Standard', rt: 'Realtime',
  ways: { code: 'Code to Control', direct: 'Direct Control', train: 'Train Model to Control', mixed: '混合', none: '没有形成控制' },
  layers: { thought: '想法错了（为主）', before: '先想错，引出失误', after: '先失误，没能挽回', motor: '纯动作失误', external: '外部原因' },
  claims: { claimed: '声称成功', honest: '如实说失败', silent: '没有表态', mismatch: '与现场一致、评分不同', other: '其他' },
  fixes: { likely: '很可能翻盘', possible: '可能翻盘', unlikely: '不太可能' },
  reachS: '成功的 trial', reachF: '失败的 trial', reachX: '已用时限', reachY: '已做成关键动作的比例',
  after: { stopped: '停下', kept: '继续做无用功' }, left: (p) => `出事时还剩 ${p}% 时间`,
  small: '样本少', copy: '复制', copied: '已复制',
} : {
  of: (a, b) => `${int(a)} of ${int(b)}`, tasks: 'tasks', trials: 'trials', failures: 'failures',
  priv: 'Privileged', std: 'Standard', rt: 'Realtime',
  ways: { code: 'Code to Control', direct: 'Direct Control', train: 'Train Model to Control', mixed: 'Mixed', none: 'No control formed' },
  layers: { thought: 'Wrong idea (mainly)', before: 'Wrong idea, then a slip', after: 'A slip, not recovered', motor: 'Motor slip only', external: 'External' },
  claims: { claimed: 'Claimed success', honest: 'Said it failed', silent: 'Said nothing', mismatch: 'Saw success, graded otherwise', other: 'Other' },
  fixes: { likely: 'Likely saved', possible: 'Possibly saved', unlikely: 'Unlikely' },
  reachS: 'Successful trials', reachF: 'Failed trials', reachX: 'Share of the time limit used', reachY: 'Share that had done the key step once',
  after: { stopped: 'Stopped', kept: 'Kept going in vain' }, left: (p) => `${p}% of the time left`,
  small: 'few trials', copy: 'Copy', copied: 'Copied',
};
const AGENT = (d, a) => d.agents[a]?.[ZH ? 'zh' : 'en'] || a;
const FAMILY = (d, a) => d.agents[a]?.family || 'flash';

/* ---------------------------------------------------------------------------------------------- numbers */

/** data-f="key" reads data.facts (counts a/b); data-f="b.key" reads the bottleneck analysis's facts (values as stated). */
function fillFacts(d) {
  $$('[data-f]').forEach((el) => {
    const k = el.dataset.f;
    const v = k.startsWith('b.') ? d.bottleneck?.facts[k.slice(2)] : k.startsWith('r.') ? [d.repo?.[k.slice(2)]] : k.startsWith('w.') ? [d.where?.[k.slice(2)]] : d.facts[k];
    if (!v || v[0] == null) { el.textContent = '?'; return; }
    const [a, b] = v;
    el.textContent = { pct: `${pct(a, b)}%`, frac: T.of(a, b), num: int(a), den: int(b), raw: `${a}`, rawpct: `${a}%`,
      vs: `${a}% ${ZH ? '对' : 'vs'} ${b}%`, second: `${b}` }[el.dataset.fmt || 'pct'];
  });
}

function command(el) {
  if (!el) return;
  const cmd = 'harbor run -d embodied-first-exam -a claude-code -m anthropic/claude-opus-5-5';
  el.innerHTML = `<span class="pr" aria-hidden="true">$</span><code>${esc(cmd)}</code><button type="button">${T.copy}</button>`;
  const b = $('button', el);
  b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(cmd); } catch { return; }
    b.textContent = T.copied; setTimeout(() => { b.textContent = T.copy; }, 1500);
  });
}

/* --------------------------------------------------------------------------------------------- figures */

/** Privileged -> standard on the same tasks, one row per agent. */
function figSame(el, d) {
  if (!el) return;
  const rows = Object.entries(d.same_tasks).map(([a, v]) => ({ a, p: pct(...v.privileged), s: pct(...v.standard), pv: v.privileged, sv: v.standard }))
    .sort((x, y) => y.p - x.p);
  const n = Object.values(d.same_tasks)[0];
  el.innerHTML = `<p class="fig-title">${ZH ? `同一批任务上的成功率（privileged ${n.privileged[1]} 个，standard ${n.standard[1]} 个）` : `Success on the same tasks (${n.privileged[1]} privileged, ${n.standard[1]} standard)`}</p>
    <div class="legend"><span><i style="background:var(--priv)"></i>${T.priv}</span><span><i style="background:var(--std)"></i>${T.std}</span></div>
    <div class="db">${rows.map((r) => `<div class="db-row ${FAMILY(d, r.a)}"><div class="who">${esc(AGENT(d, r.a))}</div><div class="db-track"
        title="${esc(`${T.priv} ${r.pv[0]}/${r.pv[1]} · ${T.std} ${r.sv[0]}/${r.sv[1]}`)}">
      <span class="db-line" style="left:${r.s}%;width:${r.p - r.s}%"></span>
      <span class="db-dot s" style="left:${r.s}%"></span><span class="db-dot p" style="left:${r.p}%"></span>
      ${r.p - r.s >= 9 ? `<span class="db-lab s" style="left:${r.s}%">${r.s}%</span><span class="db-lab p" style="left:${r.p}%">${r.p}%</span>`
        : `<span class="db-lab p" style="left:${r.p}%">${r.p}% → ${r.s}%</span>`}</div></div>`).join('')}</div>
    <div class="db-axis"><span></span><div class="ticks">${[0, 25, 50, 75, 100].map((v) => `<i style="left:${v}%">${v}%</i>`).join('')}</div></div>`;
}

/** The share of question-and-mode cells that no agent solved, per task type, privileged against standard. */
function figNobody(el, d) {
  if (!el) return;
  const order = ['all', ...Object.keys(d.types).sort((x, y) => {
    const g = (k) => pct(...d.nobody[k].standard) - pct(...d.nobody[k].privileged);
    return g(y) - g(x);
  })];
  const name = (k) => (k === 'all' ? (ZH ? '全部' : 'All tasks') : d.types[k][ZH ? 'zh' : 'en']);
  const bar = (m, v) => `<div class="nb-bar ${m}"><div class="t"><span style="width:${pct(...v)}%"></span></div><small>${pct(...v)}% · ${v[0]}/${v[1]}</small></div>`;
  el.innerHTML = `<p class="fig-title">${ZH ? '没有一个 agent 做成的比例（至少 3 个 agent 跑过）' : 'Share that no agent solved (cells run by at least three agents)'}</p>
    <div class="legend"><span><i style="background:var(--priv)"></i>${T.priv}</span><span><i style="background:var(--std)"></i>${T.std}</span></div>
    ${order.filter((k) => d.nobody[k]).map((k) => `<div class="nb-row${k === 'all' ? ' all' : ''}"><div class="who">${esc(name(k))}</div>
      <div class="nb-bars">${bar('p', d.nobody[k].privileged)}${bar('s', d.nobody[k].standard)}</div></div>`).join('')}`;
}

/** A stacked bar per row; segs = [[key, label, colour var, light text?], ...]. */
function stackRows(rows, segs, { total = (r) => r.n, label = (r) => r.label, counts = false } = {}) {
  return `<div class="bars">${rows.map((r) => {
    const n = total(r);
    return `<div class="bar-row"><div class="who">${label(r)}${r.n < 20 ? `<small>${esc(T.small)}</small>` : ''}</div><div class="stack">${segs.map(([k, l, c, lt]) => {
      const v = r[k] || 0, p = n ? (100 * v) / n : 0;
      return v ? `<span class="${lt ? 'lt' : ''}" style="width:${p}%;background:var(${c})" title="${esc(`${l}: ${v}/${r.n}`)}">${p >= 9 ? (counts ? v : `${Math.round(p)}%`) : ''}</span>` : '';
    }).join('')}</div><div class="n">${r.n}</div></div>`;
  }).join('')}</div>`;
}
const legend = (segs) => `<div class="legend">${segs.map(([, l, c]) => `<span><i style="background:var(${c})"></i>${esc(l)}</span>`).join('')}</div>`;

function figWays(el, d) {
  if (!el) return;
  const segs = [['code', T.ways.code, '--w-code'], ['direct', T.ways.direct, '--w-direct'], ['train', T.ways.train, '--w-train'],
    ['mixed', T.ways.mixed, '--w-mixed'], ['none', T.ways.none, '--w-none', 1]];
  const rows = ['privileged', 'standard', 'realtime'].map((m) => ({ ...d.ways[m], label: `<span class="m-${m[0]}">${T[m === 'privileged' ? 'priv' : m === 'standard' ? 'std' : 'rt']}</span>` }));
  el.innerHTML = `<p class="fig-title">${ZH ? '谁决定每一步动作 · 按模式（分析过的 trial，成败都算）' : 'Who decides each move, by mode (analysed trials, success and failure)'}</p>
    ${legend(segs)}${stackRows(rows, segs)}`;
}

function figLayers(el, d) {
  if (!el) return;
  const segs = [['thought', T.layers.thought, '--l-thought'], ['before', T.layers.before, '--l-before'], ['after', T.layers.after, '--l-after', 1],
    ['motor', T.layers.motor, '--l-motor'], ['external', T.layers.external, '--l-ext', 1]];
  const rows = d.layers.map((r) => ({ ...r, label: esc(AGENT(d, r.agent)) }));
  el.innerHTML = `<p class="fig-title">${ZH ? '失败背后有没有想法上的错 · 按 agent（抽样的失败 trial）' : 'Was there a wrong idea behind the failure? By agent (sampled failures)'}</p>
    ${legend(segs)}${stackRows(rows, segs)}`;
}

/** Share of trials that had done the task's key step once (progress level 3) by each point of the time limit. */
function figReach(el, d) {
  if (!el) return;
  const xs = d.reach3.at;
  const W = Math.max(340, Math.min(900, el.clientWidth - 8 || 900)), H = W < 600 ? 300 : 340, L = 44, R = 16, Tp = 16, B = 46;
  const x = (v) => L + ((W - L - R) * v) / 100, y = (v) => Tp + ((H - Tp - B) * (100 - v)) / 100;
  const path = (vs) => `M${x(0)},${y(0)} ` + vs.map((v, i) => `L${x(xs[i])},${y(v)}`).join(' ');
  const draw = (mode) => {
    const m = d.reach3.modes[mode];
    const lines = [['success', T.reachS, 'var(--c-honest)'], ['failure', T.reachF, 'var(--c-claim)']];
    $('svg', el).innerHTML = `${[0, 25, 50, 75, 100].map((v) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v}%</text>`).join('')}
      ${xs.map((v) => `<text class="ax" x="${x(v)}" y="${H - B + 18}" text-anchor="middle">${v}%</text>`).join('')}
      <text class="ax" x="${(L + W - R) / 2}" y="${H - 4}" text-anchor="middle">${esc(T.reachX)}</text>
      ${lines.map(([k, l, c]) => {
        const vs = m[k].at, last = vs[vs.length - 1];
        return `<path d="${path(vs)}" style="stroke:${c}"/>${vs.map((v, i) => `<circle cx="${x(xs[i])}" cy="${y(v)}" r="5" style="fill:${c}"><title>${esc(`${l} · ${xs[i]}% → ${v}%`)}</title></circle>
          <text class="val" x="${x(xs[i])}" y="${y(v) + (k === 'success' ? -12 : 22)}" text-anchor="middle" style="fill:${c}">${v}%</text>`).join('')}`;
      }).join('')}`;
    $('.legend', el).innerHTML = lines.map(([k, l, c]) => `<span><i style="background:${c}"></i>${esc(l)} <em>n=${m[k].n}</em></span>`).join('');
    $$('.chart-tabs button', el).forEach((b) => b.classList.toggle('on', b.dataset.m === mode));
  };
  el.innerHTML = `<p class="fig-title">${esc(T.reachY)}</p>
    <div class="chart-tabs">${['privileged', 'standard'].map((m) => `<button type="button" data-m="${m}">${m === 'privileged' ? T.priv : T.std}</button>`).join('')}</div>
    <div class="legend"></div>
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(T.reachY)}"></svg>`;
  $$('.chart-tabs button', el).forEach((b) => b.addEventListener('click', () => draw(b.dataset.m)));
  draw('standard');
}

function figAfter(el, d) {
  if (!el) return;
  const segs = [['kept', T.after.kept, '--c-claim'], ['stopped', T.after.stopped, '--c-silent', 1]];
  const rows = d.after_point.filter((r) => d.agents[r.agent]).map((r) => ({ ...r, label: `${esc(AGENT(d, r.agent))}<small>${esc(T.left(r.left))}</small>` }));
  el.innerHTML = `<p class="fig-title">${ZH ? '过了不可挽回点、还剩一分钟以上时，agent 怎么做' : 'After the point of no return, with more than a minute left'}</p>
    ${legend(segs)}${stackRows(rows, segs)}`;
}

function figClaims(el, d) {
  if (!el) return;
  const segs = [['claimed', T.claims.claimed, '--c-claim'], ['honest', T.claims.honest, '--c-honest'], ['silent', T.claims.silent, '--c-silent', 1],
    ['mismatch', T.claims.mismatch, '--c-other', 1], ['other', T.claims.other, '--c-other', 1]];
  const rows = d.claims.filter((r) => d.agents[r.agent]).map((r) => ({ ...r, label: esc(AGENT(d, r.agent)) }));
  el.innerHTML = `<p class="fig-title">${ZH ? '失败时的最后一句话 · 按 agent（自己结束的失败，不含被时限截断的）' : 'The last word on a failure, by agent (failures the agent ended itself; cut-off runs left out)'}</p>
    ${legend(segs.slice(0, 3))}${stackRows(rows, segs)}`;
}

function figFixes(el, d) {
  if (!el) return;
  const segs = [['likely', T.fixes.likely, '--f-likely'], ['possible', T.fixes.possible, '--f-possible', 1], ['unlikely', T.fixes.unlikely, '--f-unlikely', 1]];
  const rows = d.fixes.map((r) => ({ ...r, label: esc(r[ZH ? 'zh' : 'en']) }));
  el.innerHTML = `<p class="fig-title">${ZH ? '失败最缺的那一步（每次失败只记一步）' : 'The one step a failure most lacked (one per failure)'}</p>
    ${legend(segs)}${stackRows(rows, segs, { total: () => Math.max(...rows.map((r) => r.n)), counts: true })}`;
  // bars share one scale, so the longest row is the most common missing step; the numbers are failures
  $$('.stack', el).forEach((st) => { st.style.background = 'none'; });
}


/** Estimates from a random sample with their 95% intervals, one bar each: rows = [{en, zh, share, lo, hi}]. */
function ciBars(rows, colour) {
  const max = Math.max(...rows.map((r) => r.hi)) * 1.05;
  return `<div class="ci">${rows.map((r) => `<div class="ci-row"><div class="who">${esc(r[ZH ? 'zh' : 'en'])}</div>
    <div class="ci-track"><span class="ci-bar" style="width:${(100 * r.share) / max}%;background:var(${colour})"></span>
      ${r.hi > r.lo ? `<span class="ci-whisk" style="left:${(100 * r.lo) / max}%;width:${(100 * (r.hi - r.lo)) / max}%"></span>` : ''}</div>
    <div class="n">${Math.round(100 * r.share)}%</div></div>`).join('')}</div>`;
}

function figRoots(el, d) {
  if (!el || !d.bottleneck) return;
  const b = d.bottleneck;
  el.innerHTML = `<p class="fig-title">${ZH ? `失败的根本原因（随机抽 ${b.facts.sample_fail[0]} 个失败逐条阅读，按组加权）` : `Root cause of a failure (a random ${b.facts.sample_fail[0]} failures read one by one, weighted by group)`}</p>
    ${ciBars(b.roots.slice(0, 8), '--l-motor')}
    <p class="fig-note">${ZH ? '细线是 95% 置信区间。' : 'Thin lines are 95% intervals.'}</p>`;
}

function figSubtasks(el, d) {
  if (!el || !d.bottleneck) return;
  const rows = [...d.bottleneck.subtasks].sort((a, b) => b.time - a.time);
  const max = Math.max(...rows.flatMap((r) => [r.time, r.stuck])) * 1.05;
  const bar = (cls, v) => `<div class="nb-bar ${cls}"><div class="t"><span style="width:${(100 * v) / max}%"></span></div><small>${(100 * v).toFixed(1)}%</small></div>`;
  el.innerHTML = `<p class="fig-title">${ZH ? '每个子任务占全部时间的比例，和卡在这一步的失败比例' : 'Share of all agent time spent on each subtask, and share of failures that got stuck there'}</p>
    <div class="legend"><span><i style="background:var(--w-code)"></i>${ZH ? '占全部时间' : 'Share of time'}</span><span><i style="background:var(--c-claim)"></i>${ZH ? '失败卡在这里' : 'Failures stuck here'}</span></div>
    ${rows.map((r) => `<div class="nb-row"><div class="who">${esc(r[ZH ? 'zh' : 'en'])}</div><div class="nb-bars">${bar('t1', r.time)}${bar('t2', r.stuck)}</div></div>`).join('')}`;
}

/** P(a run succeeds in the end | it has not succeeded by τ), per agent. */
function figEventual(el, d) {
  if (!el || !d.bottleneck) return;
  const ev = d.bottleneck.eventual, taus = ev.taus;
  const COL = ['var(--ink)', 'var(--w-code)', 'var(--w-direct)', 'var(--w-train)', 'var(--flash)', 'var(--flash)', 'var(--flash)'];
  const draw = () => {
    const W = Math.max(340, Math.min(900, el.clientWidth - 8 || 900)), H = W < 600 ? 280 : 320, L = 44, R = 16, Tp = 14, B = 46;
    const ymax = 0.6;
    const x = (t) => L + (W - L - R) * t, y = (p) => Tp + (H - Tp - B) * (1 - p / ymax);
    $('svg', el).setAttribute('viewBox', `0 0 ${W} ${H}`);
    $('svg', el).innerHTML = `${[0, 0.2, 0.4, 0.6].map((v) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${Math.round(100 * v)}%</text>`).join('')}
      ${[0, 0.25, 0.5, 0.75, 1].map((t) => `<text class="ax" x="${x(t)}" y="${H - B + 18}" text-anchor="middle">${Math.round(100 * t)}%</text>`).join('')}
      <text class="ax" x="${(L + W - R) / 2}" y="${H - 4}" text-anchor="middle">${esc(T.reachX)}</text>
      ${ev.lines.map((l, i) => `<path d="${l.p.map((p, j) => `${j ? 'L' : 'M'}${x(taus[j])},${y(p)}`).join(' ')}" style="stroke:${COL[i]};stroke-width:${i ? 2.2 : 3.2};${i > 3 ? 'stroke-dasharray:4 4' : ''}"><title>${esc(l[ZH ? 'zh' : 'en'])}</title></path>`).join('')}`;
  };
  el.innerHTML = `<p class="fig-title">${ZH ? '到这个时刻还没成功的 run，最后成功的概率（核心题）' : 'Chance that a run not yet successful at this point still succeeds (core questions)'}</p>
    <div class="legend">${ev.lines.map((l, i) => `<span><i style="background:${COL[i]}"></i>${esc(l[ZH ? 'zh' : 'en'])}</span>`).join('')}</div>
    <svg class="chart" role="img" aria-label="${esc(ZH ? '最终成功的概率' : 'Chance of eventual success')}"></svg>`;
  draw();
  addEventListener('resize', draw);
}

function figBreaks(el, d) {
  if (!el || !d.bottleneck) return;
  const b = d.bottleneck;
  el.innerHTML = `<p class="fig-title">${ZH ? `卡了很久、最后成功的 run 是怎么突破的（随机抽 ${b.facts.sample_break[0]} 个）` : `How long-stalled runs that succeeded broke through (a random ${b.facts.sample_break[0]})`}</p>
    ${ciBars(b.breaks, '--c-honest')}
    <p class="fig-note">${ZH ? '每个 run 只记主要的突破方式；细线是 95% 置信区间。' : 'Each run counts once, by its main breakthrough; thin lines are 95% intervals.'}</p>`;
}


/** Core-set results per agent and mode (data.overall, from the results index). */
function figOverall(el, d) {
  if (!el || !d.overall) return;
  const o = d.overall, M = [['privileged', 'privileged', '--priv'], ['standard', 'standard', '--std'], ['standard-realtime', 'standard-realtime', '--rt'], ['all', 'all modes', '--ink']];
  const cell = ([s, n], c) => `<td><div class="ov"><span style="width:${n ? (100 * s) / n : 0}%;background:var(${c})"></span></div><b>${pct(s, n)}%</b><small>${s}/${n}</small></td>`;
  el.innerHTML = `<p class="fig-title">Success on the core set, by agent and mode</p>
    <div class="ovt-wrap"><table class="ovt"><thead><tr><th>Agent · harness</th>${M.map(([, l]) => `<th>${l}</th>`).join('')}</tr></thead>
    <tbody>${o.runs.map((r) => `<tr class="${r.run.includes('luna') ? 'ref' : ''}"><td class="who">${esc(r.name)}</td>${M.map(([m, , c]) => cell(r[m], c)).join('')}</tr>`).join('')}</tbody></table></div>
    <p class="fig-note">Core set: the ${o.core} task dirs in docs/core_set.toml. Each cell counts the latest graded trial of each core task dir the agent sat; success means the verifier passed it. Results index snapshot ${esc(o.snapshot)}.</p>`;
}

/** For each agent, the tasks it ran in both modes: solved in both, only privileged, only standard, neither. */
function figKept(el, d) {
  if (!el) return;
  const segs = [['both', 'Solved in both modes', '--c-honest'], ['priv_only', 'Only with privileged access', '--priv'], ['std_only', 'Only under standard rules', '--std'], ['neither', 'Neither', '--c-silent', 1]];
  const rows = d.kept.filter((r) => d.agents[r.agent]).map((r) => ({ ...r, label: esc(AGENT(d, r.agent)) }));
  el.innerHTML = `<p class="fig-title">Tasks each agent ran in both modes, by outcome</p>${legend(segs)}${stackRows(rows, segs)}`;
}

function figWaysRt(el, d) {
  if (!el) return;
  const segs = [['code', T.ways.code, '--w-code'], ['direct', T.ways.direct, '--w-direct'], ['train', T.ways.train, '--w-train'],
    ['mixed', T.ways.mixed, '--w-mixed'], ['none', T.ways.none, '--w-none', 1]];
  const rows = ['privileged', 'standard', 'realtime'].map((m) => ({ ...d.ways_rt_benches[m], label: `<span class="m-${m[0]}">${T[m === 'privileged' ? 'priv' : m === 'standard' ? 'std' : 'rt']}</span>` }));
  el.innerHTML = `<p class="fig-title">Who decides each move on the benchmarks that have a realtime mode (BiGym 2.0, Panda Dynamic, RoboOlympics, HumanoidBench)</p>${legend(segs)}${stackRows(rows, segs)}`;
}

/* ------------------------------------------------------------------------------------------ the article */

/** The contents: an ordinary list in the article, built from its section heads. */
function toc() {
  const heads = $$('.post h2[id]');
  const box = $('#toc');
  if (!box || !heads.length) return;
  box.innerHTML = `<p class="label">${ZH ? '目录' : 'Contents'}</p><ol>${heads.map((h) => `<li><a href="#${h.id}">${esc(h.dataset.short || h.textContent.replace(/^\s*\d+\s*/, ''))}</a></li>`).join('')}</ol>`;
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

getJSON('data/blog.json').then((d) => {
  fillFacts(d);
  command($('#blog-cmd'));
  figOverall($('#fig-overall'), d);
  figKept($('#fig-kept'), d);
  figWaysRt($('#fig-ways-rt'), d);
  figSame($('#fig-same'), d);
  figNobody($('#fig-nobody'), d);
  figWays($('#fig-ways'), d);
  figLayers($('#fig-layers'), d);
  figReach($('#fig-reach'), d);
  figAfter($('#fig-after'), d);
  figClaims($('#fig-claims'), d);
  figFixes($('#fig-fixes'), d);
  figRoots($('#fig-roots'), d);
  figSubtasks($('#fig-subtasks'), d);
  figEventual($('#fig-eventual'), d);
  figBreaks($('#fig-breaks'), d);
  $$('[data-snapshot-a]').forEach((el) => { el.textContent = d.snapshot; });
  $$('[data-snapshot-b]').forEach((el) => { el.textContent = d.bottleneck?.snapshot || ''; });
  $$('[data-snapshot]').forEach((el) => { el.textContent = [d.snapshot.slice(0, 10), d.bottleneck?.snapshot].filter(Boolean).join(ZH ? ' 与 ' : ' and '); });
  toc();
  clips();
}).catch((err) => {
  console.error(err);
  $$('.fig-body').forEach((el) => { el.innerHTML = `<p class="fig-note">${esc(err.message)}</p>`; });
});
