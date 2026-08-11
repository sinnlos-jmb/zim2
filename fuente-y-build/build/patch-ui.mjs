/**
 * Parche de ui.js: dos arreglos independientes.
 *
 * 1. FAQ/Definiciones con la cita repetida.
 *    collectTagged() hace entry.passageIds.push(p.id) UNA VEZ POR TAG. Un
 *    pasaje que lleva varios tags con la misma pregunta se lista tantas veces
 *    como tags tenga (el chunker de build-corpus.mjs acumula los tags de los
 *    parrafos que fusiona: prev.tags = [...prev.tags, ...u.tags]).
 *
 * 2. Tooltip del chip de cobertura.
 *    r.demoted es axisDemoted || senseDemoted. El chip de cobertura lo usaba
 *    como si fuera solo axisDemoted, asi que un pasaje relegado por la ACEPCION
 *    mostraba "toca un solo eje" aunque tocara todos.
 *
 * IMPORTANTE: antes de correrlo, sincroniza las dos copias de ui.js. Hoy
 * fuente-y-build/src/ui.js es la vieja (STORE_KEY en v11):
 *   copy server\public\js\ui.js fuente-y-build\src\ui.js
 *
 * Uso:
 *   node patch-ui.mjs                 // parchea las dos copias
 *   node patch-ui.mjs ruta/ui.js      // una ruta explicita
 *
 * Aborta sin escribir si algun anclaje no aparece exactamente una vez.
 * Deja copia .bak-ui.
 */
import fs from 'node:fs'
import path from 'node:path'

const DEFAULT_PATHS = [
	path.join('server', 'public', 'js', 'ui.js'),
	path.join('fuente-y-build', 'src', 'ui.js'),
]

const EDITS = [
	{
		label: 'FAQ: un pasaje se lista una sola vez, aunque tenga varios tags',
		old: '      entry.passageIds.push(p.id);',
		new:
			'      // Un pasaje puede llevar VARIOS tags con la misma pregunta: el\n' +
			'      // chunker fusiona parrafos cortos del mismo capitulo y acumula sus\n' +
			'      // tags (prev.tags en build-corpus.mjs). Sin este control, showTagged\n' +
			'      // encuentra el mismo pasaje una vez por tag y la respuesta repite la\n' +
			'      // cita. Los tags SI se acumulan todos: de ahi salen rta y nota.\n' +
			'      if (!entry.passageIds.includes(p.id)) entry.passageIds.push(p.id);',
	},
	{
		label: 'cobertura: el chip debil mira axisDemoted, no demoted',
		old: "        if (r.demoted) cov.classList.add('weak');",
		new:
			'        // r.demoted es axisDemoted || senseDemoted. Este chip habla SOLO\n' +
			'        // de cobertura de ejes: si mira demoted, un pasaje relegado por la\n' +
			'        // acepcion aparece como si tocara un solo eje.\n' +
			"        if (r.axisDemoted) cov.classList.add('weak');",
	},
	{
		label: 'cobertura: el texto del tooltip tambien',
		old: '        cov.title = r.demoted',
		new: '        cov.title = r.axisDemoted',
	},
	{
		label: 'puntaje: el tooltip avisa si la acepcion relego el pasaje',
		old: '(r.senseFactor * 100).toFixed(0)}%`;',
		new:
			'(r.senseFactor * 100).toFixed(0)}%`\n' +
			"          + (r.senseDemoted ? ' \u00b7 relegado al final de la lista' : '');",
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
		if (n !== 1) problems.push(`  [${n} apariciones, se esperaba 1] ${edit.label}`)
	}
	if (problems.length > 0) {
		console.log(`ABORTADO en ${filePath}. No se escribio nada.`)
		for (const p of problems) console.log(p)
		return false
	}

	let out = src
	for (const edit of EDITS) out = replaceOnce(out, eol(edit.old), eol(edit.new))

	fs.copyFileSync(filePath, filePath + '.bak-ui')
	fs.writeFileSync(filePath, out, 'utf8')

	const key = (out.match(/en1:index:v\d+/) || ['?'])[0]
	console.log(`OK ${filePath}`)
	console.log(`   fin de linea: ${usesCRLF ? 'CRLF' : 'LF'} (respetado)`)
	console.log(`   respaldo: ${filePath}.bak-ui`)
	console.log(`   STORE_KEY: ${key}`)
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
		console.log('No encontre ui.js. Correlo desde la raiz del repo o pasa la ruta.')
		return 1
	}
	let ok = true
	for (const p of paths) {
		if (!fs.existsSync(p)) { console.log(`No existe: ${p}`); ok = false; continue }
		if (!patch(p)) ok = false
		console.log('')
	}
	if (ok) console.log('Listo. Recarga con Ctrl+F5 (este cambio no toca el indice).')
	return ok ? 0 : 1
}

process.exit(main())
