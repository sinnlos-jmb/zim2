/* ============================================================================
   regresion.mjs - BASELINE del comportamiento observable del motor.

   Congela lo que hoy hace el motor y avisa cuando algo cambia. No juzga si el
   cambio es bueno: solo dice QUE cambio y DONDE. Sirve para tocar vectorize.js
   o lexicon.js sabiendo exactamente que se movio de lugar.

   Captura cuatro capas, de la mas interna a la mas visible:
     1. indice   - terminos descartados por duplicado, frases colapsadas y
                   cuantos terminos quedaron por eje y sentido. Detecta la
                   trampa del Set por eje que mata terminos en silencio.
     2. vectores - el vector de cada pasaje (solo las dimensiones no nulas).
     3. sentidos - la mezcla de acepciones de cada pasaje, ya con los tags
                   manuales aplicados, y cuales quedaron fijados a mano.
     4. consultas- el top-8 real de un juego fijo de consultas, con puntaje,
                   factor de sentido y bandera de relegado. Esta es la capa que
                   se parece a lo que ve el usuario en el navegador.

   Uso, desde la raiz del repo:
     node build/regresion.mjs --guardar    crea o rehace el baseline
     node build/regresion.mjs              compara contra el baseline
     node build/regresion.mjs --detalle    compara y lista TODAS las diferencias

   Sale con codigo 1 si encuentra diferencias, para poder encadenarlo:
     node build/check-lexicon.mjs fuente-y-build/src && node build/regresion.mjs

   IMPORTANTE: correr build-corpus.mjs antes si se toco el .txt fuente.
   ========================================================================= */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  vectorize, senseMixFromHits, applySenseTags, topK,
  DIM, duplicateTerms, collapsedTerms, INDEX,
} from '../src/vectorize.js';
import { AXES } from '../src/lexicon.js';

/* ---------------------------------------------------- ENTRADA ---------------- */
const args = process.argv.slice(2);
const guardar = args.includes('--guardar');
const detalle = args.includes('--detalle');
const rutaArg = args.find((a) => a.endsWith('.json') && a.indexOf('baseline') < 0);

const CANDIDATOS = [
  rutaArg,
  'data/corpus.json',
  'server/public/data/corpus.json',
  '../server/public/data/corpus.json',
  '/data/en1/app/data/corpus.json',
].filter(Boolean);

const SRC = CANDIDATOS.find((p) => { try { return fs.statSync(p).isFile(); } catch { return false; } });
if (!SRC) {
  console.error('No encuentro corpus.json. Probe:');
  CANDIDATOS.forEach((p) => console.error('  - ' + p));
  console.error('Pasa la ruta como argumento, o corre antes build-corpus.mjs.');
  process.exit(1);
}

// fileURLToPath y NO new URL(...).pathname: en Windows pathname devuelve
// /C:/Users/... y fs lo lee como C:\C:\Users\..., que no existe.
const BASELINE = fileURLToPath(new URL('./baseline-regresion.json', import.meta.url));

/* ---------------------------------------------------- CONSULTAS -------------- */
/* Juego fijo. Cubre los cuatro ejes polisemicos por sus dos acepciones, las
   consultas genericas que no votan ninguna, y los terminos que hoy estan en
   duda. Agregar consultas es barato; sacarlas invalida el baseline viejo. */
const CONSULTAS = [
  'virtud',
  'valentia justicia templanza',
  'prudencia sabiduria',
  'virtud etica',
  'virtud dianoetica',
  'obra',
  'funcion propia',
  'carpintero zapatero',
  'acto',
  'accion',
  'potencia y acto',
  'discurso',
  'argumento',
  'entendimiento',
  'razon',
  'felicidad',
  'bien supremo',
  'alma',
  'actividad del alma segun la virtud',
  'placer honor',
];

/* ---------------------------------------------------- MOTOR ------------------ */
/* Se arma igual que ui.js: vector de esOnly + glosas, mezcla de sentidos desde
   los hits y despues los tags manuales encima. Si esto se desviara de ui.js el
   baseline dejaria de representar lo que ve el usuario. */
const corpus = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const PASSAGES = corpus.passages.map((p) => {
  const { vector, raw, hits } = vectorize(p.esOnly != null ? p.esOnly : p.es, p.glosses || []);
  const { mix, pinned } = applySenseTags(senseMixFromHits(hits), p.tags || []);
  return { ...p, vector, raw, hits, senses: mix, sensesPinned: pinned };
});

/* ---------------------------------------------------- SNAPSHOT --------------- */
const r6 = (x) => (typeof x === 'number' ? Math.round(x * 1e6) / 1e6 : x);

// solo las dimensiones no nulas, rotuladas por id de eje: asi el baseline
// sobrevive a que un eje nuevo corra los indices del vector.
function vecObj(v) {
  const o = {};
  v.forEach((x, i) => { if (x) o[(AXES[i] || {}).id || ('?' + i)] = r6(x); });
  return o;
}
function mixR(m) {
  const o = {};
  for (const eje of Object.keys(m || {}).sort()) {
    const inner = {};
    for (const s of Object.keys(m[eje]).sort()) inner[s] = r6(m[eje][s]);
    o[eje] = inner;
  }
  return o;
}
function conteoTerminos() {
  const c = {};
  const maps = [
    ['es', INDEX.esUni], ['es', INDEX.esPhr],
    ['gr', INDEX.grUni], ['gr', INDEX.grPhr],
    ['gx', INDEX.gxUni], ['gx', INDEX.gxPhr],
    ['gw', INDEX.gwUni], ['gw', INDEX.gwPhr],
  ];
  for (const [canal, map] of maps) {
    for (const entries of map.values()) {
      for (const e of entries) {
        const k = ((AXES[e.axis] || {}).id || ('?' + e.axis)) + '/' + (e.sense || '-');
        if (!c[k]) c[k] = { es: 0, gr: 0, gx: 0, gw: 0 };
        c[k][canal] += 1;
      }
    }
  }
  const o = {};
  for (const k of Object.keys(c).sort()) o[k] = c[k];
  return o;
}
function corridaConsulta(q) {
  const { vector, hits } = vectorize(q, [], { query: true });
  if (!vector.some((x) => x)) return { vacia: true };
  const sm = senseMixFromHits(hits);
  const senseMix = Object.keys(sm).length ? sm : null;
  const res = topK(vector, PASSAGES, 8, { senseMix });
  return {
    senseMix: mixR(sm),
    terminos: [...new Set(hits.map((h) => h.token))].sort(),
    top: res.map((r) => ({
      id: r.passage.id,
      score: r6(r.score),
      cos: r6(r.cos),
      sf: r6(r.senseFactor),
      relegado: Boolean(r.demoted),
      ejes: r.hitAxes + '/' + r.axisCount,
    })),
  };
}

function snapshot() {
  const pas = {};
  for (const p of [...PASSAGES].sort((a, b) => a.id.localeCompare(b.id))) {
    pas[p.id] = {
      vector: vecObj(p.vector),
      sentidos: mixR(p.senses),
      fijados: (p.sensesPinned || []).slice().sort(),
    };
  }
  const cons = {};
  for (const q of CONSULTAS) cons[q] = corridaConsulta(q);
  return {
    meta: { pasajes: PASSAGES.length, ejes: AXES.length, dim: DIM, consultas: CONSULTAS.length },
    indice: {
      duplicados: duplicateTerms().map((d) => d.axis + ' | ' + d.term + ' | ' + d.token).sort(),
      colapsos: collapsedTerms().map((c) => c.axis + ' | ' + c.term + ' | ' + c.token).sort(),
      terminos: conteoTerminos(),
    },
    pasajes: pas,
    consultas: cons,
  };
}

/* ---------------------------------------------------- COMPARACION ------------ */
function comparar(base, ahora, ruta, out) {
  if (JSON.stringify(base) === JSON.stringify(ahora)) return;
  const bo = base && typeof base === 'object';
  const ao = ahora && typeof ahora === 'object';
  if (!bo || !ao || Array.isArray(base) !== Array.isArray(ahora)) {
    out.push({ ruta, antes: base, ahora });
    return;
  }
  const keys = [...new Set([...Object.keys(base), ...Object.keys(ahora)])];
  for (const k of keys) comparar(base[k], ahora[k], ruta ? ruta + '.' + k : k, out);
}
const breve = (v) => {
  if (v === undefined) return '(no existia)';
  const s = JSON.stringify(v);
  return s.length > 90 ? s.slice(0, 87) + '...' : s;
};

/* ---------------------------------------------------- SALIDA ----------------- */
const actual = snapshot();
console.log('REGRESION DEL MOTOR');
console.log('corpus : ' + SRC);
console.log('motor  : ' + AXES.length + ' ejes, DIM ' + DIM + ', ' + PASSAGES.length + ' pasajes, ' + CONSULTAS.length + ' consultas');
console.log('baseline: ' + BASELINE);

if (guardar) {
  const previo = fs.existsSync(BASELINE);
  fs.writeFileSync(BASELINE, JSON.stringify(actual, null, 1).replace(/\r\n/g, '\n') + '\n', 'utf8');
  console.log('');
  console.log((previo ? 'BASELINE REHECHO' : 'BASELINE CREADO') + ': ' + BASELINE);
  if (previo) console.log('El estado anterior quedo sobrescrito: de aca en adelante esto es la referencia.');
  process.exit(0);
}

if (!fs.existsSync(BASELINE)) {
  console.error('');
  console.error('No hay baseline todavia. Crealo con:');
  console.error('  node build/regresion.mjs --guardar');
  process.exit(1);
}

const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
const difs = [];
comparar(base, actual, '', difs);

if (!difs.length) {
  console.log('');
  console.log('=== SIN CAMBIOS: el motor se comporta igual que en el baseline. OK');
  process.exit(0);
}

const porSeccion = new Map();
for (const d of difs) {
  const sec = d.ruta.split('.')[0];
  if (!porSeccion.has(sec)) porSeccion.set(sec, []);
  porSeccion.get(sec).push(d);
}
console.log('');
console.log('=== ' + difs.length + ' DIFERENCIA(S) CONTRA EL BASELINE ===');
for (const [sec, lista] of porSeccion) {
  console.log('');
  console.log('-- ' + sec + ': ' + lista.length + ' --');
  const muestra = detalle ? lista : lista.slice(0, 12);
  for (const d of muestra) {
    console.log('  ' + d.ruta);
    console.log('      baseline: ' + breve(d.antes));
    console.log('      ahora   : ' + breve(d.ahora));
  }
  if (!detalle && lista.length > muestra.length) {
    console.log('  ... y ' + (lista.length - muestra.length) + ' mas (correr con --detalle)');
  }
}
console.log('');
console.log('Si los cambios son los buscados, fijalos con: node build/regresion.mjs --guardar');
process.exit(1);