/**
 * Diagnostico del indice que arma vectorize.js a partir de lexicon.js.
 *
 * Muestra las tres cosas que el build NO reporta y que se rompen en silencio:
 *   1. terminos DESCARTADOS por duplicado (dos entradas que piden el mismo
 *      token dentro de un mismo eje: la guarda usa un Set por EJE, asi que
 *      dos sentidos distintos del mismo eje se pisan entre si)
 *   2. frases que COLAPSAN a un solo token al sacar stopwords ('en acto' -> acto)
 *   3. cuantos terminos quedaron efectivamente en el indice por eje y sentido,
 *      con aviso si algun sentido quedo vacio
 *
 * Uso, desde la raiz del repo:
 *   node check-lexicon.mjs                    // usa server/public/js
 *   node check-lexicon.mjs fuente-y-build/src // otra carpeta
 */
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const dir = process.argv[2] || path.join('server', 'public', 'js')
const load = (f) => import(pathToFileURL(path.resolve(dir, f)).href)

const V = await load('vectorize.js')
const L = await load('lexicon.js')
const { AXES } = L

const axisId = (i) => (AXES[i] ? AXES[i].id : '?' + i)

console.log(`lexicon: ${path.resolve(dir, 'lexicon.js')}`)
console.log(`ejes: ${AXES.length}  (DIM del vector: ${V.DIM})`)

/* ------------------------------------------------ 1. terminos descartados */

const dup = V.duplicateTerms()
console.log(`\n=== TERMINOS DESCARTADOS POR DUPLICADO: ${dup.length} ===`)
if (dup.length === 0) {
	console.log('  (ninguno)')
} else {
	for (const d of dup) {
		console.log(`  ${d.axis.padEnd(12)} "${d.term}" -> token "${d.token}" YA OCUPADO, se descarta`)
	}
}

/* ------------------------------------------------ 2. frases que colapsan */

const col = V.collapsedTerms()
console.log(`\n=== FRASES QUE COLAPSAN A UN SOLO TOKEN: ${col.length} ===`)
if (col.length === 0) {
	console.log('  (ninguna)')
} else {
	for (const c of col) {
		console.log(`  ${c.axis.padEnd(12)} "${c.term}" -> "${c.token}"`)
	}
}

/* ------------------------- 3. terminos efectivos por eje y por sentido */

const counts = new Map()
const bump = (key, canal) => {
	if (!counts.has(key)) counts.set(key, { es: 0, gr: 0, gx: 0, gw: 0 })
	counts.get(key)[canal] += 1
}

const maps = [
	['es', V.INDEX.esUni],
	['es', V.INDEX.esPhr],
	['gr', V.INDEX.grUni],
	['gr', V.INDEX.grPhr],
	['gx', V.INDEX.gxUni],
	['gx', V.INDEX.gxPhr],
	['gw', V.INDEX.gwUni],
	['gw', V.INDEX.gwPhr],
]

for (const [canal, map] of maps) {
	for (const entries of map.values()) {
		for (const e of entries) {
			bump(axisId(e.axis) + '\u0000' + (e.sense || ''), canal)
		}
	}
}

console.log('\n=== TERMINOS EN EL INDICE DEL CORPUS (sin aliases) ===')
console.log('eje / sentido                        es   gr   gx   gw')

let vacios = 0
for (const ax of AXES) {
	const base = counts.get(ax.id + '\u0000' + '') || { es: 0, gr: 0, gx: 0, gw: 0 }
	const senses = ax.senses || []
	const marca = senses.length ? ' (neutro)' : ''
	console.log(
		`${(ax.id + marca).padEnd(34)} ${String(base.es).padStart(4)} ${String(base.gr).padStart(4)} ${String(base.gx).padStart(4)} ${String(base.gw).padStart(4)}`,
	)
	for (const sn of senses) {
		const c = counts.get(ax.id + '\u0000' + sn.id) || { es: 0, gr: 0, gx: 0, gw: 0 }
		const total = c.es + c.gr + c.gx + c.gw
		const w = sn.weight == null ? 1 : sn.weight
		const aviso = total === 0 ? '   <-- VACIO' : ''
		if (total === 0) vacios += 1
		console.log(
			`  = ${(sn.id + ' (w ' + w + ')').padEnd(30)} ${String(c.es).padStart(4)} ${String(c.gr).padStart(4)} ${String(c.gx).padStart(4)} ${String(c.gw).padStart(4)}${aviso}`,
		)
	}
}

console.log('')
if (vacios > 0) {
	console.log(`ATENCION: ${vacios} sentido(s) sin ningun termino en el indice.`)
	console.log('Casi siempre es un duplicado: otro sentido del mismo eje ya reclamo ese token.')
} else {
	console.log('Ningun sentido quedo vacio.')
}
console.log('Nota: los listados 1 y 2 corresponden al ultimo indice construido,')
console.log('que es el de CONSULTA (incluye aliases). El conteo 3 es el del CORPUS.')
