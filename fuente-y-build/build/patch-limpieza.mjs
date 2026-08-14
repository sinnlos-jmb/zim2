/* ============================================================================
   patch-limpieza.mjs  --  parche 7: limpieza de la autoridad de acepcion

   NO borra ningun termino del lexico: mueve tres terminos desde un SENTIDO
   hacia el EJE NEUTRO. El termino sigue sumando al vector exactamente igual
   (0 cambios de ranking), pero deja de tener autoridad para declarar una
   acepcion en los pasajes donde aparece.

     1. idea/separada.es    'separado'      -> idea.es
     2. idea/categorial.es  'en comun'      -> idea.es
     3. teleios/absoluto.gr 'teleiotaton'   -> teleios.gr    (ver FLAG abajo)

   Medido sobre los 72 pasajes: 0 vectores cambiados, 0 consultas cambiadas,
   5 etiquetas de acepcion falsas eliminadas (7.h, 8.h, 9.b, 13.e, 7.i).
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* Poner en false si preferis conservar teleiotaton en la acepcion absoluta y
   resolver 7.i con un tag manual. */
const MOVER_TELEIOTATON = true;

const TT = '\u03c4\u03b5\u03bb\u03b5\u03b9\u03cc\u03c4\u03b1\u03c4\u03bf\u03bd';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function hallarSrc() {
  const arg = process.argv[2];
  if (arg) {
    const p = path.resolve(arg);
    if (fs.existsSync(path.join(p, 'lexicon.js'))) return p;
    console.error('  no hay lexicon.js en ' + p);
    process.exit(1);
  }
  let d = HERE;
  for (let i = 0; i < 6; i++) {
    for (const cand of [path.join(d, 'src'), path.join(d, 'fuente-y-build', 'src')]) {
      if (fs.existsSync(path.join(cand, 'lexicon.js'))) return cand;
    }
    d = path.dirname(d);
  }
  console.error('  no encuentro src/lexicon.js. Pasalo como argumento.');
  process.exit(1);
}

const SRC = hallarSrc();
console.log('  src: ' + SRC);

const ARCH = path.join(SRC, 'lexicon.js');
const crudo = fs.readFileSync(ARCH, 'utf8');
const CRLF = crudo.indexOf('\r\n') >= 0;
let txt = CRLF ? crudo.split('\r\n').join('\n') : crudo;

let FAIL = 0;
const fail = (m) => { console.error('  !! ' + m); FAIL++; };

/* --- localizar "canal: [" dentro de la ventana de un bloque -------------- */
function buscarCanal(desde, hasta, canal) {
  const marca = canal + ': [';
  let j = txt.indexOf(marca, desde);
  while (j >= 0 && j < hasta) {
    const c = txt[j - 1];
    if (c === ' ' || c === '\t' || c === '\n') return j;
    j = txt.indexOf(marca, j + 1);
  }
  return -1;
}

function leerLista(marca, canal, ventana) {
  const i = txt.indexOf(marca);
  if (i < 0) { fail('no encuentro el bloque ' + marca); return null; }
  const j = buscarCanal(i, i + ventana, canal);
  if (j < 0) { fail('no encuentro "' + canal + ': [" dentro de ' + marca); return null; }
  const k = txt.indexOf(']', j);
  if (k < 0) { fail('lista sin cerrar en ' + marca + '.' + canal); return null; }
  const cuerpo = txt.slice(j + marca0(canal), k);
  const items = [];
  const re = /'([^']*)'/g;
  let m;
  while ((m = re.exec(cuerpo)) !== null) items.push(m[1]);
  const sangria = (() => {
    let s = j - 1, out = '';
    while (s >= 0 && (txt[s] === ' ' || txt[s] === '\t')) { out = txt[s] + out; s--; }
    return out;
  })();
  return { ini: j - sangria.length, fin: k + 1, items, sangria, canal, cuerpo };
}

function marca0(canal) { return canal.length + 3; }

function escribirLista(L, items) {
  const lista = items.map((x) => "'" + x + "'").join(', ');
  const rep = L.sangria + L.canal + ': [' + lista + ']';
  txt = txt.slice(0, L.ini) + rep + txt.slice(L.fin);
  return lista;
}

/* --- los tres movimientos ------------------------------------------------ */
const MOVS = [
  { origen: "id: 'separada'", destino: "id: 'idea',", canal: 'es', termino: 'separado' },
  { origen: "id: 'categorial'", destino: "id: 'idea',", canal: 'es', termino: 'en comun' },
];
if (MOVER_TELEIOTATON) {
  MOVS.push({ origen: "id: 'absoluto'", destino: "id: 'teleios',", canal: 'gr', termino: TT });
}

/* --- pre-flight: leer todo antes de tocar nada --------------------------- */
let yaAplicado = 0;
for (const mv of MOVS) {
  const o = leerLista(mv.origen, mv.canal, 2600);
  const d = leerLista(mv.destino, mv.canal, 2600);
  if (!o || !d) continue;
  const enOrigen = o.items.indexOf(mv.termino) >= 0;
  const enDestino = d.items.indexOf(mv.termino) >= 0;
  if (!enOrigen && enDestino) {
    console.log('  ya aplicado: "' + mv.termino + '" ya esta en ' + mv.destino);
    yaAplicado++;
  } else if (!enOrigen) {
    fail('"' + mv.termino + '" no esta en ' + mv.origen + '.' + mv.canal + ' -> [' + o.items.join(', ') + ']');
  } else if (enDestino) {
    fail('"' + mv.termino + '" ya esta en ' + mv.destino + '.' + mv.canal + ' (quedaria duplicado)');
  }
}
if (FAIL > 0) {
  console.error('  PRE-FLIGHT FALLIDO (' + FAIL + '): no escribi nada.');
  process.exit(1);
}
if (yaAplicado === MOVS.length) {
  console.log('  nada que hacer: el parche ya estaba aplicado.');
  process.exit(0);
}

/* --- aplicar: siempre de abajo hacia arriba dentro del archivo ----------- */
for (const mv of MOVS) {
  const o = leerLista(mv.origen, mv.canal, 2600);
  const d = leerLista(mv.destino, mv.canal, 2600);
  if (!o || !d) { fail('relectura fallida en ' + mv.origen); break; }
  if (o.items.indexOf(mv.termino) < 0) continue;

  /* el destino esta ANTES del origen en el archivo (eje antes que sentidos),
     asi que edito primero el origen para no invalidar el offset del destino */
  const quedan = o.items.filter((x) => x !== mv.termino);
  const l1 = escribirLista(o, quedan);
  const d2 = leerLista(mv.destino, mv.canal, 2600);
  const l2 = escribirLista(d2, d2.items.concat([mv.termino]));
  console.log('  ' + mv.origen.padEnd(18) + mv.canal + ' -> [' + l1 + ']');
  console.log('    ' + mv.destino.padEnd(18) + mv.canal + ' -> [' + l2 + ']');
}
if (FAIL > 0) {
  console.error('  FALLO al aplicar (' + FAIL + '): no escribi nada.');
  process.exit(1);
}

/* --- guardar ------------------------------------------------------------- */
const sello = Date.now();
fs.copyFileSync(ARCH, ARCH + '.bak-' + sello);
fs.writeFileSync(ARCH, CRLF ? txt.split('\n').join('\r\n') : txt, 'utf8');
console.log('  ok lexicon.js   (backup lexicon.js.bak-' + sello + ')');

console.log('');
console.log('  Listo. Ahora:');
console.log('    1) node fuente-y-build/build/check-lexicon.mjs fuente-y-build/src');
console.log('       -> 26 ejes, 0 duplicados, 7 colapsos, ningun sentido vacio');
console.log('       -> idea (neutro) pasa a 5 es; separada 1 es; categorial 1 es');
console.log('    2) node fuente-y-build/build/regresion.mjs');
console.log('       -> tiene que marcar SOLO diferencias de indice y de sentidos.');
console.log('       -> CERO diferencias de vector y CERO de consultas. Si aparece');
console.log('          alguna, algo salio mal: restaura el backup.');
console.log('    3) node fuente-y-build/build/regresion.mjs --guardar');