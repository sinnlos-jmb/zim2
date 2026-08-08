// normalize.js — capa de normalizacion. Se usa SOLO para indexar/buscar.
// Nunca se muestra al usuario: la UI siempre renderiza el texto original.

const GREEK_CHAR = /[\u0370-\u03FF\u1F00-\u1FFF]/;

export const hasGreek = (s) => GREEK_CHAR.test(s);

export function greekRatio(s) {
  const letters = [...s].filter((c) => /\p{L}/u.test(c));
  if (!letters.length) return 0;
  return letters.filter((c) => GREEK_CHAR.test(c)).length / letters.length;
}

/* ---------------------------------------------------------------- CASTELLANO */

export const ES_STOP = new Set(
  ('a al algo alguna algunas alguno algunos ante antes aquel aquella aquellas aquello aquellos aqui asi aun aunque cada como con contra cual cuales cuando de del desde donde dos e el ella ellas ello ellos en entre era eran es esa esas ese eso esos esta estan estas este esto estos ha han hay la las le les lo los mas me mi mientras misma mismo mismas mismos mucha muchas mucho muchos muy nada ni no nos nosotros o os otra otras otro otros para pero poco por porque pues que quien quienes se sea sean segun ser si sin sino sobre solo son su sus tal tales tambien tanto te toda todas todo todos tras un una unas uno unos y ya').split(' ')
);

// sufijos castellanos, de mas largo a mas corto
const ES_SUF = [
  'amientos','imientos','amiento','imiento','aciones','iciones','adoras','adores',
  'ancias','encias','ismos','istas','ables','ibles','anzas','icos','icas','ismo',
  'able','ible','ista','osos','osas','ivos','ivas','anza','icar','izar','ando',
  'iendo','arse','erse','irse','ador','idad','ivo','iva','oso','osa','ico','ica',
  'ion','dad','mente','ar','er','ir','os','as','es','a','o','e','s',
];

export function esNormalize(s) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // quita tildes latinas
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function esStem(w) {
  if (w.length <= 4) return w;
  for (const suf of ES_SUF) {
    if (w.endsWith(suf) && w.length - suf.length >= 4) return w.slice(0, -suf.length);
  }
  return w;
}

export function esTokens(text) {
  return esNormalize(text)
    .split(' ')
    .filter((w) => w && w.length > 2 && !ES_STOP.has(w))
    .map(esStem);
}

/* -------------------------------------------------------------------- GRIEGO */

// articulos, particulas y pronombres que aparecen dentro de glosas multi-palabra
export const GR_STOP = new Set(
  ('και τε δε μεν ο η το τον την τω τη τα των τους τας οι αι του της γαρ ουν δη '
  + 'αλλα αλλ περι προς εν εις εκ εξ απο κατα κατ καθ δια δι μη ου ουκ ουχ ως ει αν '
  + 'τι τις τινα τινος τουτο ταυτα τουτων αυτο αυτου αυτων αυτο αυτη ουτος ουτω '
  + 'μαλλον ετι ηδη νυν οτι εαν ινα τε γε μεντοι ουδε μηδε ειτε ουτε μητε παρα παρ '
  + 'υπο υπερ συν μετα επι εφ αφ ωσπερ οσον οσα ουδεν πας πασα παν εστι ειναι').split(/\s+/)
);

// terminaciones de declinacion/conjugacion, de mas larga a mas corta
const GR_SUF = [
  'ουσιν','οντων','ωσιν','ουσα','οντα','ασιν','εσθαι','ηναι','εων','ιων','ους',
  'ωσι','ατος','ατι','ατα','ων','ας','ης','οι','αι','ες','εα','ον','αν','ην',
  'ῳ','ᾳ','ῃ','ω','α','η','ο','ε','ι','ν','σ',
];

// quita diacriticos politonicos, marcas de elision y unifica sigma final
export function grStrip(s) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f\u0345]/g, '')      // acentos, espiritus, iota suscrita
    .replace(/[\u1FBD\u1FBF\u1FFE\u2019\u02BC']/g, '') // apostrofo de elision: κατ᾽ -> κατ
    .normalize('NFC')
    .toLowerCase()
    .replace(/ς/g, 'σ');
}

// la stoplist se compara SIEMPRE normalizada (bug: 'τας' !== 'τασ')
let GR_STOP_N = null;
export function isGrStop(token) {
  if (!GR_STOP_N) GR_STOP_N = new Set([...GR_STOP].map(grStrip));
  return GR_STOP_N.has(grStrip(token));
}

export function grStem(w) {
  const base = grStrip(w);
  if (base.length <= 4) return base;
  for (const suf of GR_SUF) {
    const s = grStrip(suf);
    if (base.endsWith(s) && base.length - s.length >= 4) return base.slice(0, -s.length);
  }
  return base;
}

const GR_TOKEN = /[\u0370-\u03FF\u1F00-\u1FFF]+/g;

export function grTokens(text) {
  return (text.match(GR_TOKEN) || [])
    .filter((t) => !isGrStop(t))
    .map(grStem)
    // 2 en vez de 3: particulas/adverbios breves como "εὖ" (bien) quedan en
    // 2 caracteres una vez sacados los diacriticos y antes valian cero: el
    // termino se cargaba en el lexico pero nunca entraba al indice. Las
    // palabras vacias de 2 letras ya estan cubiertas por GR_STOP, asi que
    // bajar el piso no mete ruido: solo habilita los pocos terminos de
    // contenido de 2 letras que alguien liste a mano en el lexico.
    .filter((t) => t.length >= 2);
}

// devuelve las formas originales (para el glosario), sin stemming
export function grSurfaceForms(text) {
  return (text.match(GR_TOKEN) || []).filter((t) => !isGrStop(t));
}
