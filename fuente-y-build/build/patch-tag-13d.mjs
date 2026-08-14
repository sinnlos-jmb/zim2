/* ============================================================================
   patch-tag-13d.mjs  --  tag manual en 13.d + fix del duplicador de tags

   PARTE 1 (bug real, encontrado al ir a escribir la parte 2)
   ---------------------------------------------------------
   build-corpus.mjs acumula los tags cuando fusiona unidades cortas:

     prev.tags = [...(prev.tags || []), ...(u.tags || [])];

   Cuando un parrafo se dividio en fragmentos y esos fragmentos se vuelven a
   fusionar, el MISMO tag entra varias veces. Hoy, si regeneras el corpus:

     EN.I.4.d   {"eje":"arete"} x5      (parrafoNros [9,9,9,9,9])
     EN.I.8.h   {"eje":"arete"} x4
     EN.I.7.i   los 3 tags x2           (incluye tags de SENTIDO con peso)
     EN.I.7.f, 8.i, 12.b, 13.g          idem

   El corpus commiteado tiene una sola copia de cada uno, o sea que hoy el
   .txt y el corpus.json NO son consistentes: regenerar el corpus mete 7
   pasajes con tags repetidos. Medido: no cambia ningun vector y tampoco las
   mezclas de sentido (applySenseTags normaliza, asi que 0.7/0.3 duplicado
   sigue dando 0.7/0.3). Es un bug latente, no activo. Pero es una mina:
   basta un tag de sentido que se duplique de forma asimetrica para que los
   pesos se desbalanceen en silencio.

   Fix: deduplicar por contenido al fusionar.

   PARTE 2 (el tag de 13.d)
   ------------------------
   13.d (1102a26) declara la acepcion idea/categorial por el griego kappa-omicron-iota-nu
   (koinoi, dativo), glosado en el pasaje. Pero ahi koinon significa
   "compartido por todos los vivientes" (la parte vegetativa), NO "predicado
   en comun" en sentido categorial. Es el unico falso positivo que quedo vivo
   despues del parche de limpieza, y no se puede arreglar desde el lexico:
   koinoi y koinon comparten stem, asi que sacarlo mataria 6.h, que es un
   acierto central del capitulo 6.

   Solucion: tag neutro. applySenseTags ya soporta sentido "ninguno" /
   "neutral" / "sin_sentido": vacia la mezcla de ese eje y lo marca fijado.

   Los tags viven en el .txt fuente y se asignan POR PARRAFO. El parrafo 48
   alimenta 13.d y tambien 13.e, asi que el tag cae en los dos. Medido: en
   13.e el efecto es "sentidos.idea: {}" mas el eje fijado, o sea que 13.e
   queda blindado contra la reintroduccion del mismo falso positivo. No
   cambia ningun vector ni ninguna consulta.
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function hallarRaiz() {
  const arg = process.argv[2];
  const ok = (d) => fs.existsSync(path.join(d, 'fuente-y-build', 'build', 'build-corpus.mjs'));
  if (arg) {
    const p = path.resolve(arg);
    if (ok(p)) return p;
    console.error('  no encuentro fuente-y-build/build/build-corpus.mjs en ' + p);
    process.exit(1);
  }
  let d = HERE;
  for (let i = 0; i < 6; i++) {
    if (ok(d)) return d;
    d = path.dirname(d);
  }
  console.error('  no encuentro la raiz del repo. Pasala como argumento.');
  process.exit(1);
}

const RAIZ = hallarRaiz();
const BC = path.join(RAIZ, 'fuente-y-build', 'build', 'build-corpus.mjs');
console.log('  raiz: ' + RAIZ);

/* el .txt fuente: el que use build-corpus por defecto */
const dirF = path.join(RAIZ, 'fuente-y-build');
const TXT = fs.readdirSync(dirF).filter((f) => f.endsWith('.txt')).map((f) => path.join(dirF, f));
if (TXT.length !== 1) {
  console.error('  esperaba UN .txt en fuente-y-build, encontre ' + TXT.length + ': ' + TXT.join(', '));
  process.exit(1);
}
console.log('  fuente: ' + path.basename(TXT[0]));

let FAIL = 0;
const fail = (m) => { console.error('  !! ' + m); FAIL++; };

const leer = (f) => {
  const crudo = fs.readFileSync(f, 'utf8');
  const crlf = crudo.indexOf('\r\n') >= 0;
  return { txt: crlf ? crudo.split('\r\n').join('\n') : crudo, crlf };
};

const A = leer(BC);
const B = leer(TXT[0]);

/* ---------------------------------------------------- PARTE 1 --------------- */
const M1 = '    prev.tags = [...(prev.tags || []), ...(u.tags || [])];';
const N1 = [
  '    // dedupe por contenido: cuando un parrafo se dividio y sus fragmentos',
  '    // se vuelven a fusionar, el MISMO tag llega varias veces.',
  '    {',
  '      const acumulados = [...(prev.tags || [])];',
  '      const vistos = new Set(acumulados.map((t) => JSON.stringify(t)));',
  '      for (const t of (u.tags || [])) {',
  '        const k = JSON.stringify(t);',
  '        if (vistos.has(k)) continue;',
  '        vistos.add(k);',
  '        acumulados.push(t);',
  '      }',
  '      prev.tags = acumulados;',
  '    }',
].join('\n');

/* ---------------------------------------------------- PARTE 2 --------------- */
const A_ = '\u00e1';
const M2 = '{ "parrafo_nro": 48, "tags": [{"rol": "faq", "eje": "psyche", "pregunta": "cu' + A_ + 'les son las partes del alma?", "peso": 0.9}] }';
const TAG = '{"eje": "idea", "sentido": "ninguno", "nota": "koinon aqui = compartido por todos los vivientes, no predicado en comun (categorial)"}';
const N2 = M2.replace('}] }', '}, ' + TAG + '] }');

/* ---------------------------------------------------- pre-flight ------------ */
const cuenta = (s, m) => s.split(m).length - 1;

const p1Hecha = A.txt.indexOf('dedupe por contenido') >= 0;
const p2Hecha = B.txt.indexOf('"sentido": "ninguno"') >= 0;

if (!p1Hecha && cuenta(A.txt, M1) !== 1) {
  fail('build-corpus.mjs: la marca de fusion aparece ' + cuenta(A.txt, M1) + ' veces (esperaba 1)');
}
if (!p2Hecha && cuenta(B.txt, M2) !== 1) {
  fail('fuente .txt: la linea del parrafo 48 aparece ' + cuenta(B.txt, M2) + ' veces (esperaba 1)');
}
if (FAIL > 0) {
  console.error('  PRE-FLIGHT FALLIDO (' + FAIL + '): no escribi nada.');
  process.exit(1);
}
if (p1Hecha && p2Hecha) {
  console.log('  nada que hacer: el parche ya estaba aplicado.');
  process.exit(0);
}

/* ---------------------------------------------------- escribir -------------- */
const sello = Date.now();
const guardar = (f, o, nuevo, etiq) => {
  fs.copyFileSync(f, f + '.bak-' + sello);
  fs.writeFileSync(f, o.crlf ? nuevo.split('\n').join('\r\n') : nuevo, 'utf8');
  console.log('  ok ' + etiq + '   (backup ' + path.basename(f) + '.bak-' + sello + ')');
};

if (!p1Hecha) {
  guardar(BC, A, A.txt.split(M1).join(N1), 'build/build-corpus.mjs  [dedupe de tags]');
} else {
  console.log('  ya aplicado: dedupe de tags');
}
if (!p2Hecha) {
  guardar(TXT[0], B, B.txt.split(M2).join(N2), path.basename(TXT[0]) + '  [tag neutro parrafo 48]');
} else {
  console.log('  ya aplicado: tag del parrafo 48');
}

console.log('');
console.log('  Listo. Ahora, en este orden:');
console.log('    1) node fuente-y-build/build/build-corpus.mjs');
console.log('       -> regenera corpus.json. Tiene que seguir diciendo 72 pasajes.');
console.log('    2) node fuente-y-build/build/regresion.mjs');
console.log('       -> 4 diferencias, TODAS de pasajes:');
console.log('          13.d sentidos.idea.categorial 1 -> (no existia)');
console.log('          13.d fijados.0 -> "idea"');
console.log('          13.e sentidos.idea -> {}');
console.log('          13.e fijados.0 -> "idea"');
console.log('       -> CERO de indice, CERO de vector, CERO de consultas.');
console.log('    3) node fuente-y-build/build/regresion.mjs --guardar');