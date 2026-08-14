/* ============================================================================
   patch-tag13d-txt.mjs

   Hace UNA sola cosa: agrega el tag neutro de "idea" al parrafo 48 del .txt
   fuente, para que 13.d y 13.e dejen de recibir la acepcion "categorial"
   por el koinon griego (ahi koinon = compartido por todos los vivientes,
   no predicado en comun).

   NO toca build-corpus.mjs. NO toca el lexico. Solo el .txt.

   Uso:  node fuente-y-build/build/patch-tag13d-txt.mjs
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function hallarDir() {
  const arg = process.argv[2];
  const ok = (d) => {
    try { return fs.readdirSync(path.join(d, 'fuente-y-build')).some((f) => f.endsWith('.txt')); }
    catch { return false; }
  };
  if (arg) {
    const p = path.resolve(arg);
    if (ok(p)) return path.join(p, 'fuente-y-build');
    if (p.endsWith('.txt') && fs.existsSync(p)) return path.dirname(p);
  }
  let d = HERE;
  for (let i = 0; i < 6; i++) { if (ok(d)) return path.join(d, 'fuente-y-build'); d = path.dirname(d); }
  console.error('  no encuentro fuente-y-build con un .txt. Pasa la raiz como argumento.');
  process.exit(1);
}

const DIR = hallarDir();
const cands = fs.readdirSync(DIR).filter((f) => f.endsWith('.txt'));
if (cands.length !== 1) {
  console.error('  esperaba exactamente 1 archivo .txt en ' + DIR + ', encontre ' + cands.length + ':');
  for (const c of cands) console.error('    ' + c);
  process.exit(1);
}
const SRC = path.join(DIR, cands[0]);
console.log('  fuente: ' + SRC);

let txt = fs.readFileSync(SRC, 'utf8');
const CRLF = txt.indexOf('\r\n') >= 0;
if (CRLF) txt = txt.split('\r\n').join('\n');

/* ------------------------------------------------------- idempotencia ----- */
if (txt.indexOf('"sentido": "ninguno"') >= 0) {
  console.log('  nada que hacer: el tag neutro ya estaba en el .txt.');
  process.exit(0);
}

/* ------------------------------------------------------- la marca --------- */
const M = '{ "parrafo_nro": 48, "tags": [{"rol": "faq", "eje": "psyche", "pregunta": "cu'
  + '\u00e1' + 'les son las partes del alma?", "peso": 0.9}] }';

const TAG = '{"eje": "idea", "sentido": "ninguno", "nota": "koinon aqui = compartido por '
  + 'todos los vivientes, no predicado en comun (categorial)"}';

const cuenta = (s) => { let n = 0, i = 0; for (;;) { const j = txt.indexOf(s, i); if (j < 0) break; n++; i = j + s.length; } return n; };

const n = cuenta(M);
if (n !== 1) {
  console.error('  !! la linea del parrafo 48 aparece ' + n + ' veces (esperaba 1).');
  console.error('     PRE-FLIGHT FALLIDO: no escribi nada.');
  console.error('     Pasame el resultado de buscar "parrafo_nro": 48 en el .txt.');
  process.exit(1);
}

const N = M.replace('}] }', '}, ' + TAG + '] }');
let nuevo = txt.split(M).join(N);

/* ------------------------------------------------------- verificacion ----- */
if (nuevo.indexOf('"sentido": "ninguno"') < 0) {
  console.error('  !! la insercion no quedo. No escribi nada.');
  process.exit(1);
}
if (nuevo.length <= txt.length) {
  console.error('  !! el archivo no crecio. No escribi nada.');
  process.exit(1);
}

if (CRLF) nuevo = nuevo.split('\n').join('\r\n');
const bak = SRC + '.bak-' + Date.now();
fs.copyFileSync(SRC, bak);
fs.writeFileSync(SRC, nuevo, 'utf8');
console.log('  ok ' + cands[0] + '   (backup ' + path.basename(bak) + ')');
console.log('');
console.log('  El parrafo 48 alimenta 13.d Y 13.e, asi que el tag cae en los dos.');
console.log('  Eso es deseado: en 13.e blinda el eje contra el mismo falso positivo.');
console.log('');
console.log('  Ahora, en este orden:');
console.log('    1) node fuente-y-build/build/build-corpus.mjs');
console.log('       -> tiene que seguir diciendo 72 pasajes.');
console.log('    2) node fuente-y-build/build/check-estado.mjs');
console.log('       -> seccion 5 completa en OK, y decime si marca tags duplicados.');
console.log('    3) node fuente-y-build/build/regresion.mjs');
console.log('       -> 4 diferencias, TODAS de pasajes:');
console.log('          13.d sentidos.idea.categorial 1 -> (no existia)');
console.log('          13.d fijados.0 -> "idea"');
console.log('          13.e sentidos.idea -> {}');
console.log('          13.e fijados.0 -> "idea"');
console.log('       -> CERO de indice, CERO de vector, CERO de consultas.');
console.log('    4) solo si el diff es ese: node fuente-y-build/build/regresion.mjs --guardar');