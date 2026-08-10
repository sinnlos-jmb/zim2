/**
 * Parche 2 de lexicon.js: corrige el colapso razon/razonamiento del parche 1.
 *
 * esStem() corta el sufijo -amiento, asi que esTokens('razonamiento') da
 * ['razon']: los dos sentidos de logos pedian el mismo token y la guarda
 * DUPLICATE_TERMS (que es por EJE, no por sentido) descartaba el segundo en
 * silencio. Resultado: el sentido 'argumento' se quedaba sin castellano.
 *
 * Uso:
 *   node patch-lexicon-2.mjs                  // parchea las dos copias del repo
 *   node patch-lexicon-2.mjs ruta/lexicon.js  // una ruta explicita
 *
 * Requiere haber corrido antes patch-lexicon.mjs. Aborta sin escribir si
 * algun anclaje no aparece exactamente una vez. Deja copia .bak2.
 */
import fs from 'node:fs'
import path from 'node:path'

const DEFAULT_PATHS = [
	path.join('fuente-y-build', 'src', 'lexicon.js'),
	path.join('server', 'public', 'js', 'lexicon.js'),
]

const EDITS = [
	{
		label: "logos: 'razon' pasa al nivel del EJE (neutro entre sentidos)",
		old: `    gr: ['\u03bd\u03bf\u1fe6\u03c2'],\n    senses: [`,
		new: `    gr: ['\u03bd\u03bf\u1fe6\u03c2'],\n    // 'razon' se declara en el EJE y no dentro de un sentido. esStem() corta\n    // el sufijo -amiento, asi que esTokens('razonamiento') devuelve ['razon']:\n    // el castellano NO puede separar la facultad del argumento. Declarado\n    // aca el termino enciende el eje sin votar por ningun sentido\n    // (senseMixFromHits saltea los hits sin sense) y la acepcion queda en\n    // manos de las formas griegas, que si son inequivocas.\n    // Si viviera dentro de un sentido, el OTRO sentido perderia su termino\n    // castellano en silencio: la guarda DUPLICATE_TERMS de buildIndex usa un\n    // solo Set por eje, compartido por todos sus sentidos.\n    es: [['razon', 0.3]],\n    senses: [`,
	},
	{
		label: "logos/razon: saca el unigrama, quedan solo terminos discriminantes",
		old: `        es: [['razon', 0.3], 'entendimiento', 'inteligencia', 'obedecer a la razon'],`,
		new: `        es: ['entendimiento', 'inteligencia', 'obedecer a la razon'],`,
	},
	{
		label: "logos/argumento: 'razonamiento' -> bigrama 'nuestro razonamiento'",
		old: `        es: ['razonamiento'],\n        aliases: ['argumento', 'nuestro razonamiento', 'discurso', 'definicion'],`,
		new: `        // 'nuestro razonamiento' tokeniza como el bigrama ['nuestr','razon'],\n        // asi que sobrevive al colapso de -amiento y marca exactamente los\n        // pasajes donde \u03bb\u03cc\u03b3\u03bf\u03c2 es el hilo del tratado: "de acuerdo con nuestro\n        // razonamiento" (8.a) y "apoya nuestro razonamiento" (10.h).\n        es: ['nuestro razonamiento'],\n        aliases: ['argumento', 'discurso', 'definicion'],`,
	},
]

function countOccurrences(haystack, needle) {
	let n = 0
	let i = haystack.indexOf(needle)
	while (i !== -1) {
		n += 1
		i = haystack.indexOf(needle, i + needle.length)
	}
	return n
}

function replaceOnce(haystack, needle, replacement) {
	const i = haystack.indexOf(needle)
	return haystack.slice(0, i) + replacement + haystack.slice(i + needle.length)
}

function patch(filePath) {
	const src = fs.readFileSync(filePath, 'utf8')

	const usesCRLF = src.includes('\r\n')
	const eol = (s) => (usesCRLF ? s.replace(/\n/g, '\r\n') : s)

	const problems = []
	for (const edit of EDITS) {
		const n = countOccurrences(src, eol(edit.old))
		if (n !== 1) {
			problems.push(`  [${n} apariciones, se esperaba 1] ${edit.label}`)
		}
	}
	if (problems.length > 0) {
		console.log(`ABORTADO en ${filePath}. No se escribio nada.`)
		for (const p of problems) console.log(p)
		console.log('  (este parche se aplica DESPUES de patch-lexicon.mjs)')
		return false
	}

	let out = src
	for (const edit of EDITS) {
		out = replaceOnce(out, eol(edit.old), eol(edit.new))
	}

	fs.copyFileSync(filePath, filePath + '.bak2')
	fs.writeFileSync(filePath, out, 'utf8')

	console.log(`OK ${filePath}`)
	console.log(`   fin de linea: ${usesCRLF ? 'CRLF' : 'LF'} (respetado)`)
	console.log(`   respaldo: ${filePath}.bak2`)
	console.log(
		`   ${Buffer.byteLength(src, 'utf8')} bytes -> ${Buffer.byteLength(out, 'utf8')} bytes`,
	)
	for (const edit of EDITS) console.log(`   aplicado: ${edit.label}`)
	return true
}

function main() {
	const args = process.argv.slice(2)
	const paths = args.length > 0 ? args : DEFAULT_PATHS.filter((p) => fs.existsSync(p))

	if (paths.length === 0) {
		console.log('No encontre lexicon.js. Correlo desde la raiz del repo o pasa la ruta:')
		console.log('   node patch-lexicon-2.mjs fuente-y-build/src/lexicon.js')
		return 1
	}

	let ok = true
	for (const p of paths) {
		if (!fs.existsSync(p)) {
			console.log(`No existe: ${p}`)
			ok = false
			continue
		}
		if (!patch(p)) ok = false
		console.log('')
	}

	if (ok) {
		console.log('Listo. Ahora verifica el indice:')
		console.log('  node check-lexicon.mjs')
	}
	return ok ? 0 : 1
}

process.exit(main())
