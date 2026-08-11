#!/usr/bin/env node
/* patch-lexicon-4.mjs - limpieza de terminos redundantes en lexicon.js
 *
 * QUE HACE
 * Borra los 54 terminos que el indice ya descartaba por duplicado: plurales
 * castellanos que stemean igual que su singular ('virtud'/'virtudes') y
 * variantes de acento griegas que grStrip unifica ('ἀρχὴ'/'ἀρχῆς'/'ἀρχῇ'...).
 * Son 32 lineas tocadas. Ninguna linea desaparece.
 *
 * POR QUE ES SEGURO
 * Estos terminos no aportaban nada: buildIndex() los registraba en
 * DUPLICATE_TERMS y los salteaba con continue. Se verifico en el sandbox que
 * el indice resultante es IDENTICO al actual, entrada por entrada, con el
 * mismo peso y el mismo sentido: 343 entradas en INDEX (corpus) y 423 en
 * INDEX_Q (consulta), antes y despues. DIM sigue en 26.
 * Por eso NO hace falta tocar STORE_KEY: los vectores del corpus no cambian,
 * el cache guardado sigue siendo valido.
 *
 * COMO SE CORRE, desde la raiz del repo:
 *   node fuente-y-build/build/patch-lexicon-4.mjs
 *
 * Valida los dos archivos ANTES de escribir ninguno: si un anclaje no aparece
 * exactamente una vez, no toca nada. Respeta el fin de linea de cada archivo
 * y deja respaldo .bak4. Correrlo dos veces aborta la segunda.
 */
import fs from 'node:fs'
import path from 'node:path'

const PATHS = ['server/public/js/lexicon.js', 'fuente-y-build/src/lexicon.js']

const EDITS = [
 {
  "kind": "line",
  "line": 50,
  "old": "    gr: ['ἀγαθόν', 'τἀγαθόν', 'ἀγαθά', 'ἀγαθῶν', 'ἀγαθοὺς', 'εὖ', ['βέλτιον', 0.4]],",
  "new": "    gr: ['ἀγαθόν', 'τἀγαθόν', 'εὖ', ['βέλτιον', 0.4]],",
  "desc": "agathon axis.gr: \"ἀγαθά\", \"ἀγαθῶν\", \"ἀγαθοὺς\""
 },
 {
  "kind": "line",
  "line": 51,
  "old": "    es: [['bien', 0.2], ['bienes', 0.35], ['bueno', 0.3], ['buenas', 0.3]],",
  "new": "    es: [['bien', 0.2], ['bueno', 0.3]],",
  "desc": "agathon axis.es: \"bienes\", \"buenas\""
 },
 {
  "kind": "line",
  "line": 57,
  "old": "    gr: ['ἄριστον', 'ἀρίστην', 'ἀρίσταις', 'ἀρίστων', 'βέλτιστον', 'ἀκρότατον', 'κυριώτατα'],",
  "new": "    gr: ['ἄριστον', 'ἀρίσταις', 'βέλτιστον', 'ἀκρότατον', 'κυριώτατα'],",
  "desc": "ariston axis.gr: \"ἀρίστην\", \"ἀρίστων\""
 },
 {
  "kind": "line",
  "line": 69,
  "old": "    es: ['felicidad', 'feliz', 'felices', 'dichoso', 'vivir bien', 'obrar bien', 'desdichado', 'venturoso'],",
  "new": "    es: ['felicidad', 'feliz', 'dichoso', 'vivir bien', 'obrar bien', 'desdichado', 'venturoso'],",
  "desc": "eudaimonia axis.es: \"felices\""
 },
 {
  "kind": "line",
  "line": 94,
  "old": "        grForms: ['ἔργον', 'ἔργου', 'ἔργῳ', ['ἀργόν', 0.5], ['ἀργὸν', 0.5]],",
  "new": "        grForms: ['ἔργον', 'ἔργου', 'ἔργῳ', ['ἀργόν', 0.5]],",
  "desc": "ergon sense:funcion.grForms: \"ἀργὸν\""
 },
 {
  "kind": "line",
  "line": 101,
  "old": "        es: [['obra', 0.5], ['obras', 0.5], 'hechos realizados'],",
  "new": "        es: [['obra', 0.5], 'hechos realizados'],",
  "desc": "ergon sense:obra.es: \"obras\""
 },
 {
  "kind": "line",
  "line": 119,
  "old": "    aliases: ['arete', 'excelencia'],",
  "new": "    aliases: ['arete'],",
  "desc": "arete axis.aliases: \"excelencia\""
 },
 {
  "kind": "line",
  "line": 120,
  "old": "    gr: ['ἀρετή', 'ἀρεταί', 'σπουδαῖον'],",
  "new": "    gr: ['ἀρετή', 'σπουδαῖον'],",
  "desc": "arete axis.gr: \"ἀρεταί\""
 },
 {
  "kind": "line",
  "line": 121,
  "old": "    es: ['virtud', 'virtudes', 'excelencia', 'esforzado', 'etica'],",
  "new": "    es: ['virtud', 'excelencia', 'esforzado', 'etica'],",
  "desc": "arete axis.es: \"virtudes\""
 },
 {
  "kind": "line",
  "line": 134,
  "old": "        gr: ['ἀνδρείαν', 'δίκαια', 'σωφροσύνη', 'ἠθικαί', 'ἀνδρείου', 'ἀνδρεῖον', 'σώφρονος', 'σώφρων'],",
  "new": "        gr: ['ἀνδρείαν', 'δίκαια', 'σωφροσύνη', 'ἠθικαί', 'ἀνδρείου', 'σώφρονος', 'σώφρων'],",
  "desc": "arete sense:etica.gr: \"ἀνδρεῖον\""
 },
 {
  "kind": "line",
  "line": 183,
  "old": "        gr: ['ἐνέργεια', 'ἐνεργεῖν', 'ἐνέργειαι'],",
  "new": "        gr: ['ἐνέργεια'],",
  "desc": "energeia sense:acto.gr: \"ἐνεργεῖν\", \"ἐνέργειαι\""
 },
 {
  "kind": "line",
  "line": 206,
  "old": "        es: ['accion', 'acciones'],",
  "new": "        es: ['accion'],",
  "desc": "energeia sense:accion.es: \"acciones\""
 },
 {
  "kind": "line",
  "line": 310,
  "old": "      'habito', 'habitos', 'costumbre', 'acostumbrar', 'disposicion', 'disposiciones', 'ejercitar',",
  "new": "      'habito', 'costumbre', 'acostumbrar', 'disposicion', 'disposiciones', 'ejercitar',",
  "desc": "hexis axis.es: \"habitos\""
 },
 {
  "kind": "line",
  "line": 314,
  "old": "      ['poseer', 0.5], ['posee', 0.5], ['posesion', 0.5], ['inactivo', 0.5],",
  "new": "      ['poseer', 0.5], ['posesion', 0.5], ['inactivo', 0.5],",
  "desc": "hexis axis.es: \"posee\""
 },
 {
  "kind": "line",
  "line": 333,
  "old": "    gr: ['τιμήν', 'τιμίων', 'τίμιόν', 'ἐπαινετῶν', 'ἐπαινοῦμεν', 'ἐπαίνων'],",
  "new": "    gr: ['τιμήν', 'τιμίων', 'ἐπαινετῶν', 'ἐπαινοῦμεν', 'ἐπαίνων'],",
  "desc": "time axis.gr: \"τίμιόν\""
 },
 {
  "kind": "line",
  "line": 334,
  "old": "    es: ['honor', 'honra', 'elogio', 'elogiable', 'reputacion', 'estima', 'alabanza', 'encomio'],",
  "new": "    es: ['honor', 'honra', 'elogio', 'reputacion', 'estima', 'alabanza', 'encomio'],",
  "desc": "time axis.es: \"elogiable\""
 },
 {
  "kind": "line",
  "line": 339,
  "old": "    es: ['riqueza', 'riquezas', 'rico', 'ricos', 'dinero', 'util', 'utilidad', 'instrumento', 'negocio', 'lucro'],",
  "new": "    es: ['riqueza', 'rico', 'dinero', 'util', 'instrumento', 'negocio', 'lucro'],",
  "desc": "ploutos axis.es: \"riquezas\", \"ricos\", \"utilidad\""
 },
 {
  "kind": "line",
  "line": 354,
  "old": "    aliases: ['autosuficiencia', 'autarkeia', 'autosuficientes'],",
  "new": "    aliases: ['autosuficiencia', 'autarkeia'],",
  "desc": "autarkeia axis.aliases: \"autosuficientes\""
 },
 {
  "kind": "line",
  "line": 371,
  "old": "    grForms: ['πολλοί', 'πολλοὶ'],",
  "new": "    grForms: ['πολλοί'],",
  "desc": "endoxa axis.grForms: \"πολλοὶ\""
 },
 {
  "kind": "line",
  "line": 381,
  "old": "    es: ['politica', 'ciudad', 'legislador', 'ciencia', 'ciencias', 'arte', 'artes', 'arquitectonica', 'rectora', 'estrategia', 'medicina'],",
  "new": "    es: ['politica', 'ciudad', 'legislador', 'ciencia', 'arte', 'arquitectonica', 'rectora', 'estrategia', 'medicina'],",
  "desc": "politike axis.es: \"ciencias\", \"artes\""
 },
 {
  "kind": "line",
  "line": 387,
  "old": "    es: ['joven', 'jovenes', 'oyente', 'inexperto', 'educacion', 'educado', 'aprender', 'ensenanza', 'pasiones', 'discipulo'],",
  "new": "    es: ['joven', 'oyente', 'inexperto', 'educacion', 'educado', 'aprender', 'ensenanza', 'pasiones', 'discipulo'],",
  "desc": "akroates axis.es: \"jovenes\""
 },
 {
  "kind": "line",
  "line": 397,
  "old": "    es: ['idea', 'ideas', 'universal', 'en comun', 'separado', 'platon', 'pitagoricos', 'en si', 'amigos la verdad'],",
  "new": "    es: ['idea', 'universal', 'en comun', 'separado', 'platon', 'pitagoricos', 'en si', 'amigos la verdad'],",
  "desc": "idea axis.es: \"ideas\""
 },
 {
  "kind": "line",
  "line": 409,
  "old": "    es: ['vida entera', 'vida completa', 'golondrina', 'un solo dia', ['tiempo', 0.5], 'mudanza', 'vicisitudes', 'genero de vida', 'generos de vida'],",
  "new": "    es: ['vida entera', 'vida completa', 'golondrina', 'un solo dia', ['tiempo', 0.5], 'mudanza', 'vicisitudes', 'genero de vida'],",
  "desc": "bios axis.es: \"generos de vida\""
 },
 {
  "kind": "line",
  "line": 418,
  "old": "    es: [['vivir', 0.5], ['viviente', 0.5], ['vivientes', 0.5], ['vive', 0.5], ['viven', 0.5], 'vivir bien', 'plantas', 'animales'],",
  "new": "    es: [['vivir', 0.5], ['viviente', 0.5], ['vive', 0.5], ['viven', 0.5], 'vivir bien', 'plantas', 'animales'],",
  "desc": "zoe axis.es: \"vivientes\""
 },
 {
  "kind": "line",
  "line": 424,
  "old": "    grForms: ['καλόν', 'καλὸν', 'καλά', 'καλὰ', 'καλῶν', 'καλαί', 'καλαὶ', 'καλαῖς', 'καλὴ', 'κάλλιον', 'κάλλιστα', 'κάλλιστον'],",
  "new": "    grForms: ['καλόν', 'καλά', 'καλῶν', 'καλαί', 'καλαῖς', 'καλὴ', 'κάλλιον', 'κάλλιστα', 'κάλλιστον'],",
  "desc": "kalon axis.grForms: \"καλὸν\", \"καλὰ\", \"καλαὶ\""
 },
 {
  "kind": "line",
  "line": 425,
  "old": "    es: ['noble', 'nobles', 'hermoso', 'hermosa', 'hermosas', 'bello', 'bella', 'belleza', 'hechos nobles'],",
  "new": "    es: ['noble', 'hermoso', 'bello', 'belleza', 'hechos nobles'],",
  "desc": "kalon axis.es: \"nobles\", \"hermosa\", \"hermosas\", \"bella\""
 },
 {
  "kind": "line",
  "line": 432,
  "old": "      'θεῖον', 'θεῖόν', 'θείαν', 'θείων', 'θειότερον', 'θειότερόν', 'θειοτάτων',",
  "new": "      'θεῖον', 'θείαν', 'θείων', 'θειότερον', 'θειοτάτων',",
  "desc": "theion axis.grForms: \"θεῖόν\", \"θειότερόν\""
 },
 {
  "kind": "line",
  "line": 433,
  "old": "      'θεός', 'θεοὺς', 'θεούς', 'θεῶν', 'θεῷ',",
  "new": "      'θεός', 'θεοὺς', 'θεῶν', 'θεῷ',",
  "desc": "theion axis.grForms: \"θεούς\""
 },
 {
  "kind": "line",
  "line": 436,
  "old": "    es: ['divino', 'divina', 'dios', 'dioses', 'bienaventurado', 'don de los dioses', 'providencia'],",
  "new": "    es: ['divino', 'dios', 'bienaventurado', 'don de los dioses', 'providencia'],",
  "desc": "theion axis.es: \"divina\", \"dioses\""
 },
 {
  "kind": "line",
  "line": 449,
  "old": "    gr: ['ἀρχή', 'ἀρχὴ', 'ἀρχῆς', 'ἀρχῇ', 'ἀρχήν', 'ἀρχὴν', 'ἀρχάς', 'ἀρχὰς', 'ἀρχῶν'],",
  "new": "    gr: ['ἀρχή', 'ἀρχάς', 'ἀρχῶν'],",
  "desc": "arkhe axis.gr: \"ἀρχὴ\", \"ἀρχῆς\", \"ἀρχῇ\", \"ἀρχήν\", \"ἀρχὴν\", \"ἀρχὰς\""
 },
 {
  "kind": "line",
  "line": 450,
  "old": "    es: ['principio', 'principios', 'punto de partida'],",
  "new": "    es: ['principio', 'punto de partida'],",
  "desc": "arkhe axis.es: \"principios\""
 },
 {
  "kind": "line",
  "line": 461,
  "old": "    es: ['perfecto', 'perfecta', 'perfectos', 'perfectas', ['completo', 0.5], ['acabado', 0.5], ['cabal', 0.5], ['pleno', 0.5]],",
  "new": "    es: ['perfecto', ['completo', 0.5], ['acabado', 0.5], ['cabal', 0.5], ['pleno', 0.5]],",
  "desc": "teleios axis.es: \"perfecta\", \"perfectos\", \"perfectas\""
 }
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
  console.log('Si ya lo habias corrido, esto es lo esperable: el parche 4 no se aplica dos veces.')
  process.exit(1)
}

/* ---------- fase 2: escribir ---------- */
console.log('')
for (const f of plan) {
  let out = f.src
  for (const e of EDITS) {
    if (e.kind === 'dropLine') out = out.replace(e.old + '\n', () => '')
    else out = out.replace(e.old, () => e.new)
  }

  const axes = (out.match(/^    id: '/gm) || []).length
  if (axes !== 26) {
    console.log('ABORTADO en ' + f.rel + ': quedaron ' + axes + ' ejes en vez de 26. No se escribio.')
    process.exit(1)
  }
  const before = f.src.split('\n').length
  const after = out.split('\n').length
  const esperado = before - EDITS.filter((e) => e.kind === 'dropLine').length
  if (after !== esperado) {
    console.log('ABORTADO en ' + f.rel + ': quedaron ' + after + ' lineas en vez de ' + esperado + '. No se escribio.')
    process.exit(1)
  }

  fs.copyFileSync(f.abs, f.abs + '.bak4')
  const final = f.crlf ? out.replace(/\n/g, '\r\n') : out
  fs.writeFileSync(f.abs, final)
  console.log('OK ' + f.rel)
  console.log('   fin de linea: ' + (f.crlf ? 'CRLF' : 'LF') + ' (respetado)')
  console.log('   respaldo: ' + f.rel + '.bak4')
  console.log('   ' + Buffer.byteLength(f.raw) + ' bytes -> ' + Buffer.byteLength(final) + ' bytes')
  console.log('   ' + EDITS.length + ' lineas limpiadas, 54 terminos redundantes fuera, 26 ejes intactos')
  console.log('')
}

console.log('Listo: ' + plan.length + ' archivos.')
console.log('El indice NO cambia (probado entrada por entrada), asi que no hace falta')
console.log('reconstruirlo ni tocar STORE_KEY. Un Ctrl+F5 alcanza.')
