/* ============================================================================
   auditar-sentidos.mjs - que sabe el motor sobre la ACEPCION de cada eje.

   Un eje polisemico solo puede filtrar por sentido si los terminos que lo
   prenden declaran a que acepcion pertenecen. Un termino puesto al NIVEL DEL
   EJE (ax.es / ax.gr / ax.grForms / ax.aliases) no vota ninguna: el pasaje que
   entra solo por ahi queda con mezcla vacia, senseAgreement devuelve null y el
   filtro de sentido no lo toca. No baja de puesto: es INMUNE. Ese es el unico
   error del lexico que no se ve desde el navegador, porque el pasaje aparece
   en la lista como si todo estuviera bien.

   Este reporte los cuenta, nombra al termino culpable y deja la lista de
   pasajes a taguear a mano.

   Uso:
     node build/auditar-sentidos.mjs [ruta/a/corpus.json] [--eje ID] [--todos]

   Sin argumentos busca corpus.json en las rutas habituales. Leer corpus.json
   y no el .txt es deliberado: es el mismo archivo que carga la app, asi que el
   reporte no puede desincronizarse del chunker de build-corpus.mjs.
   IMPORTANTE: correr build-corpus.mjs antes si se toco la fuente.

     --eje ID   detalle pasaje por pasaje de ese eje
     --todos    detalle de todos los ejes polisemicos
   ========================================================================= */
import fs from 'node:fs';
import { vectorize, senseMixFromHits, applySenseTags } from '../src/vectorize.js';
import { AXES } from '../src/lexicon.js';

/* ---------------------------------------------------- ENTRADA ---------------- */
const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? (args[i + 1] || true) : null; };
const ejeDetalle = flag('--eje');
const todos = args.includes('--todos');
const ruta = args.find((a) => a.endsWith('.json'));

const CANDIDATOS = [
  ruta,
  'data/corpus.json',
  'server/public/data/corpus.json',
  '../server/public/data/corpus.json',
  '/data/en1/app/data/corpus.json',
].filter(Boolean);

const SRC = CANDIDATOS.find((p) => { try { return fs.statSync(p).isFile(); } catch { return false; } });
if (!SRC) {
  console.error('No encuentro corpus.json. Probe:');
  CANDIDATOS.forEach((p) => console.error('  - ' + p));
  console.error('Pasa la ruta como primer argumento, o corre antes build-corpus.mjs.');
  process.exit(1);
}

const passages = JSON.parse(fs.readFileSync(SRC, 'utf8')).passages;
const AXID = (h) => (typeof h.axis === 'number' ? (AXES[h.axis] || {}).id : h.axis);
const POLI = AXES.filter((a) => (a.senses || []).length);
const POLI_IDS = POLI.map((a) => a.id);

/* Un eje puede quedar sin acepcion de DOS maneras distintas, y las dos son
 * inmunes al filtro (senseAgreement devuelve null en ambas), pero solo una es
 * un error:
 *   - OMISION   : mix[eje] no existe. Ningun termino voto acepcion. Accidente.
 *   - NEUTRAL   : mix[eje] existe pero vacio. Un tag { eje } SIN 'sentido' la
 *                 anulo a proposito... o sin querer, ver la seccion 5. */
const vacio = (m) => !m || !Object.keys(m).length;

/* Se vectoriza igual que la app: texto sin parentesis + solo las glosas
 * griegas entre parentesis. El griego PARALELO no entra al indice. */
const ps = passages.map((p) => {
  const v = vectorize(p.esOnly ?? p.es, p.glosses || []);
  const base = senseMixFromHits(v.hits);
  const { mix, pinned } = applySenseTags(base, p.tags || []);
  return { ...p, hits: v.hits, base, mix, pinned };
});

const linea = (c = '-') => console.log(c.repeat(74));
console.log('AUDITORIA DE ACEPCIONES');
console.log('fuente : ' + SRC);
console.log('pasajes: ' + ps.length + '   ejes: ' + AXES.length + '   polisemicos: ' + POLI.length +
  ' (' + POLI_IDS.join(', ') + ')');

/* ---------------------------------------------------- 1. CENSO --------------- */
linea('=');
console.log('1. CENSO DE INMUNIDAD');
linea();
console.log('  ' + 'eje'.padEnd(12) + 'pasajes'.padStart(8) + 'c/acepcion'.padStart(12) +
  'inmunes'.padStart(9) + '   %   desglose');
const omisionPorEje = new Map();
const neutralPorEje = new Map();
let totalInm = 0;
for (const ax of POLI_IDS) {
  const tocan = ps.filter((p) => p.hits.some((h) => AXID(h) === ax));
  const om = tocan.filter((p) => !(p.mix && p.mix[ax]));
  const ne = tocan.filter((p) => p.mix && p.mix[ax] && !Object.keys(p.mix[ax]).length);
  omisionPorEje.set(ax, om);
  neutralPorEje.set(ax, ne);
  const sin = om.length + ne.length;
  totalInm += sin;
  if (!tocan.length) continue;
  const pc = Math.round((sin / tocan.length) * 100);
  console.log('  ' + ax.padEnd(12) + String(tocan.length).padStart(8) +
    String(tocan.length - sin).padStart(12) + String(sin).padStart(9) +
    String(pc).padStart(5) + '%' +
    '   (omision ' + om.length + ', anulados por tag ' + ne.length + ')' +
    (pc >= 30 ? '  <<< REVISAR' : ''));
}
console.log('  total pasaje-x-eje sin acepcion utilizable: ' + totalInm);

/* ---------------------------------------------------- 2. CULPABLES ----------- */
linea('=');
console.log('2. TERMINOS QUE PRENDEN UN EJE POLISEMICO SIN VOTAR ACEPCION');
console.log('   (viven al nivel del eje; moverlos a un sentido cierra el agujero)');
linea();
const culp = new Map();
for (const p of ps) {
  for (const h of p.hits) {
    const ax = AXID(h);
    if (!POLI_IDS.includes(ax) || h.sense) continue;
    const k = ax + '\u0000' + h.token + '\u0000' + h.lang;
    if (!culp.has(k)) culp.set(k, new Set());
    culp.get(k).add(p.id);
  }
}
if (!culp.size) console.log('  ninguno. Todos los terminos declaran acepcion.');
[...culp.entries()].sort((a, b) => b[1].size - a[1].size).forEach(([k, set]) => {
  const [ax, tok, lang] = k.split('\u0000');
  console.log('  ' + String(set.size).padStart(3) + ' pasajes  ' + ax.padEnd(11) + '<- "' + tok + '" (' + lang + ')');
});

/* ---------------------------------------------------- 3. A TAGUEAR ----------- */
linea('=');
console.log('3. PASAJES A TAGUEAR A MANO (el motor no puede deducir la acepcion)');
linea();
for (const ax of POLI_IDS) {
  const om = omisionPorEje.get(ax) || [];
  const ne = neutralPorEje.get(ax) || [];
  if (!om.length && !ne.length) continue;
  console.log('  ' + ax + '  (sentidos validos: ' +
    (AXES.find((a) => a.id === ax).senses || []).map((s) => s.id).join(', ') + ')');
  if (om.length) console.log('    sin acepcion, ' + om.length + ': ' + om.map((p) => p.id).join(', '));
  if (ne.length) console.log('    anulados por un tag, ' + ne.length + ': ' + ne.map((p) => p.id).join(', '));
}

/* ---------------------------------------------------- 4. TAGS ---------------- */
linea('=');
console.log('4. TAGS MANUALES CONTRA EL MOTOR (por mezcla declarada)');
console.log('   Los tags de un mismo eje en un pasaje forman UNA mezcla, no veredictos');
console.log('   sueltos: asi los aplica applySenseTags. Se compara la mezcla declarada');
console.log('   contra la que dedujo el motor, no tag por tag.');
linea();
const NEUTRO4 = new Set(['ninguno', 'neutral', 'sin_sentido']);
const fmtMix = (m) => Object.entries(m).sort((a, b) => b[1] - a[1])
  .map(([k, v]) => k + ' ' + (v * 100).toFixed(0) + '%').join(' / ');
let nMez = 0, nCoin = 0, nDisc = 0, nMudo = 0, nEmp = 0, nDup = 0;
for (const p of ps) {
  const declarado = new Map();
  for (const t of p.tags || []) {
    if (!t || !t.eje || !t.sentido) continue;
    if (NEUTRO4.has(String(t.sentido).toLowerCase())) continue;
    if (!declarado.has(t.eje)) declarado.set(t.eje, new Map());
    const m = declarado.get(t.eje);
    if (m.has(t.sentido)) {
      nDup++;
      console.log('  ' + p.id.padEnd(10) + t.eje.padEnd(10) + 'tag DUPLICADO: ' + t.sentido);
    }
    const w = t.peso_sentido == null ? 1 : t.peso_sentido;
    m.set(t.sentido, (m.get(t.sentido) || 0) + w);
  }
  for (const [eje, m] of declarado) {
    let total = 0;
    for (const v of m.values()) total += v;
    const dec = {};
    for (const [s, v] of m) dec[s] = total ? v / total : 0;
    nMez++;
    const etiq = '  ' + p.id.padEnd(10) + eje.padEnd(10) + 'declara ' + fmtMix(dec).padEnd(30);
    const auto = p.base && p.base[eje];
    if (!auto || !Object.keys(auto).length) {
      nMudo++;
      console.log(etiq + 'el motor no deduce nada (el tag es la unica fuente)');
      continue;
    }
    const ordDec = Object.entries(dec).sort((a, b) => b[1] - a[1]);
    const empate = ordDec.length > 1 && Math.abs(ordDec[0][1] - ordDec[1][1]) < 1e-9;
    const domAuto = Object.entries(auto).sort((a, b) => b[1] - a[1])[0][0];
    if (empate) {
      nEmp++;
      console.log(etiq + 'motor ' + fmtMix(auto).padEnd(30) + 'empate deliberado (sin dominante)');
    } else if (ordDec[0][0] === domAuto) {
      nCoin++;
      console.log(etiq + 'motor ' + fmtMix(auto).padEnd(30) + 'coinciden en ' + domAuto);
    } else {
      nDisc++;
      console.log(etiq + 'motor ' + fmtMix(auto).padEnd(30) + 'DISCREPA: el motor dice ' + domAuto);
    }
  }
}
if (!nMez) console.log('  todavia no hay tags que fijen acepcion.');
else console.log('  --> ' + nMez + ' mezclas: ' + nCoin + ' coinciden en el dominante, ' +
  nDisc + ' discrepan, ' + nEmp + ' empates deliberados, ' + nMudo + ' sobre ejes mudos' +
  (nDup ? ' (' + nDup + ' tags duplicados)' : ''));

/* ---------------------------------------------------- 5. ANULACIONES --------- */
linea('=');
console.log('5. ANULACIONES EXPLICITAS DE ACEPCION (revisar si son intencionales)');
console.log('   Desde el parche 6, applySenseTags solo vacia la mezcla de un eje si el tag');
console.log('   declara un sentido neutro (ninguno, neutral o sin_sentido). Un tag de eje');
console.log('   sin sentido, por ejemplo un tag de rol como faq, ya no anula nada: queda inerte.');
linea();
const NEUTRO_IDS = new Set(['ninguno', 'neutral', 'sin_sentido']);
let anuladas = 0;
for (const p of ps) {
  for (const t of p.tags || []) {
    if (!t || !t.eje || !t.sentido) continue;
    if (!NEUTRO_IDS.has(String(t.sentido).toLowerCase())) continue;
    if (!POLI_IDS.includes(t.eje)) continue;
    const habia = p.base && p.base[t.eje];
    anuladas++;
    console.log('  ' + p.id.padEnd(10) + 'rol ' + (t.rol || '-').padEnd(8) + ' sobre ' + t.eje.padEnd(10) +
      (habia ? 'ANULA a proposito ' + JSON.stringify(habia) : 'el motor no habia deducido nada'));
  }
}
if (!anuladas) console.log('  ninguna.');

console.log();
console.log('  tags de eje sin sentido sobre ejes polisemicos (inertes, no fijan ni anulan nada):');
let inertes = 0;
for (const p of ps) {
  for (const t of p.tags || []) {
    if (!t || !t.eje || t.sentido) continue;
    if (!POLI_IDS.includes(t.eje)) continue;
    inertes++;
    console.log('    ' + p.id.padEnd(10) + 'rol ' + (t.rol || '-').padEnd(8) + ' sobre ' + t.eje.padEnd(10) +
      '(revisar si le falta el campo sentido)');
  }
}
if (!inertes) console.log('    ninguno.');

/* ---------------------------------------------------- 6. DETALLE ------------- */
const detalle = todos ? POLI_IDS : (typeof ejeDetalle === 'string' ? [ejeDetalle] : []);
for (const ax of detalle) {
  if (!POLI_IDS.includes(ax)) { console.log('\nel eje "' + ax + '" no existe o no tiene sentidos'); continue; }
  linea('=');
  console.log('DETALLE: ' + ax);
  linea();
  for (const p of ps) {
    const hs = p.hits.filter((h) => AXID(h) === ax);
    if (!hs.length) continue;
    const m = p.mix && p.mix[ax];
    const etiq = !m ? '*** SIN ACEPCION (omision) - INMUNE ***'
      : (!Object.keys(m).length ? '*** ANULADA POR TAG - INMUNE ***' : JSON.stringify(m));
    console.log('  ' + p.id.padEnd(10) + (p.bekker || '?').padEnd(9) + etiq +
      ((p.pinned || []).includes(ax) ? '  [fijado a mano]' : ''));
    console.log('    ' + hs.map((h) => h.token + ' [' + (h.sense || 'nivel de eje') + ' ' + h.contrib.toFixed(2) + ']').join(', '));
  }
}
linea('=');
