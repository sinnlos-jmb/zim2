// patch-auditar-sentidos.mjs - reescribe la seccion 5 de auditar-sentidos.mjs
// para que coincida con applySenseTags real (post-parche-6): ya no hay
// anulacion "sin pedirlo", solo tags con sentido en {ninguno,neutral,sin_sentido}
// anulan a proposito. Ademas lista, por separado, los tags de eje SIN 'sentido'
// sobre ejes polisemicos como INERTES (no fijan ni anulan nada), en vez de
// reportarlos como colaterales.
//
// Estrategia de matching: por LINEAS, anclado a la linea de apertura y a la
// linea de cierre de la seccion 5 (ambas sin comillas dificiles de escapar).
// No se intenta matchear el contenido intermedio byte a byte: se reemplaza
// todo el rango [inicio, fin] inclusive.
//
// Idempotente: si ya corrio, no vuelve a tocar el archivo.
// Tolerante a CRLF/LF/BOM (Windows/Unix).
//
// Uso: node build/patch-auditar-sentidos.mjs [ruta/a/auditar-sentidos.mjs]

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ruta = process.argv[2] || fileURLToPath(new URL('./auditar-sentidos.mjs', import.meta.url));

const crudo = fs.readFileSync(ruta, 'utf8');
const bom = crudo.charCodeAt(0) === 0xFEFF;
const sinBom = bom ? crudo.slice(1) : crudo;
const crlf = sinBom.includes('\r\n');
const normalizado = sinBom.replace(/\r\n/g, '\n');

const MARCA_APLICADO = 'ANULACIONES EXPLICITAS DE ACEPCION';
if (normalizado.includes(MARCA_APLICADO)) {
  console.log('Ya aplicado (encontre la marca de la version nueva). No se modifico nada.');
  process.exit(0);
}

const lineas = normalizado.split('\n');

const ANCLA_INICIO = '/* ---------------------------------------------------- 5. COLATERAL ----------- */';
const ANCLA_FIN = "if (!colateral) console.log('  ninguno.');";

const idxInicio = [];
const idxFin = [];
lineas.forEach((l, i) => {
  if (l.trim() === ANCLA_INICIO) idxInicio.push(i);
  if (l.trim() === ANCLA_FIN) idxFin.push(i);
});

if (idxInicio.length !== 1 || idxFin.length !== 1 || idxFin[0] <= idxInicio[0]) {
  console.error('!! PRE-FLIGHT FALLIDO: no se modifico nada.');
  console.error('  - EOL detectado: ' + (crlf ? 'CRLF (Windows)' : 'LF (Unix)') + (bom ? ' + BOM' : ''));
  console.error('  - ancla de inicio de la seccion 5 encontrada ' + idxInicio.length + ' vez/veces (esperado: 1)');
  console.error('  - ancla de fin de la seccion 5 encontrada ' + idxFin.length + ' vez/veces (esperado: 1)');
  if (idxInicio.length) {
    console.error('  - contexto alrededor del inicio encontrado:');
    console.error(lineas.slice(Math.max(0, idxInicio[0] - 1), idxInicio[0] + 3).join('\n'));
  }
  console.error('auditar-sentidos.mjs no es el esperado. Revisar antes de insistir.');
  process.exit(1);
}

const inicio = idxInicio[0];
const fin = idxFin[0];

const NUEVO_BLOQUE = [
  "/* ---------------------------------------------------- 5. ANULACIONES --------- */",
  "linea('=');",
  "console.log('5. ANULACIONES EXPLICITAS DE ACEPCION (revisar si son intencionales)');",
  "console.log('   Desde el parche 6, applySenseTags solo vacia la mezcla de un eje si el tag');",
  "console.log('   declara un sentido neutro (ninguno, neutral o sin_sentido). Un tag de eje');",
  "console.log('   sin sentido, por ejemplo un tag de rol como faq, ya no anula nada: queda inerte.');",
  "linea();",
  "const NEUTRO_IDS = new Set(['ninguno', 'neutral', 'sin_sentido']);",
  "let anuladas = 0;",
  "for (const p of ps) {",
  "  for (const t of p.tags || []) {",
  "    if (!t || !t.eje || !t.sentido) continue;",
  "    if (!NEUTRO_IDS.has(String(t.sentido).toLowerCase())) continue;",
  "    if (!POLI_IDS.includes(t.eje)) continue;",
  "    const habia = p.base && p.base[t.eje];",
  "    anuladas++;",
  "    console.log('  ' + p.id.padEnd(10) + 'rol ' + (t.rol || '-').padEnd(8) + ' sobre ' + t.eje.padEnd(10) +",
  "      (habia ? 'ANULA a proposito ' + JSON.stringify(habia) : 'el motor no habia deducido nada'));",
  "  }",
  "}",
  "if (!anuladas) console.log('  ninguna.');",
  "",
  "console.log();",
  "console.log('  tags de eje sin sentido sobre ejes polisemicos (inertes, no fijan ni anulan nada):');",
  "let inertes = 0;",
  "for (const p of ps) {",
  "  for (const t of p.tags || []) {",
  "    if (!t || !t.eje || t.sentido) continue;",
  "    if (!POLI_IDS.includes(t.eje)) continue;",
  "    inertes++;",
  "    console.log('    ' + p.id.padEnd(10) + 'rol ' + (t.rol || '-').padEnd(8) + ' sobre ' + t.eje.padEnd(10) +",
  "      '(revisar si le falta el campo sentido)');",
  "  }",
  "}",
  "if (!inertes) console.log('    ninguno.');",
].join('\n');

const nuevasLineas = [
  ...lineas.slice(0, inicio),
  NUEVO_BLOQUE,
  ...lineas.slice(fin + 1),
];

const parcheado = nuevasLineas.join('\n');
const final = (crlf ? parcheado.replace(/\n/g, '\r\n') : parcheado);
const salida = (bom ? '\uFEFF' : '') + final;
fs.writeFileSync(ruta, salida, 'utf8');
console.log('OK: seccion 5 reescrita en ' + ruta + ' (EOL preservado: ' + (crlf ? 'CRLF' : 'LF') + (bom ? '+BOM' : '') + ')');