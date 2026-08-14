// patch-expresiones.mjs -- canal de expresiones griegas literales (gw) + sentidos de idea y teleios.
// Uso:  node patch-expresiones.mjs [ruta/a/src]
// No escribe nada si algun pre-flight falla. Deja backups .bak-<ts> junto a cada archivo.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const buscar = () => {
  let d = HERE;
  for (let i = 0; i < 6; i++) {
    for (const c of [path.join(d, 'src'), path.join(d, 'fuente-y-build', 'src')]) {
      if (fs.existsSync(path.join(c, 'lexicon.js')) && fs.existsSync(path.join(c, 'vectorize.js'))) return c;
    }
    d = path.dirname(d);
  }
  return null;
};
const SRC = process.argv[2] ? path.resolve(process.argv[2]) : buscar();
if (!SRC) {
  console.error('!! no encontre src/lexicon.js. Corre:  node patch-expresiones.mjs ruta/a/src');
  process.exit(1);
}
console.log('  src: ' + SRC);

let FAIL = 0;
const fail = (m) => { console.error('  !! ' + m); FAIL++; };
const leer = (f) => {
  const raw = fs.readFileSync(path.join(SRC, f), 'utf8');
  return { crlf: raw.includes('\r\n'), texto: raw.replace(/\r\n/g, '\n') };
};

// ------------------------------------------------------------------ griego
const IDEA = '\u1F30\u03B4\u03AD\u03B1';
const EIDOS = '\u03B5\u1F36\u03B4\u03BF\u03C2';
const EIDE = '\u03B5\u1F34\u03B4\u03B7';
const KATHOLOU = '\u03BA\u03B1\u03B8\u03CC\u03BB\u03BF\u03C5';
const KOINON = '\u03BA\u03BF\u03B9\u03BD\u03CC\u03BD';
const PYTH = '\u03A0\u03C5\u03B8\u03B1\u03B3\u03CC\u03C1\u03B5\u03B9\u03BF\u03B9';
const KHORISTON = '\u03C7\u03C9\u03C1\u03B9\u03C3\u03C4\u03CC\u03BD';
const AUTOEKASTON = '\u03B1\u1F50\u03C4\u03BF\u03AD\u03BA\u03B1\u03C3\u03C4\u03BF\u03BD';
const KATH = '\u03BA\u03B1\u03B8\u1FBD';
const DI = '\u03B4\u03B9\u1FBD';
const HAUTO_A = '\u03B1\u1F51\u03C4\u03CC';
const HAUTA = '\u03B1\u1F51\u03C4\u03AC';
const HAUTO_G = '\u03B1\u1F51\u03C4\u1F78';
const HAUTON = '\u03B1\u1F51\u03C4\u1F78\u03BD';
const HAUTAS = '\u03B1\u1F51\u03C4\u1F70\u03C2';
const HEN = '\u1F15\u03BD';
const TI = '\u03C4\u03AF';
const ESTI = '\u1F10\u03C3\u03C4\u03B9';
const PROS = '\u03C0\u03C1\u03CC\u03C2';
const TI_ENC = '\u03C4\u03B9';
const TO_DAT = '\u03C4\u1FF7';
const DIOKTON = '\u03B4\u03B9\u03C9\u03BA\u03C4\u03CC\u03BD';
const ALLO = '\u1F04\u03BB\u03BB\u03BF';
const HEDYS = '\u1F21\u03B4\u03CD\u03C2';
const HEDEIAI = '\u1F21\u03B4\u03B5\u1FD6\u03B1\u03B9';
const POS = '\u03C0\u1FF6\u03C2';
const EKHEIN = '\u1F14\u03C7\u03B5\u03B9\u03BD';
const TELEION = '\u03C4\u03AD\u03BB\u03B5\u03B9\u03BF\u03BD';
const TELEIOS = '\u03C4\u03AD\u03BB\u03B5\u03B9\u03BF\u03C2';
const TELEION_PL = '\u03C4\u03B5\u03BB\u03B5\u03AF\u03C9\u03BD';
const TELEIOUTAI = '\u03C4\u03B5\u03BB\u03B5\u03B9\u03BF\u1FE6\u03C4\u03B1\u03B9';
const TELEIOTATON = '\u03C4\u03B5\u03BB\u03B5\u03B9\u03CC\u03C4\u03B1\u03C4\u03BF\u03BD';
const TELEIOTERON = '\u03C4\u03B5\u03BB\u03B5\u03B9\u03CC\u03C4\u03B5\u03C1\u03BF\u03BD';
const lista = (ws) => "['" + ws.join("', '") + "']";

// ============================================================ 1. vectorize.js
const V = leer('vectorize.js');
let vt = V.texto;
const CANAL = [
  "const GW_W = 0.4;   // peso del canal de expresiones. Medido: es el mayor peso que no",
  "                    // altera ningun eje dominante de los 72 pasajes del libro I.",
  '// Canal "gw": expresiones griegas literales, enumeradas una por una en el lexico',
  '// (campo grExpr, en el eje o en un sentido). grKeep borra los acentos TONALES pero',
  '// CONSERVA los espiritus, y no estemea ni filtra stopwords. Eso distingue dos pares',
  '// minimos que los otros canales no pueden ver:',
  '//    hen "uno" (dasia)        vs  en "en" (psili, y es stopword)',
  '//    hauto reflexivo (dasia)  vs  auto "eso mismo" (psili)',
  '// y mantiene separadas ti esti de ti estin, que el stemmer unifica en "esti".',
  '// Por eso la whitelist tiene que ser enumerada: un detector automatico de',
  '// expresiones romperia los 36 colapsos utiles que hoy funcionan bien.',
  "const TONAL = /[\\u0300\\u0301\\u0342\\u0345\\u0303\\u0304\\u0306\\u0308]/g;",
  "const APOS_G = /[\\u1FBD\\u1FBF\\u1FFE\\u2019\\u02BC']/g;",
  "const GR_ANY = /[\\u0370-\\u03FF\\u1F00-\\u1FFF]+/g;",
  "const grKeep = (w) => String(w).normalize('NFD').replace(TONAL, '').replace(APOS_G, '').normalize('NFC').toLowerCase().replace(/\\u03c2/g, '\\u03c3');",
  "const grExprTokens = (text) => (String(text).match(GR_ANY) || []).map(grKeep).filter(Boolean);",
].join('\n');

const EDITS_V = [
  { buscar: "const grExactTokens = (text) => grSurfaceForms(text).map(grStrip).filter((t) => t.length >= 2);",
    poner: CANAL + '\n' + "const grExactTokens = (text) => grSurfaceForms(text).map(grStrip).filter((t) => t.length >= 2);" },
  { buscar: "  const gxUni = new Map(), gxPhr = new Map();",
    poner: "  const gxUni = new Map(), gxPhr = new Map();\n  const gwUni = new Map(), gwPhr = new Map();" },
  { buscar: "    load(ax.grForms, grExactTokens, gxUni, gxPhr, DEFAULT_WEIGHTS.grForms, 'gx');",
    poner: "    load(ax.grForms, grExactTokens, gxUni, gxPhr, DEFAULT_WEIGHTS.grForms, 'gx');\n    load(ax.grExpr, grExprTokens, gwUni, gwPhr, GW_W, 'gw');" },
  { buscar: "      load(sn.grForms, grExactTokens, gxUni, gxPhr, DEFAULT_WEIGHTS.grForms, 'gx', sn.id, sw);",
    poner: "      load(sn.grForms, grExactTokens, gxUni, gxPhr, DEFAULT_WEIGHTS.grForms, 'gx', sn.id, sw);\n      load(sn.grExpr, grExprTokens, gwUni, gwPhr, GW_W, 'gw', sn.id, sw);" },
  { buscar: "  return { esUni, esPhr, grUni, grPhr, gxUni, gxPhr };",
    poner: "  return { esUni, esPhr, grUni, grPhr, gxUni, gxPhr, gwUni, gwPhr };" },
  { buscar: "  accumulate(grExactTokens(greek), IX.gxUni, IX.gxPhr, 'gr', vec, hits);",
    poner: "  accumulate(grExactTokens(greek), IX.gxUni, IX.gxPhr, 'gr', vec, hits);\n  accumulate(grExprTokens(greek), IX.gwUni, IX.gwPhr, 'gw', vec, hits);" },
];
if (vt.includes('grExprTokens')) fail('vectorize.js ya tiene el canal de expresiones: no hago nada');
else for (const e of EDITS_V) {
  const n = vt.split(e.buscar).length - 1;
  if (n !== 1) fail('vectorize.js: la marca aparece ' + n + ' veces (esperaba 1) -> ' + e.buscar.trim().slice(0, 55));
  else vt = vt.replace(e.buscar, e.poner);
}

// ============================================================== 2. lexicon.js
const L = leer('lexicon.js');
let lineas = L.texto.split('\n');
const bloque = (id) => {
  const i = lineas.findIndex((l) => l.includes("id: '" + id + "'"));
  if (i < 0) { fail('no encontre el eje ' + id); return null; }
  let j = i;
  while (j < lineas.length && !/^ {2}\},/.test(lineas[j])) j++;
  return { from: i, to: j };
};
const clave = (b, k) => {
  for (let i = b.from; i <= b.to; i++) if (lineas[i].trim().startsWith(k + ':')) return i;
  return -1;
};
// reparte las palabras de una linea gr entre destinos; lo no reconocido se queda en el eje
const repartir = (idx, mapa) => {
  const hay = (lineas[idx].match(/'([^']*)'/g) || []).map((s) => s.slice(1, -1));
  const conocidas = new Set(Object.keys(mapa));
  const sobran = hay.filter((w) => !conocidas.has(w));
  const faltan = [...conocidas].filter((w) => !hay.includes(w));
  return { hay, sobran, faltan };
};

// ---- teleios (de abajo hacia arriba para no invalidar indices)
const bT = bloque('teleios');
if (bT) {
  const gi = clave(bT, 'gr');
  const ei = clave(bT, 'es');
  if (gi < 0 || ei < 0) fail('teleios: no encontre gr/es');
  else if (clave(bT, 'senses') >= 0) fail('teleios ya tiene senses');
  else {
    const r = repartir(gi, { [TELEION]: 1, [TELEIOS]: 1, [TELEION_PL]: 1, [TELEIOTATON]: 1, [TELEIOTERON]: 1, [TELEIOUTAI]: 1 });
    if (r.faltan.length) fail('teleios.gr no tiene ' + r.faltan.length + ' de las palabras esperadas');
    else {
      lineas[gi] = '    gr: ' + lista([TELEION, TELEIOS, TELEION_PL, TELEIOTERON, TELEIOUTAI].concat(r.sobran)) + ',';
      lineas.splice(ei + 1, 0,
        '    senses: [',
        '      {',
        "        id: 'absoluto',",
        "        label: 'completo en sentido absoluto',",
        "        greek: '" + TELEIOTATON + "',",
        '        gr: ' + lista([TELEIOTATON]) + ',',
        '        grExpr: ' + lista([KATH + ' ' + HAUTO_G + ' ' + DIOKTON]) + ',',
        '      },',
        '      {',
        "        id: 'relativo',",
        "        label: 'm\u00e1s completo que otro',",
        "        greek: '" + TELEIOTERON + "',",
        '        grExpr: ' + lista([DI + ' ' + ALLO]) + ',',
        '      },',
        '    ],');
      if (r.sobran.length) console.log('  aviso teleios.gr: deje sin tocar ' + r.sobran.length + ' termino(s) que no esperaba');
    }
  }
}

// ---- idea
const bI = bloque('idea');
if (bI) {
  const gi = clave(bI, 'gr');
  const ei = clave(bI, 'es');
  if (gi < 0 || ei < 0) fail('idea: no encontre gr/es');
  else if (clave(bI, 'senses') >= 0) fail('idea ya tiene senses');
  else {
    const r = repartir(gi, { [IDEA]: 1, [EIDOS]: 1, [EIDE]: 1, [KATHOLOU]: 1, [KOINON]: 1, [PYTH]: 1, [KHORISTON]: 1, [AUTOEKASTON]: 1 });
    if (r.faltan.length) fail('idea.gr no tiene ' + r.faltan.length + ' palabra(s) esperada(s): aplicaste el commit de las 4 palabras?');
    else {
      lineas[gi] = '    gr: ' + lista([PYTH].concat(r.sobran)) + ',';
      lineas[ei] = "    es: ['platon', 'pitagoricos', 'amigos la verdad'],";
      lineas.splice(ei + 1, 0,
        '    senses: [',
        '      {',
        "        id: 'separada',",
        "        label: 'el bien separado (en s\u00ed)',",
        "        greek: '" + KHORISTON + "',",
        '        gr: ' + lista([IDEA, EIDOS, EIDE, KHORISTON, AUTOEKASTON]) + ',',
        '        grExpr: ' + lista([KATH + ' ' + HAUTO_A, KATH + ' ' + HAUTA, HEN]) + ',',
        "        es: ['idea', 'separado', 'en si'],",
        '      },',
        '      {',
        "        id: 'categorial',",
        "        label: 'el bien dicho en muchas categor\u00edas',",
        "        greek: '" + KATHOLOU + "',",
        '        gr: ' + lista([KATHOLOU, KOINON]) + ',',
        '        grExpr: ' + lista([TI + ' ' + ESTI, PROS + ' ' + TI_ENC, TO_DAT + ' ' + TI_ENC]) + ',',
        "        es: ['universal', 'en comun'],",
        '      },',
        '    ],');
      if (r.sobran.length) console.log('  aviso idea.gr: deje sin tocar ' + r.sobran.length + ' termino(s) que no esperaba');
    }
  }
}

// ---- hedone, hexis, telos: solo agregan grExpr
const SIMPLES = [
  { id: 'hedone', tras: 'es', expr: [KATH + ' ' + HAUTON + ' ' + HEDYS, KATH + ' ' + HAUTAS + ' ' + HEDEIAI] },
  { id: 'hexis', tras: 'gr', expr: [PROS + ' ' + TI_ENC + ' ' + POS + ' ' + EKHEIN] },
  { id: 'telos', tras: 'es', expr: [DI + ' ' + HAUTO_A, DI + ' ' + HAUTA] },
];
for (const s of SIMPLES) {
  const b = bloque(s.id);
  if (!b) continue;
  if (clave(b, 'grExpr') >= 0) { fail(s.id + ' ya tiene grExpr'); continue; }
  const at = clave(b, s.tras);
  if (at < 0) { fail(s.id + ': no encontre la linea ' + s.tras); continue; }
  lineas.splice(at + 1, 0, '    grExpr: ' + lista(s.expr) + ',');
}

// ================================================================= 3. ui.js
let ut = null, U = null;
const UI = path.join(SRC, 'ui.js');
if (fs.existsSync(UI) && fs.statSync(UI).size > 200) {
  U = leer('ui.js');
  const m = U.texto.match(/en1:index:v(\d+)/);
  if (!m) console.log('  AVISO: no encontre en1:index:vNN en ui.js. Subi el STORE_KEY a mano: invalida el indice cacheado en el navegador.');
  else {
    const nuevo = 'en1:index:v' + (Number(m[1]) + 1);
    ut = U.texto.split(m[0]).join(nuevo);
    console.log('  ui.js: STORE_KEY ' + m[0] + ' -> ' + nuevo);
  }
} else console.log('  AVISO: ui.js no esta en src (o es un stub). Subi el STORE_KEY a mano en ui.js: en1:index:vNN -> vNN+1');

// ================================================== 4. build/check-lexicon.mjs
// El pre-flight cuenta terminos por canal. Sin esta edicion marca como VACIO
// cualquier sentido que solo tenga expresiones (grExpr): seria un falso aviso.
let ct = null, CK = null;
const CKP = path.resolve(SRC, '..', 'build', 'check-lexicon.mjs');
if (!fs.existsSync(CKP)) {
  console.log('  AVISO: no encontre build/check-lexicon.mjs. Si lo corres sin actualizar va a marcar el sentido "relativo" como VACIO: es un falso aviso.');
} else {
  const rawck = fs.readFileSync(CKP, 'utf8');
  CK = { crlf: rawck.includes('\r\n'), texto: rawck.replace(/\r\n/g, '\n') };
  if (CK.texto.includes('gwUni')) {
    console.log('  check-lexicon.mjs ya cuenta el canal de expresiones');
  } else {
    const cl = CK.texto.split('\n');
    const ix = cl.findIndex((l) => l.includes("['gx', V.INDEX.gxPhr]"));
    if (ix < 0) fail('check-lexicon.mjs: no encontre la lista de canales');
    else {
      const ind = (cl[ix].match(/^[ \t]*/) || [''])[0];
      cl.splice(ix + 1, 0, ind + "['gw', V.INDEX.gwUni],", ind + "['gw', V.INDEX.gwPhr],");
      let t = cl.join('\n');
      const EDITS_C = [
        { buscar: '{ es: 0, gr: 0, gx: 0 }', poner: '{ es: 0, gr: 0, gx: 0, gw: 0 }', veces: 3 },
        { buscar: "es   gr   gx')", poner: "es   gr   gx   gw')", veces: 1 },
        { buscar: 'const total = c.es + c.gr + c.gx', poner: 'const total = c.es + c.gr + c.gx + c.gw', veces: 1 },
        { buscar: '${String(base.gx).padStart(4)}`', poner: '${String(base.gx).padStart(4)} ${String(base.gw).padStart(4)}`', veces: 1 },
        { buscar: '${String(c.gx).padStart(4)}${aviso}`', poner: '${String(c.gx).padStart(4)} ${String(c.gw).padStart(4)}${aviso}`', veces: 1 },
      ];
      let malas = 0;
      for (const e of EDITS_C) {
        const n = t.split(e.buscar).length - 1;
        if (n !== e.veces) { fail('check-lexicon.mjs: la marca aparece ' + n + ' veces (esperaba ' + e.veces + ') -> ' + e.buscar.slice(0, 42)); malas++; }
        else t = t.split(e.buscar).join(e.poner);
      }
      if (!malas) ct = t;
    }
  }
}

// ================================================================= escribir
if (FAIL > 0) {
  console.error('\n  PRE-FLIGHT FALLIDO (' + FAIL + '): no escribi nada.');
  process.exit(1);
}
const ts = Date.now();
const guardar = (f, texto, o) => {
  const p = path.join(SRC, f);
  fs.copyFileSync(p, p + '.bak-' + ts);
  fs.writeFileSync(p, o.crlf ? texto.replace(/\n/g, '\r\n') : texto, 'utf8');
  console.log('  ok ' + f + '   (backup ' + f + '.bak-' + ts + ')');
};
guardar('vectorize.js', vt, V);
if (ct !== null && CK) {
  fs.copyFileSync(CKP, CKP + '.bak-' + ts);
  fs.writeFileSync(CKP, CK.crlf ? ct.replace(/\n/g, '\r\n') : ct, 'utf8');
  console.log('  ok build/check-lexicon.mjs   (backup .bak-' + ts + ')');
}
guardar('lexicon.js', lineas.join('\n'), L);
if (ut !== null && U) guardar('ui.js', ut, U);
console.log('\n  Listo. Ahora, en este orden:');
console.log('    1) node fuente-y-build/build/check-lexicon.mjs fuente-y-build/src     -> 26 ejes, 0 duplicados, 7 colapsos');
console.log('    2) node fuente-y-build/build/regresion.mjs                            -> va a marcar diferencias: son los cambios buscados');
console.log('    3) node fuente-y-build/build/regresion.mjs --guardar                  -> fija el estado nuevo como baseline');