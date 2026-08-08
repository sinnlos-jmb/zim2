// lexicon.js - los 23 ejes semanticos del libro I de la Etica Nicomaquea.
//
// Cada eje puede tener:
//   gr      : lemas griegos, se comparan por RAIZ (stemming). Peso por defecto 1.0
//   grForms : formas griegas EXACTAS, sin stemming. Para terminos con homonimia
//             fuerte donde la raiz confundiria sentidos distintos (kalon/kalos,
//             theion/theoria). Peso por defecto 1.0
//   es      : palabras castellanas, se comparan por raiz. Peso por defecto 0.5
//   aliases : COMO SE NOMBRA el concepto. Mismo canal y mismo peso que `es`.
//             Se diferencia de `es` por su funcion, no por su mecanica:
//               es      -> vocabulario que APARECE en la traduccion
//               aliases -> vocabulario con que el ESTUDIANTE pregunta
//             Un alias puede tener df 0 y servir igual, porque el mismo
//             pipeline vectoriza los pasajes y las consultas: nadie escribe
//             "lo mejor" al preguntar, escribe "el sumo bien".
//             Los alias se cargan ultimos y con guarda antiduplicados: agregar
//             uno solo puede sumar cobertura nueva, nunca duplicar peso.
//             Es la lista pensada para editar sin miedo desde el dashboard.
//   senses  : SENTIDOS de un mismo eje polisemico (ver ergon y energeia).
//             NO son ejes nuevos: el vector sigue teniendo UNA componente por
//             eje y el espacio sigue teniendo la misma cantidad de
//             dimensiones. Cada sentido declara sus propios lemas (gr /
//             grForms / es) y un `weight` opcional que multiplica el peso de
//             esos lemas. Cada aporte queda ATRIBUIDO a su sentido, y de ahi
//             sale la mezcla del pasaje: { obra: 0.8, funcion: 0.2 }.
//             Es mezcla y no etiqueta unica a proposito: en 7.g-7.i
//             Aristoteles usa los dos sentidos de ergon a la vez, y ese
//             deslizamiento es el argumento mismo.
//             Un tag manual en el .txt pisa la mezcla calculada:
//               { "parrafo_nro": 42, "tags": [{"eje": "ergon", "sentido": "obra"}] }
//
// Cualquier termino admite la forma [termino, peso] para ajustarlo caso por caso.

export const AXES = [
  {
    id: 'telos', label: 'Fin', greek: 'τέλος',
    gr: ['τέλος', 'τέλη', 'ἐφίεσθαι', 'προαίρεσις', 'πρακτῶν', 'ἕνεκα'],
    es: [['fin', 0.5], ['fines', 0.5], 'tender', 'tienden', ['aquello a que', 0.6], 'en vista de', 'subordinada', 'subordinan'],
  },
  {
    // AGATHON: los bienes, en plural y enumerables. NO el bien supremo (ver ariston).
    id: 'agathon', label: 'Bienes', greek: 'ἀγαθόν',
    gr: ['ἀγαθόν', 'τἀγαθόν', 'ἀγαθά', 'ἀγαθῶν', 'ἀγαθοὺς', 'εὖ', ['βέλτιον', 0.4]],
    es: [['bien', 0.2], ['bienes', 0.35], ['bueno', 0.3], ['buenas', 0.3]],
  },
  {
    // ARISTON: el fin unico y superlativo. Se apoya en el griego; el castellano
    // "mejor" es comparativo corriente en 30/70 pasajes y quedaria fuera.
    id: 'ariston', label: 'Bien supremo', greek: 'ἄριστον',
    gr: ['ἄριστον', 'ἀρίστην', 'ἀρίσταις', 'ἀρίστων', 'βέλτιστον', 'ἀκρότατον', 'κυριώτατα'],
    // OJO: nada de "mejor" suelto. Es comparativo corriente en 30/70 pasajes.
    // Tampoco "lo mejor de todo": colapsa al unigrama "mejor" al quitar stopwords.
    // Las cuatro expresiones castellanas de abajo tienen df 0: la traduccion
    // dice "lo mejor", nunca "el sumo bien". Viven del lado de la consulta.
    aliases: ['mayor bien', 'bien ultimo', 'fin ultimo'],
    es: ['bien supremo', 'sumo bien', 'fin supremo', 'bien mas alto', ['supremo', 0.3], ['optimo', 0.4]],
  },
  {
    id: 'eudaimonia', label: 'Felicidad', greek: 'εὐδαιμονία',
    aliases: ['eudaimonia', 'buena vida', 'vida feliz', 'florecimiento'],
    gr: ['εὐδαιμονία', 'εὐδαιμονεῖν', 'εὐδαιμονίζομεν', 'εὐπραξία', 'ἄθλιος', ['μακαρίους', 0.5]],
    es: ['felicidad', 'feliz', 'felices', 'dichoso', 'vivir bien', 'obrar bien', 'desdichado', 'venturoso'],
  },
  {
    // ERGON: eje con dos sentidos, declarados abajo en `senses`.
    //   funcion -> la funcion propia. Es el argumento del cap. 7 (7.g, 7.h, 7.i)
    //   obra    -> la obra o el hecho hecho (1.a, 7.k, 10.d, 12.b, 12.d)
    // Medido sobre los 72 pasajes: fuera del cap. 7 casi todo es 'obra'.
    //
    // LIMPIEZA: οἰκεῖον e ἴδιον SALIERON del eje. Eran un "propio de" generico
    // y arrastraban 3.c, 5.b y 6.a, que no hablan de ergon en absoluto. 7.h y
    // 7.k no se pierden: ya entran por ἔργον.
    //
    // Las formas de ἔργον no se declaran aca sino en cada sentido, y por
    // grForms (igualdad exacta) en lugar de gr (raiz): el stem εργ- no
    // distingue singular de plural, y la oposicion ἔργον / ἔργα es justamente
    // la pista principal del sentido.
    id: 'ergon', label: 'Función propia', greek: 'ἔργον',
    // carpintero/zapatero sostienen la analogia del ergon en 7.g y no eligen
    // sentido: se quedan en el eje. Si se crea el eje techne, se mudan alli.
    es: ['carpintero', 'zapatero'],
    aliases: ['ergon'],
    senses: [
      {
        id: 'funcion', label: 'función propia', greek: 'ἔργον',
        // ἀργόν ("inactivo") con peso menor: es el reverso del argumento en 7.h
        grForms: ['ἔργον', 'ἔργου', 'ἔργῳ', ['ἀργόν', 0.5], ['ἀργὸν', 0.5]],
        es: [['funcion', 0.6], 'función propia', '