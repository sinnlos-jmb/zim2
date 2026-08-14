/* ============================================================================
   check-estado.mjs  --  auditoria de estado del repo (SOLO LECTURA)

   Responde: que parches estan realmente aplicados, si el corpus y el baseline
   son consistentes, y si tus archivos locales coinciden con los que yo probe.
   No escribe nada, no toca backups.

   Uso:  node fuente-y-build/build/check-estado.mjs
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

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

let OK = 0, MAL = 0;
const fila = (bien, etiq, detalle) => {
  const marca = bien === null ? '  ?  ' : (bien ? ' OK  ' : ' !!  ');
  if (bien === true) OK++; else if (bien === false) MAL++;
  console.log(marca + etiq.padEnd(46) + (detalle == null ? '' : detalle));
};

const TT = '\u03c4\u03b5\u03bb\u03b5\u03b9\u03cc\u03c4\u03b1\u03c4\u03bf\u03bd';

/* ---------------------------------------- 0. integridad de los parches ----- */
console.log('');
console.log('=== 0. ARCHIVOS DE PARCHE (bytes esperados) ===');
const PARCHES = [
  ['patch-limpieza.mjs', 6922],
  ['patch-regresion-gw.mjs', 4148],
  ['patch-tag-13d.mjs', 7356],
];
for (const [nom, esp] of PARCHES) {
  const f = P('fuente-y-build', 'build', nom);
  const b = bytes(f);
  if (b < 0) { fila(null, nom, 'NO EXISTE'); continue; }
  fila(b === esp, nom, b + ' bytes (esperado ' + esp + ')' + (b === 0 ? '  <-- VACIO: se trunco al guardarlo' : ''));
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

/* ---------------------------------------- 4. tag 13.d --------------------- */
console.log('');
console.log('=== 4. PARCHE DEL TAG DE 13.d ===');
const bc = leer(P('fuente-y-build', 'build', 'build-corpus.mjs'));
fila(bc == null ? null : bc.indexOf('dedupe por contenido') >= 0, 'build-corpus.mjs: dedupe de tags');
if (bc != null) {
  const m = bc.match(/prev\.tags\s*=\s*\[/g);
  fila(null, 'build-corpus.mjs: fusiones de tags', (m ? m.length : 0) + ' ocurrencia(s) de prev.tags = [');
}
const dirF = P('fuente-y-build');
let txtF = null, nomF = null, cuantos = 0;
try {
  const c = fs.readdirSync(dirF).filter((f) => f.endsWith('.txt'));
  cuantos = c.length;
  if (c.length === 1) { nomF = c[0]; txtF = leer(path.join(dirF, c[0])); }
} catch {}
fila(cuantos === 1, 'fuente-y-build: un solo .txt', cuantos + ' archivo(s)');
fila(txtF == null ? null : txtF.indexOf('"sentido": "ninguno"') >= 0, 'fuente .txt: tag neutro en el parrafo 48', nomF || '');

/* ---------------------------------------- 5. corpus ----------------------- */
console.log('');
console.log('=== 5. CORPUS GENERADO ===');
const C = json(P('server', 'public', 'data', 'corpus.json'));
if (C == null) { fila(null, 'corpus.json: no se pudo leer'); } else {
  const B = {};
  for (const p of C.passages) B[p.id] = p;
  fila(C.passages.length === 72, 'corpus.json: 72 pasajes', String(C.passages.length));
  const neutro = (pid) => ((B[pid] || {}).tags || []).some((t) => t && t.eje === 'idea' && String(t.sentido || '').toLowerCase() === 'ninguno');
  fila(neutro('EN.I.13.d'), '13.d tiene el tag idea/ninguno');
  fila(neutro('EN.I.13.e'), '13.e tiene el tag idea/ninguno');
  let dup = 0; const cuales = [];
  for (const p of C.passages) {
    const ts = (p.tags || []).map((t) => JSON.stringify(t));
    if (ts.length !== new Set(ts).size) { dup++; if (cuales.length < 8) cuales.push(p.id); }
  }
  fila(dup === 0, 'ningun pasaje con tags duplicados', dup ? dup + ': ' + cuales.join(' ') : '');
  fila(null, 'corpus.json builtAt', String(C.builtAt || '?'));
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
  const p13d = (BL.pasajes || {})['EN.I.13.d'] || {};
  const p13e = (BL.pasajes || {})['EN.I.13.e'] || {};
  const sinIdea = (p) => !(p.sentidos && p.sentidos.idea && Object.keys(p.sentidos.idea).length);
  const fij = (p) => Array.isArray(p.fijados) && p.fijados.indexOf('idea') >= 0;
  fila(sinIdea(p13d), '13.d sin acepcion de idea', p13d.sentidos ? JSON.stringify(p13d.sentidos.idea || null) : '?');
  fila(fij(p13d), '13.d con idea fijado a mano', JSON.stringify(p13d.fijados || []));
  fila(sinIdea(p13e), '13.e sin acepcion de idea', p13e.sentidos ? JSON.stringify(p13e.sentidos.idea || null) : '?');
  fila(fij(p13e), '13.e con idea fijado a mano', JSON.stringify(p13e.fijados || []));
  const s6h = (((BL.pasajes || {})['EN.I.6.h'] || {}).sentidos || {}).idea || null;
  fila(!!(s6h && s6h.separada === 1 && !s6h.categorial), '6.h con separada 1 (limpieza)', JSON.stringify(s6h));
  fila(null, 'baseline: pasajes / consultas', Object.keys(BL.pasajes || {}).length + ' / ' + Object.keys(BL.consultas || {}).length);
}

/* ---------------------------------------- 7. huellas --------------------- */
console.log('');
console.log('=== 7. HUELLA DE TUS ARCHIVOS (para comparar) ===');
const CLAVE = [
  ['fuente-y-build', 'src', 'lexicon.js'],
  ['fuente-y-build', 'src', 'vectorize.js'],
  ['fuente-y-build', 'src', 'normalize.js'],
  ['fuente-y-build', 'src', 'ui.js'],
  ['fuente-y-build', 'build', 'build-corpus.mjs'],
  ['fuente-y-build', 'build', 'regresion.mjs'],
  ['fuente-y-build', 'build', 'check-lexicon.mjs'],
];
for (const partes of CLAVE) {
  const f = P(...partes);
  const b = bytes(f);
  const h = sha(f);
  console.log('     ' + partes[partes.length - 1].padEnd(22) + String(b).padStart(7) + ' b   ' + (h ? h.slice(0, 16) : 'NO EXISTE'));
}
if (bc != null) {
  const secs = (bc.match(/'===\s[^']*'/g) || []).map((s) => s.replace(/'/g, ''));
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
  console.log('  Todo aplicado y consistente entre lexico, corpus y baseline.');
} else {
  console.log('  Cada parche cubre esto:');
  console.log('    patch-expresiones.mjs   -> seccion 1 (canal gw en el motor)');
  console.log('    patch-limpieza.mjs      -> seccion 2');
  console.log('    patch-regresion-gw.mjs  -> seccion 3');
  console.log('    patch-tag-13d.mjs       -> secciones 4 y 5');
  console.log('  Tras cambiar el .txt o el lexico: build-corpus.mjs y despues');
  console.log('  regresion.mjs (mirar el diff) y solo entonces --guardar.');
}