/* ============================================================================
   check-estado.mjs  --  auditoria de estado del repo (SOLO LECTURA)

   Responde: que parches estan realmente aplicados, si el corpus y el baseline
   son consistentes, si el motor esta sincronizado con la app, y si tus
   archivos locales coinciden con los que yo probe.
   No escribe nada, no toca backups.

   Criterio: NINGUN chequeo hardcodea un id de pasaje ni un conteo de pasajes.
   Los ids son posicionales y se corren con cada cambio de chunking, asi que
   todo lo que dependa de un pasaje concreto se resuelve cruzando el .txt
   fuente (parrafo_nro, que si es estable) con el corpus.

   Uso:  node fuente-y-build/build/check-estado.mjs
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { TARGETS } from './sync-engine.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function hallarRaiz() {
  const arg = process.argv[2];
  const ok = (d) => fs.existsSync(path.join(d, 'fuente-y-build', 'src', 'lexicon.js'));
  if (arg) { const p = path.resolve(arg); if (ok(p)) return p; }
  let d = HERE;
  for (let i = 0; i < 6; i++) { if (ok(d)) return d; d = path.dirname(d); }
  console.error('  no encuentro la raiz del repo. Pasala como argumento.');
  process.exit(1);
}

const R = hallarRaiz();
const P = (...x) => path.join(R, ...x);
console.log('  raiz: ' + R);

const leer = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return null; } };
const json = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const bytes = (f) => { try { return fs.statSync(f).size; } catch { return -1; } };
const sha = (f) => { try { return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'); } catch { return null; } };
const listar = (d) => { try { return fs.readdirSync(d); } catch { return []; } };

/* Tamano con el fin de linea normalizado a LF. Los tamanos esperados se
 * midieron sobre archivos en LF; en Windows el checkout queda en CRLF y cada
 * archivo pesa exactamente una linea de mas por cada salto. Comparar el
 * tamano crudo daba 3 falsos positivos permanentes. */
const bytesLF = (f) => {
  const s = leer(f);
  return s == null ? -1 : Buffer.byteLength(s.replace(/\r\n/g, '\n'), 'utf8');
};

/* parrafoNros trae el numero repetido una vez por unidad de texto que aporto
 * al pasaje ([9,9,9,9,9] es UN parrafo, no cinco). Todo chequeo sobre
 * parrafos tiene que mirar el conjunto de valores unicos. */
const parsDe = (p) => [...new Set(p.parrafoNros || [])];

let OK = 0, MAL = 0;
const fila = (bien, etiq, detalle) => {
  const marca = bien === null ? '  ?  ' : (bien ? ' OK  ' : ' !!  ');
  if (bien === true) OK++; else if (bien === false) MAL++;
  console.log(marca + etiq.padEnd(46) + (detalle == null ? '' : detalle));
};

const TT = '\u03c4\u03b5\u03bb\u03b5\u03b9\u03cc\u03c4\u03b1\u03c4\u03bf\u03bd';

/* Centinelas de tags del .txt fuente: { "parrafo_nro": N, "tags": [ ... ] }.
 * Es la unica referencia estable a un lugar del texto, porque el numero de
 * parrafo no depende de como se corte el corpus. */
function tagsDeLaFuente(txt) {
  const out = new Map();
  if (!txt) return out;
  const re = /\{\s*"parrafo_nro"\s*:\s*(\d+)\s*,\s*"tags"\s*:\s*\[[\s\S]*?\]\s*\}/g;
  let m;
  while ((m = re.exec(txt)) !== null) {
    let obj = null;
    try { obj = JSON.parse(m[0]); } catch { continue; }
    if (!obj || typeof obj.parrafo_nro !== 'number') continue;
    out.set(obj.parrafo_nro, (out.get(obj.parrafo_nro) || []).concat(obj.tags || []));
  }
  return out;
}

const esNeutro = (t) => !!t && t.eje === 'idea' && String(t.sentido || '').toLowerCase() === 'ninguno';

/* ---------------------------------------- 0. integridad de los parches ----- */
console.log('');
console.log('=== 0. ARCHIVOS DE PARCHE (bytes esperados, normalizados a LF) ===');
const PARCHES = [
  ['patch-limpieza.mjs', 6922],
  ['patch-regresion-gw.mjs', 4148],
  ['patch-tag-13d.mjs', 7356],
];
for (const [nom, esp] of PARCHES) {
  const f = P('fuente-y-build', 'build', nom);
  const b = bytes(f);
  if (b < 0) { fila(null, nom, 'NO EXISTE'); continue; }
  const n = bytesLF(f);
  /* Tolerancia de 1 byte: los tres se guardaron sin el salto de linea final.
   * No es corrupcion, no cambia lo que el script hace, y ya corrieron. Dejar
   * tres rojos permanentes por eso solo entrena a ignorar el semaforo. */
  const dif = esp - n;
  const nota = (b !== n ? '  [' + b + ' b en disco, CRLF]' : '') +
    (dif === 1 ? '  [sin salto final]' : '') +
    (b === 0 ? '  <-- VACIO: se trunco al guardarlo' : '');
  fila(dif === 0 || dif === 1, nom, n + ' b LF (esperado ' + esp + ')' + nota);
}

/* ---------------------------------------- 1. motor: canal gw --------------- */
console.log('');
console.log('=== 1. MOTOR (canal de expresiones griegas) ===');
const vec = leer(P('fuente-y-build', 'src', 'vectorize.js'));
fila(vec == null ? null : vec.indexOf('GW_W') >= 0, 'vectorize.js: constante GW_W');
fila(vec == null ? null : vec.indexOf('grExprTokens') >= 0, 'vectorize.js: grExprTokens');
fila(vec == null ? null : vec.indexOf('gwUni') >= 0, 'vectorize.js: indices gwUni/gwPhr');
const ckl = leer(P('fuente-y-build', 'build', 'check-lexicon.mjs'));
fila(ckl == null ? null : ckl.indexOf('gwUni') >= 0, 'check-lexicon.mjs: columna gw');
const ui = leer(P('fuente-y-build', 'src', 'ui.js'));
fila(ui == null ? null : ui.indexOf('en1:index:v15') >= 0, 'ui.js: STORE_KEY v15', ui && ui.length < 200 ? '(archivo de ' + ui.length + ' bytes: STUB)' : '');

/* ---------------------------------------- 2. limpieza ---------------------- */
console.log('');
console.log('=== 2. PARCHE DE LIMPIEZA (termino movido al eje neutro) ===');
const lx = leer(P('fuente-y-build', 'src', 'lexicon.js'));
if (lx == null) { fila(null, 'lexicon.js: no se pudo leer'); } else {
  const iIdea = lx.indexOf("id: 'idea',");
  const iSep = lx.indexOf("id: 'separada'");
  const iCat = lx.indexOf("id: 'categorial'");
  const iAbs = lx.indexOf("id: 'absoluto'");
  const iBios = lx.indexOf("id: 'bios'");
  const corte = (i, j) => (i >= 0 && j > i ? lx.slice(i, j) : '');
  const neutro = corte(iIdea, iSep);
  const sep = corte(iSep, iCat);
  const cat = corte(iCat, iBios > iCat ? iBios : iCat + 900);
  fila(neutro.indexOf("'separado'") >= 0, "idea (neutro).es contiene 'separado'");
  fila(neutro.indexOf("'en comun'") >= 0, "idea (neutro).es contiene 'en comun'");
  fila(sep.indexOf("'separado'") < 0, "idea/separada.es YA NO tiene 'separado'");
  fila(cat.indexOf("'en comun'") < 0, "idea/categorial.es YA NO tiene 'en comun'");
  const iTT = lx.indexOf(TT);
  fila(iTT >= 0 && iAbs >= 0 && iTT < iAbs, 'teleiotaton esta en teleios (neutro)', iTT < 0 ? '(no aparece)' : (iTT < iAbs ? '' : '(sigue en absoluto)'));
}

/* ---------------------------------------- 3. regresion gw ------------------ */
console.log('');
console.log('=== 3. PARCHE gw EN LA RED DE REGRESION ===');
const rg = leer(P('fuente-y-build', 'build', 'regresion.mjs'));
fila(rg == null ? null : rg.indexOf('INDEX.gwUni') >= 0, 'regresion.mjs: maps incluye gwUni/gwPhr');
fila(rg == null ? null : rg.indexOf('gw: 0') >= 0, 'regresion.mjs: acumulador con gw');

/* ---------------------------------------- 4. chunker y fuente ------------- */
console.log('');
console.log('=== 4. CHUNKER (regla: ningun pasaje cruza parrafos) ===');
const bc = leer(P('fuente-y-build', 'build', 'build-corpus.mjs'));
fila(bc == null ? null : bc.indexOf('function dedupeTags') >= 0, 'build-corpus.mjs: dedupe de tags');
fila(bc == null ? null : bc.indexOf('function armarParrafos') >= 0, 'build-corpus.mjs: armado por parrafo');
fila(bc == null ? null : bc.indexOf('function cortarParrafo') >= 0, 'build-corpus.mjs: particion pareja');
fila(bc == null ? null : bc.indexOf('PUNTO_MAX_CHARS') >= 0, 'build-corpus.mjs: ventana de corte en punto');
/* La fusion entre unidades de distinto parrafo es justo lo que la regla
 * prohibe: si reaparece, el corpus vuelve a tener pasajes a caballo. */
if (bc != null) {
  const m = bc.match(/prev\.tags\s*=\s*\[/g);
  fila(!m, 'build-corpus.mjs: sin fusion entre parrafos', m ? m.length + ' ocurrencia(s) de prev.tags = [  <-- volvio la fusion' : '');
}
const dirF = P('fuente-y-build');
let txtF = null, nomF = null, cuantos = 0;
try {
  const c = listar(dirF).filter((f) => f.endsWith('.txt'));
  cuantos = c.length;
  if (c.length === 1) { nomF = c[0]; txtF = leer(path.join(dirF, c[0])); }
} catch {}
fila(cuantos === 1, 'fuente-y-build: un solo .txt', cuantos + ' archivo(s)');
const FUENTE = tagsDeLaFuente(txtF);
const PARS_NEUTRO = [...FUENTE.entries()].filter(([, ts]) => ts.some(esNeutro)).map(([n]) => n).sort((a, b) => a - b);
fila(txtF == null ? null : FUENTE.size > 0, 'fuente .txt: centinelas de tags legibles', FUENTE.size + ' parrafo(s) tagueado(s) ' + (nomF || ''));
fila(txtF == null ? null : PARS_NEUTRO.length > 0, 'fuente .txt: tag idea/ninguno presente', PARS_NEUTRO.length ? 'parrafo(s) ' + PARS_NEUTRO.join(', ') : 'AUSENTE');

/* ---------------------------------------- 5. corpus ----------------------- */
console.log('');
console.log('=== 5. CORPUS GENERADO ===');
const C = json(P('server', 'public', 'data', 'corpus.json'));
const porParrafo = new Map();
let aCaballo = [];
if (C == null) { fila(null, 'corpus.json: no se pudo leer'); } else {
  for (const p of C.passages) {
    for (const n of parsDe(p)) {
      if (!porParrafo.has(n)) porParrafo.set(n, []);
      if (porParrafo.get(n).indexOf(p) < 0) porParrafo.get(n).push(p);
    }
  }
  aCaballo = C.passages.filter((p) => parsDe(p).length > 1);
  fila(null, 'corpus.json: pasajes', String(C.passages.length));
  /* LA invariante de la regla nueva. Antes esto era '=== 72', que es un
   * numero que cambia con cada ajuste de chunking y no dice nada. */
  fila(aCaballo.length === 0, 'ningun pasaje abarca dos parrafos',
    aCaballo.length ? aCaballo.length + ': ' + aCaballo.slice(0, 8).map((p) => p.id + ' [' + parsDe(p).join('+') + ']').join(' ') : '');
  const conRepes = C.passages.filter((p) => (p.parrafoNros || []).length !== parsDe(p).length);
  fila(null, 'pasajes con parrafoNros repetidos', conRepes.length ? conRepes.length + ' (cosmetico: un nro por unidad de texto)' : 'ninguno');

  /* Los tags neutros se buscan donde el .txt dice que estan, no en un id. */
  for (const n of PARS_NEUTRO) {
    const ps = porParrafo.get(n) || [];
    const conTag = ps.filter((p) => (p.tags || []).some(esNeutro));
    fila(ps.length > 0 && conTag.length === ps.length, 'parrafo ' + n + ': idea/ninguno en sus pasajes',
      ps.length ? conTag.length + '/' + ps.length + ' -> ' + ps.map((p) => p.id).join(' ') : 'el parrafo no llego al corpus');
  }

  let dup = 0; const cuales = [];
  for (const p of C.passages) {
    const ts = (p.tags || []).map((t) => JSON.stringify(t));
    if (ts.length !== new Set(ts).size) { dup++; if (cuales.length < 8) cuales.push(p.id); }
  }
  fila(dup === 0, 'ningun pasaje con tags duplicados', dup ? dup + ': ' + cuales.join(' ') : '');
  fila(null, 'corpus.json builtAt', String(C.builtAt || '?'));
}

/* ------------------------------- 5b. parrafos -> fragmentos --------------- */
console.log('');
console.log('=== 5b. PARRAFOS Y FRAGMENTOS ===');
if (C == null) { fila(null, 'corpus.json: no se pudo leer'); } else {
  const sinParrafo = C.passages.filter((p) => !parsDe(p).length);
  fila(sinParrafo.length === 0, 'todos los pasajes tienen parrafo asignado',
    sinParrafo.length ? sinParrafo.length + ': ' + sinParrafo.slice(0, 8).map((p) => p.id).join(' ') : '');
  fila(null, 'parrafos numerados en el corpus', String(porParrafo.size));

  /* Un parrafo partido en varios fragmentos ya NO es una anomalia: es la
   * regla. Lo que hay que verificar es que la numeracion cierre y que el
   * ruteo de tags sea el esperado (rol -> un fragmento, sentido -> todos). */
  const partidos = [...porParrafo.entries()].filter(([, ps]) => ps.length > 1).sort((a, b) => a[0] - b[0]);
  fila(null, 'parrafos partidos en varios fragmentos', partidos.length + ' de ' + porParrafo.size);
  let malNumerados = 0;
  for (const [n, ps] of partidos) {
    const idxs = ps.map((p) => p.fragIndex).filter((x) => typeof x === 'number').sort((a, b) => a - b);
    const tot = ps.map((p) => p.fragTotal).filter((x) => typeof x === 'number');
    const coherente = idxs.length === ps.length &&
      new Set(idxs).size === ps.length &&
      idxs[0] === 1 && idxs[idxs.length - 1] === ps.length &&
      tot.every((t) => t === ps.length);
    if (!coherente) malNumerados++;
    console.log('     parrafo ' + String(n).padStart(3) + ' -> ' + ps.map((p) => p.id + ' (' + p.words + ' pal.)').join(', ') + (coherente ? '' : '   <-- fragIndex/fragTotal incoherentes'));
  }
  fila(malNumerados === 0, 'fragIndex/fragTotal coherentes', malNumerados ? malNumerados + ' parrafo(s)' : '');

  /* Tags de la fuente que no aterrizaron en ningun pasaje: antes se perdian
   * en silencio si el parrafo quedaba fuera del corpus. */
  const perdidos = [...FUENTE.keys()].filter((n) => !porParrafo.has(n)).sort((a, b) => a - b);
  fila(FUENTE.size === 0 ? null : perdidos.length === 0, 'todo parrafo tagueado existe en el corpus',
    perdidos.length ? perdidos.length + ': ' + perdidos.slice(0, 12).join(', ') : '');
}

/* ---------------------------------------- 6. baseline --------------------- */
console.log('');
console.log('=== 6. BASELINE ===');
const BL = json(P('fuente-y-build', 'build', 'baseline-regresion.json'));
if (BL == null) { fila(null, 'baseline-regresion.json: no se pudo leer'); } else {
  const T = (BL.indice || {}).terminos || {};
  const claves = Object.keys(T);
  const conGw = claves.filter((k) => T[k] && Object.prototype.hasOwnProperty.call(T[k], 'gw'));
  fila(claves.length > 0 && conGw.length === claves.length, 'indice.terminos: todas las entradas con gw', conGw.length + '/' + claves.length);
  fila(!!T['teleios/absoluto'], 'indice.terminos: teleios/absoluto presente', T['teleios/absoluto'] ? JSON.stringify(T['teleios/absoluto']) : 'AUSENTE');
  fila(!!T['teleios/relativo'], 'indice.terminos: teleios/relativo presente', T['teleios/relativo'] ? JSON.stringify(T['teleios/relativo']) : 'AUSENTE');

  const idsBase = Object.keys(BL.pasajes || {});
  fila(null, 'baseline: pasajes / consultas', idsBase.length + ' / ' + Object.keys(BL.consultas || {}).length);

  /* Deteccion explicita del estado en el que queda el repo despues de un
   * rechunk: el baseline sigue siendo valido como archivo, pero habla de
   * pasajes que ya no existen. Sin esto, regresion.mjs escupe un diff total
   * sin explicar por que. */
  if (C != null) {
    const idsCorpus = new Set(C.passages.map((p) => p.id));
    const huerfanos = idsBase.filter((id) => !idsCorpus.has(id));
    if (idsBase.length && huerfanos.length === idsBase.length) {
      fila(false, 'baseline: ids compatibles con el corpus', 'NINGUNO coincide: el baseline es de otro chunking');
      console.log('     -> revisa el diff con regresion.mjs --detalle y recien despues --guardar');
    } else {
      fila(huerfanos.length === 0, 'baseline: ids compatibles con el corpus',
        huerfanos.length ? huerfanos.length + ' huerfano(s): ' + huerfanos.slice(0, 8).join(' ') : idsBase.length + '/' + idsBase.length);
    }

    /* Los pasajes con tag neutro se resuelven desde el corpus, no por id. */
    const neutros = C.passages.filter((p) => (p.tags || []).some(esNeutro));
    const sinIdea = (p) => !(p.sentidos && p.sentidos.idea && Object.keys(p.sentidos.idea).length);
    const fij = (p) => Array.isArray(p.fijados) && p.fijados.indexOf('idea') >= 0;
    for (const p of neutros) {
      const b = (BL.pasajes || {})[p.id];
      if (!b) { fila(null, p.id + ': no esta en el baseline', '(esperable tras un rechunk)'); continue; }
      fila(sinIdea(b) && fij(b), p.id + ': idea neutro y fijado a mano',
        JSON.stringify((b.sentidos || {}).idea || null) + ' fijados=' + JSON.stringify(b.fijados || []));
    }

    const conSeparada = idsBase.filter((id) => {
      const s = (((BL.pasajes || {})[id] || {}).sentidos || {}).idea;
      return s && s.separada === 1 && !s.categorial;
    });
    fila(conSeparada.length > 0, 'baseline: algun pasaje con idea/separada 1', conSeparada.length ? conSeparada.slice(0, 6).join(' ') : '(la limpieza no dejo rastro)');
  }
}

/* ------------------------- 7. sincronizacion src -> public ---------------- */
console.log('');
console.log('=== 7. SINCRONIZACION DEL MOTOR Y LA UI ===');
{
  const declarados = new Set();
  let faltaFuente = 0, desync = 0;
  for (const t of TARGETS) {
    const SRC = t.from === 'js' ? P('fuente-y-build', 'src') : P('fuente-y-build', 'src', 'css');
    for (const f of t.files) {
      declarados.add(f);
      const a = leer(path.join(SRC, f));
      const b = leer(P(t.to, f));
      if (a == null) { faltaFuente++; console.log('  !!  falta el fuente src/' + (t.from === 'css' ? 'css/' : '') + f); continue; }
      if (a !== b) { desync++; console.log('  !!  desincronizado: ' + path.join(t.to, f)); }
    }
  }
  fila(faltaFuente === 0, 'todo TARGET tiene su fuente en src', faltaFuente ? faltaFuente + ' sin fuente' : String(declarados.size) + ' archivo(s)');
  fila(desync === 0, 'public al dia respecto de src', desync ? desync + ' archivo(s): corre build-corpus.mjs o sync-engine.mjs' : '');

  /* El agujero por el que se colo el Lab: un .js nuevo creado directamente en
   * server/public queda fuera de TARGETS, nadie lo sincroniza, y el primer
   * build que corra pisa lo que si esta declarado. */
  const sueltos = [
    ...listar(P('server', 'public', 'js')).filter((f) => f.endsWith('.js')),
    ...listar(P('server', 'public', 'css')).filter((f) => f.endsWith('.css')),
  ].filter((f) => !declarados.has(f));
  fila(sueltos.length === 0, 'ningun js/css en public fuera de TARGETS',
    sueltos.length ? sueltos.join(' ') + '  <-- se edita a mano y nadie lo sincroniza' : '');

  /* Cada seccion declarada en la barra tiene que tener su pagina. */
  const sh = leer(P('fuente-y-build', 'src', 'shell.js'));
  if (sh == null) { fila(null, 'shell.js: no se pudo leer'); } else {
    const hrefs = (sh.match(/href:\s*'([^']+\.html)'/g) || []).map((s) => s.slice(s.indexOf("'") + 1, -1));
    const faltan = hrefs.filter((h) => !fs.existsSync(P('server', 'public', h)));
    fila(faltan.length === 0, 'toda seccion de shell.js tiene su .html', faltan.length ? faltan.join(' ') : hrefs.length + ' seccion(es)');
  }
}

/* ---------------------------------------- 8. huellas --------------------- */
console.log('');
console.log('=== 8. HUELLA DE TUS ARCHIVOS (para comparar) ===');
const CLAVE = [
  ['fuente-y-build', 'src', 'lexicon.js'],
  ['fuente-y-build', 'src', 'vectorize.js'],
  ['fuente-y-build', 'src', 'normalize.js'],
  ['fuente-y-build', 'src', 'ui.js'],
  ['fuente-y-build', 'src', 'shell.js'],
  ['fuente-y-build', 'src', 'lab.js'],
  ['fuente-y-build', 'build', 'build-corpus.mjs'],
  ['fuente-y-build', 'build', 'regresion.mjs'],
  ['fuente-y-build', 'build', 'sync-engine.mjs'],
  ['fuente-y-build', 'build', 'check-lexicon.mjs'],
];
for (const partes of CLAVE) {
  const f = P(...partes);
  const b = bytes(f);
  const h = sha(f);
  console.log('     ' + partes[partes.length - 1].padEnd(22) + String(b).padStart(7) + ' b   ' + (h ? h.slice(0, 16) : 'NO EXISTE'));
}
if (bc != null) {
  const secs = (bc.match(/['"`]===\s[^'"`]*['"`]/g) || []).map((s) => s.slice(1, -1));
  console.log('     build-corpus imprime ' + secs.length + ' seccion(es): ' + secs.join(' | '));
}
if (nomF) {
  const f = path.join(dirF, nomF);
  console.log('     ' + nomF.padEnd(22) + String(bytes(f)).padStart(7) + ' b   ' + (sha(f) || '').slice(0, 16));
}

/* ---------------------------------------- veredicto ---------------------- */
console.log('');
console.log('=== VEREDICTO: ' + OK + ' OK, ' + MAL + ' pendiente(s) ===');
if (MAL === 0) {
  console.log('  Todo aplicado y consistente entre lexico, corpus, baseline y app.');
} else {
  console.log('  Donde mirar segun la seccion:');
  console.log('    1  -> patch-expresiones.mjs (canal gw en el motor)');
  console.log('    2  -> patch-limpieza.mjs');
  console.log('    3  -> patch-regresion-gw.mjs');
  console.log('    4  -> build-corpus.mjs y el .txt fuente');
  console.log('    5  -> corre build-corpus.mjs: el corpus quedo viejo');
  console.log('    6  -> regresion.mjs --detalle y, si el diff es el esperado, --guardar');
  console.log('    7  -> sync-engine.mjs: el fuente de un .js/.css no esta en src/');
  console.log('  Tras cambiar el .txt o el lexico: build-corpus.mjs y despues');
  console.log('  regresion.mjs (mirar el diff) y solo entonces --guardar.');
}
