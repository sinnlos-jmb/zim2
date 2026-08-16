// parse.js - convierte el .txt de la traduccion en unidades estructuradas.
import { greekRatio, hasGreek } from './normalize.js';

const NL = String.fromCharCode(10);
const RULE = /^[\u2550\u2500\s]+$/;
const CHAPTER = /^\s*(\d{1,2})\s*$/;
const TAG_LINE = /^\{\s*"parrafo_nro"\s*:/;
const BEKKER_TOKEN = /(1[01]\d{2}[ab])|\[(\d{1,2})\]/g;
const CPL_FALLBACK = 60;

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
    if (last && n === 1 && last.line === 1 && m.index - last.off <= 8) continue;
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
  let pendingTag = null;
  let pendingTagLine = -1;
  // tag vigente del bloque actual: una vez asignada a la primera linea de
  // un parrafo con punto aparte (varias lineas sin renglon en blanco entre
  // ellas), se sigue aplicando a las lineas siguientes del MISMO bloque que
  // no traigan su propio tag. Se resetea al vaciar el bloque (flush).
  let blockTag = null;

  /* Identidad de parrafo.
   *
   * El chunker necesita saber de que parrafo salio cada linea para no armar
   * nunca un pasaje a caballo de dos. "Un renglon en blanco" no alcanza como
   * criterio: una linea de tag en medio de un bloque abre un parrafo nuevo sin
   * que haya renglon en blanco (por eso bufTags es por linea y no por bloque).
   * parSeq avanza en los dos casos, asi que dos lineas comparten parId si y
   * solo si pertenecen al MISMO parrafo. Los numeros no son consecutivos ni
   * significan nada: solo tienen que ser distintos y estables dentro de una
   * corrida. El numero editorial sigue siendo parrafoNro, que puede faltar. */
  let parSeq = 0;
  let bufPars = [];

  const flush = () => {
    if (!buf.length) return;
    const text = buf.join(NL);
    blocks.push({
      chapter,
      lines: buf.slice(),
      tags: bufTags.slice(),
      pars: bufPars.slice(),
      kind: greekRatio(text) > 0.6 ? 'gr' : 'es',
    });
    buf = [];
    bufTags = [];
    bufPars = [];
    blockTag = null;
    parSeq++;
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
      return;
    }
    if (RULE.test(t)) { flush(); return; }
    const ch = t.match(CHAPTER);
    if (ch) { flush(); chapter = Number(ch[1]); return; }
    if (chapter === null) return;
    buf.push(t);
    if (pendingTag) {
      // un tag que aparece en medio de un bloque empieza un parrafo nuevo
      // aunque no haya renglon en blanco antes
      if (buf.length > 1) parSeq++;
      blockTag = pendingTag;
      pendingTag = null;
    }
    bufTags.push(blockTag);
    bufPars.push(parSeq);
  });
  if (pendingTag) {
    tagWarnings.push(
      'parrafo_nro ' + pendingTag.parrafo_nro + ' (linea ' + (pendingTagLine + 1) +
      ') se descarta: quedo al final del archivo sin parrafo siguiente',
    );
  }
  flush();

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
        parId: b.pars[j],
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
    .replace(/\s+([,.;:!?\u00bb])/g, '$1')
    .replace(/([\u00ab\u00bf\u00a1])\s+/g, '$1')
    .trim();
}
