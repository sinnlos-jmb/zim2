#!/usr/bin/env node
/* patch-lexicon-5.mjs - 'razon' pasa de es[] a aliases[] en el eje logos
 *
 * QUE HACE
 * Dos lineas del eje 'logos'. El termino castellano 'razon' (peso 0.3) sale
 * de ax.es y entra en ax.aliases, con el mismo peso 0.3.
 *
 * POR QUE
 * buildIndex() solo carga ax.aliases cuando withAliases=true, es decir en
 * INDEX_Q (el indice de la CONSULTA) y nunca en INDEX (el de los PASAJES).
 * Estando en 'es', 'razon' entraba en el vector de todo pasaje que dijera
 * "con razon" / "por esta razon" / "muchas razones", que son modismos de la
 * traduccion y no usos de logos. Dos consecuencias medidas:
 *   1. Con peso 0.3 le ganaba a 'nuestro razonamiento' (0.5 * 0.4 = 0.2),
 *      el termino preciso del sentido 'argumento'.
 *   2. Como no vota ningun sentido, esos pasajes quedaban sin mezcla en el
 *      eje; senseAgreement() devuelve null cuando falta un lado, no entra en
 *      el promedio y senseFactor queda en 1: eran INMUNES al filtro de
 *      acepcion, mientras que los pasajes bien etiquetados si se relegaban.
 * Como alias, "razon" se sigue pudiendo escribir en el buscador con el mismo
 * peso, y deja de contaminar los vectores del corpus.
 *
 * OJO: esto SI cambia los vectores de los pasajes (a diferencia del parche 4).
 * Despues de aplicarlo hay que reconstruir el indice con el boton
 * "Reconstruir indice" del pie de pagina, o vaciar el cache del navegador.
 *
 * COMO SE CORRE, desde la raiz del repo:
 *   node fuente-y-build/build/patch-lexicon-5.mjs
 *
 * Valida los dos archivos ANTES de escribir ninguno: si un anclaje no aparece
 * exactamente una vez, no toca nada. Respeta el fin de linea de cada archivo
 * y deja respaldo .bak5. Correrlo dos veces aborta la segunda.
 */
import fs from 'node:fs'
import path from 'node:path'

const PATHS = ['server/public/js/lexicon.js', 'fuente-y-build/src/lexicon.js']

const EDITS = [
  {
    line: 267,
    desc: "aliases del eje logos: entra ['razon', 0.3]",
    old: "    aliases: ['logos'],",
    new: "    aliases: ['logos', ['razon', 0.3]],",
  },
  {
    line: 269,
    desc: "sale la linea es: [['razon', 0.3]] y se reescribe su comentario",
    old: [
      "    // 'razon' se declara en el EJE y no dentro de un sentido. esStem() corta",
      "    // el sufijo -amiento, asi que esTokens('razonamiento') devuelve ['razon']:",
      "    // el castellano NO puede separar la facultad del argumento. Declarado",
      "    // aca el termino enciende el eje sin votar por ningun sentido",
      "    // (senseMixFromHits saltea los hits sin sense) y la acepcion queda en",
      "    // manos de las formas griegas, que si son inequivocas.",
      "    // Si viviera dentro de un sentido, el OTRO sentido perderia su termino",
      "    // castellano en silencio: la guarda DUPLICATE_TERMS de buildIndex usa un",
      "    // solo Set por eje, compartido por todos sus sentidos.",
      "    es: [['razon', 0.3]],",
    ].join('\n'),
    new: [
      "    // 'razon' vive en los ALIAS del eje y ya no en 'es'. buildIndex solo",
      "    // carga ax.aliases con withAliases=true, o sea en INDEX_Q (la consulta)",
      "    // y nunca en INDEX (los pasajes): se lo puede seguir escribiendo en el",
      "    // buscador, pero deja de entrar en el vector de cada pasaje.",
      "    // Estaba en 'es' con peso 0.3 y era un detector de modismos de la",
      "    // traduccion (\"con razon\" 1.a, \"por esta razon\" 4.b, \"muchas razones\"",
      "    // 6.a). Con 0.3 le ganaba a 'nuestro razonamiento' (0.5 * 0.4 = 0.2), el",
      "    // termino preciso del sentido. Y como no vota ningun sentido, esos",
      "    // pasajes quedaban sin mezcla en el eje: senseAgreement devuelve null,",
      "    // no entra en el promedio y senseFactor queda en 1. Eran inmunes al",
      "    // filtro de acepcion justo los que entraban por un modismo.",
      "    // Sigue sin sentido asignado a proposito: esStem() corta el sufijo",
      "    // -amiento, asi que esTokens('razonamiento') devuelve ['razon'] y el",
      "    // castellano no puede separar la facultad del argumento. Esa distincion",
      "    // queda en manos de las formas griegas, que si son inequivocas.",
      "    // Si viviera dentro de un sentido, el OTRO sentido perderia su termino",
      "    // castellano en silencio: la guarda DUPLICATE_TERMS de buildIndex usa un",
      "    // solo Set por eje, compartido por todos sus sentidos.",
    ].join('\n'),
  },
]

/* ---------- fase 1: validar TODO antes de escribir NADA ---------- */
const plan = []
let fail = false

for (const rel of PATHS) {
  const abs = path.resolve(rel)
  if (!fs.existsSync(abs)) {
    console.log('FALTA  ' + rel + '  (no existe; se corre desde la raiz del repo?)')
    fail = true
    continue
  }
  const raw = fs.readFileSync(abs, 'utf8')
  const crlf = raw.includes('\r\n')
  const src = raw.replace(/\r\n/g, '\n')
  const bad = []
  for (const e of EDITS) {
    const n = src.split(e.old).length - 1
    if (n !== 1) bad.push('   [' + n + ' apariciones, se esperaba 1] linea ' + e.line + '  ' + e.desc)
  }
  if (bad.length) {
    console.log('MAL    ' + rel)
    for (const b of bad) console.log(b)
    fail = true
  } else {
    plan.push({ rel, abs, raw, crlf, src })
    console.log('listo  ' + rel + '  (' + EDITS.length + ' anclajes verificados, ' + (crlf ? 'CRLF' : 'LF') + ')')
  }
}

if (fail) {
  console.log('')
  console.log('ABORTADO. No se escribio NADA en ningun archivo.')
  console.log('Si ya lo habias corrido, esto es lo esperable: el parche 5 no se aplica dos veces.')
  process.exit(1)
}

/* ---------- fase 2: escribir ---------- */
console.log('')
for (const f of plan) {
  let out = f.src
  for (const e of EDITS) out = out.replace(e.old, () => e.new)

  const axes = (out.match(/^    id: '/gm) || []).length
  if (axes !== 26) {
    console.log('ABORTADO en ' + f.rel + ': quedaron ' + axes + ' ejes en vez de 26. No se escribio.')
    process.exit(1)
  }
  if (out.includes("    es: [['razon', 0.3]],")) {
    console.log('ABORTADO en ' + f.rel + ": 'razon' sigue en es[]. No se escribio.")
    process.exit(1)
  }
  if (!out.includes("    aliases: ['logos', ['razon', 0.3]],")) {
    console.log('ABORTADO en ' + f.rel + ": 'razon' no quedo en aliases[]. No se escribio.")
    process.exit(1)
  }

  fs.copyFileSync(f.abs, f.abs + '.bak5')
  const final = f.crlf ? out.replace(/\n/g, '\r\n') : out
  fs.writeFileSync(f.abs, final)
  console.log('OK ' + f.rel)
  console.log('   fin de linea: ' + (f.crlf ? 'CRLF' : 'LF') + ' (respetado)')
  console.log('   respaldo: ' + f.rel + '.bak5')
  console.log('   ' + Buffer.byteLength(f.raw) + ' bytes -> ' + Buffer.byteLength(final) + ' bytes')
  console.log('')
}

console.log('Listo: ' + plan.length + ' archivos.')
console.log('')
console.log('IMPORTANTE: este parche SI cambia los vectores de los pasajes.')
console.log('Abri el sitio y toca "Reconstruir indice" en el pie de pagina (o Ctrl+F5')
console.log('y reconstruir) para que el cache deje de servir los vectores viejos.')
