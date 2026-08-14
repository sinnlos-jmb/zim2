/* ============================================================================
   patch-glosa-6h.mjs   (v2)

   Agrega UNA glosa griega al pasaje 6.h (1096b26) en el .txt fuente:

     ...pues si lo que se predica en comun (κοινῇ κατηγορούμενον) como bien
     fuera algo uno, o algo separado (χωριστὸν) que existiera por si mismo
     (καθ᾽ αὑτό)...

   POR QUE. 6.h enuncia la disyuncion completa de la critica a Platon: el bien
   o es "lo predicado en comun" (κοινῇ κατηγορούμενον) o es "algo separado en
   si" (χωριστὸν ... καθ᾽ αὑτό). Las dos ramas estan en el texto, pero solo la
   segunda estaba glosada, asi que el motor veia media frase y daba
   idea = {separada: 1}. No era un error de calculo: era falta de materia.

   El parche de limpieza habia movido 'en comun' del sentido 'categorial' al
   eje neutro (el termino castellano acertaba 4 veces y fallaba 4), y 6.h
   perdio ahi su categorial 0.116. Esta glosa lo recupera por el canal que si
   discrimina: el griego. κοινῇ estemea κοιν, el mismo stem que el κοινόν que
   ya esta en idea/categorial.gr, asi que NO hay que tocar lexicon.js.
   κατηγορούμενον estemea κατηγορουμεν, que no esta en el lexico: no aporta
   peso, solo deja la frase completa a la vista del lector.

   ALCANCE. Las glosas son por pasaje: el unico vector que se mueve es el de
   6.h. Los otros pasajes que dicen "en comun" en castellano (6.b, 6.c, 6.g,
   7.h, 9.b, 13.d, 13.e) entran por el eje neutro, no votan sentido y quedan
   intactos. 13.d ya tiene κοινῷ glosado, mismo stem, pero su tag neutro le
   bloquea el eje a proposito: ahi koinon es "comun a los vivientes".

   v2: la guarda de idempotencia NO puede buscar la glosa suelta. La frase
   κοινῇ κατηγορούμενον YA EXISTE en el archivo, dentro del griego paralelo
   de este mismo pasaje, asi que la v1 se declaraba aplicada sin escribir
   nada. Ahora se busca la frase castellana ya glosada, que solo puede existir
   si este parche corrio.

   Solo edita el .txt. No toca el lexico, ni el corpus, ni el baseline.
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

// -- localizar el .txt fuente: argumento, o el unico .txt de fuente-y-build --
function hallarTxt() {
  const arg = process.argv[2];
  if (arg) {
    const p = path.resolve(arg);
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  }
  let dir = AQUI;
  for (let i = 0; i < 6; i++) {
    const cand = path.join(dir, 'fuente-y-build');
    if (fs.existsSync(cand) && fs.statSync(cand).isDirectory()) {
      const txts = fs.readdirSync(cand).filter((f) => f.toLowerCase().endsWith('.txt'));
      if (txts.length === 1) return path.join(cand, txts[0]);
      if (txts.length > 1) {
        console.error('!! hay ' + txts.length + ' archivos .txt en ' + cand + ': pasame la ruta como argumento.');
        process.exit(1);
      }
    }
    const arriba = path.dirname(dir);
    if (arriba === dir) break;
    dir = arriba;
  }
  return null;
}

const RUTA = hallarTxt();
if (!RUTA) { console.error('!! no encontre el .txt fuente. Uso: node patch-glosa-6h.mjs [ruta.txt]'); process.exit(1); }
console.log('fuente: ' + RUTA);

let txt = fs.readFileSync(RUTA, 'utf8');

// -- fin de linea: se detecta y se restituye al escribir --------------------
const CRLF = txt.indexOf('\r\n') >= 0;
console.log('fin de linea: ' + (CRLF ? 'CRLF (se preserva)' : 'LF'));
if (CRLF) txt = txt.split('\r\n').join('\n');

const GLOSA = '\u03ba\u03bf\u03b9\u03bd\u1fc7 \u03ba\u03b1\u03c4\u03b7\u03b3\u03bf\u03c1\u03bf\u03cd\u03bc\u03b5\u03bd\u03bf\u03bd';
const M = 'se predica en com\u00fan como bien fuera algo uno';
const N = 'se predica en com\u00fan (' + GLOSA + ') como bien fuera algo uno';

// -- idempotencia: se busca N, la frase castellana YA glosada ---------------
// Buscar GLOSA sola seria un falso positivo garantizado: esa frase griega ya
// vive en el texto paralelo de 6.h. Ese fue el bug de la v1.
if (txt.indexOf(N) >= 0) {
  console.log('nada que hacer: la glosa ya esta puesta en el castellano de 6.h.');
  process.exit(0);
}

// -- pre-flight: la marca tiene que aparecer exactamente una vez ------------
const cuenta = (s, m) => { let n = 0, i = 0; for (;;) { const j = s.indexOf(m, i); if (j < 0) break; n++; i = j + m.length; } return n; };
const veces = cuenta(txt, M);
if (veces !== 1) {
  console.error('!! la marca aparece ' + veces + ' veces (esperaba 1). No escribo nada.');
  console.error('   marca buscada: "' + M + '"');
  process.exit(1);
}

// -- aplicar ---------------------------------------------------------------
const antes = txt.length;
let nuevo = txt.replace(M, N);
const neta = nuevo.length - antes;
if (neta <= 0) { console.error('!! el archivo no crecio. No escribo nada.'); process.exit(1); }
if (cuenta(nuevo, N) !== 1) { console.error('!! la frase glosada no quedo exactamente 1 vez. No escribo nada.'); process.exit(1); }

if (CRLF) nuevo = nuevo.split('\n').join('\r\n');

const bak = RUTA + '.bak-' + Date.now();
fs.copyFileSync(RUTA, bak);
fs.writeFileSync(RUTA, nuevo, 'utf8');

console.log('+ glosa (' + GLOSA + ') en el castellano de 6.h  (' + neta + ' caracteres)');
console.log('ok ' + path.basename(RUTA) + '   (backup ' + path.basename(bak) + ')');
console.log('');
console.log('Ahora:');
console.log('  node fuente-y-build/build/build-corpus.mjs   -> siguen 72 pasajes; 6.h pasa de 13 a 14 glosas');
console.log('  node fuente-y-build/build/regresion.mjs      -> mirar el diff ANTES de --guardar');