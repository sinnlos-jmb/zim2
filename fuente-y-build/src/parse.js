// parse.js - convierte el .txt de la traduccion en unidades estructuradas.
//
// Estructura del archivo fuente:
//   <n>          encabezado de capitulo
//   ----         regla decorativa
//   <bloque ES>  1..n lineas, cada una un parrafo de la traduccion
//   <bloque GR>  1..n lineas, el griego original paralelo
//
// Cada bloque ES se aparea con el bloque GR inmediatamente siguiente.

import { greekRatio, hasGreek } from './normalize.js';

const NL = String.fromCharCode(10);
const RULE = /^[\u2550\u2500\s]+$/;
const CHAPTER = /^\s*(\d{1,2})\s*$/;
// Centinela de tags: una linea JSON pegada justo antes del parrafo que
// describe. NO es contenido de la traduccion: se saca del stream de lineas
// y su carga (`tags`) se ata al proximo parrafo que se empuje a `buf`.
// Formato: { "parrafo_nro": N, "tags": [ { "rol": ..., ... }, ... ] }
// `tags` es opcional: un renglon puede solo numerar el parrafo (tagueo
// parcial) sin describir ningun rol todavia.
const TAG_LINE = /^\{\s*"parrafo_nro"\s*:/;
// Un solo token, escaneado en ORDEN: pagina Bekker o numero de linea.
// Tomarlos con dos regex independientes producia referencias inventadas
// (p.ej. "1098b30") en los pasajes que cruzan un cambio de pagina, porque la
// linea salia de una pagina y el numero de pagina de la siguiente.
// Los corchetes editoriales de Bywater ([prakticais], [makarizomen]) no
// interfieren porque el token exige digitos.
const BEKKER_TOKEN = /(1[01]\d{2}[ab])|\[(\d{1,2})\]/g;
const CPL_FALLBACK = 60;

// 1099a -> 1099b -> 1100a
function advancePage(p) {
  const n = Number(p.slice(0, 4));
  return p[4] === 'a' ? String(n) + 'b' : String(n + 1) + 'a';
}

function buildMarkers(stream) {
  const out = [];
  const warnings = [];
  let page = null;
  let m;
  BEKKER_TOKEN.lastIndex = 0;
  while ((m = BEKKER_TOKEN.exec(stream))) {
    if (m[1]) {
      page = m[1];
      out.push({ off: m.index, page, line: 1 });
      continue;
    }
    if (!page) continue;
    const n = Number(m[2]);
    const last = out[out.length - 1];
    // "1097b [1]": el [1] repite el marcador de pagina recien emitido.
    if (last && n === 1 && last.line === 1 && m.index - last.off <= 8) continue;
    // Los numeros de linea solo crecen dentro de una pagina. Si retroceden,
    // en el fuente falta el marcador de pagina. Se repara y se avisa, para
    // que un marcador perdido no arrastre el error por todo un capitulo.
    if (last && last.page === page && n <= last.line) {
      const from = page;
      page = advancePage(page);
      warnings.push(
        'falta el marcador de pagina ' + page + ' en el fuente (tras ' +
        from + String(last.line) + ', se reanuda en ' + page + String(n) + ')'
      );
    }
    out.push({ off: m.index, page, line: n });
  }
  return { markers: out, warnings };
}

// Los marcadores van de cinco en cinco, asi que la distancia entre dos da
// una escala de caracteres por linea Bekker. Se usa la mediana.
function charsPerLine(markers) {
  const s = [];
  for (let i = 1; i < markers.length; i++) {
    const a = markers[i - 1];
    const b = markers[i];
    if (a.page !== b.page || b.line <= a.line) continue;
    s.push((b.off - a.off) / (b.line - a.line));
  }
  if (!s.length) return CPL_FALLBACK;
  s.sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
}

// Referencia en un punto del stream: ULTIMO marcador en o antes del punto,
// mas las lineas transcurridas desde ahi. Nunca un marcador posterior.
function refAt(markers, cpl, off) {
  let lo = 0;
  let hi = markers.length - 1;
  let k = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (markers[mid].off <= off) { k = mid; lo = mid + 1; } else hi = mid - 1;
  }
  if (k < 0) return { page: null, line: null };
  const a = markers[k];
  const b = markers[k + 1];
  let step = cpl;
  if (b && b.page === a.page && b.line > a.line) {
    step = (b.off - a.off) / (b.line - a.line);
  }
  let line = a.line + Math.round((off - a.off) / step);
  if (b && b.page === a.page && line > b.line) line = b.line;
  if (line < a.line) line = a.line;
  return { page: a.page, line };
}

export function parseSource(raw) {
  const lines = raw.split(/\r?\n/);

  const blocks = [];
  const tagWarnings = [];
  let chapter = null;
  let buf = [];
  let bufTags = [];
  // centinela pendiente: tag ya leido que todavia no encontro su parrafo
  let pendingTag = null;
  let pendingTagLine = -1;

  const flush = () => {
    if (!buf.length) return;
    const text = buf.join(NL);
    blocks.push({
      chapter,
      lines: buf.slice(),
      tags: bufTags.slice(),
      kind: greekRatio(text) > 0.6 ? 'gr' : 'es',
    });
    buf = [];
    bufTags = [];
  };

  lines.forEach((line, i) => {
    const t = line.trim();
    if (!t) { flush(); return; }
    if (TAG_LINE.test(t)) {
      if (pendingTag) {
        tagWarnings.push(
          'parrafo_nro ' + pendingTag.parrafo_nro + ' (linea ' + (pendingTagLine + 1) +
          ') se descarta: no hubo parrafo antes del siguiente tag',
        );
      }
      try {
        pendingTag = JSON.parse(t);
        pendingTagLine = i;
      } catch (e) {
        tagWarnings.push('linea ' + (i + 1) + ' parece un tag pero no es JSON valido: ' + e.message);
        pendingTag = null;
      }
      return; // el centinela nunca entra al cuerpo de la traduccion
    }
    if (RULE.test(t)) { flush(); return; }
    const ch = t.match(CHAPTER);
    if (ch) { flush(); chapter = Number(ch[1]); return; }
    if (chapter === null) return;
    buf.push(t);
    bufTags.push(pendingTag);
    pendingTag = null;
  });
  if (pendingTag) {
    tagWarnings.push(
      'parrafo_nro ' + pendingTag.parrafo_nro + ' (linea ' + (pendingTagLine + 1) +
      ') se descarta: quedo al final del archivo sin parrafo siguiente',
    );
  }
  flush();

  // Stream griego en orden de documento, con offsets por bloque y por linea.
  // El cursor avanza sobre este stream, no sobre cada bloque por separado.
  let stream = '';
  const grPos = new Map();
  for (const g of blocks) {
    if (g.kind !== 'gr') continue;
    const start = stream.length;
    const lineOffsets = [];
    g.lines.forEach((ln, k) => {
      if (k) stream += NL;
      lineOffsets.push(stream.length);
      stream += ln;
    });
    grPos.set(g, { start, end: stream.length, lineOffsets });
    stream += NL;
  }
  const { markers, warnings } = buildMarkers(stream);
  const cpl = charsPerLine(markers);

  const units = [];
  let seq = 0;
  let cursor = 0;

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.kind !== 'es') continue;
    const next = blocks[i + 1];
    const gr = next && next.kind === 'gr' ? next : null;
    const aligned = Boolean(gr) && gr.lines.length === b.lines.length;
    const pos = gr ? grPos.get(gr) : null;

    // Si el griego no viene linea a linea, se reparte el tramo del bloque
    // en proporcion al largo de cada parrafo castellano.
    const esLens = b.lines.map((l) => l.length);
    const esTotal = esLens.reduce((a, c) => a + c, 0) || 1;
    let acc = 0;

    b.lines.forEach((esLine, j) => {
      let grLine = '';
      let off = cursor;
      if (aligned) {
        grLine = gr.lines[j];
        off = pos.lineOffsets[j];
      } else if (gr) {
        if (j === 0) grLine = gr.lines.join(NL);
        off = pos.start + Math.round((pos.end - pos.start) * (acc / esTotal));
      }
      acc += esLens[j];

      const r = refAt(markers, cpl, off);
      const ref = r.page ? r.page + String(r.line) : null;

      const tagEntry = b.tags[j];
      units.push({
        seq: seq++,
        chapter: b.chapter,
        bekker: ref,
        bekkerPage: r.page,
        bekkerApprox: !aligned,
        es: esLine,
        greekParallel: grLine || null,
        aligned,
        glosses: extractGlosses(esLine),
        words: esLine.split(/\s+/).filter(Boolean).length,
        parrafoNro: tagEntry ? tagEntry.parrafo_nro : null,
        tags: tagEntry && tagEntry.tags ? tagEntry.tags : [],
      });
    });

    if (pos) cursor = pos.end;
  }

  units.bekkerWarnings = warnings;
  units.tagWarnings = tagWarnings;
  return units;
}

export function extractGlosses(esLine) {
  const out = [];
  for (const m of esLine.matchAll(/\(([^()]*)\)/g)) {
    const inner = m[1].trim();
    if (hasGreek(inner)) out.push(inner);
  }
  return out;
}

export function spanishOnly(esLine) {
  return esLine
    .replace(/\([^()]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?\u00bb])/g, '$1')   // "insuficiente , pues" -> "insuficiente, pues"
    .replace(/([\u00ab\u00bf\u00a1])\s+/g, '$1')
    .trim();
}
