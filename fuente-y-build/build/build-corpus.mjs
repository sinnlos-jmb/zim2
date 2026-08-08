import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseSource, spanishOnly } from '../src/parse.js';
import { grStem, grSurfaceForms, grStrip } from '../src/normalize.js';

const SRC = process.argv[2] || '/data/en1/app/EN_libro1_v7_tags_fixed.txt';
const OUT = '/data/en1/app/data';
fs.mkdirSync(OUT, { recursive: true });

const raw = fs.readFileSync(SRC, 'utf8');
const units = parseSource(raw);
if (units.tagWarnings && units.tagWarnings.length) {
  console.log('=== AVISOS DE TAGS ===');
  units.tagWarnings.forEach((w) => console.log('  ! ' + w));
}

const hash = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 12);

/* ---------------------------------------------------- CHUNKER ---------------- */
// Regla: unidad argumental de 80-200 palabras.
//  - fusionar unidades cortas (<70) con la vecina del mismo capitulo
//  - dividir unidades largas (>200) en conectores argumentales

const CONNECTORS = [
  'Ademas', 'Adem\u00e1s', 'Por otra parte', 'Pero como', 'Y si', 'Es evidente',
  'Sin embargo', 'Por tanto', 'Por consiguiente', 'Asimismo', 'En efecto',
  'Pero acaso', 'Pero tal vez', 'Acaso', 'Y as\u00ed', 'Ahora bien', 'Pero si',
  'De igual modo', 'Del mismo modo', 'Por lo dem\u00e1s', 'Y puesto que', 'Puesto que',
];

function splitLong(u) {
  if (u.words <= 200) return [u];
  // cortar en limites de oracion cercanos a conectores
  const sentences = u.es.match(/[^.;]+[.;]+\s*/g) || [u.es];
  const parts = [];
  let cur = '';
  let curWords = 0;
  for (const s of sentences) {
    const w = s.split(/\s+/).filter(Boolean).length;
    const startsConnector = CONNECTORS.some((c) => s.trimStart().startsWith(c));
    if (cur && curWords >= 80 && (startsConnector || curWords + w > 200)) {
      parts.push(cur.trim());
      cur = s;
      curWords = w;
    } else {
      cur += s;
      curWords += w;
    }
  }
  if (cur.trim()) parts.push(cur.trim());
  if (parts.length < 2) return [u];
  return parts.map((text, i) => ({
    ...u,
    es: text,
    words: text.split(/\s+/).filter(Boolean).length,
    splitIndex: i,
    splitOf: parts.length,
    greekParallel: i === 0 ? u.greekParallel : null,
    // el tag describe el parrafo ORIGINAL completo: se conserva solo en el
    // primer fragmento para no hacer aparecer el mismo tag 2-3 veces.
    tags: i === 0 ? u.tags : [],
    parrafoNro: i === 0 ? u.parrafoNro : null,
  }));
}

// 1. dividir largos
let work = units.flatMap(splitLong);

// 2. fusionar cortos con el vecino del mismo capitulo
const merged = [];
for (const u of work) {
  const prev = merged[merged.length - 1];
  if (prev && u.words < 70 && prev.chapter === u.chapter && prev.words + u.words <= 230) {
    prev.es = prev.es + ' ' + u.es;
    prev.words = prev.es.split(/\s+/).filter(Boolean).length;
    prev.greekParallel = [prev.greekParallel, u.greekParallel].filter(Boolean).join(' ') || null;
    prev.mergedCount = (prev.mergedCount || 1) + 1;
    // dos parrafos con tags propios pueden terminar en la misma unidad final:
    // se acumulan todos, no se pisan.
    prev.tags = [...(prev.tags || []), ...(u.tags || [])];
    prev.parrafoNros = [...(prev.parrafoNros || (prev.parrafoNro != null ? [prev.parrafoNro] : [])), ...(u.parrafoNro != null ? [u.parrafoNro] : [])];
  } else {
    merged.push({ ...u });
  }
}

/* ---------------------------------------------------- IDs + GLOSAS ----------- */
const byChapter = {};
const passages = merged.map((u) => {
  byChapter[u.chapter] = (byChapter[u.chapter] || 0) + 1;
  const letter = String.fromCharCode(96 + byChapter[u.chapter]);
  const glosses = (u.es.match(/\(([^()]*)\)/g) || [])
    .map((g) => g.slice(1, -1).trim())
    .filter((g) => /[\u0370-\u03FF\u1F00-\u1FFF]/.test(g));
  return {
    id: `EN.I.${u.chapter}.${letter}`,
    chapter: u.chapter,
    bekker: u.bekker,
    words: u.words,
    es: u.es,
    esOnly: spanishOnly(u.es),
    glosses,
    greekParallel: u.greekParallel,
    textHash: hash(u.es),
    vectorizedFrom: null,
    vector: null,
    translationStatus: 'draft',
    parrafoNros: u.parrafoNros || (u.parrafoNro != null ? [u.parrafoNro] : []),
    tags: u.tags || [],
  };
});

/* ---------------------------------------------------- GLOSARIO --------------- */
const lemmas = new Map();
for (const p of passages) {
  for (const g of p.glosses) {
    for (const form of grSurfaceForms(g)) {
      const key = grStem(form);
      if (key.length < 3) continue;
      if (!lemmas.has(key)) lemmas.set(key, { stem: key, forms: new Map(), passages: new Set() });
      const e = lemmas.get(key);
      e.forms.set(form, (e.forms.get(form) || 0) + 1);
      e.passages.add(p.id);
    }
  }
}

const glossary = [...lemmas.values()]
  .map((e) => {
    const forms = [...e.forms.entries()].sort((a, b) => b[1] - a[1]);
    return {
      stem: e.stem,
      canonical: forms[0][0],
      total: forms.reduce((s, f) => s + f[1], 0),
      formCount: forms.length,
      forms: forms.map(([f, n]) => ({ form: f, n })),
      passages: [...e.passages],
      passageCount: e.passages.size,
    };
  })
  .sort((a, b) => b.total - a.total || b.passageCount - a.passageCount);

/* ---------------------------------------------------- SALIDA ----------------- */
fs.writeFileSync(path.join(OUT, 'corpus.json'), JSON.stringify({ version: 1, source: 'EN libro I', builtAt: new Date().toISOString(), passages }, null, 1));
fs.writeFileSync(path.join(OUT, 'glossary.json'), JSON.stringify({ version: 1, lemmas: glossary }, null, 1));

/* ---------------------------------------------------- REPORTE ---------------- */
const w = passages.map((p) => p.words).sort((a, b) => a - b);
const pct = (q) => w[Math.floor((w.length - 1) * q)];
console.log('=== CHUNKING ===');
console.log('unidades crudas del parser :', units.length);
console.log('tras dividir/fusionar      :', passages.length);
console.log(`palabras: min ${w[0]} | p25 ${pct(0.25)} | mediana ${pct(0.5)} | p75 ${pct(0.75)} | max ${w[w.length - 1]}`);
console.log('fuera de rango 70-230      :', passages.filter((p) => p.words < 70 || p.words > 230).length);
console.log('sin referencia Bekker      :', passages.filter((p) => !p.bekker).length);
console.log('con griego paralelo        :', passages.filter((p) => p.greekParallel).length);

const tagRoles = {};
let taggedParagraphs = 0;
for (const p of passages) {
  if (p.parrafoNros && p.parrafoNros.length) taggedParagraphs += p.parrafoNros.length;
  for (const t of p.tags) tagRoles[t.rol] = (tagRoles[t.rol] || 0) + 1;
}
console.log('\n=== TAGS ===');
console.log('parrafos numerados (tags)  :', taggedParagraphs);
console.log('pasajes con algun rol      :', passages.filter((p) => p.tags.length).length);
for (const [rol, n] of Object.entries(tagRoles)) console.log(`  rol "${rol}" \u00d7 ${n}`);

console.log('\n=== POR CAPITULO ===');
for (let c = 1; c <= 13; c++) {
  const ps = passages.filter((p) => p.chapter === c);
  if (!ps.length) continue;
  console.log(`  cap ${String(c).padStart(2)} : ${String(ps.length).padStart(2)} pasajes  ${ps[0].bekker || '?'} -> ${ps[ps.length - 1].bekker || '?'}`);
}

console.log('\n=== GLOSARIO ===');
console.log('lemas unicos      :', glossary.length);
console.log('con >1 forma      :', glossary.filter((g) => g.formCount > 1).length);
console.log('en >=3 pasajes    :', glossary.filter((g) => g.passageCount >= 3).length);
console.log('\ntop 25 por frecuencia:');
console.log('  ' + 'lema'.padEnd(16) + 'tot  pas  formas');
for (const g of glossary.slice(0, 25)) {
  const fl = g.forms.map((f) => `${f.form}\u00d7${f.n}`).join(', ');
  console.log(`  ${g.canonical.padEnd(16)}${String(g.total).padStart(3)}${String(g.passageCount).padStart(5)}  ${fl}`);
}
