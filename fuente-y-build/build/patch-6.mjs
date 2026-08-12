#!/usr/bin/env node
/* patch-6.mjs -- dos cambios sobre el motor de acepciones, los dos medidos
 * con build/auditar-sentidos.mjs sobre los 72 pasajes del libro I.
 *
 * (1) vectorize.js / applySenseTags
 *     Un tag { eje } SIN 'sentido' deja de vaciar la mezcla de ese eje. Esa
 *     forma es tambien la de los tags de ROL y de RELEVANCIA
 *     ({ rol: "faq", eje: "ergon" }), asi que un tag que solo queria colgar
 *     una pregunta borraba de paso lo que el motor habia deducido bien: 9
 *     mezclas correctas perdidas sin que nadie lo pidiera. Para anular a
 *     proposito ahora hay que escribirlo:
 *         { "eje": "arete", "sentido": "ninguno" }
 *
 * (2) lexicon.js / eje arete
 *     'etica' pasa del nivel del eje al sentido 'etica'. El comentario del
 *     lexico dejaba la decision "a la espera de esa medicion": la medicion
 *     dice que el termino prende en 1 solo pasaje de 72 (13.h, "virtudes
 *     eticas y dianoeticas") y que el titulo del tratado no aparece nunca en
 *     el texto indexado, que era el riesgo que frenaba el cambio.
 *
 * Uso:
 *   node fuente-y-build/build/patch-6.mjs --dry     (no escribe nada)
 *   node fuente-y-build/build/patch-6.mjs
 *
 * Parchea TODAS las copias de vectorize.js y lexicon.js que cuelguen del
 * directorio actual. Es idempotente: si ya esta aplicado, lo dice y sigue.
 *
 * OJO: corpus.json guarda las mezclas YA CALCULADAS. Sin reconstruir el
 * corpus, ninguno de los dos cambios se ve en la app.
 */
import fs from 'node:fs';
import path from 'node:path';

const DRY = process.argv.includes('--dry');
const ROOT = process.cwd();
const SALTAR = new Set(['node_modules', '.git', '.next', 'dist', 'build_output', '.vercel', '.cache']);

function caminar(dir, salida = []) {
  let entradas;
  try {
    entradas = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return salida;
  }
  for (const e of entradas) {
    if (SALTAR.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) caminar(p, salida);
    else salida.push(p);
  }
  return salida;
}

/* ------------------------------------------------------------ EDICIONES --- */

const VIEJO_VECTORIZE = `  const porEje = new Map();
  // ejes fijados a mano como "sin sentido": un tag { eje } SIN 'sentido' anula
  // la mezcla de ese eje (queda vacia), para los falsos positivos/negativos de
  // la heuristica que no ameritan elegir un sentido puntual.
  const neutralEjes = new Set();
  for (const t of tags || []) {
    if (!t || !t.eje) continue;
    if (!t.sentido) { neutralEjes.add(t.eje); continue; }`;

const NUEVO_VECTORIZE = `  const porEje = new Map();
  // ejes fijados a mano como "sin sentido": SOLO anula la mezcla de un eje el
  // tag que lo pide con todas las letras, { "eje": "arete", "sentido":
  // "ninguno" }.
  //
  // Antes alcanzaba con un tag { eje } SIN 'sentido' para vaciarla, y esa es
  // tambien la forma de los tags de ROL y de RELEVANCIA ({ rol: "faq", eje:
  // "ergon" }): el campo 'eje' significaba dos cosas distintas segun viniera o
  // no acompanado de 'sentido', y un tag que solo queria colgar una pregunta
  // borraba lo que el motor habia deducido bien. Medido con
  // build/auditar-sentidos.mjs sobre los 72 pasajes: 9 mezclas correctas
  // borradas sin que nadie lo pidiera.
  //   2.a  energeia  {accion: 1}
  //   3.a  arete     {etica: 1}   (delta, dikaia, andreia en el pasaje)
  //   4.d  arete     {etica: 1}
  //   6.g  arete     {dianoetica: 1}
  //   7.g  ergon     {funcion: 0.90, obra: 0.10}
  //   7.i  ergon     {funcion: 0.90, obra: 0.10}
  //   8.f  arete     {etica: 1}
  //   8.g  arete     {etica: 1}
  //   8.h  arete     {etica: 1}
  // Un tag sin 'sentido' ahora se ignora aca y sigue viviendo para lo suyo
  // (rol, relevancia, preguntas): no dice nada sobre la acepcion.
  const NEUTRO = new Set(['ninguno', 'neutral', 'sin_sentido']);
  const neutralEjes = new Set();
  for (const t of tags || []) {
    if (!t || !t.eje) continue;
    if (!t.sentido) continue;
    if (NEUTRO.has(String(t.sentido).toLowerCase())) { neutralEjes.add(t.eje); continue; }`;

const VIEJO_LEX_EJE = `    // 'etica' (palabra suelta) se deja SIN mover a un sentido: coincide con
    // el stem del titulo del tratado ("Etica Nicomaquea") ademas del
    // adjetivo "etica/eticas" referido a la virtud, y sin medirlo contra los
    // 72 pasajes no se sabe si moverla arrastraria menciones del titulo.
    // Queda como estaba, a la espera de esa medicion.
    id: 'arete', label: 'Virtud', greek: 'ἀρετή',
    aliases: ['arete'],
    gr: ['ἀρετή', 'σπουδαῖον'],
    es: ['virtud', 'excelencia', 'esforzado', 'etica'],`;

const NUEVO_LEX_EJE = `    // 'etica' (palabra suelta) BAJO al sentido 'etica'. El comentario viejo la
    // dejaba arriba "a la espera de esa medicion", por miedo a que el stem
    // etic- arrastrara el titulo del tratado ("Etica Nicomaquea") ademas del
    // adjetivo referido a la virtud. La medicion existe: sobre los 72 pasajes
    // el termino prende en UNO solo, 13.h ("las virtudes eticas y
    // dianoeticas"), que es justamente el pasaje donde el adjetivo elige
    // sentido. El titulo no aparece nunca en el texto indexado.
    // Efecto medido en 13.h: la mezcla pasa de {dianoetica 0.66 / etica 0.34}
    // a {dianoetica 0.59 / etica 0.41}, mas cerca del 50/50 tagueado a mano.
    // OJO si algun dia se lo quiere en los dos lados: la guarda
    // DUPLICATE_TERMS de buildIndex usa un solo Set por eje, compartido por
    // todos sus sentidos, y ax.es se carga ANTES que los sentidos. Dejarlo
    // arriba y agregarlo abajo no lo duplica: mata la copia del sentido.
    id: 'arete', label: 'Virtud', greek: 'ἀρετή',
    aliases: ['arete'],
    gr: ['ἀρετή', 'σπουδαῖον'],
    es: ['virtud', 'excelencia', 'esforzado'],`;

const VIEJO_LEX_SENTIDO = `        es: ['valentía', 'justicia', 'justo', 'valiente', 'templado'],`;
const NUEVO_LEX_SENTIDO = `        es: ['valentía', 'justicia', 'justo', 'valiente', 'templado', 'etica'],`;

const EDICIONES = {
  'vectorize.js': [
    { nombre: "applySenseTags: solo anula sentido 'ninguno'", viejo: VIEJO_VECTORIZE, nuevo: NUEVO_VECTORIZE },
  ],
  'lexicon.js': [
    { nombre: "arete: 'etica' sale del nivel del eje", viejo: VIEJO_LEX_EJE, nuevo: NUEVO_LEX_EJE },
    { nombre: "arete/etica: 'etica' entra al sentido", viejo: VIEJO_LEX_SENTIDO, nuevo: NUEVO_LEX_SENTIDO },
  ],
};

/* -------------------------------------------------------------- APLICAR --- */

const contar = (texto, aguja) => texto.split(aguja).length - 1;

function parchear(archivo, ediciones) {
  let src = fs.readFileSync(archivo, 'utf8');
  const crlf = src.includes('\r\n');
  const nl = (s) => (crlf ? s.replace(/\r?\n/g, '\r\n') : s);
  const rel = path.relative(ROOT, archivo) || archivo;

  let aplicadas = 0;
  let yaEstaban = 0;
  let fallidas = 0;

  for (const ed of ediciones) {
    const viejo = nl(ed.viejo);
    const nuevo = nl(ed.nuevo);

    if (src.includes(nuevo)) {
      console.log(`  =  ${ed.nombre} -- ya estaba aplicada`);
      yaEstaban++;
      continue;
    }
    const n = contar(src, viejo);
    if (n === 0) {
      console.log(`  !  ${ed.nombre} -- NO SE ENCONTRO el bloque original`);
      fallidas++;
      continue;
    }
    if (n > 1) {
      console.log(`  !  ${ed.nombre} -- el bloque aparece ${n} veces, no toco nada`);
      fallidas++;
      continue;
    }
    src = src.replace(viejo, nuevo);
    console.log(`  +  ${ed.nombre}`);
    aplicadas++;
  }

  if (aplicadas && !DRY) fs.writeFileSync(archivo, src, 'utf8');
  console.log(`  -> ${rel}${crlf ? '  [CRLF]' : ''}${DRY && aplicadas ? '  (dry: no se escribio)' : ''}`);
  return { aplicadas, yaEstaban, fallidas };
}

/* ----------------------------------------------------------------- MAIN --- */

console.log('PARCHE 6' + (DRY ? '  (dry run)' : ''));
console.log('raiz: ' + ROOT);
console.log('='.repeat(74));

const todos = caminar(ROOT);
let total = { aplicadas: 0, yaEstaban: 0, fallidas: 0 };
let copias = 0;

for (const base of Object.keys(EDICIONES)) {
  const objetivos = todos.filter((f) => path.basename(f) === base);
  if (!objetivos.length) {
    console.log(`\n${base}: no se encontro ninguna copia`);
    continue;
  }
  for (const archivo of objetivos) {
    copias++;
    console.log(`\n${base}  (${path.relative(ROOT, archivo) || archivo})`);
    const r = parchear(archivo, EDICIONES[base]);
    total.aplicadas += r.aplicadas;
    total.yaEstaban += r.yaEstaban;
    total.fallidas += r.fallidas;
  }
}

console.log('\n' + '='.repeat(74));
console.log(`copias tocadas: ${copias}   aplicadas: ${total.aplicadas}   ya estaban: ${total.yaEstaban}   fallidas: ${total.fallidas}`);

if (total.fallidas) {
  console.log('\nHubo bloques que no matchearon. No se escribio nada en esos archivos.');
  console.log('Suele ser porque el archivo ya se edito a mano. Revisar y aplicar el');
  console.log('cambio manualmente, o restaurar desde git y volver a correr.');
  process.exit(1);
}

if (total.aplicadas && !DRY) {
  console.log('\nFALTA RECONSTRUIR. corpus.json guarda las mezclas ya calculadas:');
  console.log('  node fuente-y-build/build/build-corpus.mjs');
  console.log('  node fuente-y-build/build/build-app.mjs');
  console.log('y despues, para ver el efecto:');
  console.log('  node fuente-y-build/build/auditar-sentidos.mjs');
}
