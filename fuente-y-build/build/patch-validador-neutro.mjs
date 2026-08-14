/* ============================================================================
   patch-validador-neutro.mjs

   Arregla un desajuste entre dos partes del pipeline:

     - vectorize.js (applySenseTags) ACEPTA los sentidos neutros
       'ninguno' / 'neutral' / 'sin_sentido': el eje aplica al pasaje pero sin
       ninguna de sus acepciones, y queda fijado como dominante.
     - build-corpus.mjs los reporta como error:
         !! REVISAR: EN.I.13.d: "ninguno" no es un sentido de "idea"

   El motor tiene razon y el validador no. Este parche le ensena al validador
   el mismo vocabulario, para que un tag neutro deliberado no grite en cada
   build y no tape los errores de verdad (ejes mal escritos, sentidos
   inexistentes), que es para lo que ese reporte existe.

   Uso:  node fuente-y-build/build/patch-validador-neutro.mjs
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NOMBRE = 'build-corpus.mjs';

function hallarArchivo() {
  const arg = process.argv[2];
  if (arg) {
    const p = path.resolve(arg);
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
    const d1 = path.join(p, NOMBRE);
    if (fs.existsSync(d1)) return d1;
    const d2 = path.join(p, 'fuente-y-build', 'build', NOMBRE);
    if (fs.existsSync(d2)) return d2;
  }
  const aqui = path.join(HERE, NOMBRE);
  if (fs.existsSync(aqui)) return aqui;
  let d = HERE;
  for (let i = 0; i < 6; i++) {
    const c = path.join(d, 'fuente-y-build', 'build', NOMBRE);
    if (fs.existsSync(c)) return c;
    d = path.dirname(d);
  }
  console.error('  no encuentro ' + NOMBRE + '. Pasa su ruta como argumento.');
  process.exit(1);
}

const F = hallarArchivo();
console.log('  archivo: ' + F);

let txt = fs.readFileSync(F, 'utf8');
const CRLF = txt.indexOf('\r\n') >= 0;
if (CRLF) txt = txt.split('\r\n').join('\n');
console.log('  fin de linea: ' + (CRLF ? 'CRLF (se preserva)' : 'LF'));

/* -------------------------------------------------------- idempotencia ---- */
if (txt.indexOf('NEUTRO.has(t.sentido)') >= 0 && txt.indexOf('const NEUTRO = new Set') >= 0) {
  console.log('  nada que hacer: el parche ya estaba aplicado.');
  process.exit(0);
}

/* -------------------------------------------------------- las marcas ----- */
const M1 = 'const SENSES_BY_AXIS = new Map(AXES.map((a) => [a.id, (a.senses || []).map((s) => s.id)]));';

const N1 = M1 + '\n'
  + '\n'
  + '/* Mismo vocabulario que applySenseTags en vectorize.js. Un tag neutro no\n'
  + ' * elige acepcion: deja el eje sin mezcla y lo fija como dominante. No es\n'
  + ' * un sentido invalido, es la manera de decir "el eje aplica aca, pero sin\n'
  + ' * ninguna de sus acepciones". Caso tipico: 13.d, donde koinon significa\n'
  + ' * compartido por todos los vivientes y no predicado en comun. */\n'
  + "const NEUTRO = new Set(['ninguno', 'neutral', 'sin_sentido']);";

const M2 = '    if (!validos.length) senseErrors.push(`${p.id}: el eje "${t.eje}" todavia no declara sentidos en lexicon.js`);';

const N2 = '    if (NEUTRO.has(t.sentido)) continue;   // neutro: no hay acepcion que verificar\n' + M2;

/* -------------------------------------------------------- pre-flight ----- */
const cuenta = (s) => { let n = 0, i = 0; for (;;) { const j = txt.indexOf(s, i); if (j < 0) break; n++; i = j + s.length; } return n; };

let FAIL = 0;
for (const [etiq, m] of [['declaracion de SENSES_BY_AXIS', M1], ['validacion de sentidos', M2]]) {
  const n = cuenta(m);
  if (n !== 1) { console.error('  !! ' + etiq + ': la marca aparece ' + n + ' veces (esperaba 1)'); FAIL++; }
}
if (FAIL) {
  console.error('  PRE-FLIGHT FALLIDO (' + FAIL + '): no escribi nada.');
  console.error('  Tu build-corpus.mjs difiere del que lei en el repo. Pasame la seccion');
  console.error('  SENTIDOS FIJADOS A MANO tal como esta en tu archivo.');
  process.exit(1);
}

/* -------------------------------------------------------- escritura ------ */
let nuevo = txt.split(M1).join(N1).split(M2).join(N2);
if (nuevo.indexOf('const NEUTRO = new Set') < 0 || nuevo.indexOf('NEUTRO.has(t.sentido)') < 0) {
  console.error('  !! la edicion no quedo. No escribi nada.');
  process.exit(1);
}
if (CRLF) nuevo = nuevo.split('\n').join('\r\n');
const bak = F + '.bak-' + Date.now();
fs.copyFileSync(F, bak);
fs.writeFileSync(F, nuevo, 'utf8');
console.log('  + const NEUTRO = new Set([ninguno, neutral, sin_sentido])');
console.log('  + los tags neutros salteados en la validacion de acepciones');
console.log('  ok ' + NOMBRE + '   (backup ' + path.basename(bak) + ')');
console.log('');
console.log('  Ahora:');
console.log('    node fuente-y-build/build/build-corpus.mjs');
console.log('      -> SENTIDOS FIJADOS A MANO sigue contando idea = ninguno x 2,');
console.log('         pero ya NO aparece el bloque !! REVISAR.');
console.log('      -> 72 pasajes.');
console.log('    node fuente-y-build/build/regresion.mjs');
console.log('      -> SIN CAMBIOS. Este parche solo toca un reporte, no el motor.');