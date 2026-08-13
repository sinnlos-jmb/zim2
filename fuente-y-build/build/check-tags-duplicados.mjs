import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* check-tags-duplicados.mjs - red de regresion.
 *
 * Lee server/public/data/corpus.json (lo que consume la app de veras) y avisa
 * si algun pasaje tiene el MISMO tag repetido dentro de su propio array.
 * Nunca deberia pasar: un tag repetido no aporta nada y, si tiene rol, la
 * misma pregunta o definicion se cuenta y se muestra dos veces.
 *
 * Sale con codigo 1 si encuentra duplicados, asi sirve de guarda antes de
 * publicar.
 *
 * Uso:
 *   node fuente-y-build/build/check-tags-duplicados.mjs
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CORPUS = path.join(ROOT, 'server', 'public', 'data', 'corpus.json');

if (!fs.existsSync(CORPUS)) {
  console.error('!! no existe ' + CORPUS + '\n   corre primero: node fuente-y-build/build/build-corpus.mjs');
  process.exit(1);
}

const { passages = [], builtAt } = JSON.parse(fs.readFileSync(CORPUS, 'utf8'));

// clave canonica: ordena las claves para que el orden de escritura del tag en
// el .txt no cambie la comparacion
const canon = (v) => {
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  }
  return JSON.stringify(v);
};

console.log('corpus  :', CORPUS);
console.log('generado:', builtAt || '(sin fecha)');
console.log('pasajes :', passages.length);

let totalTags = 0;
let conTags = 0;
const hallazgos = [];

for (const p of passages) {
  const tags = p.tags || [];
  if (tags.length) conTags += 1;
  totalTags += tags.length;
  const vistos = new Map();
  for (const t of tags) {
    const k = canon(t);
    vistos.set(k, (vistos.get(k) || 0) + 1);
  }
  for (const [k, n] of vistos) {
    if (n > 1) hallazgos.push({ id: p.id, parrafos: p.parrafoNros || [], n, tag: k });
  }
}

console.log('con tags:', conTags);
console.log('tags     :', totalTags);

console.log('\n=== TAGS REPETIDOS EN EL MISMO PASAJE ===');
if (!hallazgos.length) {
  console.log('  ninguno. OK');
  process.exit(0);
}

for (const h of hallazgos) {
  console.log(`  ${h.id} (parrafos ${JSON.stringify(h.parrafos)}) x${h.n}`);
  console.log(`     ${h.tag}`);
}
console.log(`\n!! ${hallazgos.length} tag(s) duplicado(s) en ${new Set(hallazgos.map((h) => h.id)).size} pasaje(s).`);
process.exit(1);