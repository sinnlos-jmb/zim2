// Arma un HTML autocontenido: motor + corpus + UI inlineados.
// Sin fetch, sin bundler: funciona abriendo el archivo con doble clic (file://).
import fs from 'node:fs';
import path from 'node:path';

const SRC = '/data/en1/app/src';
const DIST = '/data/en1/app/dist';
fs.mkdirSync(DIST, { recursive: true });

// quita import/export para poder concatenar los modulos ESM en un script clasico
function plain(file) {
  return fs.readFileSync(path.join(SRC, file), 'utf8')
    .replace(/^\s*import[^;]*;\s*$/gm, '')
    .replace(/^export\s+\{[^}]*\};?\s*$/gm, '')
    .replace(/^export\s+/gm, '');
}

const engine = ['normalize.js', 'lexicon.js', 'vectorize.js'].map(plain).join('\n');
const ui = fs.readFileSync(path.join(SRC, 'ui.js'), 'utf8');
const corpus = JSON.parse(fs.readFileSync('/data/en1/app/data/corpus.json', 'utf8'));

// solo lo que la app necesita (mas liviano)
const slim = {
  version: corpus.version,
  passages: corpus.passages.map((p) => ({
    id: p.id, chapter: p.chapter, bekker: p.bekker, words: p.words,
    esOnly: p.esOnly, glosses: p.glosses, greekParallel: p.greekParallel,
    textHash: p.textHash,
  })),
};

const html = fs.readFileSync('/data/en1/app/src/index.template.html', 'utf8')
  .replace('/*__CORPUS__*/', 'const CORPUS = ' + JSON.stringify(slim) + ';')
  .replace('/*__ENGINE__*/', engine)
  .replace('/*__UI__*/', ui);

fs.writeFileSync(path.join(DIST, 'index.html'), html);
console.log('dist/index.html', (html.length / 1024).toFixed(0) + ' KB');
console.log('pasajes inlineados:', slim.passages.length);
