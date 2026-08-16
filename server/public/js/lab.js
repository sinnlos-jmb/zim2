/* ============================================================================
   lab.js - seccion Lab: laboratorio de inspeccion del corpus.

   Para que existe: revisar el corpus parrafo por parrafo y pulir el sistema
   de tags ANTES de empezar el Libro II. Muestra, para cada parrafo del .txt
   fuente, en que pasajes-chunks se parte (critico: un tag con parrafo_nro
   cae en TODOS los pasajes que ese parrafo alimenta) y, por pasaje:
     - el vector CRUDO de vectorize() (raw, no solo el normalizado L2),
     - los hits con el token que disparo cada eje (arete <- "virtud" (es)),
     - los tags ya aplicados,
     - la mezcla de sentidos antes/despues de applySenseTags (base vs mix).

   SOLO LECTURA, deliberadamente: escribir tags desde la UI saltearia el
   pre-flight de los patch-*.mjs y el baseline de regresion.mjs, que es la
   red que viene salvando el proyecto. Lo maximo que hace es dejar copiada
   la linea JSON lista para pegar en el .txt.
   ========================================================================= */
import { AXES } from './lexicon.js';
import { vectorize, senseMixFromHits, applySenseTags, senseLabel } from './vectorize.js';

const CORPUS = await fetch(new URL('../data/corpus.json', import.meta.url)).then((r) => {
  if (!r.ok) throw new Error('no se pudo cargar el corpus: HTTP ' + r.status);
  return r.json();
});

const $ = (s) => document.querySelector(s);
const el = (t, c, txt) => { const e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; };

/* --------------------------------------------------------- INDEXADO EN VIVO
 * El Lab NO usa el cache de localStorage de ui.js: revectoriza siempre, para
 * inspeccionar lo que el motor calcula HOY (72 pasajes tardan unos pocos ms).
 * `raw` es el vector crudo, antes de normalizar L2. */
const PASSAGES = CORPUS.passages.map((p) => {
  const { vector, raw, hits } = vectorize(p.esOnly, p.glosses);
  const senseBase = senseMixFromHits(hits);
  const { mix, pinned } = applySenseTags(senseBase, p.tags);
  return { ...p, vector, raw, hits, senseBase, senseMix: mix, sensesPinned: pinned };
});

/* -------------------------------------------------------- MODELO POR PARRAFO
 * parrafoNros invertido: parrafo -> pasajes que alimenta. Los pasajes sin
 * numero (hoy EN.I.3.b y EN.I.10.b, pendiente 2 del arranque) van en un
 * bloque aparte: son intagueables por parrafo_nro y el Lab los tiene que
 * mostrar, no esconder. */
const PAR_MAP = new Map();
PASSAGES.forEach((p) => {
  (p.parrafoNros || []).forEach((n) => {
    if (!PAR_MAP.has(n)) PAR_MAP.set(n, { nro: n, chapter: p.chapter, passages: [] });
    const entry = PAR_MAP.get(n);
    if (!entry.passages.includes(p)) entry.passages.push(p);
  });
});
const PARAGRAPHS = [...PAR_MAP.values()].sort((a, b) => a.nro - b.nro);
const ORPHANS = PASSAGES.filter((p) => !(p.parrafoNros || []).length);

let current = null; // { type: 'par', idx } | { type: 'orphan', id }

/* Mismo criterio que dedupeTags en build-corpus.mjs: clave canonica con las
 * claves ordenadas, para que el orden de escritura del tag no cuente como
 * diferencia. */
const canonTag = (v) => {
  if (Array.isArray(v)) return '[' + v.map(canonTag).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canonTag(v[k])).join(',') + '}';
  }
  return JSON.stringify(v);
};
function dedupeTags(tags) {
  const vistos = new Set();
  const out = [];
  for (const t of tags || []) {
    const k = canonTag(t);
    if (vistos.has(k)) continue;
    vistos.add(k);
    out.push(t);
  }
  return out;
}

/* ------------------------------------------------------------- HELPERS UI - */

function copyBtn(textFn, label) {
  const b = el('button', 'copybtn', label || 'copiar');
  b.type = 'button';
  b.onclick = async () => {
    const txt = typeof textFn === 'function' ? textFn() : String(textFn);
    let ok = false;
    try { await navigator.clipboard.writeText(txt); ok = true; } catch (e) {
      // fallback para contextos sin clipboard API (http plano, etc.)
      const ta = document.createElement('textarea');
      ta.value = txt;
      document.body.append(ta);
      ta.select();
      try { ok = document.execCommand('copy'); } catch (e2) {}
      ta.remove();
    }
    const prev = b.textContent;
    b.textContent = ok ? 'copiado ✓' : 'no se pudo copiar';
    b.classList.toggle('ok', ok);
    setTimeout(() => { b.textContent = prev; b.classList.remove('ok'); }, 1400);
  };
  return b;
}

function barRow(label, value, max, extra) {
  const row = el('div', 'bar');
  row.append(el('span', 'bl', label));
  const track = el('span', 'bt');
  const fill = el('span', 'bf');
  fill.style.width = `${Math.max(2, (value / (max || 1)) * 100)}%`;
  track.append(fill);
  row.append(track);
  row.append(el('span', 'bv', extra != null ? extra : value.toFixed(2)));
  return row;
}

const setCount = (sel, n) => { const e = $(sel); if (e) e.textContent = n ? String(n) : ''; };

function fmtMix(axisId, m) {
  if (!m) return '—';
  const entries = Object.entries(m).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return 'sin acepción (neutro)';
  return entries.map(([s, v]) => `${senseLabel(axisId, s)} ${Math.round(v * 100)}%`).join(' · ');
}

/* ------------------------------------------------------------- SIDEBAR ---- */

function renderParList() {
  const box = $('#parlist');
  box.innerHTML = '';
  let ch = null;
  PARAGRAPHS.forEach((par, i) => {
    if (par.chapter !== ch) {
      ch = par.chapter;
      box.append(el('div', 'pgrp', 'Capítulo ' + ch));
    }
    const b = el('button', 'pbtn');
    b.type = 'button';
    b.dataset.idx = String(i);
    if (par.passages.length > 1) b.classList.add('multi');
    b.append(el('b', null, '¶ ' + par.nro));
    b.append(el('span', 'm', par.passages.length + ' pas.'));
    b.title = par.passages.map((p) => p.id).join(', ');
    b.onclick = () => showParagraph(i, true);
    box.append(b);
  });
  setCount('#npar', PARAGRAPHS.length);
}

function renderOrphans() {
  const box = $('#orphanlist');
  box.innerHTML = '';
  setCount('#norf', ORPHANS.length);
  if (!ORPHANS.length) {
    box.append(el('p', 'sbempty', 'Todos los pasajes tienen párrafo asignado.'));
    return;
  }
  ORPHANS.forEach((p) => {
    const b = el('button', 'sbq', p.id + ' · ' + (p.bekker || 'sin Bekker'));
    b.type = 'button';
    b.dataset.pid = p.id;
    b.onclick = () => showOrphan(p.id, true);
    box.append(b);
  });
}

/* ---------------------------------------------------------- NAVEGACION ---- */

function showParagraph(i, push) {
  if (i < 0 || i >= PARAGRAPHS.length) return;
  current = { type: 'par', idx: i };
  if (push) history.pushState(null, '', location.pathname + location.search + '#p=' + PARAGRAPHS[i].nro);
  render();
}

function showOrphan(id, push) {
  if (!PASSAGES.some((p) => p.id === id)) return;
  current = { type: 'orphan', id };
  if (push) history.pushState(null, '', location.pathname + location.search + '#pasaje=' + encodeURIComponent(id));
  render();
}

function renderCrumbs(label) {
  if (!window.SHELL) return;
  window.SHELL.crumbs([
    { label: 'Inicio', icon: '\u2302', onClick: () => { location.href = 'index.html'; } },
    { label: 'Lab' },
    { label },
  ]);
}

function render() {
  document.querySelectorAll('#sb .on').forEach((x) => x.classList.remove('on'));
  if (window.PANELS && window.PANELS.isMobile()) window.PANELS.setSidebar(false);
  if (current.type === 'par') {
    const par = PARAGRAPHS[current.idx];
    const btn = document.querySelector('.pbtn[data-idx="' + current.idx + '"]');
    if (btn) { btn.classList.add('on'); btn.scrollIntoView({ block: 'nearest' }); }
    renderCrumbs('Párrafo ' + par.nro + ' · cap. ' + par.chapter);
    renderParHead(par, current.idx);
    renderParBody(par);
  } else {
    const p = PASSAGES.find((x) => x.id === current.id);
    const btn = document.querySelector('#orphanlist .sbq[data-pid="' + current.id + '"]');
    if (btn) btn.classList.add('on');
    renderCrumbs(p.id + ' (sin párrafo)');
    renderOrphanHead(p);
    renderOrphanBody(p);
  }
  $('#mn').scrollTop = 0;
}

/* ----------------------------------------------------- VISTA DEL PARRAFO -- */

function renderParHead(par, i) {
  const head = $('#parhead');
  head.innerHTML = '';
  const prev = el('button', 'pnav', '←');
  prev.type = 'button';
  prev.title = 'Párrafo anterior (tecla ←)';
  prev.disabled = i <= 0;
  prev.onclick = () => showParagraph(i - 1, true);
  const next = el('button', 'pnav', '→');
  next.type = 'button';
  next.title = 'Párrafo siguiente (tecla →)';
  next.disabled = i >= PARAGRAPHS.length - 1;
  next.onclick = () => showParagraph(i + 1, true);
  const h = el('h2', null, 'Párrafo ' + par.nro);
  h.append(el('span', 'sub', 'capítulo ' + par.chapter + ' · ' + par.passages.length + (par.passages.length > 1 ? ' pasajes' : ' pasaje')));
  head.append(prev, h, next);
}

function renderParBody(par) {
  const box = $('#parview');
  box.innerHTML = '';

  if (par.passages.length > 1) {
    const w = el('div', 'labwarn');
    w.textContent = 'Este párrafo alimenta ' + par.passages.length + ' pasajes. Un tag con "parrafo_nro": ' + par.nro + ' cae en TODOS ellos.';
    box.append(w);
  }

  // Tags del parrafo: union deduplicada de los tags de sus pasajes. El corpus
  // guarda los tags a nivel pasaje, asi que cuando un pasaje fusiona varios
  // parrafos no se puede saber desde aca de cual vino cada tag: se avisa.
  const tags = dedupeTags(par.passages.flatMap((p) => p.tags || []));
  const tb = el('section', 'tagbox');
  tb.append(el('h3', null, 'Tags visibles desde este párrafo (' + tags.length + ')'));
  if (par.passages.some((p) => (p.parrafoNros || []).length > 1)) {
    tb.append(el('p', 'muted', 'Ojo: al menos un pasaje fusiona varios párrafos; el corpus no distingue de cuál de ellos vino cada tag.'));
  }
  if (!tags.length) tb.append(el('p', 'muted', 'Ninguno.'));
  tags.forEach((t) => {
    const row = el('div', 'tagline');
    row.append(el('code', null, JSON.stringify(t)));
    row.append(copyBtn(() => JSON.stringify(t)));
    tb.append(row);
  });
  tb.append(el('p', 'muted pastehint', 'Línea lista para pegar en el .txt (editala a mano y después corré build-corpus → regresion):'));
  const line = () => JSON.stringify({ parrafo_nro: par.nro, tags });
  const lr = el('div', 'tagline');
  lr.append(el('code', null, line()));
  lr.append(copyBtn(line, 'copiar línea'));
  tb.append(lr);
  box.append(tb);

  par.passages.forEach((p) => box.append(passageCard(p)));
}

function renderOrphanHead(p) {
  const head = $('#parhead');
  head.innerHTML = '';
  const h = el('h2', null, p.id);
  h.append(el('span', 'sub', 'capítulo ' + p.chapter + ' · sin número de párrafo'));
  head.append(h);
}

function renderOrphanBody(p) {
  const box = $('#parview');
  box.innerHTML = '';
  const w = el('div', 'labwarn');
  w.textContent = 'Este pasaje no tiene párrafo asignado: hoy es intagueable por "parrafo_nro" (pendiente 2 del arranque). El Lab lo muestra para poder rastrear de dónde sale.';
  box.append(w);
  box.append(passageCard(p));
}

/* ----------------------------------------------------- FICHA DEL PASAJE --- */

function passageCard(p) {
  const card = el('article', 'card labcard');

  const top = el('div', 'ctop');
  const meta = el('div', 'meta');
  meta.append(el('strong', null, p.id));
  meta.append(el('span', 'bek', p.bekker || 'sin Bekker'));
  meta.append(el('span', 'muted', p.words + ' palabras'));
  top.append(meta);
  const pars = p.parrafoNros || [];
  const badge = el('span', 'parbadge', pars.length ? '¶ ' + pars.join(' + ') : 'sin párrafo');
  if (!pars.length) badge.classList.add('none');
  else if (pars.length > 1) badge.classList.add('fused');
  badge.title = !pars.length
    ? 'Pasaje sin número de párrafo: hoy intagueable por parrafo_nro'
    : pars.length > 1
      ? 'Pasaje que fusiona varios párrafos cortos del mismo capítulo: los tags de todos ellos se acumulan acá'
      : 'Número de párrafo en el .txt fuente';
  top.append(badge);
  card.append(top);

  // texto con las glosas griegas intercaladas (es, no esOnly: el Lab quiere
  // ver lo mismo que ve el lector, y las glosas son parte de la inspeccion)
  card.append(el('p', 'text', p.es));
  if (p.glosses.length) {
    const g = el('div', 'gloss');
    g.append(el('span', 'glabel', 'Glosas:'));
    g.append(el('span', 'glist', ' ' + p.glosses.join(', ') + '.'));
    card.append(g);
  }

  /* VECTOR CRUDO + HITS. La barra muestra `raw` (los aportes acumulados por
   * eje, ANTES de normalizar L2); el valor normalizado va en el tooltip.
   * Debajo de cada eje, los hits que lo dispararon, estilo:
   *   arete ← "virtud" (es) ×2 +0.83 · sentido: ética  */
  const active = p.raw
    .map((v, i) => ({ v, norm: p.vector[i], i }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v);
  const vb = el('section', 'vecbox');
  vb.append(el('h4', null, 'Ejes activados (' + active.length + ' de ' + AXES.length + ') · vector crudo'));
  if (!active.length) vb.append(el('p', 'muted', 'Ningún eje activado.'));
  const max = active.length ? active[0].v : 1;
  const byAxis = new Map();
  p.hits.forEach((h) => {
    if (!byAxis.has(h.axis)) byAxis.set(h.axis, []);
    byAxis.get(h.axis).push(h);
  });
  active.forEach(({ v, norm, i }) => {
    const row = barRow(AXES[i].label + ' (' + AXES[i].greek + ')', v, max, v.toFixed(2));
    row.title = 'crudo ' + v.toFixed(3) + ' · L2 ' + norm.toFixed(3);
    vb.append(row);
    const hits = (byAxis.get(i) || []).slice().sort((a, b) => b.contrib - a.contrib);
    if (hits.length) {
      const hr = el('div', 'hitrows');
      hits.forEach((h) => {
        const parts = ['"' + h.token + '" (' + h.lang + ')'];
        if (h.n > 1) parts.push('×' + h.n);
        parts.push('+' + h.contrib.toFixed(2));
        if (h.phrase) parts.push('· frase');
        if (h.sense) parts.push('· sentido: ' + senseLabel(AXES[i].id, h.sense));
        const lineEl = el('div', 'hitrow');
        lineEl.append(el('b', null, AXES[i].id));
        lineEl.append(document.createTextNode(' ← ' + parts.join(' ')));
        hr.append(lineEl);
      });
      vb.append(hr);
    }
  });
  card.append(vb);

  // tags aplicados al pasaje, tal como quedaron en corpus.json
  const tg = el('section', 'tagsec');
  const ptags = p.tags || [];
  tg.append(el('h4', null, 'Tags aplicados al pasaje (' + ptags.length + ')'));
  if (!ptags.length) tg.append(el('p', 'muted', 'Ninguno.'));
  ptags.forEach((t) => {
    const row = el('div', 'tagline');
    row.append(el('code', null, JSON.stringify(t)));
    row.append(copyBtn(() => JSON.stringify(t)));
    tg.append(row);
  });
  card.append(tg);

  /* SENTIDOS: base (lo que el motor deduce de los hits) vs final (lo que
   * queda despues de applySenseTags, con los ejes fijados a mano marcados).
   * Es el antes/despues que pide el repaso: aca se ve el agujero de arete
   * sin acepcion (base vacia para el eje) y los tags neutros. */
  const axIds = [...new Set([...Object.keys(p.senseBase || {}), ...Object.keys(p.senseMix || {})])];
  const sb = el('section', 'sensebox');
  sb.append(el('h4', null, 'Mezcla de sentidos · base (hits) → final (applySenseTags)'));
  if (!axIds.length) sb.append(el('p', 'muted', 'Ningún eje con acepciones en juego en este pasaje.'));
  axIds.forEach((axisId) => {
    const row = el('div', 'senserow');
    const name = el('span', 'sensename', axisId);
    if ((p.sensesPinned || []).includes(axisId)) name.append(el('span', 'pinbadge', 'fijado a mano'));
    row.append(name);
    row.append(el('span', 'sensemix', 'base: ' + fmtMix(axisId, (p.senseBase || {})[axisId])));
    row.append(el('span', 'sensemix final', 'final: ' + fmtMix(axisId, (p.senseMix || {})[axisId])));
    sb.append(row);
  });
  card.append(sb);

  if (p.greekParallel) {
    const det = el('details');
    det.append(el('summary', null, 'Griego original'));
    det.append(el('p', 'grtext', p.greekParallel));
    card.append(det);
  }

  return card;
}

/* ------------------------------------------------------- URL COMO ESTADO -- */

function applyHash() {
  const raw = location.hash.replace(/^#/, '');
  if (!raw) return false;
  const params = new URLSearchParams(raw);
  const pnum = params.get('p');
  if (pnum != null) {
    const idx = PARAGRAPHS.findIndex((x) => String(x.nro) === pnum);
    if (idx >= 0) { showParagraph(idx, false); return true; }
  }
  const pid = params.get('pasaje');
  if (pid && ORPHANS.some((p) => p.id === pid)) { showOrphan(pid, false); return true; }
  return false;
}

/* ------------------------------------------------------------------ INIT -- */

function init() {
  renderParList();
  renderOrphans();
  $('#status').textContent = 'Lab · solo lectura: los tags se editan en el .txt fuente y pasan por build-corpus → regresion antes de guardarse.';
  $('#stats').textContent = PARAGRAPHS.length + ' párrafos · ' + PASSAGES.length + ' pasajes · ' + AXES.length + ' ejes · ' + ORPHANS.length + ' sin párrafo';

  document.addEventListener('keydown', (e) => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (!current || current.type !== 'par') return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); showParagraph(current.idx - 1, true); }
    if (e.key === 'ArrowRight') { e.preventDefault(); showParagraph(current.idx + 1, true); }
  });

  window.addEventListener('popstate', () => { if (!applyHash()) showParagraph(0, false); });
  if (!applyHash()) showParagraph(0, false);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
