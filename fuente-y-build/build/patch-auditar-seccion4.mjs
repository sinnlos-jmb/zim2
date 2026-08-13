// patch-auditar-seccion4.mjs - reescribe la seccion 4 de auditar-sentidos.mjs
// para que compare MEZCLAS declaradas contra la mezcla del motor, en vez de
// evaluar cada tag por separado. Los tags de un mismo eje en un mismo pasaje
// son UNA mezcla (asi los interpreta applySenseTags), no veredictos sueltos.
//
// Sin este arreglo, en toda mezcla la mitad minoritaria "DISCREPA" por
// construccion, aunque humano y motor coincidan en el sentido dominante.
// Ademas trata el empate exacto (50/50) como categoria propia: no tiene
// dominante, asi que compararlo contra el dominante del motor no significa nada.
//
// Estrategia de matching: por LINEAS. Ancla de inicio = comentario de la
// seccion 4. Ancla de fin = el siguiente comentario de seccion (5.), que se
// conserva intacto. Sirve tanto si la seccion 5 ya fue parcheada como si no.
//
// Idempotente. Tolerante a CRLF/LF/BOM.
//
// Uso: node build/patch-auditar-seccion4.mjs [ruta/a/auditar-sentidos.mjs]

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ruta = process.argv[2] || fileURLToPath(new URL('./auditar-sentidos.mjs', import.meta.url));

const crudo = fs.readFileSync(ruta, 'utf8');
const bom = crudo.charCodeAt(0) === 0xFEFF;
const sinBom = bom ? crudo.slice(1) : crudo;
const crlf = sinBom.includes('\r\n');
const normalizado = sinBom.replace(/\r\n/g, '\n');

const MARCA_APLICADO = 'por mezcla declarada';
if (normalizado.includes(MARCA_APLICADO)) {
  console.log('Ya aplicado (encontre la marca de la version nueva). No se modifico nada.');
  process.exit(0);
}

const lineas = normalizado.split('\n');

const ANCLA_INICIO = '/* ---------------------------------------------------- 4. TAGS ---------------- */';

const idxInicio = [];
lineas.forEach((l, i) => { if (l.trim() === ANCLA_INICIO) idxInicio.push(i); });

let idxFin = -1;
if (idxInicio.length === 1) {
  for (let i = idxInicio[0] + 1; i < lineas.length; i++) {
    const t = lineas[i].trim();
    if (t.startsWith('/* -') && t.includes(' 5. ')) { idxFin = i; break; }
  }
}

if (idxInicio.length !== 1 || idxFin === -1) {
  console.error('!! PRE-FLIGHT FALLIDO: no se modifico nada.');
  console.error('  - EOL detectado: ' + (crlf ? 'CRLF (Windows)' : 'LF (Unix)') + (bom ? ' + BOM' : ''));
  console.error('  - ancla de inicio de la seccion 4 encontrada ' + idxInicio.length + ' vez/veces (esperado: 1)');
  console.error('  - comentario de la seccion 5 posterior: ' + (idxFin === -1 ? 'NO encontrado' : 'linea ' + (idxFin + 1)));
  console.error('auditar-sentidos.mjs no es el esperado. Revisar antes de insistir.');
  process.exit(1);
}

const NUEVO_BLOQUE = [
  "/* ---------------------------------------------------- 4. TAGS ---------------- */",
  "linea('=');",
  "console.log('4. TAGS MANUALES CONTRA EL MOTOR (por mezcla declarada)');",
  "console.log('   Los tags de un mismo eje en un pasaje forman UNA mezcla, no veredictos');",
  "console.log('   sueltos: asi los aplica applySenseTags. Se compara la mezcla declarada');",
  "console.log('   contra la que dedujo el motor, no tag por tag.');",
  "linea();",
  "const NEUTRO4 = new Set(['ninguno', 'neutral', 'sin_sentido']);",
  "const fmtMix = (m) => Object.entries(m).sort((a, b) => b[1] - a[1])",
  "  .map(([k, v]) => k + ' ' + (v * 100).toFixed(0) + '%').join(' / ');",
  "let nMez = 0, nCoin = 0, nDisc = 0, nMudo = 0, nEmp = 0, nDup = 0;",
  "for (const p of ps) {",
  "  const declarado = new Map();",
  "  for (const t of p.tags || []) {",
  "    if (!t || !t.eje || !t.sentido) continue;",
  "    if (NEUTRO4.has(String(t.sentido).toLowerCase())) continue;",
  "    if (!declarado.has(t.eje)) declarado.set(t.eje, new Map());",
  "    const m = declarado.get(t.eje);",
  "    if (m.has(t.sentido)) {",
  "      nDup++;",
  "      console.log('  ' + p.id.padEnd(10) + t.eje.padEnd(10) + 'tag DUPLICADO: ' + t.sentido);",
  "    }",
  "    const w = t.peso_sentido == null ? 1 : t.peso_sentido;",
  "    m.set(t.sentido, (m.get(t.sentido) || 0) + w);",
  "  }",
  "  for (const [eje, m] of declarado) {",
  "    let total = 0;",
  "    for (const v of m.values()) total += v;",
  "    const dec = {};",
  "    for (const [s, v] of m) dec[s] = total ? v / total : 0;",
  "    nMez++;",
  "    const etiq = '  ' + p.id.padEnd(10) + eje.padEnd(10) + 'declara ' + fmtMix(dec).padEnd(30);",
  "    const auto = p.base && p.base[eje];",
  "    if (!auto || !Object.keys(auto).length) {",
  "      nMudo++;",
  "      console.log(etiq + 'el motor no deduce nada (el tag es la unica fuente)');",
  "      continue;",
  "    }",
  "    const ordDec = Object.entries(dec).sort((a, b) => b[1] - a[1]);",
  "    const empate = ordDec.length > 1 && Math.abs(ordDec[0][1] - ordDec[1][1]) < 1e-9;",
  "    const domAuto = Object.entries(auto).sort((a, b) => b[1] - a[1])[0][0];",
  "    if (empate) {",
  "      nEmp++;",
  "      console.log(etiq + 'motor ' + fmtMix(auto).padEnd(30) + 'empate deliberado (sin dominante)');",
  "    } else if (ordDec[0][0] === domAuto) {",
  "      nCoin++;",
  "      console.log(etiq + 'motor ' + fmtMix(auto).padEnd(30) + 'coinciden en ' + domAuto);",
  "    } else {",
  "      nDisc++;",
  "      console.log(etiq + 'motor ' + fmtMix(auto).padEnd(30) + 'DISCREPA: el motor dice ' + domAuto);",
  "    }",
  "  }",
  "}",
  "if (!nMez) console.log('  todavia no hay tags que fijen acepcion.');",
  "else console.log('  --> ' + nMez + ' mezclas: ' + nCoin + ' coinciden en el dominante, ' +",
  "  nDisc + ' discrepan, ' + nEmp + ' empates deliberados, ' + nMudo + ' sobre ejes mudos' +",
  "  (nDup ? ' (' + nDup + ' tags duplicados)' : ''));",
  "",
].join('\n');

const nuevasLineas = [
  ...lineas.slice(0, idxInicio[0]),
  NUEVO_BLOQUE,
  ...lineas.slice(idxFin),
];

const parcheado = nuevasLineas.join('\n');
const final = (crlf ? parcheado.replace(/\n/g, '\r\n') : parcheado);
const salida = (bom ? '\uFEFF' : '') + final;
fs.writeFileSync(ruta, salida, 'utf8');
console.log('OK: seccion 4 reescrita en ' + ruta + ' (EOL preservado: ' + (crlf ? 'CRLF' : 'LF') + (bom ? '+BOM' : '') + ')');