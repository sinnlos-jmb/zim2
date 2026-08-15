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
const LEX = path.join(SRC_DIR, 'src', 'lexicon.js');

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
  fs.writeFileSync(f, esCRLF ? lf.replace(/\n/g, '\r\n') : lf, 'utf8');
}
function contar(hay, buscado) {
  return hay.split(buscado).length - 1;
}

const { lf: lexTxt, esCRLF: lexCRLF } = leer(LEX);
const { lf: txt, esCRLF: txtCRLF } = leer(TXT);

console.log('lexicon: ' + LEX);
console.log('fuente : ' + TXT);
console.log('fin de linea: lexicon ' + (lexCRLF ? 'CRLF' : 'LF') + ', txt ' + (txtCRLF ? 'CRLF' : 'LF') + ' (se preservan)');
console.log('');

// --- 1) mover la ultima expresion de integro.grExpr a relativo.grExpr (teleios) ---
// Se hace por extraccion/cirugia de indices, nunca transcribiendo el griego a mano.
function extraerBloque(texto, marcaId) {
  const iId = texto.indexOf(marcaId);
  if (iId === -1) return null;
  const iArr = texto.indexOf('grExpr: [', iId);
  if (iArr === -1) return null;
  const iOpen = iArr + 'grExpr: ['.length - 1;
  const iClose = texto.indexOf(']', iOpen);
  return { iOpen, iClose, contenido: texto.slice(iOpen, iClose + 1) };
}
function items(arrText) {
  const out = [];
  const re = /'([^']+)'/g;
  let m;
  while ((m = re.exec(arrText))) out.push(m[1]);
  return out;
}

const integroAntes = extraerBloque(lexTxt, "id: 'integro'");
const relativoAntes = extraerBloque(lexTxt, "id: 'relativo'");

let lexYaAplicado = false;
let lexPreFlightOk = true;
let nuevoLex = lexTxt;
let ultimoMovido = null;

if (!integroAntes || !relativoAntes) {
  console.log('PRE-FLIGHT FALLIDO: no encontre los bloques grExpr de integro/relativo en teleios.');
  lexPreFlightOk = false;
} else {
  const itemsIntegro = items(integroAntes.contenido);
  const itemsRelativo = items(relativoAntes.contenido);
  if (itemsIntegro.length === 5 && itemsRelativo.length === 2) {
    lexYaAplicado = true;
  } else if (itemsIntegro.length !== 6 || itemsRelativo.length !== 1) {
    console.log('PRE-FLIGHT FALLIDO: esperaba 6 items en integro y 1 en relativo, encontre ' + itemsIntegro.length + ' y ' + itemsRelativo.length + '.');
    lexPreFlightOk = false;
  } else {
    ultimoMovido = itemsIntegro[itemsIntegro.length - 1];
    const nuevosIntegro = itemsIntegro.slice(0, -1);
    const nuevoArrIntegro = "[" + nuevosIntegro.map((s) => "'" + s + "'").join(', ') + "]";
    const nuevosRelativo = [...itemsRelativo, ultimoMovido];
    const nuevoArrRelativo = "[" + nuevosRelativo.map((s) => "'" + s + "'").join(', ') + "]";

    let resultado = lexTxt.slice(0, integroAntes.iOpen) + nuevoArrIntegro + lexTxt.slice(integroAntes.iClose + 1);
    const delta = nuevoArrIntegro.length - integroAntes.contenido.length;
    const relOpenAjustado = relativoAntes.iOpen + delta;
    const relCloseAjustado = relativoAntes.iClose + delta;
    resultado = resultado.slice(0, relOpenAjustado) + nuevoArrRelativo + resultado.slice(relCloseAjustado + 1);
    nuevoLex = resultado;
  }
}

// --- 2) tags manuales en el .txt ---
const TXT_M14 = '{ "parrafo_nro": 14 }';
const TXT_N14 = '{ "parrafo_nro": 14, "tags": [{"eje": "idea", "sentido": "categorial", "peso_sentido": 1}] }';

const TXT_M21 = '{ "parrafo_nro": 21 }';
const TXT_N21 = '{ "parrafo_nro": 21, "tags": [{"eje": "idea", "sentido": "separada", "peso_sentido": 1}] }';

const TXT_M38 = '{ "parrafo_nro": 38 }';
const TXT_N38 = '{ "parrafo_nro": 38, "tags": [{"eje": "arete", "sentido": "etica", "peso_sentido": 0.5}, {"eje": "arete", "sentido": "dianoetica", "peso_sentido": 0.5}] }';

const TXT_M39 = '{ "parrafo_nro": 39, "tags": [{"eje": "teleios", "sentido": "integro", "peso_sentido": 1}] }';
const TXT_N39 = '{ "parrafo_nro": 39, "tags": [{"eje": "teleios", "sentido": "integro", "peso_sentido": 1}, {"eje": "arete", "sentido": "etica", "peso_sentido": 1}] }';

const txtYaAplicado =
  txt.indexOf(TXT_N14) !== -1 &&
  txt.indexOf(TXT_N21) !== -1 &&
  txt.indexOf(TXT_N38) !== -1 &&
  txt.indexOf(TXT_N39) !== -1;

if (lexYaAplicado && txtYaAplicado) {
  console.log('ya estaba todo aplicado, no hago nada.');
  process.exit(0);
}

const checksTxt = [
  ['txt: parrafo 14 (6.b)', txt, TXT_M14],
  ['txt: parrafo 21 (6.h/6.i)', txt, TXT_M21],
  ['txt: parrafo 38 (10.c/10.d/10.e)', txt, TXT_M38],
  ['txt: parrafo 39 (10.f/10.g/10.h)', txt, TXT_M39],
];
let txtPreFlightOk = true;
if (!txtYaAplicado) {
  for (const [nombre, hay, buscado] of checksTxt) {
    const c = contar(hay, buscado);
    if (c !== 1) {
      console.log('PRE-FLIGHT FALLIDO en "' + nombre + '": aparece ' + c + ' veces (esperaba 1).');
      txtPreFlightOk = false;
    }
  }
}

if (!lexPreFlightOk || !txtPreFlightOk) {
  console.log('No escribi nada.');
  process.exit(1);
}

if (ultimoMovido) {
  console.log('moviendo de integro a relativo: "' + ultimoMovido + '"');
}
console.log('AVISO: parrafo 38 alimenta a 10.c, 10.d y 10.e -> los tres reciben arete mezcla 50/50 (etica/dianoetica).');
console.log('AVISO: parrafo 39 alimenta a 10.f, 10.g y 10.h -> arete:etica se suma junto al teleios:integro ya existente.');
console.log('AVISO: parrafo 21 alimenta a 6.h y 6.i -> ambos reciben idea:separada.');
console.log('AVISO: parrafo 14 (6.b) no es compartido.');
console.log('');

const nuevoTxt = txtYaAplicado ? txt : txt
  .split(TXT_M14).join(TXT_N14)
  .split(TXT_M21).join(TXT_N21)
  .split(TXT_M38).join(TXT_N38)
  .split(TXT_M39).join(TXT_N39);

const backupLex = LEX + '.bak-' + Date.now();
const backupTxt = TXT + '.bak-' + Date.now();
fs.writeFileSync(backupLex, fs.readFileSync(LEX));
fs.writeFileSync(backupTxt, fs.readFileSync(TXT));

if (!lexYaAplicado) escribir(LEX, nuevoLex, lexCRLF);
if (!txtYaAplicado) escribir(TXT, nuevoTxt, txtCRLF);

// verificacion
const verifLex = leer(LEX);
const verifTxt = leer(TXT);
const verifIntegro = extraerBloque(verifLex.lf, "id: 'integro'");
const verifRelativo = extraerBloque(verifLex.lf, "id: 'relativo'");
const verifOkLex = verifIntegro && verifRelativo && items(verifIntegro.contenido).length === 5 && items(verifRelativo.contenido).length === 2;
const verifOkTxt =
  contar(verifTxt.lf, TXT_N14) === 1 &&
  contar(verifTxt.lf, TXT_N21) === 1 &&
  contar(verifTxt.lf, TXT_N38) === 1 &&
  contar(verifTxt.lf, TXT_N39) === 1;

if (!verifOkLex || !verifOkTxt) {
  fs.writeFileSync(LEX, fs.readFileSync(backupLex));
  fs.writeFileSync(TXT, fs.readFileSync(backupTxt));
  console.log('VERIFICACION FALLIDA: se restauraron ambos backups. No quedaron cambios.');
  process.exit(1);
}

console.log('+ movido el ultimo grExpr de integro a relativo en teleios (lexicon.js)');
console.log('+ tag idea:categorial (peso 1) en el parrafo 14 (6.b)');
console.log('+ tag idea:separada (peso 1) en el parrafo 21 (6.h/6.i)');
console.log('+ tag arete mezcla 50/50 etica/dianoetica en el parrafo 38 (10.c/10.d/10.e)');
console.log('+ tag arete:etica (peso 1) sumado en el parrafo 39 (10.f/10.g/10.h)');
console.log('ok ' + path.basename(LEX) + '   (backup ' + path.basename(backupLex) + ')');
console.log('ok ' + path.basename(TXT) + '   (backup ' + path.basename(backupTxt) + ')');
console.log('');
console.log('Ahora:');
console.log('node fuente-y-build/build/check-lexicon.mjs   -> 26 ejes, 0 duplicados');
console.log('node fuente-y-build/build/build-corpus.mjs');
console.log('node fuente-y-build/build/regresion.mjs       -> mirar el diff ANTES de --guardar');