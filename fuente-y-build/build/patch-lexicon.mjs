/**
 * Parche de lexicon.js: particion del eje logos en dos sentidos + fixes de energeia.
 *
 * Uso:
 *   node patch-lexicon.mjs                  // parchea las dos copias del repo
 *   node patch-lexicon.mjs ruta/lexicon.js  // una ruta explicita
 *
 * Seguridad: NO escribe nada si algun anclaje no aparece EXACTAMENTE una vez.
 * Deja copia .bak de cada archivo modificado.
 */
import fs from 'node:fs'
import path from 'node:path'

const DEFAULT_PATHS = [
	path.join('fuente-y-build', 'src', 'lexicon.js'),
	path.join('server', 'public', 'js', 'lexicon.js'),
]

const LOGOS_OLD = `    id: 'logos', label: 'Razón', greek: 'λόγος',
    gr: ['λόγος', 'λόγον ἔχον', 'νοῦς', 'φρόνησις', 'σοφία', 'σύνεσις', 'ἀλήθειαν', 'ὀρθῶς'],
    es: [['razon', 0.45], 'racional', 'entendimiento', 'prudencia', 'sabiduría', 'inteligencia', 'obedecer a la razon'],`

const LOGOS_NEW = `    // LOGOS: eje con dos sentidos, declarados abajo en \`senses\`.
    //   razon     -> la facultad racional: κατὰ λόγον, μετὰ λόγου, τὸ λόγον ἔχον
    //   argumento -> el razonamiento del tratado: οἱ λόγοι, μαρτυρεῖ τῷ λόγῳ
    //
    // El eje "Razón" era en realidad dos ejes solapados, igual que lo era
    // "Actividad" antes de separar acto de accion. Medido sobre los 72
    // pasajes: 5 parrafos usan el argumento (6, 9, 21, 30, 38) y 5 la
    // facultad (7, 26, 27, 37, 49/50). Casi la mitad del eje no hablaba de
    // la razon como potencia del alma sino del hilo argumental del libro.
    //
    // Las formas van por grForms (igualdad exacta) y no por gr (raiz): el
    // stem λογ- no distingue el λόγον que se TIENE del λόγος que se
    // ARGUMENTA, y el caso gramatical los separa casi sin ruido, igual que
    // la oposicion ἔργον / ἔργα en ergon.
    //   acusativo/genitivo (λόγον, λόγου) -> facultad
    //   nominativo/plural/dativo (λόγος, λόγοι, λόγοις, λόγῳ) -> argumento
    //
    // OJO con 6.d (parrafo 16): ahi λόγος es la DEFINICION ("la definicion
    // de hombre en si mismo"), un tercer uso que cae en 'argumento' por la
    // regla de caso. Es el pasaje a mirar si el sentido queda raro; su tema
    // real es la polemica con Platon (eje idea).
    //
    // SALIERON DEL EJE:
    //   'λόγον ἔχον' : termino muerto. Frase de dos tokens, y la glosa
    //                  indexada dice solo (λόγον); ἔχοντος vive en el griego
    //                  paralelo, que no se indexa. Nunca matcheo.
    //   'racional'   : df 0. La unica forma que aparece en el libro es
    //                  'irracional' (13.f-13.g), que es de psyche. Sobrevive
    //                  como alias 'parte racional', del lado de la consulta.
    //   φρόνησις, σοφία, σύνεσις, 'prudencia', 'sabiduría' -> arete/dianoetica.
    //                  Nombran VIRTUDES, no la facultad. Estando aca, un
    //                  pasaje que las nombraba puntuaba logos y nunca
    //                  arete/dianoetica: por eso 13.h necesito tag manual.
    //   ἀλήθειαν, ὀρθῶς -> akribeia. En los pasajes medidos son metodo
    //                  ("mostrar la verdad a grandes rasgos", "juzgar
    //                  rectamente"), nunca la facultad. Mismo caso que καλῶς.
    //
    // 'razon' baja de 0.45 a 0.3: es un detector de modismos de la
    // traduccion ("con razon" 1.a, "por esta razon" 4.b, "muchas razones"
    // 6.a), el mismo tic que 'vida' en bios. El peso se corre al griego.
    id: 'logos', label: 'Razón', greek: 'λόγος',
    aliases: ['logos'],
    gr: ['νοῦς'],
    senses: [
      {
        id: 'razon', label: 'la razón (facultad)', greek: 'λόγον ἔχον',
        grForms: ['λόγον', 'λόγου'],
        es: [['razon', 0.3], 'entendimiento', 'inteligencia', 'obedecer a la razon'],
        aliases: ['facultad racional', 'parte racional', 'lo que tiene razon'],
      },
      {
        id: 'argumento', label: 'el razonamiento, el discurso', greek: 'λόγοι', weight: 0.4,
        grForms: ['λόγος', 'λόγοι', 'λόγοις', 'λόγῳ'],
        es: ['razonamiento'],
        aliases: ['argumento', 'nuestro razonamiento', 'discurso', 'definicion'],
      },
    ],`

const DIANOETICA_OLD = `        gr: ['διανοητικαί'],
        es: ['dianoetica'],`

const DIANOETICA_NEW = `        // φρόνησις/σοφία/σύνεσις y sus castellanos VINIERON de logos: nombran
        // virtudes del intelecto, no la facultad. Estaban solo como aliases
        // (lado consulta), asi que 13.h --el parrafo que dice que la
        // sabiduria, la inteligencia y la prudencia son dianoeticas-- no
        // llegaba a este sentido por si solo y hubo que tagearlo a mano.
        // A mirar: 4.b (parrafo 18) los nombra en una lista doxografica de
        // bienes candidatos; ahi el sentido activa sin discutir la virtud.
        gr: ['διανοητικαί', 'φρόνησις', 'σοφία', 'σύνεσις'],
        es: ['dianoetica', 'prudencia', 'sabiduría'],`

const ACTO_OLD = `        es: ['actividad', 'actividades', 'en acto', 'ejercicio'],
        aliases: ['acto', 'actualidad', 'estar en acto', 'estar en obra', 'being at work'],`

const ACTO_NEW = `        // 'en acto' SALIO de es: con las stopwords fuera colapsa al unigrama
        // 'acto', y las unicas cuatro ocurrencias castellanas de "acto/actos"
        // en el libro son 1.c, 7.a y 7.c ("el fin de nuestros actos",
        // πρακτῶν: lo realizable, con τέλος en la misma glosa) y 7.e ("hay
        // que tomarla en acto", κατ᾽ ἐνέργειαν). O sea 3 de 4 le daban el
        // sentido 'acto' a pasajes cuyo tema es la accion, invirtiendo el
        // sentido dominante. La cuarta, la legitima, ya entra por la glosa.
        // Efecto lateral bueno: el alias 'acto' estaba MUERTO, porque
        // 'en acto' ocupaba la clave es|acto y la guarda DUPLICATE_TERMS lo
        // descartaba en silencio. Ahora revive del lado de la consulta.
        //
        // 'ejercicio' bajo a aliases: sus dos unicas ocurrencias estan en
        // 9.b (parrafo 34), "por algun otro ejercicio", "cierto aprendizaje
        // o ejercicio", que es la ADQUISICION de la eudaimonia (hexis) y no
        // el estar-en-acto. Ojo: hexis no lo caza, porque 'ejercitar' stemea
        // ejercit y 'ejercicio' stemea ejercici.
        es: ['actividad', 'actividades'],
        aliases: ['acto', 'actualidad', 'estar en acto', 'estar en obra', 'ejercicio', 'being at work'],`

const EDITS = [
	{
		label: 'telos: sacar πρακτῶν (lo reclamaban telos y energeia/accion a la vez)',
		old: `'προαίρεσις', 'πρακτῶν', 'ἕνεκα'],`,
		new: `'προαίρεσις', 'ἕνεκα'],`,
	},
	{
		label: 'arete/dianoetica: recibe φρόνησις, σοφία, σύνεσις, prudencia, sabiduría',
		old: DIANOETICA_OLD,
		new: DIANOETICA_NEW,
	},
	{
		label: 'energeia/acto: sacar el colapso de "en acto" y mover "ejercicio" a aliases',
		old: ACTO_OLD,
		new: ACTO_NEW,
	},
	{
		label: 'logos: particion en los sentidos razon / argumento',
		old: LOGOS_OLD,
		new: LOGOS_NEW,
	},
	{
		label: 'akribeia: recibe ἀλήθειαν (la verdad como asunto de metodo)',
		old: `'ἐπαγωγῇ', 'ἐπισκεπτέον'],`,
		new: `'ἐπαγωγῇ', 'ἐπισκεπτέον', 'ἀλήθειαν'],`,
	},
	{
		label: 'akribeia: recibe ὀρθῶς con peso 0.6, igual que καλῶς',
		old: `grForms: [['καλῶς', 0.6]],`,
		new: `grForms: [['καλῶς', 0.6], ['ὀρθῶς', 0.6]],`,
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

	// En Windows los .js suelen quedar con fin de linea CRLF. Los anclajes de
	// varias lineas estan escritos con LF, asi que los adapto al archivo real
	// en vez de convertir sus finales de linea: eso ensuciaria el diff entero.
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
		return false
	}

	let out = src
	for (const edit of EDITS) {
		out = replaceOnce(out, eol(edit.old), eol(edit.new))
	}

	fs.copyFileSync(filePath, filePath + '.bak')
	fs.writeFileSync(filePath, out, 'utf8')

	console.log(`OK ${filePath}`)
	console.log(`   fin de linea: ${usesCRLF ? 'CRLF' : 'LF'} (respetado)`)
	console.log(`   respaldo: ${filePath}.bak`)
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
		console.log('   node patch-lexicon.mjs fuente-y-build/src/lexicon.js')
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
		console.log('Listo. Ahora:')
		console.log('  node fuente-y-build/build/build-corpus.mjs fuente-y-build/EN_libro1_v7_tags_fixed.txt')
	}
	return ok ? 0 : 1
}

process.exit(main())
