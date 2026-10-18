// Task search over data/search.json (written by scripts/export_atlas.py). No dependencies; an ES module.
//
//   import { makeSearch } from "/assets/search_core.js";
//   const S = makeSearch(await (await fetch("data/search.json")).json());
//   const r = S.search("fold cloth");   // r.hits: task indices, best first; r.score[i] in 0..1
//   S.keys[r.hits[0]];                  // "<suite>/<id>", the key of data/tasks.json and data/atlas.json
//   r.P.concepts;                       // Map "type:id" -> {w, via}: what the query was read as
//   S.relatedTerms(r.qv, r.P, 7);       // related words to offer
//
// A query is read three ways and the scores are combined:
//   concepts  task types, capabilities, bodies, suites, keywords, atomic actions and robot names, by their aliases;
//   meaning   the query vector is the weighted sum of its words' embedding vectors (bge-m3, projected to 256
//             dimensions), compared with each task's vector; a misspelt word is read as the closest known word, and
//             the last word, while it is still being typed, as its most common completion;
//   text      BM25 over names, summaries, objects, keywords, categories, ids and steps.

export function makeSearch(D) {
  const T = D.tasks, N = T.length, DIM = D.vec.dim;
  const stem = (w) => (w.length > 4 && w.endsWith("ies") ? w.slice(0, -3) + "y"
    : w.length > 3 && w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us") ? w.slice(0, -1) : w);
  const words = (s) => String(s).toLowerCase().match(/[a-z][a-z0-9']*(?:-[a-z0-9]+)*/g) || [];
  const stems = (s) => words(s).map(stem);
  const STOP = new Set("a an the and or of to in on at by for from with into onto is are be it its this that as up out off over under then than not no so all any each other some".split(" "));

  // Vectors are int8 projections onto the task embeddings' leading singular directions, one scale per dimension,
  // kept at their projected length (not renormalised) so that reduced dot products rank tasks as the full model does.
  function decode(b64, scale, rows) {
    const bin = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("binary");
    const out = new Float32Array(rows * DIM);
    for (let j = 0; j < rows * DIM; j++) { let v = bin.charCodeAt(j); if (v > 127) v -= 256; out[j] = v * scale[j % DIM]; }
    return out;
  }
  const keys = D.lex.keys, NT = keys.length;
  const TV = decode(D.vec.task, D.vec.task_scale, N);
  const LV = decode(D.vec.term, D.vec.term_scale, NT);
  const keyIdx = new Map(keys.map((k, i) => [k, i]));
  const unigramByLen = [];   // for fuzzy matching: unigram keys with df > 0
  keys.forEach((k, i) => { if (!k.includes(" ") && D.lex.df[i] > 0) unigramByLen.push(i); });

  // ---- concepts ----
  const C = D.concepts, aliasMap = new Map();
  const CONCEPT = new Map();  // "type:id" -> {type, id, en, vec}
  const addAlias = (phrase, ref) => { if (!phrase) return; if (!aliasMap.has(phrase)) aliasMap.set(phrase, []); aliasMap.get(phrase).push(ref); };
  const enKey = (s) => stems(s).join(" ");
  function defConcept(type, id, en, vecPhrase) {
    const k = type + ":" + id; CONCEPT.set(k, { type, id, en, vec: keyIdx.get(enKey(vecPhrase || en)) }); return k;
  }
  for (const g of ["task_type", "capability"]) for (const c of C[g]) {
    const k = defConcept(g, c.id, c.en);
    for (const a of [c.en, ...c.alias_en]) addAlias(enKey(a), { k, w: 1 });
    for (const a of c.weak_en || []) addAlias(enKey(a), { k, w: 0.45 });
  }
  for (const c of C.body) {
    if (c.id === "other") continue;
    const k = defConcept("body", c.id, c.en, c.alias_en[0] || c.en);
    for (const a of [c.en, ...c.alias_en]) addAlias(enKey(a), { k, w: 1 });
  }
  // suites: by name, by the name without punctuation, and by the first word of the id when only one suite has it
  D.benches.forEach((label, bi) => {
    const k = defConcept("bench", bi, label, "benchmark");
    CONCEPT.get(k).vec = undefined;
    const low = label.toLowerCase();
    for (const a of new Set([low, low.replace(/[^a-z0-9]+/g, ""), low.replace(/[^a-z0-9]+/g, " ").trim(), D.bench_ids[bi]])) addAlias(enKey(a) || a, { k, w: 1 });
  });
  const benchCompact = D.benches.map((label, bi) => [label.toLowerCase().replace(/[^a-z0-9]+/g, ""), bi]);
  const benchPrefix = new Map();
  D.bench_ids.forEach((id, bi) => { const p = id.split(/[-_]/)[0]; if (!benchPrefix.has(p)) benchPrefix.set(p, new Set()); benchPrefix.get(p).add(bi); });
  for (const [p, set] of benchPrefix) if (set.size === 1) addAlias(enKey(p) || p, { k: "bench:" + [...set][0], w: 1 });
  for (const [id, syn] of Object.entries(D.vocab)) {
    const k = defConcept("kw", id, id.replace(/-/g, " "));
    for (const a of [id.replace(/-/g, " "), ...syn]) addAlias(enKey(a), { k, w: 0.6 });
  }
  for (const id of D.actions) {
    const k = defConcept("act", id, id.replace(/-/g, " "));
    addAlias(enKey(id.replace(/-/g, " ")), { k, w: 0.5 });
  }
  const GENERIC_ROBOT = new Set(["bimanual", "arm", "hand", "floating", "plus", "longfinger", "mpl", "torso", "dex1", "vb", "rods"]);
  const robotTok = new Set();
  T.forEach((t) => t.robot.split("-").forEach((p) => { if (p.length > 1 && !GENERIC_ROBOT.has(p) && !/^\d+$/.test(p)) robotTok.add(p); }));
  for (const p of robotTok) { const k = defConcept("robot", p, p); CONCEPT.get(k).vec = undefined; addAlias(stem(p), { k, w: 0.6 }); }

  function has(t, k) {
    const c = CONCEPT.get(k);
    switch (c.type) {
      case "task_type": return t.tt.includes(c.id);
      case "capability": return t.cap.includes(c.id);
      case "body": return t.body === c.id;
      case "bench": return t.bench === c.id;
      case "kw": return t.k.includes(c.id);
      case "act": return t.st.some((s) => s[0] === c.id);
      case "robot": return t.robot.split("-").includes(c.id);
    }
    return false;
  }

  // ---- lexical index (BM25) ----
  const tagName = {}; for (const g of ["task_type", "capability"]) for (const c of C[g]) tagName[c.id] = c.en;
  const docs = T.map((t, i) => {
    const f = new Map(); let len = 0;
    const add = (s, w) => { for (const x of stems(s)) { if (STOP.has(x)) continue; f.set(x, (f.get(x) || 0) + w); len += w; } };
    add(t.n, 3); add(t.t, 1); add(t.o.join(" "), 2); add(t.k.join(" ").replace(/-/g, " "), 1.5);
    add([...t.tt, ...t.cap].map((x) => tagName[x]).join(" "), 1); add(D.keys[i].replace(/[-_/]/g, " "), 1);
    add(t.robot.replace(/-/g, " "), 1); add(t.st.map((s) => s[0] + " " + s[1]).join(" "), 1);
    return { f, len };
  });
  const avgLen = docs.reduce((a, d) => a + d.len, 0) / N;
  const df = new Map(); for (const d of docs) for (const w of d.f.keys()) df.set(w, (df.get(w) || 0) + 1);
  const idf = (w) => { const n = df.get(w) || 0; return Math.log(1 + (N - n + 0.5) / (n + 0.5)); };

  // edit distance with adjacent transpositions, giving up beyond `max`
  function editDist(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev2 = null, prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i]; let best = i;
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (prev2 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], prev2[j - 2] + 1);
        best = Math.min(best, cur[j]);
      }
      if (best > max) return max + 1;
      prev2 = prev; prev = cur;
    }
    return prev[b.length];
  }
  const termW = (i) => Math.min(4, Math.max(1, Math.log(1 + N / (1 + D.lex.df[i]))));

  // ---- query parsing ----
  function parse(qraw) {
    const q = String(qraw).normalize("NFKC").toLowerCase();
    const units = [];           // semantic units {i (lexicon index), w, label, how}
    const lexTok = new Map();   // stem -> weight
    const concepts = new Map(); // k -> {w, via}
    const addConcept = (ref, via) => { const cur = concepts.get(ref.k); if (!cur || cur.w < ref.w) concepts.set(ref.k, { w: ref.w, via }); };
    const addTerm = (i, w, label, how) => { if (i === undefined) return; const u = units.find((x) => x.i === i); if (u) { u.w = Math.max(u.w, w); return; } units.push({ i, w, label, how }); };
    const toks = q.match(/[a-z][a-z0-9']*(?:-[a-z0-9]+)*/g) || [];
    const raw = toks.map(stem);
    // spelling: a word that is neither a lexicon term nor an alias is read as its closest lexicon word, and the
    // last word, while still being typed, as its most common completion
    const fix = raw.map((s, a) => {
      if (STOP.has(s) || keyIdx.has(s) || aliasMap.has(s)) return { s, how: "word" };
      if (a === raw.length - 1 && s.length >= 2) {
        let best = -1; for (const j of unigramByLen) if (keys[j].startsWith(s) && (best < 0 || D.lex.df[j] > D.lex.df[best])) best = j;
        if (best >= 0) return { s: keys[best], how: "prefix" };
      }
      if (s.length >= 4) {
        const max = s.length >= 8 ? 2 : 1; let best = -1, bd = 9;
        for (const j of unigramByLen) { const d = editDist(s, keys[j], max); if (d <= max && (d < bd || (d === bd && D.lex.df[j] > D.lex.df[best]))) { bd = d; best = j; } }
        if (best >= 0) return { s: keys[best], how: "fuzzy" };
      }
      return { s, how: "none" };
    });
    const st = fix.map((f) => f.s);
    // a suite named by the start of its name ("robosafe", "libero", "metaworld"), when only one suite fits
    toks.forEach((w, a) => {
      if (w.length < 4 || aliasMap.has(st[a])) return;
      const fits = benchCompact.filter(([c]) => c.startsWith(w.replace(/[^a-z0-9]/g, "")));
      if (fits.length === 1) addConcept({ k: "bench:" + fits[0][1], w: 1 }, w);
    });
    const coveredByConcept = new Array(st.length).fill(false);
    for (let n = Math.min(4, st.length); n >= 1; n--) {
      for (let a = 0; a + n <= st.length; a++) {
        if (coveredByConcept.slice(a, a + n).some(Boolean)) continue;
        const ph = st.slice(a, a + n).join(" "); const refs = aliasMap.get(ph);
        if (refs) { for (const r of refs) addConcept(r, toks.slice(a, a + n).join(" ")); if (n > 1 || refs.some((r) => r.w >= 1)) for (let j = a; j < a + n; j++) coveredByConcept[j] = true; }
      }
    }
    for (let a = 0; a < st.length; a++) {
      const s = st[a]; if (STOP.has(s)) continue;
      if (a + 1 < st.length) { const bi = keyIdx.get(s + " " + st[a + 1]); if (bi !== undefined && D.lex.df[bi] > 0) addTerm(bi, termW(bi) * 1.2, D.lex.text[bi], "phrase"); }
      const i = keyIdx.get(s), how = fix[a].how;
      if (i !== undefined) {
        addTerm(i, termW(i) * (how === "word" ? 1 : 0.7), D.lex.text[i], how);
        lexTok.set(keys[i], Math.max(lexTok.get(keys[i]) || 0, how === "word" ? 1 : 0.7));
      } else lexTok.set(s, 1);
    }
    // concept vectors join the semantic query
    for (const [k, c] of concepts) { const v = CONCEPT.get(k).vec; if (v !== undefined) addTerm(v, 1.5 * c.w, CONCEPT.get(k).en, "concept"); }
    return { units, lexTok, concepts };
  }

  function queryVec(units) {
    const v = new Float32Array(DIM); let any = false;
    for (const u of units) { any = true; for (let d = 0; d < DIM; d++) v[d] += u.w * LV[u.i * DIM + d]; }
    if (!any) return null;
    let n = 0; for (let d = 0; d < DIM; d++) n += v[d] * v[d]; n = Math.sqrt(n) || 1;
    for (let d = 0; d < DIM; d++) v[d] /= n;
    return v;
  }

  function search(qraw) {
    const P = parse(qraw);
    const qv = queryVec(P.units);
    const sem = new Float32Array(N), semN = new Float32Array(N), lex = new Float32Array(N), con = new Float32Array(N), score = new Float32Array(N);
    if (qv) {
      let mu = 0, sd = 0;
      for (let i = 0; i < N; i++) { let s = 0; for (let d = 0; d < DIM; d++) s += qv[d] * TV[i * DIM + d]; sem[i] = s; mu += s; }
      mu /= N; for (let i = 0; i < N; i++) sd += (sem[i] - mu) ** 2; sd = Math.sqrt(sd / N) || 1;
      for (let i = 0; i < N; i++) semN[i] = Math.min(1, Math.max(0, ((sem[i] - mu) / sd - 1.0) / 3.5));
    }
    let lmax = 0; const k1 = 1.2, b = 0.75;
    for (const [w, qw] of P.lexTok) {
      if (!df.get(w)) continue; const iw = idf(w) * qw;
      for (let i = 0; i < N; i++) { const f = docs[i].f.get(w); if (f) lex[i] += iw * (f * (k1 + 1)) / (f + k1 * (1 - b + b * docs[i].len / avgLen)); }
    }
    for (let i = 0; i < N; i++) lmax = Math.max(lmax, lex[i]);
    if (lmax > 0) for (let i = 0; i < N; i++) lex[i] /= lmax;
    let cw = 0; for (const c of P.concepts.values()) cw += c.w;
    if (cw > 0) for (let i = 0; i < N; i++) { let s = 0; for (const [k, c] of P.concepts) if (has(T[i], k)) s += c.w; con[i] = s / cw; }
    const hasLex = lmax > 0, hasCon = cw > 0;
    const wS = 0.45, wL = hasLex ? 0.35 : 0, wC = hasCon ? (hasLex ? 0.3 : 0.45) : 0;
    let smax = 0;
    for (let i = 0; i < N; i++) { score[i] = wS * semN[i] + wL * lex[i] + wC * con[i]; smax = Math.max(smax, score[i]); }
    const cut = Math.max(0.1, 0.32 * smax);
    const hits = [];
    for (let i = 0; i < N; i++) if (score[i] >= cut) hits.push(i);
    hits.sort((a, b2) => score[b2] - score[a]);
    return { P, qv, sem, semN, lex, con, score: smax > 0 ? score.map((s) => s / smax) : score, hits, smax };
  }

  function relatedTerms(qv, P, n) {
    if (!qv) return [];
    const used = new Set(P.units.map((u) => u.i)); const pre = [...P.lexTok.keys()].map((k) => k.slice(0, 5));
    const sc = [];
    for (let j = 0; j < NT; j++) {
      if (!D.lex.sug[j] || used.has(j) || D.lex.df[j] > 200) continue;
      const k = keys[j]; if (pre.some((p) => k.startsWith(p) || k.split(" ").some((x) => x.startsWith(p)))) continue;
      let s = 0, nn = 0; for (let d = 0; d < DIM; d++) { const x = LV[j * DIM + d]; s += qv[d] * x; nn += x * x; } sc.push([s / (Math.sqrt(nn) || 1), j]);
    }
    sc.sort((a, b) => b[0] - a[0]);
    const out = [], seenStem = new Set();
    for (const [s, j] of sc) { const r = keys[j].split(" ")[0].slice(0, 5); if (seenStem.has(r)) continue; seenStem.add(r); out.push({ text: D.lex.text[j], s }); if (out.length >= n) break; }
    return out;
  }

  return { search, relatedTerms, parse, has, CONCEPT, keys: D.keys, stems, stem, TV, DIM };
}
