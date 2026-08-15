/* ============================================================================
   patch-cierre-fase2.mjs  --  cierra los pendientes de herramental de la fase 2

   Toca 4 archivos, ninguno de ellos cambia el resultado del motor:
     1. build/auditar-sentidos.mjs  -> arregla la seccion 2 (contaba de mas)
     2. build/regresion.mjs         -> baseline parametrizado por libro
     3. check-estado.mjs            -> chequeo nuevo: parrafo -> cuantos pasajes
     4. src/lexicon.js              -> documenta la imprecision autarkeia/endoxa

   La regresion debe dar SIN CAMBIOS despues de aplicarlo.
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function hallarRaiz() {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, 'fuente-y-build'))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error('no encontre fuente-y-build subiendo 6 niveles');
}

const ROOT = hallarRaiz();
const AUD = path.join(ROOT, 'fuente-y-build', 'build', 'auditar-sentidos.mjs');
const REG = path.join(ROOT, 'fuente-y-build', 'build', 'regresion.mjs');
const LEX = path.join(ROOT, 'fuente-y-build', 'src', 'lexicon.js');

// check-estado.mjs puede estar en build/ o en med/
const EST_CANDIDATOS = [
  path.join(ROOT, 'fuente-y-build', 'build', 'check-estado.mjs'),
  path.join(ROOT, 'med', 'check-estado.mjs'),
];
const EST = EST_CANDIDATOS.find((f) => fs.existsSync(f)) || null;

function leer(f) {
  const raw = fs.readFileSync(f, 'utf8');
  const esCRLF = raw.includes('\r\n');
  return { lf: raw.replace(/\r\n/g, '\n'), esCRLF };
}
function escribir(f, lf, esCRLF) {
  fs.writeFileSync(f, esCRLF ? lf.replace(/\n/g, '\r\n') : lf, 'utf8');
}
function contar(hay, buscado) {
  return hay.split(buscado).length - 1;
}

for (const f of [AUD, REG, LEX]) {
  if (!fs.existsSync(f)) {
    console.log('PRE-FLIGHT FALLIDO: no existe ' + f);
    process.exit(1);
  }
}
if (!EST) {
  console.log('PRE-FLIGHT FALLIDO: no encontre check-estado.mjs ni en build/ ni en med/');
  process.exit(1);
}

const aud = leer(AUD);
const reg = leer(REG);
const est = leer(EST);
const lex = leer(LEX);

console.log('auditor : ' + AUD);
console.log('regresion: ' + REG);
console.log('estado  : ' + EST);
console.log('lexicon : ' + LEX);
console.log('fin de linea: ' + [['auditor', aud], ['regresion', reg], ['estado', est], ['lexicon', lex]]
  .map(([n, o]) => n + ' ' + (o.esCRLF ? 'CRLF' : 'LF')).join(', ') + ' (se preservan)');
console.log('');

/* ------------------------------------------------ 1. AUDITOR, seccion 2 ---- */
const MARCA_AUD = 'el eje sigue ABIERTO';

const A1_M = "console.log('   (viven al nivel del eje; moverlos a un sentido cierra el agujero)');";
const A1_N = A1_M + "\n"
  + "console.log('   Solo se listan pasajes donde el eje sigue ABIERTO: los que ya');\n"
  + "console.log('   cerro un tag manual no cuentan (antes si, y la seccion exageraba).');";

const A2_M = 'const culp = new Map();';
const A2_N = 'const culp = new Map();\nconst cerradosPorTag = new Set();';

const A3_M = '    if (!POLI_IDS.includes(ax) || h.sense) continue;';
const A3_N = '    if (!POLI_IDS.includes(ax) || h.sense) continue;\n'
  + '    // el eje solo esta ABIERTO si no quedo acepcion utilizable en el pasaje\n'
  + '    const abierto = !(p.mix && p.mix[ax] && Object.keys(p.mix[ax]).length);\n'
  + '    if (!abierto) { cerradosPorTag.add(ax + " <- " + h.token); continue; }';

const A4_M = '/* ---------------------------------------------------- 3. A TAGUEAR ----------- */';
const A4_N = 'if (cerradosPorTag.size) {\n'
  + "  console.log('');\n"
  + "  console.log('  ' + cerradosPorTag.size + ' combinacion(es) eje<-termino quedaron fuera de la lista:');\n"
  + "  console.log('  un tag manual ya fija la acepcion en todos los pasajes que tocan.');\n"
  + '}\n\n' + A4_M;

/* ------------------------------------------------ 2. REGRESION por libro --- */
const MARCA_REG = 'baseline-regresion-libro';

const R1_M = "const rutaArg = args.find((a) => a.endsWith('.json') && a.indexOf('baseline') < 0);";
const R1_N = R1_M + '\n'
  + '// --libro N (o --libro=N): elige contra que baseline se compara. El libro 1\n'
  + '// conserva el nombre historico para no invalidar lo ya guardado.\n'
  + "const iLibro = args.findIndex((a) => a === '--libro' || a.startsWith('--libro='));\n"
  + 'const LIBRO = iLibro < 0 ? 1\n'
  + "  : Number((args[iLibro].split('=')[1] || args[iLibro + 1] || '1')) || 1;";

const R2_M = "const BASELINE = fileURLToPath(new URL('./baseline-regresion.json', import.meta.url));";
const R2_N = "const NOMBRE_BASELINE = LIBRO === 1\n"
  + "  ? './baseline-regresion.json'\n"
  + "  : './baseline-regresion-libro' + LIBRO + '.json';\n"
  + 'const BASELINE = fileURLToPath(new URL(NOMBRE_BASELINE, import.meta.url));';

const R3_M = "console.log('baseline: ' + BASELINE);";
const R3_N = "console.log('libro  : ' + LIBRO);\n" + R3_M;

/* ------------------------------------------------ 3. CHECK-ESTADO v2 ------- */
const MARCA_EST = '5b. PARRAFOS';

const E1_M = '/* ---------------------------------------- 6. baseline --------------------- */';
const E1_N = '/* ------------------------------- 5b. parrafos -> pasajes ------------------ */\n'
  + "console.log('');\n"
  + "console.log('=== 5b. PARRAFOS Y PASAJES (donde caen los tags) ===');\n"
  + 'if (C == null) { fila(null, "corpus.json: no se pudo leer"); } else {\n'
  + '  const porParrafo = new Map();\n'
  + '  for (const p of C.passages) {\n'
  + '    for (const n of (p.parrafoNros || [])) {\n'
  + '      if (!porParrafo.has(n)) porParrafo.set(n, []);\n'
  + '      if (porParrafo.get(n).indexOf(p.id) < 0) porParrafo.get(n).push(p.id);\n'
  + '    }\n'
  + '  }\n'
  + '  const idx = {};\n'
  + '  for (const p of C.passages) idx[p.id] = p;\n'
  + '  const compartidos = [...porParrafo.entries()].filter(([, ids]) => ids.length > 1)\n'
  + '    .sort((a, b) => a[0] - b[0]);\n'
  + '  fila(null, "parrafos numerados en el corpus", String(porParrafo.size));\n'
  + '  fila(null, "parrafos que alimentan mas de un pasaje", String(compartidos.length));\n'
  + '  for (const [n, ids] of compartidos) {\n'
  + '    const conTag = ids.filter((id) => ((idx[id] || {}).tags || []).length);\n'
  + '    console.log("     parrafo " + String(n).padStart(3) + " -> " + ids.join(", ") +\n'
  + '      (conTag.length ? "   [TAGUEADO: el tag cae en los " + ids.length + "]" : ""));\n'
  + '  }\n'
  + '  const sinParrafo = C.passages.filter((p) => !(p.parrafoNros || []).length);\n'
  + '  fila(sinParrafo.length === 0, "todos los pasajes tienen parrafo asignado",\n'
  + '    sinParrafo.length ? sinParrafo.length + ": " + sinParrafo.slice(0, 8).map((p) => p.id).join(" ") : "");\n'
  + '}\n\n' + E1_M;

/* ------------------------------------------------ 4. LEXICON: comentario -- */
const MARCA_LEX = 'IMPRECISION CONOCIDA (fase 2)';
const COMENTARIO_LEX =
  '    /* IMPRECISION CONOCIDA (fase 2): decidido a proposito, no tocar.\n'
  + '       El colapso "no necesita nada" (stem necesit) prende autarkeia en 4\n'
  + '       pasajes: 7.f es acierto; 8.g, 8.i y 10.c son falsos positivos.\n'
  + '       El colapso "se dice" (stem dice) prende endoxa en 9 pasajes: aciertan\n'
  + '       6.b, 6.c, 8.a y 8.b; fallan 6.h, 7.h, 8.f, 8.h y 10.a.\n'
  + '       Los dos son ejes PLANOS (sin senses), asi que el tag de sentido neutro\n'
  + '       no puede corregirlos: no hay mezcla de acepciones que anular. Angostar\n'
  + '       o borrar la frase en el lexico se lleva puestos tambien los aciertos.\n'
  + '       Se acepta el ruido y se documenta aca. Revisar recien en el libro II. */\n';

/* ------------------------------------------------ IDEMPOTENCIA ------------- */
const yaAud = aud.lf.indexOf(MARCA_AUD) !== -1;
const yaReg = reg.lf.indexOf(MARCA_REG) !== -1;
const yaEst = est.lf.indexOf(MARCA_EST) !== -1;
const yaLex = lex.lf.indexOf(MARCA_LEX) !== -1;

if (yaAud && yaReg && yaEst && yaLex) {
  console.log('ya estaba todo aplicado, no hago nada.');
  process.exit(0);
}

/* ------------------------------------------------ PRE-FLIGHT -------------- */
const checks = [];
if (!yaAud) checks.push(
  ['auditor: cabecera seccion 2', aud.lf, A1_M],
  ['auditor: mapa culp', aud.lf, A2_M],
  ['auditor: filtro de hits', aud.lf, A3_M],
  ['auditor: inicio seccion 3', aud.lf, A4_M],
);
if (!yaReg) checks.push(
  ['regresion: parseo de argumentos', reg.lf, R1_M],
  ['regresion: ruta del baseline', reg.lf, R2_M],
  ['regresion: log del baseline', reg.lf, R3_M],
);
if (!yaEst) checks.push(
  ['check-estado: inicio seccion 6', est.lf, E1_M],
);

let ok = true;
for (const [nombre, hay, buscado] of checks) {
  const c = contar(hay, buscado);
  if (c !== 1) {
    console.log('PRE-FLIGHT FALLIDO en "' + nombre + '": aparece ' + c + ' veces (esperaba 1).');
    ok = false;
  }
}

// el lexicon se edita por cirugia de indices, no por texto griego a mano
let lexNuevo = lex.lf;
if (!yaLex) {
  const iId = lex.lf.indexOf("id: 'autarkeia'");
  if (iId === -1) {
    console.log('PRE-FLIGHT FALLIDO: no encontre el eje autarkeia en lexicon.js');
    ok = false;
  } else {
    const iLinea = lex.lf.lastIndexOf('\n', iId) + 1;
    lexNuevo = lex.lf.slice(0, iLinea) + COMENTARIO_LEX + lex.lf.slice(iLinea);
  }
}

if (!ok) {
  console.log('No escribi nada.');
  process.exit(1);
}

/* ------------------------------------------------ ESCRITURA --------------- */
const audNuevo = yaAud ? aud.lf : aud.lf
  .split(A1_M).join(A1_N)
  .split(A2_M).join(A2_N)
  .split(A3_M).join(A3_N)
  .split(A4_M).join(A4_N);

const regNuevo = yaReg ? reg.lf : reg.lf
  .split(R1_M).join(R1_N)
  .split(R2_M).join(R2_N)
  .split(R3_M).join(R3_N);

const estNuevo = yaEst ? est.lf : est.lf.split(E1_M).join(E1_N);

const stamp = Date.now();
const objetivos = [
  ['auditar-sentidos.mjs', AUD, aud, audNuevo, yaAud],
  ['regresion.mjs', REG, reg, regNuevo, yaReg],
  [path.basename(EST), EST, est, estNuevo, yaEst],
  ['lexicon.js', LEX, lex, lexNuevo, yaLex],
];

const backups = [];
for (const [, file] of objetivos) {
  const b = file + '.bak-' + stamp;
  fs.writeFileSync(b, fs.readFileSync(file));
  backups.push([file, b]);
}

for (const [, file, orig, nuevo, ya] of objetivos) {
  if (!ya) escribir(file, nuevo, orig.esCRLF);
}

/* ------------------------------------------------ VERIFICACION ------------ */
const verif = [
  ['auditor', AUD, MARCA_AUD],
  ['regresion', REG, MARCA_REG],
  ['check-estado', EST, MARCA_EST],
  ['lexicon', LEX, MARCA_LEX],
];
let verifOk = true;
for (const [nombre, file, marca] of verif) {
  const c = contar(leer(file).lf, marca);
  if (c < 1) {
    console.log('VERIFICACION FALLIDA en ' + nombre + ': no encuentro la marca "' + marca + '".');
    verifOk = false;
  }
}

if (!verifOk) {
  for (const [file, b] of backups) fs.writeFileSync(file, fs.readFileSync(b));
  console.log('Se restauraron los 4 backups. No quedaron cambios.');
  process.exit(1);
}

console.log('+ auditor: la seccion 2 ya no cuenta los pasajes cerrados por tag');
console.log('+ regresion: acepta --libro N y elige el baseline correspondiente');
console.log('+ check-estado: seccion 5b, parrafo -> cuantos pasajes (y cual tiene tag)');
console.log('+ lexicon: documentada la imprecision de autarkeia y endoxa');
for (const [nombre, file] of objetivos) {
  console.log('ok ' + nombre.padEnd(22) + ' (backup ' + path.basename(file) + '.bak-' + stamp + ')');
}
console.log('');
console.log('Ahora, en este orden:');
console.log('  node fuente-y-build/build/check-lexicon.mjs');
console.log('  node fuente-y-build/build/build-corpus.mjs');
console.log('  node fuente-y-build/build/regresion.mjs        -> tiene que dar SIN CAMBIOS');
console.log('  node fuente-y-build/build/auditar-sentidos.mjs -> mirar la seccion 2');
console.log('  node med/check-estado.mjs');