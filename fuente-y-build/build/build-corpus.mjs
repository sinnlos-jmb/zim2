import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseSource, spanishOnly } from '../src/parse.js';
import { grStem, grSurfaceForms, grStrip } from '../src/normalize.js';
import { AXES } from '../src/lexicon.js';
import { syncEngine } from './sync-engine.mjs';

// Todo se resuelve desde la ubicacion de ESTE archivo, no desde el cwd:
// build/ -> fuente-y-build/ -> raiz del repo. Asi el script se puede correr
// desde cualquier carpeta y siempre escribe donde el servidor lee de veras.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = process.argv[2] || path.join(ROOT, 'fuente-y-build', 'EN_libro1_v7_tags_fixed.txt');
const OUT = path.join(ROOT, 'server', 'public', 'data');
fs.mkdirSync(OUT, { recursive: true });
console.log('fuente :', SRC);
console.log('salida :', OUT);

/* El corpus que esta por ser pisado, leido ANTES de escribir el nuevo. Es la
 * unica ventana en la que los dos existen a la vez, y sin el no hay manera de
 * saber que id viejo corresponde a que id nuevo. Ver === MAPA DE IDS === al
 * final del reporte. */
let corpusPrevio = null;
try {
  const fPrev = path.join(OUT, 'corpus.json');
  if (fs.existsSync(fPrev)) corpusPrevio = JSON.parse(fs.readFileSync(fPrev, 'utf8'));
} catch (e) {
  console.log('  ! no se pudo leer el corpus anterior:', e.message);
}


const raw = fs.readFileSync(SRC, 'utf8');
const units = parseSource(raw);
if (units.tagWarnings && units.tagWarnings.length) {
  console.log('=== AVISOS DE TAGS ===');
  units.tagWarnings.forEach((w) => console.log('  ! ' + w));
}

const hash = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 12);
const contarPalabras = (s) => s.split(/\s+/).filter(Boolean).length;

/* ---------------------------------------------------- CHUNKER ----------------
 * REGLA: un pasaje NUNCA abarca mas de un parrafo.
 *
 * Antes el orden era partir-y-despues-fusionar. Las unidades que devuelve el
 * parser son LINEAS fisicas, y el paso de fusion las volvia a pegar mirando
 * solo el capitulo y el largo, asi que dos parrafos vecinos podian terminar en
 * el mismo pasaje (20 de 51 parrafos estaban en esa situacion). Eso rompia dos
 * cosas a la vez: un tag de parrafo caia sobre texto de otro parrafo, y el
 * vector mezclaba dos unidades argumentales que podian tirar de ejes distintos.
 *
 * Ahora el orden es al reves:
 *   1. armar el parrafo completo juntando sus lineas (parId, de parse.js)
 *   2. si pasa de MAX_WORDS, partirlo en k fragmentos PAREJOS
 * y no hay ninguna fusion entre parrafos. La relacion queda
 * 1 parrafo -> N pasajes, nunca N parrafos -> 1 pasaje.
 *
 * El reparto es parejo a proposito. Con el corte codicioso de antes (acumular
 * hasta pasar 200 y cortar) un parrafo de 250 palabras daba 200 + 50, y esa
 * cola de 50 palabras es un pasaje con dos o tres hits donde la normalizacion
 * L2 le da a cualquier termino suelto un peso que no le corresponde.
 * Repartiendo, el mismo parrafo da 125 + 125.
 *
 * Los cortes caen siempre en limite de oracion, y entre dos limites cercanos se
 * prefiere el punto sobre el punto y coma: en la traduccion el punto y coma
 * suele separar miembros de una misma enumeracion, y cortar ahi parte un
 * argumento por el medio. PUNTO_MAX_CHARS es la ventana de busqueda; el reporte
 * imprime las distancias reales para poder ajustarla con datos y no a ojo.
 */

const MAX_WORDS = 200;       // techo de un pasaje: arriba de esto el parrafo se parte
const MIN_WORDS = 70;        // debajo de esto un pasaje es corto (se reporta, no se fusiona)
const PUNTO_MAX_CHARS = 50;  // ventana para mover un corte de un ';' al '.' mas cercano

/* Abreviaturas que terminan en punto sin terminar la oracion. Sin esto el
 * tokenizador corta en "cf." o "p. ej." y genera fronteras fantasma. */
const ABREVIATURAS = new Set([
  'cf', 'p', 'ej', 'vs', 'etc', 'ss', 'sig', 'sigs', 'ibid', 'ib', 'op', 'cit',
  'nro', 'num', 'aprox', 'trad', 'ed', 'vol', 'cap', 'fr', 'v', 'vv',
]);

const ultimoSigno = (s) => {
  const t = s.trimEnd();
  const c = t[t.length - 1];
  return c === '.' || c === ';' ? c : '';
};

function esFalsoLimite(texto) {
  const t = texto.trimEnd();
  if (!t.endsWith('.')) return false;
  const m = t.slice(0, -1).match(/(\p{L}+)$/u);
  if (!m) return false;
  return m[1].length === 1 || ABREVIATURAS.has(m[1].toLowerCase());
}

/* Trocea en oraciones SIN perder un solo caracter: la concatenacion de los
 * trozos es identica al texto original. La version anterior usaba
 * text.match(...) a secas y se comia todo lo que viniera despues del ultimo
 * punto, que es texto que desaparecia del corpus al partir un parrafo largo. */
function oraciones(texto, falsos) {
  const re = /[^.;]+[.;]+\s*/g;
  const crudas = [];
  let last = 0;
  let m;
  while ((m = re.exec(texto)) !== null) {
    if (m.index > last) crudas.push(texto.slice(last, m.index));
    crudas.push(m[0]);
    last = re.lastIndex;
  }
  if (last < texto.length) crudas.push(texto.slice(last));

  const out = [];
  for (const s of crudas) {
    const prev = out[out.length - 1];
    if (prev && esFalsoLimite(prev.texto)) {
      if (falsos) falsos.push(prev.texto.trim().slice(-28));
      prev.texto += s;
      prev.words = contarPalabras(prev.texto);
      prev.term = ultimoSigno(prev.texto);
      continue;
    }
    out.push({ texto: s, words: contarPalabras(s), term: ultimoSigno(s) });
  }
  return out;
}

/* 1. armar los parrafos: las unidades del parser son lineas, y todas las lineas
 *    con el mismo parId son el mismo parrafo del .txt. */
function armarParrafos(us) {
  const orden = [];
  const porId = new Map();
  for (const u of us) {
    let p = porId.get(u.parId);
    if (!p) {
      p = { ...u, es: '', greekParallel: null, tags: [], lineas: 0 };
      porId.set(u.parId, p);
      orden.push(p);
    }
    p.es = p.es ? p.es + ' ' + u.es : u.es;
    p.lineas += 1;
    if (u.greekParallel) {
      p.greekParallel = p.greekParallel ? p.greekParallel + ' ' + u.greekParallel : u.greekParallel;
    }
    // parse.js repite el tag del parrafo en cada linea fisica del bloque: al
    // juntarlas hay que deduplicar o el mismo tag entra una vez por linea.
    p.tags = dedupeTags([...(p.tags || []), ...(u.tags || [])]);
    if (p.parrafoNro == null && u.parrafoNro != null) p.parrafoNro = u.parrafoNro;
  }
  for (const p of orden) p.words = contarPalabras(p.es);
  return orden;
}

/* Estadistica de los cortes, para poder calibrar PUNTO_MAX_CHARS con datos. */
const cortes = { total: 0, enPunto: 0, movidos: 0, enPuntoYComa: 0, distancias: [] };
const sinPartir = [];
const avisosFragmento = [];

/* 2. partir el parrafo largo en k fragmentos parejos. */
function cortarParrafo(p) {
  if (p.words <= MAX_WORDS) return [p];
  const sents = oraciones(p.es, null);
  if (sents.length < 2) {
    sinPartir.push(`parrafo ${p.parrafoNro != null ? p.parrafoNro : '(sin numero)'}: ${p.words} palabras en una sola oracion, no hay donde cortar`);
    return [p];
  }

  const k = Math.ceil(p.words / MAX_WORDS);
  const objetivo = p.words / k;
  // cumW[b] / cumC[b] = palabras / caracteres acumulados ANTES de la oracion b,
  // es decir el peso del corte que va justo delante de la oracion b.
  const cumW = [0];
  const cumC = [0];
  for (const s of sents) {
    cumW.push(cumW[cumW.length - 1] + s.words);
    cumC.push(cumC[cumC.length - 1] + s.texto.length);
  }

  // elegir k-1 fronteras: la mas cercana al reparto ideal, en orden
  const elegidos = [];
  for (let j = 1; j < k; j++) {
    const ideal = objetivo * j;
    const desde = elegidos.length ? elegidos[elegidos.length - 1] + 1 : 1;
    const hasta = sents.length - (k - j);   // hay que dejar lugar para los que faltan
    let mejor = -1;
    let mejorD = Infinity;
    for (let b = desde; b <= hasta; b++) {
      const d = Math.abs(cumW[b] - ideal);
      if (d < mejorD) { mejorD = d; mejor = b; }
    }
    if (mejor < 0) break;
    elegidos.push(mejor);
  }
  if (!elegidos.length) return [p];

  const palabrasDe = (cs) => {
    const bordes = [0, ...cs, sents.length];
    let max = 0;
    for (let i = 1; i < bordes.length; i++) max = Math.max(max, cumW[bordes[i]] - cumW[bordes[i - 1]]);
    return max;
  };

  // preferir el punto sobre el punto y coma dentro de la ventana
  for (let i = 0; i < elegidos.length; i++) {
    cortes.total += 1;
    const b = elegidos[i];
    if (sents[b - 1].term === '.') { cortes.enPunto += 1; continue; }
    const limIzq = i > 0 ? elegidos[i - 1] : 0;
    const limDer = i < elegidos.length - 1 ? elegidos[i + 1] : sents.length;
    let alt = -1;
    let altD = Infinity;
    for (let c = limIzq + 1; c < limDer; c++) {
      if (sents[c - 1].term !== '.') continue;
      const d = Math.abs(cumC[c] - cumC[b]);
      if (d < altD) { altD = d; alt = c; }
    }
    cortes.distancias.push(altD === Infinity ? null : Math.round(altD));
    if (alt > 0 && altD <= PUNTO_MAX_CHARS) {
      const prueba = elegidos.slice();
      prueba[i] = alt;
      // mover el corte no puede dejar un fragmento por encima del techo
      if (palabrasDe(prueba) <= MAX_WORDS) {
        elegidos[i] = alt;
        cortes.movidos += 1;
        continue;
      }
    }
    cortes.enPuntoYComa += 1;
  }

  const bordes = [0, ...elegidos, sents.length];
  const textos = [];
  for (let i = 1; i < bordes.length; i++) {
    textos.push(sents.slice(bordes[i - 1], bordes[i]).map((s) => s.texto).join('').trim());
  }

  return textos.map((texto, i) => ({
    ...p,
    es: texto,
    words: contarPalabras(texto),
    splitIndex: i,
    splitOf: textos.length,
    greekParallel: i === 0 ? p.greekParallel : null,
    // el numero de parrafo describe al parrafo entero: lo heredan TODOS los
    // fragmentos. Antes se lo quedaba el primero y los demas salian huerfanos
    // (era el origen de EN.I.3.b y EN.I.10.b sin parrafo asignado).
    parrafoNro: p.parrafoNro,
    tags: tagsDelFragmento(p, i, textos.length),
  }));
}

/* Reparto de tags entre los fragmentos de un mismo parrafo.
 *
 * Un tag que solo fija una acepcion ({"eje":"arete","sentido":"etica"}) dice
 * como usa el parrafo ese eje: vale para todo el parrafo y va a todos los
 * fragmentos. Un tag con "rol" (faq, define) apunta a una afirmacion puntual:
 * va a un solo fragmento, el primero salvo que el .txt diga otra cosa con
 *   {"rol": "faq", "fragmento": 2, ...}
 * Sin esta distincion, o se pierden los sentidos en los fragmentos 2 y 3, o la
 * misma FAQ aparece tres veces en los resultados. */
function tagsDelFragmento(p, i, total) {
  const out = [];
  for (const t of p.tags || []) {
    if (!t || !t.rol) { out.push(t); continue; }
    let destino = 0;
    if (t.fragmento != null) {
      const f = Number(t.fragmento);
      if (!Number.isInteger(f) || f < 1 || f > total) {
        if (i === 0) {
          avisosFragmento.push(
            `parrafo ${p.parrafoNro}: "fragmento": ${t.fragmento} fuera de rango, el parrafo se parte en ${total} (se usa el primero)`,
          );
        }
      } else destino = f - 1;
    }
    if (i === destino) out.push(t);
  }
  return out;
}

/* dedupeTags - un tag no aporta nada dos veces en el mismo pasaje. Se compara
 * por clave canonica, con las claves ordenadas, para que el orden en que se
 * escribio el tag en el .txt no cuente como diferencia. */
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

const parrafos = armarParrafos(units);
const finales = parrafos.flatMap(cortarParrafo);

/* ---------------------------------------------------- IDs --------------------
 * Un id se lee "capitulo, parrafo, fragmento": EN.I.13.p48a es el primer
 * fragmento del parrafo 48, dentro del capitulo 13.
 *
 * Antes el id era EN.I.<cap>.<letra> con la letra corrida por capitulo, o sea
 * que el nombre de un pasaje dependia de cuantos pasajes hubiera ANTES en el
 * mismo capitulo. Bastaba que un parrafo se partiera distinto para que todos
 * los pasajes siguientes se renombraran en cadena, y con ellos el baseline de
 * regresion, los tags que citan un pasaje y cualquier nota que lo mencione.
 * Cada ajuste del chunker costaba una renumeracion completa.
 *
 * Ahora el id cuelga del parrafo_nro del .txt, que es un dato de la fuente y
 * no del algoritmo. Partir un parrafo en dos solo toca a los pasajes de ESE
 * parrafo: p48a pasa a ser p48a + p48b y ningun otro id se mueve. El precio es
 * que el id ya no indica el orden dentro del capitulo; para eso estan el orden
 * del arreglo y el propio numero de parrafo.
 *
 * La letra va siempre, incluso cuando el parrafo no se parte. Asi "p48a"
 * significa lo mismo hoy (parrafo entero) que despues de una particion futura
 * (primer fragmento) y el id sobrevive al cambio. Si arrancara sin letra,
 * partir el parrafo obligaria a decidir si el pasaje viejo es el nuevo primero
 * o si desaparece, que es justo el problema que este esquema viene a evitar.
 *
 * Parrafos sin numerar en el .txt: no tienen de donde colgar, asi que reciben
 * una clave s1, s2... corrida por capitulo, y el reporte los lista aparte. Esa
 * clave NO es estable: si se agrega un parrafo sin numerar antes, se corre.
 * Un parrafo sin numero tampoco se puede taguear ni citar; conviene numerarlo.
 */

// 0 -> a, 25 -> z, 26 -> aa. Un parrafo no llega ni de lejos a 26 fragmentos
// (serian 5200 palabras), pero un id no puede colisionar en silencio.
function letra(n) {
  let s = '';
  let x = n + 1;
  while (x > 0) {
    s = String.fromCharCode(97 + ((x - 1) % 26)) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

const claveDeParId = new Map();
const sinNumeroPorCap = {};
for (const p of parrafos) {
  if (p.parrafoNro != null) {
    claveDeParId.set(p.parId, 'p' + p.parrafoNro);
  } else {
    sinNumeroPorCap[p.chapter] = (sinNumeroPorCap[p.chapter] || 0) + 1;
    claveDeParId.set(p.parId, 's' + sinNumeroPorCap[p.chapter]);
  }
}

/* ---------------------------------------------------- GLOSAS ----------------- */
// La letra se cuenta por clave completa (capitulo + parrafo), no por parId: si
// dos parId compartieran parrafo_nro, sus fragmentos siguen la misma serie de
// letras en vez de pisarse.
const seqPorClave = new Map();
const passages = finales.map((u) => {
  const clave = claveDeParId.get(u.parId) || 'x';
  const base = `EN.I.${u.chapter}.${clave}`;
  const n = seqPorClave.get(base) || 0;
  seqPorClave.set(base, n + 1);
  const glosses = (u.es.match(/\(([^()]*)\)/g) || [])
    .map((g) => g.slice(1, -1).trim())
    .filter((g) => /[\u0370-\u03FF\u1F00-\u1FFF]/.test(g));
  return {
    id: `${base}${letra(n)}`,
    chapter: u.chapter,
    bekker: u.bekker,
    words: u.words,
    es: u.es,
    esOnly: spanishOnly(u.es),
    glosses,
    greekParallel: u.greekParallel,
    textHash: hash(u.es),
    vectorizedFrom: null,
    vector: null,
    translationStatus: 'draft',
    // parrafoNros sigue siendo un arreglo por compatibilidad con la UI, pero
    // desde la regla nueva tiene 0 o 1 elemento, nunca mas.
    parrafoNros: u.parrafoNro != null ? [u.parrafoNro] : [],
    parId: u.parId,
    fragIndex: u.splitIndex || 0,
    fragTotal: u.splitOf || 1,
    tags: u.tags || [],
  };
});

/* ---------------------------------------------------- GLOSARIO --------------- */
const lemmas = new Map();
for (const p of passages) {
  for (const g of p.glosses) {
    for (const form of grSurfaceForms(g)) {
      const key = grStem(form);
      if (key.length < 3) continue;
      if (!lemmas.has(key)) lemmas.set(key, { stem: key, forms: new Map(), passages: new Set() });
      const e = lemmas.get(key);
      e.forms.set(form, (e.forms.get(form) || 0) + 1);
      e.passages.add(p.id);
    }
  }
}

const glossary = [...lemmas.values()]
  .map((e) => {
    const forms = [...e.forms.entries()].sort((a, b) => b[1] - a[1]);
    return {
      stem: e.stem,
      canonical: forms[0][0],
      total: forms.reduce((s, f) => s + f[1], 0),
      formCount: forms.length,
      forms: forms.map(([f, n]) => ({ form: f, n })),
      passages: [...e.passages],
      passageCount: e.passages.size,
    };
  })
  .sort((a, b) => b.total - a.total || b.passageCount - a.passageCount);


/* ---------------------------------------------------- SALIDA ----------------- */
fs.writeFileSync(path.join(OUT, 'corpus.json'), JSON.stringify({ version: 1, source: 'EN libro I', builtAt: new Date().toISOString(), passages }, null, 1));
fs.writeFileSync(path.join(OUT, 'glossary.json'), JSON.stringify({ version: 1, lemmas: glossary }, null, 1));

/* ---------------------------------------------------- REPORTE ---------------- */
const w = passages.map((p) => p.words).sort((a, b) => a - b);
const pct = (q) => w[Math.floor((w.length - 1) * q)];
const partidos = parrafos.filter((p) => p.words > MAX_WORDS).length;
console.log('=== CHUNKING ===');
console.log('lineas del parser          :', units.length);
console.log('parrafos                   :', parrafos.length);
console.log('  partidos en fragmentos   :', partidos);
console.log('pasajes                    :', passages.length);
console.log(`palabras: min ${w[0]} | p25 ${pct(0.25)} | mediana ${pct(0.5)} | p75 ${pct(0.75)} | max ${w[w.length - 1]}`);
console.log('sin referencia Bekker      :', passages.filter((p) => !p.bekker).length);
console.log('con griego paralelo        :', passages.filter((p) => p.greekParallel).length);

// Un id repetido rompe el baseline, el Lab y cualquier cita. Nunca deberia
// pasar con la clave por parrafo, pero es barato verificarlo.
const vistosId = new Set();
const dupIds = [];
for (const p of passages) {
  if (vistosId.has(p.id)) dupIds.push(p.id);
  vistosId.add(p.id);
}
console.log('formato de id              : EN.I.<cap>.p<parrafo><letra>  ej.', passages.length ? passages[0].id : '-');
console.log('ids duplicados             :', dupIds.length, dupIds.length ? '  !! ' + [...new Set(dupIds)].join(' ') : '  (ok)');

// La invariante de la regla. Si esto deja de dar 0, algo volvio a pegar dos
// parrafos en un pasaje y los tags de ese pasaje ya no son atribuibles.
const solapados = passages.filter((p) => p.parrafoNros.length > 1);
console.log('pasajes con 2+ parrafos    :', solapados.length, solapados.length ? '  !! LA REGLA SE ROMPIO' : '  (ok: un pasaje nunca abarca dos parrafos)');
solapados.forEach((p) => console.log('     ! ' + p.id + ' -> parrafos ' + p.parrafoNros.join(', ')));

const cortos = passages.filter((p) => p.words < MIN_WORDS);
console.log(`pasajes cortos (<${MIN_WORDS} pal.)   :`, cortos.length, '  (son parrafos cortos del original: ya no se fusionan con el vecino)');
if (cortos.length) {
  console.log('  ' + cortos.map((p) => `${p.id}:${p.words}`).join('  '));
  console.log('  ojo: con pocos terminos, la normalizacion L2 le da mucho peso a cada hit suelto.');
}
const largos = passages.filter((p) => p.words > MAX_WORDS);
if (largos.length) console.log(`pasajes sobre el techo (>${MAX_WORDS}):`, largos.map((p) => `${p.id}:${p.words}`).join('  '));
sinPartir.forEach((s) => console.log('  ! ' + s));

const sinNumero = parrafos.filter((p) => p.parrafoNro == null);
if (sinNumero.length) {
  console.log('parrafos sin parrafo_nro   :', sinNumero.length, ' (no se pueden taguear hasta numerarlos en el .txt)');
  console.log('  sus pasajes usan la clave s<n> por capitulo, que se corre si se agrega otro sin numerar antes.');
  sinNumero.forEach((p) => console.log(`     cap ${p.chapter} | ${p.words} pal. | ${p.es.slice(0, 60)}...`));
}

/* ------------------------------------------------ CORTES DE PARRAFOS --------
 * Los numeros que siguen existen para calibrar PUNTO_MAX_CHARS con datos en
 * vez de a ojo: si casi ningun corte encuentra un punto en la ventana, la
 * ventana es muy chica; si todos lo encuentran holgadamente, se puede achicar.
 */
console.log('\n=== CORTES ===');
console.log('cortes hechos              :', cortes.total);
console.log('  ya caian en punto        :', cortes.enPunto);
console.log(`  movidos al punto (<=${PUNTO_MAX_CHARS}c) :`, cortes.movidos);
console.log('  quedaron en punto y coma :', cortes.enPuntoYComa);
const ds = cortes.distancias.filter((d) => d != null).sort((a, b) => a - b);
if (ds.length) {
  console.log('distancia en caracteres al punto mas cercano, para los cortes que no caian en punto:');
  console.log('  ' + ds.join(', '));
  for (const v of [30, 50, 80, 120, 200]) {
    console.log(`  ventana ${String(v).padStart(3)} : ${ds.filter((d) => d <= v).length}/${ds.length} cortes irian a un punto`);
  }
}
const huerfanos = cortes.distancias.filter((d) => d == null).length;
if (huerfanos) console.log('cortes sin ningun punto disponible en su tramo :', huerfanos);

const falsos = [];
for (const p of parrafos) oraciones(p.es, falsos);
console.log('falsos limites de oracion  :', falsos.length, ' (abreviaturas: el punto no termina la frase)');
if (falsos.length) console.log('  ' + [...new Set(falsos)].join(' | '));

const tagRoles = {};
const numerados = new Set();
for (const p of passages) {
  for (const n of p.parrafoNros) numerados.add(n);
  // un tag que solo fija un sentido no tiene rol: no debe contar como rol vacio
  for (const t of p.tags) { if (!t || !t.rol) continue; tagRoles[t.rol] = (tagRoles[t.rol] || 0) + 1; }
}
console.log('\n=== TAGS ===');
console.log('parrafos numerados         :', numerados.size);
console.log('pasajes con algun rol      :', passages.filter((p) => p.tags.length).length);
for (const [rol, n] of Object.entries(tagRoles)) console.log(`  rol "${rol}" \u00d7 ${n}`);
avisosFragmento.forEach((a) => console.log('  ! ' + a));

/* ------------------------------------------- SENTIDOS FIJADOS A MANO --------
 * Un tag con la forma
 *     { "parrafo_nro": 42, "tags": [{"eje": "ergon", "sentido": "obra"}] }
 * fija la acepcion con que ese parrafo usa el eje y pisa la que el motor deduce
 * de los lemas. Puede ir solo o junto a un rol:
 *     {"rol": "define", "eje": "ergon", "peso": 0.9, "sentido": "funcion"}
 *
 * Este reporte existe para poder taggear con red: un eje mal escrito o un
 * sentido inexistente es el unico error que el formato permite cometer en
 * silencio, porque el tag es JSON libre y nadie lo valida antes.
 */
const SENSES_BY_AXIS = new Map(AXES.map((a) => [a.id, (a.senses || []).map((s) => s.id)]));

/* Mismo vocabulario que applySenseTags en vectorize.js. Un tag neutro no
 * elige acepcion: deja el eje sin mezcla y lo fija como dominante. No es
 * un sentido invalido, es la manera de decir "el eje aplica aca, pero sin
 * ninguna de sus acepciones". Caso tipico: el parrafo 48, donde koinon
 * significa compartido por todos los vivientes y no predicado en comun. */
const NEUTRO = new Set(['ninguno', 'neutral', 'sin_sentido']);
const senseCounts = {};
const senseErrors = [];
for (const p of passages) {
  for (const t of p.tags) {
    if (!t || !t.sentido) continue;
    const k = `${t.eje} = ${t.sentido}`;
    senseCounts[k] = (senseCounts[k] || 0) + 1;
    if (!t.eje) { senseErrors.push(`${p.id}: tag con "sentido" pero sin "eje"`); continue; }
    if (!SENSES_BY_AXIS.has(t.eje)) { senseErrors.push(`${p.id}: el eje "${t.eje}" no existe en el lexico`); continue; }
    const validos = SENSES_BY_AXIS.get(t.eje);
    if (NEUTRO.has(t.sentido)) continue;   // neutro: no hay acepcion que verificar
    if (!validos.length) senseErrors.push(`${p.id}: el eje "${t.eje}" todavia no declara sentidos en lexicon.js`);
    else if (!validos.includes(t.sentido)) senseErrors.push(`${p.id}: "${t.sentido}" no es un sentido de "${t.eje}" (validos: ${validos.join(', ')})`);
  }
}
console.log('\n=== SENTIDOS FIJADOS A MANO ===');
const senseKeys = Object.keys(senseCounts).sort();
if (!senseKeys.length) {
  console.log('  ninguno todavia. Formato del tag:');
  console.log('  { "parrafo_nro": 42, "tags": [{"eje": "ergon", "sentido": "obra"}] }');
  for (const [id, ss] of SENSES_BY_AXIS) if (ss.length) console.log(`  el eje "${id}" admite: ${ss.join(', ')}`);
} else {
  for (const k of senseKeys) console.log(`  ${k} \u00d7 ${senseCounts[k]}`);
}
if (senseErrors.length) {
  console.log('  !! REVISAR:');
  senseErrors.forEach((e) => console.log('     ' + e));
}

console.log('\n=== POR CAPITULO ===');
for (let c = 1; c <= 13; c++) {
  const ps = passages.filter((p) => p.chapter === c);
  if (!ps.length) continue;
  console.log(`  cap ${String(c).padStart(2)} : ${String(ps.length).padStart(2)} pasajes  ${ps[0].bekker || '?'} -> ${ps[ps.length - 1].bekker || '?'}`);
}

console.log('\n=== GLOSARIO ===');
console.log('lemas unicos      :', glossary.length);
console.log('con >1 forma      :', glossary.filter((g) => g.formCount > 1).length);
console.log('en >=3 pasajes    :', glossary.filter((g) => g.passageCount >= 3).length);
console.log('\ntop 25 por frecuencia:');
console.log('  ' + 'lema'.padEnd(16) + 'tot  pas  formas');
for (const g of glossary.slice(0, 25)) {
  const fl = g.forms.map((f) => `${f.form}\u00d7${f.n}`).join(', ');
  console.log(`  ${g.canonical.padEnd(16)}${String(g.total).padStart(3)}${String(g.passageCount).padStart(5)}  ${fl}`);
}

/* ------------------------------------------------------ MAPA DE IDS ---------
 * Que pasaje viejo se convirtio en cual. El puente es el numero de parrafo:
 * es el unico dato que sobrevive intacto a un recorte distinto del texto.
 *
 * Como los dos chunkings parten el mismo parrafo en distinta cantidad de
 * pedazos, el mapa no siempre es 1 a 1. Cuando un id viejo cae en varios
 * nuevos, se marca en cual ARRANCA su texto: ese suele ser el heredero
 * natural de una cita puntual.
 *
 * Se imprime en pantalla y no se guarda en ningun archivo a proposito: la
 * segunda corrida compararia el corpus nuevo contra si mismo y el mapa daria
 * la identidad, pisando el unico util. Copialo cuando lo veas.
 */
console.log('\n=== MAPA DE IDS (viejo -> nuevo) ===');
if (!corpusPrevio || !Array.isArray(corpusPrevio.passages) || !corpusPrevio.passages.length) {
  console.log('  no habia corpus anterior en disco: nada que mapear.');
} else {
  const viejos = corpusPrevio.passages;
  const porPar = new Map();
  for (const p of passages) {
    for (const n of p.parrafoNros) {
      if (!porPar.has(n)) porPar.set(n, []);
      porPar.get(n).push(p);
    }
  }
  const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const usados = new Set();
  let iguales = 0;
  let unicos = 0;
  let varios = 0;
  let perdidos = 0;
  for (const v of viejos) {
    const pars = [...new Set(v.parrafoNros || [])];
    const cand = [];
    for (const n of pars) for (const p of porPar.get(n) || []) if (!cand.includes(p)) cand.push(p);
    cand.forEach((p) => usados.add(p.id));
    if (!cand.length) {
      perdidos += 1;
      console.log(`  ${String(v.id).padEnd(14)} -> (sin equivalente)   parrafos ${pars.join(', ') || '-'}`);
      continue;
    }
    const ini = norm(v.es).slice(0, 40);
    const arranca = ini ? cand.find((p) => norm(p.es).includes(ini)) : null;
    let nota = '';
    if (cand.length === 1) {
      unicos += 1;
      if (cand[0].textHash === v.textHash) { iguales += 1; nota = '   (texto identico)'; }
    } else {
      varios += 1;
      nota = arranca ? `   (arranca en ${arranca.id})` : '   (no se pudo ubicar el arranque)';
    }
    console.log(`  ${String(v.id).padEnd(14)} -> ${cand.map((p) => p.id).join(' ')}${nota}`);
  }
  const nuevos = passages.filter((p) => !usados.has(p.id));
  console.log(`  ${viejos.length} ids viejos: ${unicos} con un unico equivalente (${iguales} con el texto intacto) | ${varios} repartidos en varios | ${perdidos} sin equivalente`);
  if (nuevos.length) console.log(`  pasajes nuevos sin origen viejo (${nuevos.length}): ` + nuevos.map((p) => p.id).join(' '));
  console.log('  hay que rehacer con esto: el baseline (regresion.mjs --guardar), cualquier tag que cite un id y las notas del proyecto.');
}

console.log('\n=== SINCRONIZACION DEL MOTOR ===');
const sync = syncEngine(ROOT);
console.log('copiados:', sync.copiados.length ? sync.copiados.join(', ') : '(ninguno)');
console.log('iguales :', sync.iguales.length);
