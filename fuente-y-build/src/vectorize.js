// vectorize.js - texto -> vector de 24 dimensiones.
// El MISMO pipeline se aplica a pasajes y a consultas.

import { esTokens, grTokens, esStem, grStem, grSurfaceForms, grStrip } from './normalize.js';

// formas griegas exactas: se normalizan (sin acentos, sigma final) pero NO se stemmean
// piso en 2, misma razon que en normalize.grTokens: terminos de 2 letras
// como "εὖ" no deben quedar afuera solo por ser cortos.
const grExactTokens = (text) => grSurfaceForms(text).map(grStrip).filter((t) => t.length >= 2);
import { AXES, DEFAULT_WEIGHTS } from './lexicon.js';

export const DIM = AXES.length;
const MAX_NGRAM = 4;
const COLLAPSED = [];
// DUPLICATE_TERMS: entradas del lexico descartadas por resolver al mismo
// token que otra entrada anterior del mismo eje/canal (ver load() abajo).
const DUPLICATE_TERMS = [];

// Indices invertidos separados para unigramas y frases.
// Las frases NO se descomponen en tokens sueltos: "vivir bien" no debe hacer
// que el token "bien" active el eje felicidad.
// Se construyen DOS indices con el mismo codigo:
//   INDEX    sin alias  -> se aplica a los PASAJES
//   INDEX_Q  con alias  -> se aplica a las CONSULTAS
// Asi un alias no puede tocar el corpus. Ver la nota larga en vectorize().
function buildIndex(withAliases = false) {
  const esUni = new Map(), esPhr = new Map();
  const grUni = new Map(), grPhr = new Map();
  const gxUni = new Map(), gxPhr = new Map();
  COLLAPSED.length = 0;
  DUPLICATE_TERMS.length = 0;

  // `sense`: id del sentido al que pertenece el termino, o undefined si el
  // termino es del eje y no elige sentido. Viaja hasta los hits.
  const add = (map, key, axis, w, sense) => {
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({ axis, w, sense });
  };

  AXES.forEach((ax, ai) => {
    // Registro de lo ya cargado en ESTE eje, para que un alias repetido no
    // sume dos veces. Sin esta guarda, agregar un sinonimo que ya estaba en
    // otra lista duplicaria el peso del eje en silencio.
    const seen = new Set();

    const load = (list, tokenize, uni, phr, defW, canal, sense, scale = 1) => {
      for (const raw of list || []) {
        const [term, w0] = Array.isArray(raw) ? raw : [raw, defW];
        // `scale` es el multiplicador del sentido (1 para las listas del eje).
        // Se aplica TAMBIEN a los pesos explicitos [termino, peso]: si no, un
        // termino con peso propio se saltearia el peso de su sentido.
        const w = w0 * scale;
        const toks = tokenize(term);
        // TRAMPA: un termino de varias palabras cuyas stopwords se caen queda
        // reducido a un unigrama y deja de ser restrictivo. "lo mejor de todo"
        // se convertia en el unigrama "mejor", que aparece en 30/70 pasajes.
        if (toks.length === 1 && String(term).trim().split(/\s+/).length > 1) {
          COLLAPSED.push({ axis: ax.id, term, token: toks[0] });
        }
        // toks.length === 0 -> el termino se disolvio en stopwords, se descarta
        if (!toks.length || toks.length > MAX_NGRAM) continue;
        const key = toks.join(' ');
        const reg = canal + '|' + key;
        // DEDUP SIEMPRE, no solo en alias: dos entradas del MISMO eje y canal
        // que terminan en el mismo token se sumaban una vez por cada
        // aparicion real de la palabra en el texto (p.ej. una sola ocurrencia
        // de 'ἀγαθὸν' llegaba a contar 4 veces el peso base porque 'ἀγαθόν',
        // 'ἀγαθά', 'ἀγαθῶν' y 'ἀγαθοὺς' stemean todas a 'αγαθ'). Se guarda solo
        // la PRIMERA entrada de la lista por token; las siguientes quedan en
        // DUPLICATE_TERMS para poder auditarlas.
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
    // ALIAS: castellano, mismo canal y mismo peso que `es`. Van ultimos, asi
    // que la guarda de dedup hace que agregar un alias solo pueda sumar
    // cobertura nueva: nunca duplica el peso de un termino que ya estaba.
    // SENTIDOS: subcapa DENTRO del eje. No agregan dimensiones. Cargan
    // terminos del mismo eje `ai`, con el peso multiplicado por sense.weight y
    // marcados con el id del sentido. Esa marca es lo unico que hace falta
    // para atribuir despues cada aporte a un sentido (senseMixFromHits).
    // Van despues de las listas propias del eje y antes de los alias, bajo la
    // misma guarda de dedup: un lema que ya estaba en el eje no se cuenta dos
    // veces por figurar tambien en un sentido.
    for (const sn of ax.senses || []) {
      const sw = sn.weight == null ? 1 : sn.weight;
      load(sn.es, esTokens, esUni, esPhr, DEFAULT_WEIGHTS.es, 'es', sn.id, sw);
      load(sn.gr, grTokens, grUni, grPhr, DEFAULT_WEIGHTS.gr, 'gr', sn.id, sw);
      load(sn.grForms, grExactTokens, gxUni, gxPhr, DEFAULT_WEIGHTS.grForms, 'gx', sn.id, sw);
      // Los alias del sentido entran SOLO por el indice de consulta, igual que
      // los del eje: son la puerta por la que pregunta el estudiante y no deben
      // tocar un solo vector del corpus.
      // Van ANTES de los alias del eje por una razon medida: un alias del eje
      // que es FRASE se resuelve antes que cualquier unigrama y se queda con
      // las posiciones. Con "estar en acto" declarado a nivel de eje, la
      // consulta "estar en acto" entraba por esa frase, que no tiene sentido
      // asignado, y la consulta terminaba SIN sentido justo en el caso mas
      // claro de todos. Declarado en el sentido, se atribuye a `acto`.
      if (withAliases) load(sn.aliases, esTokens, esUni, esPhr, DEFAULT_WEIGHTS.es, 'es', sn.id, sw);
    }
    if (withAliases) load(ax.aliases, esTokens, esUni, esPhr, DEFAULT_WEIGHTS.es, 'es');
  });

  return { esUni, esPhr, grUni, grPhr, gxUni, gxPhr };
}

export const INDEX = buildIndex(false);   // pasajes
export const INDEX_Q = buildIndex(true);  // consultas

// Auditoria de terminos colapsados. Se revisa en el build, no en el navegador.
export function collapsedTerms() { return COLLAPSED.slice(); }

// Terminos que la guarda descarto por resolver al mismo token que otro ya
// cargado en el mismo eje/canal.
export function duplicateTerms() { return DUPLICATE_TERMS.slice(); }
// alias del nombre anterior, por compatibilidad con scripts existentes
export function aliasDupes() { return DUPLICATE_TERMS.slice(); }

// tf sublineal: la 5a aparicion vale menos que la 1a
const tf = (n) => 1 + Math.log(n);

function accumulate(tokens, uni, phr, lang, vec, hits) {
  // 1. frases (n-gramas). Se marcan las posiciones consumidas.
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

  // 2. unigramas (solo tokens no consumidos por una frase)
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

/**
 * @param {string} spanish  texto castellano (sin glosas)
 * @param {string[]} glosses  glosas griegas del pasaje
 * @param {{query?: boolean}} opts  query:true para vectorizar una CONSULTA
 *
 * Los alias entran SOLO por el indice de consulta, y la razon se midio:
 *
 *  1. Un alias de varias palabras le roba tokens a otro eje. Las frases se
 *     resuelven antes que los unigramas y consumen posiciones, asi que el
 *     alias 'tener la virtud' (habito) se comia el token 'virtud' del eje
 *     Virtud en los pasajes donde aparecia la expresion. Cambiaba el resultado
 *     de "que es la virtud?" sin que nadie hubiera tocado el eje Virtud.
 *  2. El df del corpus dejaba de ser una propiedad de la traduccion y pasaba a
 *     depender de cuantos sinonimos hubiera escrito el administrador.
 *
 * Separando los indices, agregar o quitar un alias NO puede alterar un solo
 * vector de pasaje: solo cambia por que puertas entra la pregunta. No hace
 * falta revectorizar el corpus al editar la lista.
 */
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

/* ------------------------------------------------------------- SENTIDOS ----
 * MEZCLA DE SENTIDOS de un texto, armada con los aportes que quedaron
 * atribuidos a un sentido en vectorize():
 *
 *   senseMixFromHits(hits) -> { ergon: { obra: 0.8, funcion: 0.2 } }
 *
 * Es una MEZCLA y no una etiqueta unica, a proposito: en 7.g-7.i los dos
 * sentidos de ergon estan en juego a la vez, y pasar de "la obra del carpintero" a
 * "la funcion propia del hombre" ES el argumento. Forzar una etiqueta
 * borraria justo el paso que hay que poder mostrar.
 *
 * Los aportes SIN sentido (los terminos que el eje declara para si, como
 * carpintero/zapatero) no entran en la cuenta: no eligen sentido.
 * Un eje sin ningun aporte marcado NO aparece en el resultado, y mas abajo eso
 * se interpreta como "sin informacion", nunca como desacuerdo.
 */
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

// Sentido dominante de un eje, con su participacion. Para el chip de la ficha.
export function dominantSense(mix, axisId) {
  const m = mix && mix[axisId];
  if (!m) return null;
  let best = null;
  for (const [sense, share] of Object.entries(m)) {
    if (!best || share > best.share) best = { sense, share };
  }
  return best;
}

// Etiqueta legible de un sentido, tal como lo declara el lexico.
export function senseLabel(axisId, senseId) {
  const ax = AXES.find((a) => a.id === axisId);
  const sn = ax && (ax.senses || []).find((s) => s.id === senseId);
  return sn ? (sn.label || sn.id) : senseId;
}

// Ejes que declaran sentidos. Sirve para no mostrar la capa donde no aplica.
export function axesWithSenses() {
  return AXES.filter((a) => (a.senses || []).length).map((a) => ({
    id: a.id, label: a.label,
    senses: a.senses.map((s) => ({ id: s.id, label: s.label || s.id, weight: s.weight == null ? 1 : s.weight })),
  }));
}

/* TAG MANUAL. Un tag del .txt con la forma
 *   { "eje": "ergon", "sentido": "obra" }
 * PISA la mezcla calculada para ese eje (queda 1.0 en el sentido elegido) y no
 * toca los demas ejes. El tagueo a mano es la fuente de verdad; la heuristica
 * de lemas solo cubre lo que todavia no fue taggeado.
 * Devuelve tambien que ejes quedaron fijados a mano, para poder distinguirlo
 * en la interfaz de lo que decidio el motor.
 */
export function applySenseTags(mix, tags = []) {
  const out = { ...(mix || {}) };
  const pinned = [];
  for (const t of tags || []) {
    if (!t || !t.eje || !t.sentido) continue;
    out[t.eje] = { [t.sentido]: 1 };
    pinned.push(t.eje);
  }
  return { mix: out, pinned };
}

export function l2(v) {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  if (!n) return v.slice();
  return v.map((x) => x / n);
}

// Vector armado directamente desde ejes seleccionados (querybuilder)
export function vectorFromAxes(selected) {
  const vec = new Array(DIM).fill(0);
  for (const [axisId, weight] of Object.entries(selected)) {
    const i = AXES.findIndex((a) => a.id === axisId);
    if (i >= 0) vec[i] = weight;
  }
  return { vector: l2(vec), raw: vec, hits: [] };
}

export function cosine(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

// COBERTURA DE EJES (coordination level matching).
// El coseno premia la magnitud, no el reparto: un pasaje con un valor altisimo
// en un solo eje le gana a otro con valores medios en los dos ejes que la
// consulta pidio. Este factor corrige eso.
// Se pondera por la MASA que cada eje tiene en la consulta, no por conteo de
// ejes: si la pregunta activo un eje apenas, no tocarlo no puede castigar lo
// mismo que no tocar el eje central de la pregunta.
// lambda = 0.5 esta medido en build/exp_cobertura3.mjs: es el valor maximo con
// CERO regresiones sobre las 23 preguntas del menu. Con 0.6 se pierde
// EN.I.5.c (la virtud dormida) frente a EN.I.13.e, que solo comparte el
// vocabulario del sueno pero habla de las partes del alma.
export const COVERAGE_LAMBDA = 0.5;

// fraccion de la masa de la consulta que el pasaje efectivamente toca
export function coverage(queryVec, passageVec) {
  let total = 0;
  let touched = 0;
  for (let i = 0; i < queryVec.length; i++) {
    if (queryVec[i] <= 0) continue;
    total += queryVec[i];
    if (passageVec[i] > 0) touched += queryVec[i];
  }
  return total ? touched / total : 1;
}

// RELEGACION DE LOS PASAJES DE UN SOLO EJE.
// Cuando la consulta pide varios ejes y el pasaje toca uno solo, no es una
// respuesta debil: es otro tema que comparte una palabra.
// No se filtran, se mandan al fondo: el estudiante tiene que poder ver que el
// motor los considero y por que quedaron ahi.
//
// Medido sobre las 23 preguntas del menu (build/exp_balance2.mjs, exp_lexico.mjs):
//   valor 3  ->  0 top-1 rotos, 0 top-5 alterados
//   valor 2  ->  1 top-1 roto, 8 top-5 alterados
// El unico caso que rompe en 2 es "¿alcanza con ser rico para vivir bien?":
// EN.I.5.d es la respuesta correcta y toca 1 de 2 ejes porque el eje Felicidad
// no reconoce "vivir bien". Es una laguna del lexico, no del ordenamiento; al
// cubrirla, el costo de este valor desaparece.
const MIN_AXES_TO_DEMOTE = 2;

/* ACUERDO DE SENTIDO entre la consulta y el pasaje.
 *
 * Solo interviene cuando la consulta ELIGE un sentido. Si el estudiante
 * pregunta por "la obra del hombre", el pasaje que usa ergon como obra sube y
 * el que lo usa como funcion propia baja. Si la pregunta no distingue, o si el
 * pasaje no tiene informacion de sentido en ese eje, el factor es 1 y el orden
 * queda EXACTAMENTE como estaba. Esa es la garantia de no regresion: sin senal
 * de sentido, el motor es el de siempre.
 *
 * La superposicion de dos mezclas se mide por interseccion (suma de los
 * minimos): 1 si coinciden, 0 si son sentidos disjuntos, intermedio si el
 * pasaje usa los dos (7.g-7.i nunca quedan castigados a fondo, porque de
 * hecho contienen el sentido que se pidio).
 *
 * Cada eje pesa segun la masa que tiene EN LA CONSULTA: desambiguar el eje
 * central de la pregunta importa mas que desambiguar uno marginal.
 *
 * lambda 0.25 es deliberadamente moderado: el sentido reordena, no filtra. Un
 * pasaje con el sentido "equivocado" pierde a lo sumo un 25% del puntaje, asi
 * que sigue siendo visible y el estudiante puede ver por que quedo mas abajo.
 */
export const SENSE_LAMBDA = 0.25;

export function senseAgreement(queryMix, passageMix, queryVec) {
  if (!queryMix || !passageMix) return 1;
  let wsum = 0, acc = 0;
  for (const [axisId, qm] of Object.entries(queryMix)) {
    const pm = passageMix[axisId];
    // el pasaje no habla de este eje, o lo toca sin elegir sentido: neutral
    if (!pm) continue;
    const i = AXES.findIndex((a) => a.id === axisId);
    const w = queryVec && i >= 0 ? queryVec[i] : 1;
    if (!w) continue;
    let inter = 0;
    for (const [sense, qs] of Object.entries(qm)) inter += Math.min(qs, pm[sense] || 0);
    wsum += w;
    acc += w * inter;
  }
  return wsum ? acc / wsum : 1;
}

// CONSULTA DE UN SOLO EJE: el coseno entre vectores L2-normalizados con un
// solo eje activo en la consulta se reduce siempre a la componente
// normalizada del pasaje en ese eje, lo que premia a pasajes que no tocan
// ningun otro eje por sobre pasajes que si tocan el eje pedido con fuerza
// real pero ademas tocan legitimamente otros ejes. Para este caso puntuamos
// con el valor CRUDO del eje (sin L2), aplastado a (0,1) con x/(x+1). No se
// toca el calculo de coseno para consultas de varios ejes (texto libre, FAQ,
// Definiciones).
function singleAxisOf(queryVec) {
  let axis = -1, count = 0;
  for (let i = 0; i < queryVec.length; i++) {
    if (queryVec[i] > 0) { axis = i; count++; if (count > 1) return -1; }
  }
  return count === 1 ? axis : -1;
}

export function topK(queryVec, passages, k = 8, opts = {}) {
  const axes = [];
  for (let i = 0; i < queryVec.length; i++) if (queryVec[i] > 0) axes.push(i);
  const singleAxis = singleAxisOf(queryVec);
  // Mezcla de sentidos de la CONSULTA. Si no viene, la capa de sentidos queda
  // apagada y el ordenamiento es identico al anterior: es la garantia de no
  // regresion para todo lo que ya funcionaba (FAQ, definiciones, querybuilder).
  const queryMix = opts.senseMix || null;

  return passages
    .map((p) => {
      const cos = cosine(queryVec, p.vector);
      const mass = coverage(queryVec, p.vector);
      const hitAxes = axes.filter((i) => p.vector[i] > 0).length;
      const axisRaw = singleAxis >= 0 ? (p.raw ? p.raw[singleAxis] : 0) : null;
      const base = axisRaw !== null
        ? axisRaw / (axisRaw + 1)
        : cos * (1 - COVERAGE_LAMBDA + COVERAGE_LAMBDA * mass);
      // acuerdo de sentido: 1 (neutral) si la consulta no desambigua nada
      const agree = queryMix ? senseAgreement(queryMix, p.senses, queryVec) : 1;
      const senseFactor = 1 - SENSE_LAMBDA + SENSE_LAMBDA * agree;
      return {
        passage: p,
        cos,
        mass,
        hitAxes,
        axisCount: axes.length,
        demoted: axes.length >= MIN_AXES_TO_DEMOTE && hitAxes === 1,
        senseAgree: agree,
        senseFactor,
        // el coseno queda disponible aparte: la barra de aportes por eje se
        // calcula sobre el, no sobre el puntaje ya reponderado
        score: base * senseFactor,
      };
    })
    .filter((r) => r.cos > 0)
    // los relegados van al fondo en bloque, ordenados entre si por puntaje
    .sort((a, b) => (Number(a.demoted) - Number(b.demoted)) || (b.score - a.score))
    .slice(0, k);
}

export { esStem, grStem };
