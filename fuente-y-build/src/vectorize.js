// vectorize.js - texto -> vector de 24 dimensiones.
import { esTokens, grTokens, esStem, grStem, grSurfaceForms, grStrip } from './normalize.js';

const grExactTokens = (text) => grSurfaceForms(text).map(grStrip).filter((t) => t.length >= 2);
import { AXES, DEFAULT_WEIGHTS } from './lexicon.js';

export const DIM = AXES.length;
const MAX_NGRAM = 4;
const COLLAPSED = [];
const DUPLICATE_TERMS = [];

function buildIndex(withAliases = false) {
  const esUni = new Map(), esPhr = new Map();
  const grUni = new Map(), grPhr = new Map();
  const gxUni = new Map(), gxPhr = new Map();
  COLLAPSED.length = 0;
  DUPLICATE_TERMS.length = 0;

  const add = (map, key, axis, w, sense) => {
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({ axis, w, sense });
  };

  AXES.forEach((ax, ai) => {
    const seen = new Set();

    const load = (list, tokenize, uni, phr, defW, canal, sense, scale = 1) => {
      for (const raw of list || []) {
        const [term, w0] = Array.isArray(raw) ? raw : [raw, defW];
        const w = w0 * scale;
        const toks = tokenize(term);
        if (toks.length === 1 && String(term).trim().split(/\s+/).length > 1) {
          COLLAPSED.push({ axis: ax.id, term, token: toks[0] });
        }
        if (!toks.length || toks.length > MAX_NGRAM) continue;
        const key = toks.join(' ');
        const reg = canal + '|' + key;
        if (seen.has(reg)) {
          DUPLICATE_TERMS.push({ axis: ax.id, term, token: key });
          continue;
        }
        seen.add(reg);
        if (toks.length === 1) add(uni, key, ai, w, sense);
        else add(phr, key, ai, w, sense);
      }
    };

    load(ax.es, esTokens, esUni, esPhr, DEFAULT_WEIGHTS.es, 'es');
    load(ax.gr, grTokens, grUni, grPhr, DEFAULT_WEIGHTS.gr, 'gr');
    load(ax.grForms, grExactTokens, gxUni, gxPhr, DEFAULT_WEIGHTS.grForms, 'gx');
    for (const sn of ax.senses || []) {
      const sw = sn.weight == null ? 1 : sn.weight;
      load(sn.es, esTokens, esUni, esPhr, DEFAULT_WEIGHTS.es, 'es', sn.id, sw);
      load(sn.gr, grTokens, grUni, grPhr, DEFAULT_WEIGHTS.gr, 'gr', sn.id, sw);
      load(sn.grForms, grExactTokens, gxUni, gxPhr, DEFAULT_WEIGHTS.grForms, 'gx', sn.id, sw);
      if (withAliases) load(sn.aliases, esTokens, esUni, esPhr, DEFAULT_WEIGHTS.es, 'es', sn.id, sw);
    }
    if (withAliases) load(ax.aliases, esTokens, esUni, esPhr, DEFAULT_WEIGHTS.es, 'es');
  });

  return { esUni, esPhr, grUni, grPhr, gxUni, gxPhr };
}

export const INDEX = buildIndex(false);
export const INDEX_Q = buildIndex(true);

export function collapsedTerms() { return COLLAPSED.slice(); }
export function duplicateTerms() { return DUPLICATE_TERMS.slice(); }
export function aliasDupes() { return DUPLICATE_TERMS.slice(); }

const tf = (n) => 1 + Math.log(n);

function accumulate(tokens, uni, phr, lang, vec, hits) {
  const used = new Array(tokens.length).fill(false);
  const phraseCounts = new Map();
  for (let n = MAX_NGRAM; n >= 2; n--) {
    for (let i = 0; i + n <= tokens.length; i++) {
      if (used.slice(i, i + n).some(Boolean)) continue;
      const key = tokens.slice(i, i + n).join(' ');
      if (!phr.has(key)) continue;
      for (let j = i; j < i + n; j++) used[j] = true;
      phraseCounts.set(key, (phraseCounts.get(key) || 0) + 1);
    }
  }
  for (const [key, n] of phraseCounts) {
    for (const { axis, w, sense } of phr.get(key)) {
      const contrib = w * tf(n);
      vec[axis] += contrib;
      hits.push({ axis, token: key, n, lang, contrib, phrase: true, sense });
    }
  }

  const counts = new Map();
  tokens.forEach((t, i) => { if (!used[i]) counts.set(t, (counts.get(t) || 0) + 1); });
  for (const [tok, n] of counts) {
    const entries = uni.get(tok);
    if (!entries) continue;
    for (const { axis, w, sense } of entries) {
      const contrib = w * tf(n);
      vec[axis] += contrib;
      hits.push({ axis, token: tok, n, lang, contrib, phrase: false, sense });
    }
  }
}

export function vectorize(spanish, glosses = [], opts = {}) {
  const IX = opts.query ? INDEX_Q : INDEX;
  const vec = new Array(DIM).fill(0);
  const hits = [];
  const greek = glosses.join(' ');
  accumulate(esTokens(spanish), IX.esUni, IX.esPhr, 'es', vec, hits);
  accumulate(grTokens(greek), IX.grUni, IX.grPhr, 'gr', vec, hits);
  accumulate(grExactTokens(greek), IX.gxUni, IX.gxPhr, 'gr', vec, hits);
  return { vector: l2(vec), raw: vec, hits };
}

export function senseMixFromHits(hits = []) {
  const byAxis = new Map();
  for (const h of hits) {
    if (!h || !h.sense) continue;
    const id = AXES[h.axis] ? AXES[h.axis].id : String(h.axis);
    if (!byAxis.has(id)) byAxis.set(id, new Map());
    const m = byAxis.get(id);
    m.set(h.sense, (m.get(h.sense) || 0) + h.contrib);
  }
  const out = {};
  for (const [axisId, m] of byAxis) {
    let total = 0;
    for (const v of m.values()) total += v;
    if (!total) continue;
    out[axisId] = {};
    for (const [sense, v] of m) out[axisId][sense] = v / total;
  }
  return out;
}

export function dominantSense(mix, axisId) {
  const m = mix && mix[axisId];
  if (!m) return null;
  let best = null;
  for (const [sense, share] of Object.entries(m)) {
    if (!best || share > best.share) best = { sense, share };
  }
  return best;
}

export function senseLabel(axisId, senseId) {
  const ax = AXES.find((a) => a.id === axisId);
  const sn = ax && (ax.senses || []).find((s) => s.id === senseId);
  return sn ? (sn.label || sn.id) : senseId;
}

export function axesWithSenses() {
  return AXES.filter((a) => (a.senses || []).length).map((a) => ({
    id: a.id, label: a.label,
    senses: a.senses.map((s) => ({ id: s.id, label: s.label || s.id, weight: s.weight == null ? 1 : s.weight })),
  }));
}

export function applySenseTags(mix, tags = []) {
  const out = { ...(mix || {}) };
  const pinned = [];
  const porEje = new Map();
  // ejes fijados a mano como "sin sentido": un tag { eje } SIN 'sentido' anula
  // la mezcla de ese eje (queda vacia), para los falsos positivos/negativos de
  // la heuristica que no ameritan elegir un sentido puntual.
  const neutralEjes = new Set();
  for (const t of tags || []) {
    if (!t || !t.eje) continue;
    if (!t.sentido) { neutralEjes.add(t.eje); continue; }
    if (!porEje.has(t.eje)) porEje.set(t.eje, new Map());
    const m = porEje.get(t.eje);
    const w = t.peso_sentido == null ? 1 : t.peso_sentido;
    m.set(t.sentido, (m.get(t.sentido) || 0) + w);
  }
  for (const [eje, m] of porEje) {
    let total = 0;
    for (const v of m.values()) total += v;
    out[eje] = {};
    for (const [sentido, v] of m) out[eje][sentido] = total ? v / total : 0;
    pinned.push(eje);
  }
  for (const eje of neutralEjes) {
    if (porEje.has(eje)) continue;
    out[eje] = {};
    pinned.push(eje);
  }
  return { mix: out, pinned };
}

export function l2(v) {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  if (!n) return v.slice();
  return v.map((x) => x / n);
}

export { esStem, grStem };
