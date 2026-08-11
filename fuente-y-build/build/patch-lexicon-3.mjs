/**
 * Parche 3: cierra la etapa del Libro I.
 *
 * lexicon.js (3 edits)
 *   1. hexis: entra ['ejercicio', 0.5] y sale la frase muerta 'sin ejercitar'.
 *      'sin ejercitar' colapsa al unigrama 'ejercit', que ya ocupa 'ejercitar',
 *      asi que la guarda DUPLICATE_TERMS la descartaba en silencio. 'ejercicio'
 *      stemea 'ejercici', un slot libre, y rescata el parrafo 34 (9.b), que
 *      quedo huerfano cuando 'ejercicio' bajo de energeia/acto a sus aliases.
 *   2. energeia/accion: alias de CONSULTA para "las cosas que se pueden hacer",
 *      la pregunta libre que no devolvia nada. Del lado del corpus el concepto
 *      ya estaba: entra por la glosa griega πρακτῶν, que vive en este mismo
 *      sentido (1094a19 y 1097a15 son esos pasajes).
 *   3. arete/etica: alias de CONSULTA para continente / incontinente. El eje
 *      ἐγκράτεια no existe y por busqueda libre el tema era invisible: solo lo
 *      alcanzaba el tag manual de 13.f. Van como alias, no como lemas: no
 *      tocan el indice del corpus, asi que no pueden generar falsos positivos.
 *
 * ui.js (1 edit)
 *   4. STORE_KEY v12 -> v13. Obligatorio: el indice cacheado en localStorage
 *      NO se invalida por cambios de lexico (textHash solo vigila el texto del
 *      corpus), asi que sin esto un navegador que ya abrio la app sigue
 *      comparando vectores viejos.
 *
 * Valida TODOS los archivos antes de escribir NINGUNO: si un anclaje falla,
 * no se toca nada (evita quedar con el lexico nuevo y la clave de cache vieja).
 * Deja copia .bak3 de cada archivo.
 *
 * Uso, desde la raiz del repo:
 *   node fuente-y-build/build/patch-lexicon-3.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const GROUPS = [
	{
		paths: [
			path.join('server', 'public', 'js', 'lexicon.js'),
			path.join('fuente-y-build', 'src', 'lexicon.js'),
		],
		edits: [
			{
				label: "hexis: entra ['ejercicio', 0.5], sale 'sin ejercitar'",
				old:
					"      'dormido', 'durmiendo', 'duerme', 'sueno', 'sin ejercitar',\n" +
					"      ['poseer', 0.5], ['posee', 0.5], ['posesion', 0.5], ['inactivo', 0.5],",
				new:
					"      'dormido', 'durmiendo', 'duerme', 'sueno',\n" +
					"      ['poseer', 0.5], ['posee', 0.5], ['posesion', 0.5], ['inactivo', 0.5],\n" +
					"      // 'sin ejercitar' SALIO: con 'sin' fuera por stopword colapsa al\n" +
					"      // unigrama 'ejercit', que ya ocupa 'ejercitar', y la guarda\n" +
					"      // DUPLICATE_TERMS la descartaba en silencio: era un termino muerto.\n" +
					"      // 'ejercicio' ocupa su lugar con peso bajo. Stemea 'ejercici', que\n" +
					"      // es un slot libre, y rescata 9.b (parrafo 34), \"cierto aprendizaje\n" +
					"      // o ejercicio\": la ADQUISICION de la eudaimonia, que quedo huerfana\n" +
					"      // cuando 'ejercicio' bajo de energeia/acto a sus aliases.\n" +
					"      ['ejercicio', 0.5],",
			},
			{
				label: 'energeia/accion: alias de consulta para "lo que se puede hacer"',
				old: "        aliases: ['praxis', 'accion humana', 'conducta'],",
				new:
					'        // Las tres frases nuevas son alias de CONSULTA: la pregunta libre\n' +
					'        // "las cosas que se pueden hacer" no devolvia nada porque ninguno\n' +
					"        // de sus tokens [cosa, pueden, hacer] estaba en el lexico. Hacen\n" +
					"        // falta las dos formas: 'pueden' no stemea igual que 'puede', asi\n" +
					"        // que \"lo que se puede hacer\" da [pued, hacer] y la otra\n" +
					'        // [cosa, pueden, hacer]. Del lado del corpus el concepto ya entra\n' +
					'        // por la glosa πρακτῶν, que esta en este mismo sentido: los\n' +
					'        // pasajes son 1094a19 y 1097a15.\n' +
					"        aliases: ['praxis', 'accion humana', 'conducta', 'lo que se puede hacer', 'las cosas que se pueden hacer', 'lo realizable'],",
			},
			{
				label: 'arete/etica: alias de consulta para continente / incontinente',
				old:
					"        aliases: ['virtud moral', 'virtudes del caracter', 'excelencia moral', 'excelencia etica'],",
				new:
					'        // continente/incontinente entran SOLO como alias, coherente con\n' +
					'        // la nota de arriba: siguen fuera del indice del corpus (no son\n' +
					'        // la virtud en discusion en 13.f/13.g) pero ya no son invisibles\n' +
					'        // para la busqueda libre, que hasta ahora no devolvia NADA y\n' +
					'        // dejaba el tema colgado del unico tag manual de 13.f.\n' +
					"        aliases: ['virtud moral', 'virtudes del caracter', 'excelencia moral', 'excelencia etica', 'continente', 'incontinente', 'continencia', 'el continente y el incontinente'],",
			},
		],
	},
	{
		paths: [
			path.join('server', 'public', 'js', 'ui.js'),
			path.join('fuente-y-build', 'src', 'ui.js'),
		],
		edits: [
			{
				label: 'STORE_KEY v12 -> v13 (el lexico cambio: hay que invalidar el cache)',
				old: "const STORE_KEY = 'en1:index:v12';",
				new: "const STORE_KEY = 'en1:index:v13';",
			},
		],
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

// FASE 1: leer y validar todo. No se escribe nada todavia.
function plan() {
	const jobs = []
	const problems = []
	for (const group of GROUPS) {
		const found = group.paths.filter((p) => fs.existsSync(p))
		if (found.length === 0) {
			problems.push(`  no encontre ninguna copia de ${path.basename(group.paths[0])}`)
			continue
		}
		for (const filePath of found) {
			const src = fs.readFileSync(filePath, 'utf8')
			const usesCRLF = src.includes('\r\n')
			const eol = (s) => (usesCRLF ? s.replace(/\n/g, '\r\n') : s)
			let out = src
			let ok = true
			for (const edit of group.edits) {
				const needle = eol(edit.old)
				const n = countOccurrences(out, needle)
				if (n !== 1) {
					problems.push(`  ${filePath}: [${n} apariciones, se esperaba 1] ${edit.label}`)
					ok = false
					continue
				}
				out = replaceOnce(out, needle, eol(edit.new))
			}
			if (ok) jobs.push({ filePath, src, out, usesCRLF, edits: group.edits })
		}
	}
	return { jobs, problems }
}

function main() {
	const { jobs, problems } = plan()
	if (problems.length > 0) {
		console.log('ABORTADO. No se escribio NADA en ningun archivo.')
		for (const p of problems) console.log(p)
		console.log('')
		console.log('Correlo desde la raiz del repo. Si ya lo aplicaste una vez,')
		console.log('los anclajes no vuelven a aparecer y esto es lo esperado.')
		return 1
	}
	for (const job of jobs) {
		fs.copyFileSync(job.filePath, job.filePath + '.bak3')
		fs.writeFileSync(job.filePath, job.out, 'utf8')
		console.log(`OK ${job.filePath}`)
		console.log(`   fin de linea: ${job.usesCRLF ? 'CRLF' : 'LF'} (respetado)`)
		console.log(`   respaldo: ${job.filePath}.bak3`)
		console.log(
			`   ${Buffer.byteLength(job.src, 'utf8')} bytes -> ${Buffer.byteLength(job.out, 'utf8')} bytes`,
		)
		for (const edit of job.edits) console.log(`   aplicado: ${edit.label}`)
		console.log('')
	}
	console.log(`Listo: ${jobs.length} archivos.`)
	console.log('El lexico cambio, asi que hay que reconstruir el indice:')
	console.log('Ctrl+F5 y, si hace falta, el boton "Reconstruir indice".')
	return 0
}

process.exit(main())
