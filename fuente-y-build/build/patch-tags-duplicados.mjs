import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* patch-tags-duplicados.mjs   (v2: tolera finales de linea CRLF de Windows)
 *
 * QUE ARREGLA
 * En el .txt un parrafo ocupa varias lineas fisicas seguidas. parse.js le deja
 * el tag del parrafo vigente en TODAS esas lineas (variable blockTag). Cada
 * linea se vuelve una unidad, y el chunker de este mismo archivo las vuelve a
 * fusionar concatenando tags sin deduplicar:
 *     prev.tags = [...(prev.tags || []), ...(u.tags || [])]
 * Resultado: el mismo tag queda 2 a 5 veces en el pasaje final, una vez por
 * linea fisica del parrafo original. Medido sobre los 72 pasajes: 10 tags
 * repetidos en 7 pasajes.
 *     EN.I.4.d   parrafo 9   {eje:arete}                       x5
 *     EN.I.7.f   parrafo 24  define autarkeia + afirma         x2 cada uno
 *     EN.I.7.i   parrafo 27  faq ergon + split arete 0.7/0.3   x2 cada uno
 *     EN.I.8.h   parrafo 32  {eje:arete}                       x4
 *     EN.I.8.i   parrafo 33  faq requisitos de la felicidad    x2
 *     EN.I.12.b  parrafo 43  faq es la felicidad elogiable     x3
 *     EN.I.13.g  parrafo 50  faq continente/incontinente       x3
 *
 * POR QUE SE ARREGLA ACA Y NO EN parse.js
 * Lo obvio seria que parse.js guarde el tag solo en la linea donde fue
 * declarado. Probado y PIERDE cobertura: un parrafo puede repartirse en dos
 * pasajes finales distintos, y con esa version el segundo se queda sin tag.
 * Medido: 13 pasajes perdian tags, entre ellos EN.I.8.c (perdia el split de
 * arete etica/dianoetica) y EN.I.13.b, EN.I.7.d, EN.I.7.f. Deduplicar al
 * fusionar arregla los 10 duplicados y no cambia la cobertura ni un tag:
 *     repo actual   pasajes 72  conTags 35  tags 73  duplicados 10
 *     este patch    pasajes 72  conTags 35  tags 56  duplicados  0
 *     via parse.js  pasajes 72  conTags 22  tags 37  duplicados  0  <- pierde
 *
 * SOBRE LOS NUMEROS
 * Los tags de sentido duplicados no falseaban el calculo: applySenseTags suma
 * los pesos repetidos y despues normaliza, asi que al duplicarse los dos lados
 * por igual la proporcion salia intacta (0.7/0.3 seguia siendo 0.7/0.3). Los
 * de rol si molestaban de veras: la misma pregunta 2 o 3 veces en el pasaje, y
 * los conteos por rol del reporte inflados (faq 27, define 11, afirma 8).
 *
 * SOBRE LOS FINALES DE LINEA
 * En Windows git suele dejar el archivo en CRLF. La v1 buscaba bloques de
 * varias lineas unidas con \n y no encontraba nada: de ahi el pre-flight
 * fallido con "aparece 0". Ahora se normaliza a \n para comparar y se
 * restaura el estilo original (y el BOM, si habia) al escribir.
 *
 * Toca un solo archivo: fuente-y-build/build/build-corpus.mjs. No toca el .txt,
 * ni parse.js, ni nada que sync-engine.mjs copie al navegador.
 *
 * Uso:
 *   node fuente-y-build/build/patch-tags-duplicados.mjs
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FILE = path.join(ROOT, 'fuente-y-build', 'build', 'build-corpus.mjs');

console.log('archivo :', FILE);

if (!fs.existsSync(FILE)) {
  console.error('\n!! no existe ' + FILE);
  console.error('   corre el script desde el repo, con la ruta tal cual:');
  console.error('   node fuente-y-build/build/patch-tags-duplicados.mjs');
  process.exit(1);
}

/* ------------------------------------------------- LEER Y NORMALIZAR EOL --- */
const crudo = fs.readFileSync(FILE, 'utf8');
const bom = crudo.charCodeAt(0) === 0xfeff ? '\ufeff' : '';
const sinBom = bom ? crudo.slice(1) : crudo;
const crlf = sinBom.includes('\r\n');
const original = crlf ? sinBom.replace(/\r\n/g, '\n') : sinBom;

const restaurarEol = (s) => bom + (crlf ? s.replace(/\n/g, '\r\n') : s);

console.log('lineas  :', original.split('\n').length);
console.log('EOL     :', crlf ? 'CRLF (Windows), se preserva' : 'LF', bom ? '+ BOM' : '');

/* ------------------------------------------------------------ IDEMPOTENCIA - */
if (original.includes('dedupeTags(')) {
  console.log('\n== YA APLICADO ==');
  console.log('build-corpus.mjs ya deduplica los tags al fusionar. No se toco nada.');
  process.exit(0);
}

/* -------------------------------------------------------------- PRE-FLIGHT - */
const VIEJO_MERGE = [
  '    // dos parrafos con tags propios pueden terminar en la misma unidad final:',
  '    // se acumulan todos, no se pisan.',
  '    prev.tags = [...(prev.tags || []), ...(u.tags || [])];',
].join('\n');

const NUEVO_MERGE = [
  '    // dos parrafos con tags propios pueden terminar en la misma unidad final:',
  '    // se acumulan todos, no se pisan, pero se deduplican: parse.js deja el',
  '    // tag del parrafo vigente en cada linea fisica del bloque, asi que al',
  '    // volver a fusionar esas lineas aca el mismo tag entraba una vez por',
  '    // linea (hasta x5 en EN.I.4.d).',
  '    prev.tags = dedupeTags([...(prev.tags || []), ...(u.tags || [])]);',
].join('\n');

const ANCLA_HELPER = '// 1. dividir largos';

const HELPER = [
  '/* dedupeTags - un tag no aporta nada dos veces en el mismo pasaje.',
  ' *',
  ' * parse.js deja el tag del parrafo vigente en TODAS las lineas fisicas del',
  ' * bloque, y eso esta bien: un parrafo puede repartirse en dos pasajes finales',
  ' * y los dos tienen que quedar tagueados (EN.I.8.b y EN.I.8.c salen del parrafo',
  ' * 30 y los dos necesitan el split de arete). El problema aparece cuando esas',
  ' * lineas se vuelven a fusionar en un mismo pasaje: ahi el tag se repite una vez',
  ' * por linea. Se compara por clave canonica, con las claves ordenadas, para que',
  ' * el orden en que se escribio el tag en el .txt no cuente como diferencia.',
  ' */',
  'const canonTag = (v) => {',
  "  if (Array.isArray(v)) return '[' + v.map(canonTag).join(',') + ']';",
  "  if (v && typeof v === 'object') {",
  "    return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canonTag(v[k])).join(',') + '}';",
  '  }',
  '  return JSON.stringify(v);',
  '};',
  '',
  'function dedupeTags(tags) {',
  '  const vistos = new Set();',
  '  const out = [];',
  '  for (const t of tags || []) {',
  '    const k = canonTag(t);',
  '    if (vistos.has(k)) continue;',
  '    vistos.add(k);',
  '    out.push(t);',
  '  }',
  '  return out;',
  '}',
  '',
  ANCLA_HELPER,
].join('\n');

const LINEA_MERGE = '    prev.tags = [...(prev.tags || []), ...(u.tags || [])];';

const cuenta = (s, sub) => s.split(sub).length - 1;
const errores = [];

if (cuenta(original, VIEJO_MERGE) !== 1) {
  errores.push('el bloque prev.tags del chunker (3 lineas) no aparece exactamente 1 vez (aparece ' + cuenta(original, VIEJO_MERGE) + ')');
}
if (cuenta(original, ANCLA_HELPER) !== 1) {
  errores.push('el comentario "' + ANCLA_HELPER + '" no aparece exactamente 1 vez (aparece ' + cuenta(original, ANCLA_HELPER) + ')');
}
if (cuenta(original, 'canonTag') !== 0) {
  errores.push('ya existe algo llamado canonTag: hay que revisar a mano para no pisarlo');
}

if (errores.length) {
  console.error('\n!! PRE-FLIGHT FALLIDO: no se modifico nada.');
  errores.forEach((e) => console.error('   - ' + e));

  // diagnostico, para no quedar a ciegas
  console.error('\n   DIAGNOSTICO');
  console.error('   - EOL detectado          : ' + (crlf ? 'CRLF' : 'LF'));
  console.error('   - la linea de prev.tags sola aparece ' + cuenta(original, LINEA_MERGE) + ' vez/veces');
  console.error('   - menciones a "prev.tags": ' + cuenta(original, 'prev.tags'));
  const lineas = original.split('\n');
  const i = lineas.findIndex((l) => l.includes('prev.tags = ['));
  if (i >= 0) {
    console.error('   - contexto real en la linea ' + (i + 1) + ':');
    for (let j = Math.max(0, i - 3); j <= Math.min(lineas.length - 1, i + 1); j++) {
      console.error('     ' + String(j + 1).padStart(4) + ' | ' + JSON.stringify(lineas[j]));
    }
    console.error('\n   Si esas lineas no son identicas a lo que este patch espera, pegalas');
    console.error('   en el chat y ajustamos el patron.');
  } else {
    console.error('   - no se encontro ninguna linea con "prev.tags = [": revisar el archivo.');
  }
  process.exit(1);
}

/* ------------------------------------------------------------------ PARCHE - */
let out = original;
out = out.replace(VIEJO_MERGE, NUEVO_MERGE);
out = out.replace(ANCLA_HELPER, HELPER);

/* ------------------------------------------------------------ VERIFICACION - */
const post = [];
if (cuenta(out, 'function dedupeTags') !== 1) post.push('no quedo exactamente 1 definicion de dedupeTags');
if (cuenta(out, 'prev.tags = dedupeTags(') !== 1) post.push('el chunker no quedo usando dedupeTags');
if (cuenta(out, '// 1. dividir largos') !== 1) post.push('se duplico o se perdio el ancla "// 1. dividir largos"');
if (out.indexOf('function dedupeTags') > out.indexOf('prev.tags = dedupeTags(')) post.push('dedupeTags quedo definida despues de su uso');
if (!out.includes('syncEngine(ROOT)')) post.push('se perdio la llamada a syncEngine');
if (!out.includes("path.join(OUT, 'corpus.json')")) post.push('se perdio la escritura de corpus.json');
if (!out.includes("path.join(OUT, 'glossary.json')")) post.push('se perdio la escritura de glossary.json');

if (post.length) {
  console.error('\n!! VERIFICACION POST-PARCHE FALLIDA: no se escribio nada.');
  post.forEach((e) => console.error('   - ' + e));
  process.exit(1);
}

const BAK = FILE + '.bak';
fs.writeFileSync(BAK, crudo);            // backup byte por byte, con su EOL original
fs.writeFileSync(FILE, restaurarEol(out));

console.log('\n== PARCHE APLICADO ==');
console.log('  backup  :', BAK);
console.log('  cambio 1: se agrego dedupeTags() antes del chunker');
console.log('  cambio 2: el merge de unidades cortas ahora deduplica los tags');
console.log('\nSIGUIENTE PASO:');
console.log('  1) node fuente-y-build/build/build-corpus.mjs');
console.log('     esperado: 72 pasajes, 35 con tags, roles faq 21 / define 10 / afirma 7');
console.log('  2) node fuente-y-build/build/check-tags-duplicados.mjs');
console.log('     esperado: "ninguno. OK" y salida 0');