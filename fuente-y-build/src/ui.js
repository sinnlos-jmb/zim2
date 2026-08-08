import { AXES, AXES_BY_GROUP } from './lexicon.js';
import { vectorize, vectorFromAxes, topK } from './vectorize.js';

// El corpus no viaja dentro del script: se pide al servidor. new URL(...)
// lo resuelve relativo a este modulo, asi la app funciona montada en / o
// en un subdirectorio como /en1 sin tocar una linea.
const CORPUS = await fetch(new URL('../data/corpus.json', import.meta.url)).then((r) => {
  if (!r.ok) throw new Error('no se pudo cargar el corpus: HTTP ' + r.status);
  return r.json();
});
/* ui.js - interfaz. Usa las funciones del motor inlineadas arriba. */

// v2 = 23 dimensiones (ariston, kalon, theion) + formas griegas exactas.
// v3 = 24 dimensiones: se agrega arkhe (Principio), medido con 3 mejoras,
//      0 regresiones y 0 degeneracion frente a v2.
// Al subir la clave se reconstruye el indice solo en el navegador.
// Subir esta clave en CADA cambio de lexico: si no, un navegador que ya abrio
// la version anterior recupera de localStorage un indice con otra cantidad de
// dimensiones y el coseno compara vectores incompatibles.
const STORE_KEY = 'en1:index:v9';

// Preguntas y definiciones del menu del header: a diferencia de una version
// anterior con preguntas escritas a mano, estas surgen del centinela
// `{ "parrafo_nro": ..., "tags": [...] }` del .txt fuente. build-corpus.mjs
// deja ese contenido en `passage.tags`; acá solo se agrupa por pregunta o
// por eje. Si el .txt no trae tags de un rol, el menu correspondiente queda
// vacío (no hay fallback a texto inventado): eso es intencional, es la forma
// mas simple de confirmar que el mecanismo de tags llega entero hasta la UI.
function collectTagged(rol) {
  const byKey = new Map();
  CORPUS.passages.forEach((p) => {
    (p.tags || []).forEach((t) => {
      if (t.rol !== rol) return;
      const key = rol === 'faq' ? t.pregunta : (t.eje || t.concepto);
      if (!key) return;
      if (!byKey.has(key)) byKey.set(key, { key, tags: [], passageIds: [] });
      const entry = byKey.get(key);
      entry.tags.push(t);
      entry.passageIds.push(p.id);
    });
  });
  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key, 'es'));
}
const FAQ_TAGGED = collectTagged('faq');
const DEF_TAGGED = collectTagged('define');
const formatPregunta = (q) => (q.trim().startsWith('¿') ? q.trim() : '¿' + q.trim());
const defLabel = (entry) => {
  const ax = AXES.find((a) => a.id === entry.key);
  return ax ? `${ax.label} (${ax.greek})` : entry.key;
};

const $ = (s) => document.querySelector(s);
const el = (t, c, txt) => { const e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; };

let PASSAGES = [];
let selectedAxes = {};
let lastResults = [];
let lastQuery = null;

/* ------------------------------------------------ INDEXADO + localStorage --- */

function buildIndexNow() {
  const t0 = performance.now();
  PASSAGES = CORPUS.passages.map((p) => {
    const { vector, raw, hits } = vectorize(p.esOnly, p.glosses);
    return { ...p, vector, raw, hits, vectorizedFrom: p.textHash };
  });
  const ms = performance.now() - t0;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      builtAt: new Date().toISOString(),
      items: PASSAGES.map((p) => ({ id: p.id, vector: p.vector, raw: p.raw, vectorizedFrom: p.vectorizedFrom })),
    }));
  } catch (e) { /* cuota */ }
  return ms;
}

function loadIndex() {
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) {}
  if (cached && cached.items && cached.items.length === CORPUS.passages.length) {
    const map = new Map(cached.items.map((i) => [i.id, i]));
    let stale = 0;
    PASSAGES = CORPUS.passages.map((p) => {
      const c = map.get(p.id);
      if (!c || c.vectorizedFrom !== p.textHash) { stale++; const v = vectorize(p.esOnly, p.glosses); return { ...p, ...v, vectorizedFrom: p.textHash }; }
      const { hits } = vectorize(p.esOnly, p.glosses);
      return { ...p, vector: c.vector, raw: c.raw, hits, vectorizedFrom: c.vectorizedFrom };
    });
    setStatus(stale ? `Índice cargado de localStorage · ${stale} pasaje(s) revectorizado(s)` : `Índice cargado de localStorage · ${PASSAGES.length} pasajes`);
    return;
  }
  const ms = buildIndexNow();
  setStatus(`Índice construido en ${ms.toFixed(0)} ms · ${PASSAGES.length} pasajes · guardado en localStorage`);
}

const setStatus = (t) => { $('#status').textContent = t; };

/* --------------------------------------------------------------- BUSQUEDA -- */

function runQuery(qv, label, hits) {
  lastQuery = { vector: qv, label, hits: hits || [] };
  lastResults = topK(qv, PASSAGES, 8);
  renderResults();
  renderQueryVector();
}

function searchText() {
  const q = $('#q').value.trim();
  if (!q) return;
  // query:true -> la consulta pasa por el indice que incluye los alias
  const { vector, hits } = vectorize(q, [], { query: true });
  if (!vector.some((x) => x)) {
    lastQuery = null;
    $('#results').innerHTML = '';
    $('#results').append(emptyState('Ningún término de la consulta activó un eje. Probá con otras palabras, abrí el menú Preguntas o usá las categorías de la izquierda.'));
    renderSidebarHint();
    renderCrumbs({ via: 'Búsqueda libre', item: q });
    return;
  }
  markActive(null);
  renderCrumbs({ via: 'Búsqueda libre', item: q });
  runQuery(vector, q, hits);
}

function searchAxes() {
  const active = Object.keys(selectedAxes);
  if (!active.length) return;
  const { vector } = vectorFromAxes(selectedAxes);
  const labels = active.map((a) => AXES.find((x) => x.id === a).label);
  // la miga del medio nombra la familia (o las familias) de los ejes elegidos
  const fams = [...new Set(active.map(axisGroupLabel).filter(Boolean))];
  markActive(null);
  renderCrumbs({ via: 'Categorías', fam: fams.join(' + '), item: labels.join(' + ') });
  runQuery(vector, labels.join(' + '), []);
}

/* ---------------------------------------------------------------- RENDER --- */

// Ya no lleva ejemplos adentro: las preguntas viven en el menu del header,
// donde siguen disponibles despues de la primera busqueda.
function emptyState(msg) {
  const d = el('div', 'empty');
  d.append(el('p', null, msg));
  return d;
}

/* -------------------------------------------------- MENU DE PREGUNTAS ----- */

// Un solo item de la sidebar puede estar activo a la vez: si elegis una
// definicion, la pregunta que estaba marcada se apaga.
function markActive(btn) {
  document.querySelectorAll('.sbq.on').forEach((x) => x.classList.remove('on'));
  if (btn) btn.classList.add('on');
}

// en movil la sidebar es un cajon: despues de elegir algo, se cierra sola
const closeDrawer = () => { if (window.PANELS && window.PANELS.isMobile()) window.PANELS.setSidebar(false); };

const setCount = (sel, n) => { const e = $(sel); if (e) e.textContent = n ? String(n) : ''; };

// A que familia tematica pertenece un eje (para la miga del medio).
function axisGroupLabel(axisId) {
  const g = AXES_BY_GROUP.find((x) => x.items.some((a) => a.id === axisId));
  return g ? g.label : null;
}

/* Migas del main: seccion / puerta de entrada / consulta. La del medio es
   clickeable y despliega su bloque en la sidebar, asi que ademas de decir
   donde estas funciona como menu. */
function renderCrumbs(step) {
  if (!window.SHELL) return;
  const items = [{ label: 'Inicio', icon: '\u2302', onClick: () => { location.href = 'index.html'; } },
                 { label: 'Búsquedas' }];
  if (!step) {
    items.push({ label: 'Elegí una entrada' });
    window.SHELL.crumbs(items);
    return;
  }
  items.push({ label: step.via, onClick: () => openPanelFor(step.via) });
  if (step.fam) items.push({ label: step.fam, onClick: () => openPanelFor('Categorías') });
  if (step.item) items.push({ label: step.item });
  window.SHELL.crumbs(items, { onClear: resetToStart });
}

// abre (y trae a la vista) el bloque de la sidebar al que apunta esa miga
function openPanelFor(via) {
  const target = { 'Búsqueda libre': 'sb-libre', Preguntas: 'faqmenu', Definiciones: 'defmenu', 'Categorías': 'sb-cat' }[via];
  if (!target) return;
  const btn = document.querySelector('.sbtitle[data-target="' + target + '"]');
  if (!btn) return;
  if (window.PANELS && window.PANELS.isMobile()) window.PANELS.setSidebar(true);
  else document.body.classList.remove('sb-off');
  if (btn.getAttribute('aria-expanded') === 'false') btn.click();
  btn.scrollIntoView({ block: 'nearest' });
}

function renderFaq() {
  const box = $('#faqmenu');
  box.innerHTML = '';
  setCount('#nfaq', FAQ_TAGGED.length);
  if (!FAQ_TAGGED.length) {
    box.append(el('p', 'sbempty', 'Todavía no hay preguntas etiquetadas (rol "faq") en el corpus.'));
    return;
  }
  FAQ_TAGGED.forEach((entry) => {
    const b = el('button', 'sbq', formatPregunta(entry.key));
    b.type = 'button';
    b.onclick = () => { markActive(b); closeDrawer(); showTagged(entry, 'faq'); };
    box.append(b);
  });
}

/* -------------------------------------------------- MENU DE DEFINICIONES -- */

function renderDefs() {
  const box = $('#defmenu');
  box.innerHTML = '';
  setCount('#ndef', DEF_TAGGED.length);
  if (!DEF_TAGGED.length) {
    box.append(el('p', 'sbempty', 'Todavía no hay conceptos etiquetados (rol "define") en el corpus.'));
    return;
  }
  DEF_TAGGED.forEach((entry) => {
    const b = el('button', 'sbq');
    b.type = 'button';
    // el griego va en su propio span para que tome el color del estado activo
    const ax = AXES.find((a) => a.id === entry.key);
    b.append(el('span', null, ax ? ax.label + ' ' : entry.key));
    if (ax) b.append(el('span', 'gr', ax.greek));
    b.onclick = () => { markActive(b); closeDrawer(); showTagged(entry, 'define'); };
    box.append(b);
  });
}

// Muestra directamente el/los pasaje(s) que un tag señaló, sin pasar por la
// búsqueda vectorial: es la prueba de que el centinela `parrafo_nro`/`tags`
// viaja intacto desde el .txt fuente hasta la tarjeta que ve el usuario.
function showTagged(entry, rol) {
  const passages = entry.passageIds
    .map((id) => PASSAGES.find((p) => p.id === id))
    .filter(Boolean);
  const rta = entry.tags.map((t) => t.rta).find(Boolean);
  const nota = entry.tags.map((t) => t.nota).find(Boolean);
  const label = rol === 'faq' ? formatPregunta(entry.key) : `Definición · ${defLabel(entry)}`;
  lastQuery = { vector: new Array(AXES.length).fill(0), label, hits: [], tagNote: rta || nota || null };
  lastResults = passages.map((p) => ({ passage: p, tagged: true, tagRol: rol }));
  renderCrumbs(rol === 'faq'
    ? { via: 'Preguntas', item: formatPregunta(entry.key) }
    : { via: 'Definiciones', item: defLabel(entry) });
  renderResults();
  renderQueryVector();
}

// Los chips se agrupan por familia tematica (AXES_BY_GROUP en lexicon.js).
// Es una capa visual: el vector sigue siendo plano y los 26 ejes siguen
// siendo independientes. El encabezado de grupo ocupa la fila entera de la
// grilla (grid-column:1/-1) y no es clickeable: no hay "seleccionar grupo".
function renderAxisChips() {
  const box = $('#axes');
  box.innerHTML = '';
  AXES_BY_GROUP.forEach((g) => {
    const h = el('div', 'axgrp');
    h.innerHTML = `<span>${g.label}</span><span class="n">${g.items.length}</span>`;
    box.append(h);
    g.items.forEach((ax) => {
      const b = el('button', 'chip');
      b.type = 'button';
      b.dataset.group = g.id;
      b.innerHTML = `<span>${ax.label}</span><span class="gr">${ax.greek}</span>`;
      b.onclick = () => {
        if (selectedAxes[ax.id]) delete selectedAxes[ax.id];
        else selectedAxes[ax.id] = 1;
        b.classList.toggle('on', Boolean(selectedAxes[ax.id]));
        syncAxCount();
        if (Object.keys(selectedAxes).length) searchAxes();
        else resetToStart();
      };
      box.append(b);
    });
  });
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

function syncAxCount() {
  const n = Object.keys(selectedAxes).length;
  $('#axcount').textContent = n ? `${n} de ${AXES.length}` : '';
  $('#clearax').hidden = !n;
}

function clearAxes() {
  clearAxChips();
  resetToStart();
}

// estado inicial: sin consulta, con la franja del vector en modo pista
function resetToStart() {
  lastQuery = null;
  lastResults = [];
  markActive(null);
  clearAxChips();
  renderSidebarHint();
  renderCrumbs(null);
  const box = $('#results');
  box.innerHTML = '';
  box.append(emptyState('Empezá por el panel de la izquierda: una pregunta ya etiquetada, la definición de un concepto, una consulta libre o una categoría.'));
}

// apaga los chips sin disparar una busqueda nueva
function clearAxChips() {
  selectedAxes = {};
  document.querySelectorAll('.chip.on').forEach((c) => c.classList.remove('on'));
  syncAxCount();
}

function renderSidebarHint() {
  const box = $('#qvec');
  box.innerHTML = '';
  box.append(el('h3', null, 'Vector de la consulta'));
  box.append(el('p', 'muted', 'Acá vas a ver en qué ejes se proyecta tu pregunta y qué términos los activaron.'));
}

function renderQueryVector() {
  const box = $('#qvec');
  box.innerHTML = '';
  if (!lastQuery) { renderSidebarHint(); return; }
  if ('tagNote' in lastQuery) {
    box.append(el('h3', null, 'Cita directa por tag'));
    box.append(el('p', 'qlabel', lastQuery.label));
    box.append(el('p', 'muted', 'Este resultado no sale de la búsqueda vectorial: es el pasaje que el traductor marcó a mano en el .txt fuente.'));
    if (lastQuery.tagNote) {
      const note = el('div', 'tagnote');
      note.append(el('span', 'muted', 'Nota del traductor: '));
      note.append(el('span', null, lastQuery.tagNote));
      box.append(note);
    }
    return;
  }
  const pairs = lastQuery.vector.map((v, i) => ({ v, ax: AXES[i] })).filter((p) => p.v > 0).sort((a, b) => b.v - a.v);
  if (!pairs.length) { renderSidebarHint(); return; }
  box.append(el('h3', null, 'Vector de la consulta'));
  box.append(el('p', 'qlabel', lastQuery.label));
  const max = pairs[0].v;
  const grid = el('div', 'vgrid');
  pairs.forEach((p) => grid.append(barRow(p.ax.label, p.v, max)));
  box.append(grid);
  if (lastQuery.hits.length) {
    const d = el('div', 'hitlist');
    d.append(el('span', 'muted', 'Términos reconocidos: '));
    const seen = new Set();
    lastQuery.hits.forEach((h) => { if (!seen.has(h.token)) { seen.add(h.token); d.append(el('code', null, h.token)); } });
    box.append(d);
  }
}

function renderResults() {
  const box = $('#results');
  box.innerHTML = '';
  if (!lastResults.length) { box.append(emptyState('Sin coincidencias.')); return; }
  const head = el('div', 'rhead');
  head.append(el('h3', null, `${lastResults.length} pasajes`));
  head.append(el('span', 'muted', lastQuery.label));
  box.append(head);

  lastResults.forEach((r, i) => {
    const p = r.passage;
    const card = el('article', 'card');

    const top = el('div', 'ctop');
    top.append(el('span', 'rank', String(i + 1)));
    const meta = el('div', 'meta');
    meta.append(el('strong', null, p.id));
    meta.append(el('span', 'bek', p.bekker || ''));
    top.append(meta);
    if (r.tagged) {
      // resultado citado directamente por un tag, no ganado por coseno
      top.append(el('span', 'score tagbadge', r.tagRol === 'faq' ? 'tag · FAQ' : 'tag · Definición'));
    } else {
      // cuantos de los ejes que pidio la consulta toca este pasaje
      if (r.axisCount > 1) {
        const cov = el('span', 'cov', `${r.hitAxes}/${r.axisCount} ejes`);
        if (r.hitAxes === r.axisCount) cov.classList.add('full');
        if (r.demoted) cov.classList.add('weak');
        cov.title = r.demoted
          ? 'Toca un solo eje de una consulta de varios: relegado al final'
          : r.hitAxes === r.axisCount
            ? 'Toca todos los ejes de la consulta'
            : 'No toca todos los ejes de la consulta: el puntaje se reduce';
        top.append(cov);
      }
      const score = el('span', 'score', r.score.toFixed(3));
      top.append(score);
    }
    card.append(top);

    card.append(el('p', 'text', p.esOnly.length > 320 ? p.esOnly.slice(0, 320) + '…' : p.esOnly));

    // por que gano: contribucion por eje al producto escalar (no aplica a
    // resultados citados directamente por tag: no hay coseno que explicar)
    const contrib = r.tagged ? [] : p.vector.map((v, j) => ({ j, c: v * lastQuery.vector[j] })).filter((x) => x.c > 0).sort((a, b) => b.c - a.c).slice(0, 4);
    if (contrib.length) {
      const why = el('div', 'why');
      why.append(el('span', 'muted', 'Aporte al puntaje'));
      const max = contrib[0].c;
      // el porcentaje se calcula sobre el coseno, no sobre el puntaje final:
      // el factor de cobertura escala el total y desbalancearia los aportes
      contrib.forEach((c) => why.append(barRow(AXES[c.j].label, c.c, max, ((c.c / r.cos) * 100).toFixed(0) + '%')));
      card.append(why);
    }

    if (p.glosses.length) {
      const g = el('div', 'gloss');
      p.glosses.slice(0, 8).forEach((x) => g.append(el('span', 'gtag', x)));
      card.append(g);
    }

    if (p.greekParallel) {
      const det = el('details');
      det.append(el('summary', null, 'Griego original'));
      det.append(el('p', 'grtext', p.greekParallel));
      card.append(det);
    }

    // ACORDEON DEL CAPITULO COMPLETO.
    // Se arma con el campo `es`, NO con `esOnly`: `es` lleva las glosas griegas
    // intercaladas entre guiones, que es como el estudiante se familiariza con
    // los terminos sin salir del castellano. `esOnly` es solo para el indice.
    // El contenido se arma recien al abrirlo: hay 8 tarjetas en pantalla y el
    // capitulo 7 tiene 11 pasajes, no tiene sentido construir 88 parrafos que
    // nadie va a mirar.
    const chap = PASSAGES.filter((x) => x.chapter === p.chapter);
    if (chap.length) {
      const cd = el('details', 'chap');
      const rango = chap[0].bekker + (chap.length > 1 ? ' – ' + chap[chap.length - 1].bekker : '');
      cd.append(el('summary', null, `Capítulo ${p.chapter} completo · ${chap.length} pasajes · ${rango}`));
      const body = el('div', 'chapbody');
      cd.append(body);
      cd.addEventListener('toggle', () => {
        if (!cd.open || body.dataset.done) return;
        body.dataset.done = '1';
        chap.forEach((c) => {
          const here = c.id === p.id;
          const par = el('div', 'cpar' + (here ? ' here' : ''));
          const cm = el('div', 'cmeta');
          cm.append(el('span', 'cbek', c.bekker || ''));
          cm.append(el('span', 'cid', c.id));
          if (here) cm.append(el('span', 'chere', 'este pasaje'));
          par.append(cm);
          par.append(el('p', 'ctext', c.es));
          body.append(par);
        });
        // el griego del capitulo, anidado un nivel mas adentro
        const gd = el('details', 'grk');
        gd.append(el('summary', null, 'Texto griego del capítulo'));
        chap.forEach((c) => {
          if (!c.greekParallel) return;
          const gp = el('p', 'grtext' + (c.id === p.id ? ' here' : ''));
          gp.textContent = c.greekParallel;
          gd.append(gp);
        });
        body.append(gd);
        // el capitulo 7 no entra en pantalla: se lleva el resaltado a la vista
        // sin mover el scroll de la pagina entera
        const mark = body.querySelector('.cpar.here');
        if (mark) body.scrollTop = Math.max(0, mark.offsetTop - body.offsetTop - 12);
      });
      card.append(cd);
    }

    box.append(card);
  });
}

/* ------------------------------------------------------------------ INIT -- */

function init() {
  loadIndex();
  renderAxisChips();
  renderFaq();
  renderDefs();
  // el recuento sale del arreglo, no de un numero escrito a mano en el HTML
  $('.sbhint').textContent = `Las ${AXES.length} dimensiones del espacio, agrupadas en siete familias. Seleccioná una o varias para consultar desde los ejes, sin escribir texto.`;
  // Los menus desplegables del header ya no existen: Preguntas, Definiciones
  // y busqueda libre son bloques de la sidebar, y de plegarlos se ocupa
  // js/panels.js, que es comun a todas las secciones.
  $('#go').onclick = searchText;
  $('#q').addEventListener('keydown', (e) => { if (e.key === 'Enter') searchText(); });
  $('#rebuild').onclick = () => { localStorage.removeItem(STORE_KEY); const ms = buildIndexNow(); setStatus(`Índice reconstruido en ${ms.toFixed(0)} ms`); if (lastQuery) runQuery(lastQuery.vector, lastQuery.label, lastQuery.hits); };
  $('#clearax').onclick = clearAxes;

  syncAxCount();
  resetToStart();
  const cov = PASSAGES.filter((p) => p.vector.some((x) => x)).length;
  $('#stats').textContent = `${PASSAGES.length} pasajes · ${AXES.length} dimensiones · ${cov} vectorizados`;
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
