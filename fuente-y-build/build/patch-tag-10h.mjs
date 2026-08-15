import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function hallarRaiz() {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, 'fuente-y-build'))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error('no encontre fuente-y-build subiendo 6 niveles desde ' + path.dirname(fileURLToPath(import.meta.url)));
}

const ROOT = hallarRaiz();
const SRC_DIR = path.join(ROOT, 'fuente-y-build');

const candidatos = fs.readdirSync(SRC_DIR).filter((f) => f.endsWith('.txt'));
if (candidatos.length !== 1) {
  console.log('PRE-FLIGHT FALLIDO: se esperaba exactamente un .txt en ' + SRC_DIR + ', se encontraron ' + candidatos.length);
  process.exit(1);
}
const TXT = path.join(SRC_DIR, candidatos[0]);

function leer(f) {
  const raw = fs.readFileSync(f, 'utf8');
  const esCRLF = raw.includes('\r\n');
  const lf = raw.replace(/\r\n/g, '\n');
  return { lf, esCRLF };
}

function escribir(f, lf, esCRLF) {
  const salida = esCRLF ? lf.replace(/\n/g, '\r\n') : lf;
  fs.writeFileSync(f, salida, 'utf8');
}

const { lf: txt, esCRLF: txtCRLF } = leer(TXT);

console.log('fuente: ' + TXT);
console.log('fin de linea: ' + (txtCRLF ? 'CRLF' : 'LF') + ' (se preserva)');

const M = '{ "parrafo_nro": 39 }';
const N = '{ "parrafo_nro": 39, "tags": [{"eje": "teleios", "sentido": "integro", "peso_sentido": 1}] }';

if (txt.indexOf(N) !== -1) {
  console.log('ya estaba aplicado, no hago nada.');
  process.exit(0);
}

function contar(hay, buscado) {
  return hay.split(buscado).length - 1;
}

const cuenta = contar(txt, M);
if (cuenta !== 1) {
  console.log('PRE-FLIGHT FALLIDO: la marca del parrafo 39 aparece ' + cuenta + ' veces (esperaba 1). No escribi nada.');
  process.exit(1);
}

console.log('AVISO: el parrafo 39 alimenta a 10.f, 10.g y 10.h. El tag caera en los tres.');

const nuevo = txt.split(M).join(N);

const backup = TXT + '.bak-' + Date.now();
fs.writeFileSync(backup, fs.readFileSync(TXT));
escribir(TXT, nuevo, txtCRLF);

const verif = leer(TXT);
const cuentaFinal = contar(verif.lf, N);
if (cuentaFinal !== 1) {
  fs.writeFileSync(TXT, fs.readFileSync(backup));
  console.log('VERIFICACION FALLIDA: se restauro el backup. No quedaron cambios.');
  process.exit(1);
}

console.log('+ tag "integro" (peso 1) en el parrafo 39 de teleios');
console.log('ok ' + candidatos[0] + '   (backup ' + path.basename(backup) + ')');
console.log('');
console.log('Ahora:');
console.log('node fuente-y-build/build/build-corpus.mjs   -> deberia sumar teleios = integro (contar cuantas veces)');
console.log('node fuente-y-build/build/regresion.mjs      -> mirar el diff ANTES de --guardar');