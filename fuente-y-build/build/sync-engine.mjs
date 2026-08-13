import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* sync-engine.mjs - fuente-y-build/src/ es la UNICA fuente de verdad del
 * motor, la UI y sus estilos. server/public/{js,css}/ son copias derivadas
 * que el servidor sirve al navegador: nunca se editan a mano, se regeneran
 * aca. Antes de esto la duplicacion era manual (el parche 6 tuvo que tocar
 * 4 copias para editar 2 archivos); este script la vuelve automatica.
 *
 * Copia byte a byte, sin normalizar fin de linea: si el original esta en
 * CRLF, la copia tambien queda en CRLF.
 *
 * Uso:
 *   node fuente-y-build/build/sync-engine.mjs
 */
export const TARGETS = [
  { from: 'js', to: path.join('server', 'public', 'js'), files: ['lexicon.js', 'normalize.js', 'panels.js', 'shell.js', 'ui.js', 'vectorize.js'] },
  { from: 'css', to: path.join('server', 'public', 'css'), files: ['app.css', 'shell.css'] },
];

export function syncEngine(root) {
  const result = { copiados: [], iguales: [] };
  for (const t of TARGETS) {
    const SRC_DIR = t.from === 'js' ? path.join(root, 'fuente-y-build', 'src') : path.join(root, 'fuente-y-build', 'src', 'css');
    const DEST_DIR = path.join(root, t.to);
    for (const f of t.files) {
      const from = path.join(SRC_DIR, f);
      const to = path.join(DEST_DIR, f);
      const a = fs.readFileSync(from, 'utf8');
      const b = fs.existsSync(to) ? fs.readFileSync(to, 'utf8') : null;
      const label = path.join(t.to, f);
      if (a === b) { result.iguales.push(label); continue; }
      fs.writeFileSync(to, a);
      result.copiados.push(label);
    }
  }
  return result;
}

function isMain() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMain()) {
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const { copiados, iguales } = syncEngine(ROOT);
  console.log('=== SINCRONIZACION (fuente-y-build/src -> server/public) ===');
  for (const f of iguales) console.log('  igual   : ' + f);
  for (const f of copiados) console.log('  copiado : ' + f);
  console.log(`\ncopiados ${copiados.length}  iguales ${iguales.length}  total ${copiados.length + iguales.length}`);
}