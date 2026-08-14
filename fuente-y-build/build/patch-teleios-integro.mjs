// patch-teleios-integro.mjs
// Dos cambios acoplados, decididos juntos:
//  (A) lexicon.js : tercera acepcion "integro" en el eje teleios
//  (B) el .txt     : tag manual de mezcla 70/30 absoluto-relativo en 7.b (parrafo 22)
// Hace TODOS los pre-flight antes de escribir nada. Si el lexicon queda con
// sintaxis invalida, lo restaura del backup y no toca el .txt.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const cuenta = (h, n) => h.split(n).length - 1;

function hallarRaiz() {
  let d = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(d, 'fuente-y-build'))) return d;
    d = path.dirname(d);
  }
  throw new Error('no encontre la carpeta fuente-y-build');
}

const RAIZ = hallarRaiz();
const LEX = path.join(RAIZ, 'fuente-y-build', 'src', 'lexicon.js');
const dirFB = path.join(RAIZ, 'fuente-y-build');
const cand = fs.readdirSync(dirFB).filter((f) => f.toLowerCase().endsWith('.txt'));
if (cand.length !== 1) throw new Error('esperaba UN .txt en fuente-y-build, encontre ' + cand.length + ': ' + cand.join(', '));
const TXT = path.join(dirFB, cand[0]);

console.log('lexicon: ' + LEX);
console.log('fuente : ' + TXT);

// ------------------------------------------------------------------ (A) lexicon
const rawLex = fs.readFileSync(LEX, 'utf8');
const crlfLex = rawLex.includes('\r\n');
const lex = crlfLex ? rawLex.replace(/\r\n/g, '\n') : rawLex;

// marca ASCII pura: no incluyo griego para no depender del tipo de apostrofo
const M_LEX = "      {\n        id: 'relativo',";

// las expresiones que discriminan el sentido "integro". Todas de 2+ tokens,
// porque el motor busca n-gramas de n=4 a n=2: una expresion de un solo token
// no se indexa como expresion.
const EXPR = [
  '\u1f10\u03bd \u03b2\u03af\u1ff3 \u03c4\u03b5\u03bb\u03b5\u03af\u1ff3',                                    // en bio teleio
  '\u03b2\u03af\u03bf\u03c5 \u03c4\u03b5\u03bb\u03b5\u03af\u03bf\u03c5',                                      // biou teleiou
  '\u03c4\u03ad\u03bb\u03b5\u03b9\u03bf\u03bd \u03b2\u03af\u03bf\u03bd',                                      // teleion bion
  '\u1f00\u03c1\u03b5\u03c4\u1fc6\u03c2 \u03c4\u03b5\u03bb\u03b5\u03af\u03b1\u03c2',                          // aretes teleias
  '\u1f00\u03c1\u03b5\u03c4\u1f74\u03bd \u03c4\u03b5\u03bb\u03b5\u03af\u03b1\u03bd',                          // areten teleian
  '\u1f00\u03c1\u03af\u03c3\u03c4\u03b7\u03bd \u03ba\u03b1\u1f76 \u03c4\u03b5\u03bb\u03b5\u03b9\u03bf\u03c4\u03ac\u03c4\u03b7\u03bd', // aristen kai teleiotaten
];
const LABEL = 'completo en extensi\u00f3n (vida o virtud entera)';
const GREEK = '\u03c4\u03ad\u03bb\u03b5\u03b9\u03bf\u03c2';

const BLOQUE =
  '      {\n' +
  "        id: 'integro',\n" +
  "        label: '" + LABEL + "',\n" +
  "        greek: '" + GREEK + "',\n" +
  '        grExpr: [' + EXPR.map((e) => "'" + e + "'").join(', ') + '],\n' +
  '      },\n';

const yaLex = lex.includes("id: 'integro'");
let nuevoLex = null;
if (!yaLex) {
  const n = cuenta(lex, M_LEX);
  if (n !== 1) {
    console.log('!! lexicon.js: la marca del sentido relativo aparece ' + n + ' veces (esperaba 1)');
    console.log('PRE-FLIGHT FALLIDO: no escribi nada.');
    process.exit(1);
  }
  nuevoLex = lex.replace(M_LEX, BLOQUE + M_LEX);
}

// ------------------------------------------------------------------ (B) .txt
const rawTxt = fs.readFileSync(TXT, 'utf8');
const crlfTxt = rawTxt.includes('\r\n');
const txt = crlfTxt ? rawTxt.replace(/\r\n/g, '\n') : rawTxt;

const M_TXT = '{ "parrafo_nro": 22, "tags": [{"rol": "define", "eje": "agathon", "nota": "definici\u00f3n finalista reforzada por el ergon", "peso": 0.7}] }';
const T1 = '{"eje": "teleios", "sentido": "absoluto", "peso_sentido": 0.7}';
const T2 = '{"eje": "teleios", "sentido": "relativo", "peso_sentido": 0.3}';
const N_TXT = M_TXT.replace('}] }', '}, ' + T1 + ', ' + T2 + '] }');

const yaTxt = txt.includes(N_TXT);
let nuevoTxt = null;
if (!yaTxt) {
  const n = cuenta(txt, M_TXT);
  if (n !== 1) {
    console.log('!! .txt: la linea de tags del parrafo 22 aparece ' + n + ' veces (esperaba 1)');
    console.log('PRE-FLIGHT FALLIDO: no escribi nada.');
    process.exit(1);
  }
  nuevoTxt = txt.replace(M_TXT, N_TXT);
}

if (yaLex && yaTxt) {
  console.log('nada que hacer: los dos cambios ya estan aplicados.');
  process.exit(0);
}

// ------------------------------------------------------------------ escritura
console.log('fin de linea: lexicon ' + (crlfLex ? 'CRLF' : 'LF') + ', txt ' + (crlfTxt ? 'CRLF' : 'LF') + ' (se preservan)');

if (nuevoLex) {
  const bak = LEX + '.bak-' + Date.now();
  fs.copyFileSync(LEX, bak);
  fs.writeFileSync(LEX, crlfLex ? nuevoLex.replace(/\n/g, '\r\n') : nuevoLex);
  try {
    execFileSync(process.execPath, ['--check', LEX], { stdio: 'pipe' });
  } catch (e) {
    fs.copyFileSync(bak, LEX);
    console.log('!! el lexicon quedaba con sintaxis invalida. Lo restaure del backup y NO toque el .txt.');
    console.log(String(e.stderr || e.message).split('\n').slice(0, 4).join('\n'));
    process.exit(1);
  }
  if (cuenta(fs.readFileSync(LEX, 'utf8'), "id: 'integro'") !== 1) {
    fs.copyFileSync(bak, LEX);
    console.log('!! verificacion posterior fallida en el lexicon. Restaurado.');
    process.exit(1);
  }
  console.log('+ acepcion "integro" en teleios, con ' + EXPR.length + ' expresiones griegas');
  console.log('ok lexicon.js   (backup ' + path.basename(bak) + ')');
} else {
  console.log('= el lexicon ya tenia la acepcion integro');
}

if (nuevoTxt) {
  const bak = TXT + '.bak-' + Date.now();
  fs.copyFileSync(TXT, bak);
  fs.writeFileSync(TXT, crlfTxt ? nuevoTxt.replace(/\n/g, '\r\n') : nuevoTxt);
  if (cuenta(fs.readFileSync(TXT, 'utf8'), T1) !== 1) {
    fs.copyFileSync(bak, TXT);
    console.log('!! verificacion posterior fallida en el .txt. Restaurado.');
    process.exit(1);
  }
  console.log('+ tag de mezcla 70/30 absoluto-relativo en 7.b (parrafo 22)');
  console.log('ok ' + path.basename(TXT) + '   (backup ' + path.basename(bak) + ')');
} else {
  console.log('= el .txt ya tenia el tag de 7.b');
}

console.log('');
console.log('Ahora:');
console.log('  node fuente-y-build/build/check-lexicon.mjs   -> 26 ejes, 0 duplicados');
console.log('  node fuente-y-build/build/build-corpus.mjs    -> deberia aparecer teleios = absoluto/relativo');
console.log('  node fuente-y-build/build/regresion.mjs       -> mirar el diff ANTES de --guardar');