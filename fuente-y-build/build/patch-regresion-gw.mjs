/* ============================================================================
   patch-regresion-gw.mjs  --  la red de regresion tiene que ver el canal gw

   Problema: conteoTerminos() en regresion.mjs registra solo los canales
   es / gr / gx. Las expresiones griegas multipalabra (canal gw, campo grExpr)
   son INVISIBLES para el baseline. Consecuencia real, vista hoy:

     indice.terminos.teleios/absoluto
     baseline: {"es":0,"gr":1,"gx":0}
     ahora   : (no existia)

   teleios/absoluto no desaparecio del lexico: sigue vivo con 1 termino gw
   (kath auto diokton). Pero el snapshot no lo puede ver, asi que la red de
   regresion lo reporta como borrado, y peor: se puede romper CUALQUIER
   expresion griega sin que salte ninguna alarma.

   Este parche agrega gw al snapshot. Dos cambios de una linea cada uno.

   OJO: despues de aplicarlo hay que rehacer el baseline. El diff sera grande
   (una clave gw nueva por cada eje/sentido) pero es puramente estructural:
   no cambia ni un vector ni una consulta.
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function hallarBuild() {
  const arg = process.argv[2];
  if (arg) {
    let p = path.resolve(arg);
    if (fs.existsSync(path.join(p, 'regresion.mjs'))) return p;
    if (path.basename(p) === 'regresion.mjs' && fs.existsSync(p)) return path.dirname(p);
    console.error('  no hay regresion.mjs en ' + p);
    process.exit(1);
  }
  if (fs.existsSync(path.join(HERE, 'regresion.mjs'))) return HERE;
  let d = HERE;
  for (let i = 0; i < 6; i++) {
    for (const cand of [path.join(d, 'build'), path.join(d, 'fuente-y-build', 'build')]) {
      if (fs.existsSync(path.join(cand, 'regresion.mjs'))) return cand;
    }
    d = path.dirname(d);
  }
  console.error('  no encuentro build/regresion.mjs. Pasalo como argumento.');
  process.exit(1);
}

const BUILD = hallarBuild();
const ARCH = path.join(BUILD, 'regresion.mjs');
console.log('  archivo: ' + ARCH);

const crudo = fs.readFileSync(ARCH, 'utf8');
const CRLF = crudo.indexOf('\r\n') >= 0;
let txt = CRLF ? crudo.split('\r\n').join('\n') : crudo;

if (txt.indexOf('INDEX.gwUni') >= 0 && txt.indexOf('gw: 0') >= 0) {
  console.log('  nada que hacer: el parche ya estaba aplicado.');
  process.exit(0);
}

let FAIL = 0;
const fail = (m) => { console.error('  !! ' + m); FAIL++; };

/* --- las dos marcas -------------------------------------------------------- */
const M1 = "    ['gx', INDEX.gxUni], ['gx', INDEX.gxPhr],\n";
const N1 = M1 + "    ['gw', INDEX.gwUni], ['gw', INDEX.gwPhr],\n";

const M2 = 'c[k] = { es: 0, gr: 0, gx: 0 };';
const N2 = 'c[k] = { es: 0, gr: 0, gx: 0, gw: 0 };';

/* --- pre-flight ------------------------------------------------------------ */
const cuenta = (s) => txt.split(s).length - 1;
for (const [nom, m] of [['maps gx', M1], ['inicializador', M2]]) {
  const n = cuenta(m);
  if (n !== 1) fail(nom + ': la marca aparece ' + n + ' veces (esperaba 1)');
}
if (FAIL > 0) {
  console.error('  PRE-FLIGHT FALLIDO (' + FAIL + '): no escribi nada.');
  process.exit(1);
}

/* --- aplicar --------------------------------------------------------------- */
txt = txt.split(M1).join(N1);
txt = txt.split(M2).join(N2);
console.log("  + maps: ['gw', INDEX.gwUni], ['gw', INDEX.gwPhr]");
console.log('  + acumulador: { es, gr, gx, gw }');

const sello = Date.now();
fs.copyFileSync(ARCH, ARCH + '.bak-' + sello);
fs.writeFileSync(ARCH, CRLF ? txt.split('\n').join('\r\n') : txt, 'utf8');
console.log('  ok regresion.mjs   (backup regresion.mjs.bak-' + sello + ')');

console.log('');
console.log('  Listo. Ahora:');
console.log('    1) node fuente-y-build/build/regresion.mjs');
console.log('       -> va a marcar SOLO diferencias de indice (una clave gw por');
console.log('          eje/sentido, y reaparecen teleios/absoluto y teleios/relativo).');
console.log('       -> CERO diferencias de pasajes y CERO de consultas.');
console.log('    2) node fuente-y-build/build/regresion.mjs --guardar');