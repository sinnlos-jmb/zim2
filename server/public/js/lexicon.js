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
    id: 'ergon', label: 'Función propia', greek: 'ἔργον',
    gr: ['ἔργον', 'ἔργα', 'οἰκεῖον', 'ἴδιον', 'ἀργόν'],
    // carpintero/zapatero sostienen la analogia del ergon en 7.g. Si se crea el
    // eje techne (artes y oficios), estos terminos se mudan alli.
    es: [['obra', 0.5], ['obras', 0.5], ['funcion', 0.6], 'función propia', 'tarea', 'oficio', 'propio del hombre', 'carpintero', 'zapatero'],
  },
  {
    id: 'arete', label: 'Virtud', greek: 'ἀρετή',
    aliases: ['arete', 'excelencia etica', 'excelencia moral'],
    gr: ['ἀρετή', 'ἀρεταί', 'σπουδαῖον', 'ἀνδρείαν', 'δίκαια', 'σωφροσύνη', 'διανοητικαί', 'ἠθικαί'],
    es: ['virtud', 'virtudes', 'excelencia', 'esforzado', 'valentía', 'justicia', 'justo', 'dianoetica', 'etica'],
  },
  {
    id: 'energeia', label: 'Actividad', greek: 'ἐνέργεια',
    // 'acto' lo descarta la guarda: "en acto" ya colapsa a ese mismo unigrama.
    aliases: ['energeia', 'acto', 'actualidad', 'estar en acto'],
    gr: ['ἐνέργεια', 'ἐνεργεῖν', 'ἐνέργειαι', 'πρᾶξις', 'πράξεις', 'πράττειν', 'κινήσεων'],
    es: ['actividad', 'actividades', 'en acto', 'ejercicio', 'obrar', 'accion', 'acciones', 'movimiento'],
  },
  {
    id: 'psyche', label: 'Alma', greek: 'ψυχή',
    aliases: ['psique', 'parte racional del alma', 'parte irracional'],
    gr: ['ψυχή', 'σώματος', 'ἄλογον', 'μόριον', 'ἐπιθυμητικόν', 'θρεπτικόν'],
    es: ['alma', 'cuerpo', 'irracional', 'apetitivo', 'nutritivo', 'vegetativo', 'partes del alma'],
  },
  {
    id: 'logos', label: 'Razón', greek: 'λόγος',
    gr: ['λόγος', 'λόγον ἔχον', 'νοῦς', '��ρόνησις', 'σοφία', 'σύνεσις', 'ἀλήθειαν', 'ὀρθῶς'],
    es: [['razon', 0.45], 'racional', 'entendimiento', 'prudencia', 'sabiduría', 'inteligencia', 'obedecer a la razon'],
  },
  {
    // HEXIS: el lado de la POSESION en el contraste tener/ejercer del libro I
    // (5.c, 8.d, 13.e). Por eso entran ktesis y katheudein: el que tiene la
    // virtud pero duerme. El lado del USO (chresis, energein) es de energeia.
    // NO se agrega ἀργόν: ya es de ergon, donde sostiene el argumento de 7.g.
    id: 'hexis', label: 'Hábito', greek: 'ἕξις',
    aliases: ['hexis', 'estado del alma', 'tener la virtud', 'virtud adquirida'],
    // Formas atestiguadas en el libro I. Ojo: en 5.c (καθεύδειν) y 4.b (ἔθεσιν)
    // el griego esta solo en el texto paralelo, que no se indexa; ahi el eje
    // entra por castellano. Se listan igual para cuando haya mas glosas.
    gr: ['ἕξιν', 'ἕξει', 'ἕξεων', 'ἔθος', 'ἔθη', 'ἔθεσιν', 'κτῆσις', 'κτήσει', 'καθεύδειν', 'καθεύδοντι'],
    es: [
      'habito', 'habitos', 'costumbre', 'acostumbrar', 'disposicion', 'disposiciones', 'ejercitar',
      // posesion inerte. Pesos bajos en los genericos: "poseer" e "inactivo"
      // aparecen tambien en 7.g y 10.c/10.i, donde el tema es otro.
      'dormido', 'durmiendo', 'duerme', 'sueno', 'sin ejercitar',
      ['poseer', 0.5], ['posee', 0.5], ['posesion', 0.5], ['inactivo', 0.5],
    ],
  },
  {
    id: 'hedone', label: 'Placer', greek: 'ἡδονή',
    gr: ['ἡδονήν', 'ἀπόλαυσις', 'ἀπολαυστικός'],
    es: ['placer', 'placeres', 'deleite', 'goce', 'gozar', 'gozan', 'vida de goce', 'sensual', 'bestias', 'vulgar'],
  },
  {
    id: 'time', label: 'Honor', greek: 'τιμή',
    aliases: ['prestigio', 'fama', 'recibir honores'],
    gr: ['τιμήν', 'τιμίων', 'τίμιόν', 'ἐπαινετῶν', 'ἐπαινοῦμεν', 'ἐπαίνων'],
    es: ['honor', 'honra', 'elogio', 'elogiable', 'reputacion', 'estima', 'alabanza', 'encomio'],
  },
  {
    id: 'ploutos', label: 'Riqueza', greek: 'πλοῦτος',
    gr: ['πλοῦτος', 'χρήσιμον', 'ὄργανα', 'χρηματιστής'],
    es: ['riqueza', 'riquezas', 'rico', 'ricos', 'dinero', 'util', 'utilidad', 'instrumento', 'negocio', 'lucro'],
  },
  {
    id: 'tyche', label: 'Fortuna', greek: 'τύχη',
    gr: ['τύχης', 'ἐκτός', 'εὐγένεια', 'φίλοι', 'μεταβολάς'],
    es: ['fortuna', 'azar', 'suerte', 'externos', 'bienes exteriores', 'amigos', 'salud', 'linaje', 'hijos', 'infortunio'],
  },
  {
    id: 'autarkeia', label: 'Autarquía', greek: 'αὐτάρκεια',
    // TELEIOS SALIO DE ACA. La autarkeia es una CONSECUENCIA de la teleiotes
    // (1097b6-8), no un sinonimo: teniendo ambos terminos en un solo eje,
    // 7.b marcaba Autarquia 0.912 sin contener la palabra autarkeia.
    gr: ['αὔταρκες', 'αὐταρκείας', 'αἱρετὸν', 'αἱρούμεθα'],
    // 'autosuficiencia' no es lo mismo que 'autosuficiente' para el stemmer
    // castellano: da 'autosuficienci' y no entraba por ninguna puerta.
    aliases: ['autosuficiencia', 'autarkeia', 'autosuficientes'],
    es: ['autosuficiente', 'autarquia', 'por si mismo', 'elegible', 'deseable', 'no necesita nada'],
  },
  {
    id: 'akribeia', label: 'Método', greek: 'ἀκρίβεια',
    gr: ['ἀκρίβειαν', 'μέθοδος', 'ὕλην', 'ὑποτυπῶσαι', 'ἐπαγωγῇ', 'ἐπισκεπτέον'],
    // kalos adverbial ("delimitar bien", "juzgar bien") es METODO, no lo noble.
    grForms: [['καλῶς', 0.6]],
    es: ['exactitud', 'rigor', 'metodo', 'bosquejo', 'materia', 'precision', 'contentarse', 'grandes rasgos', 'investigacion'],
  },
  {
    id: 'endoxa', label: 'Opiniones recibidas', greek: 'ἔνδοξα',
    aliases: ['que dice la gente', 'opinion comun', 'creencia comun', 'endoxa'],
    gr: ['δόξαν', 'συνᾴδει', 'λέγεται', 'σοφοί'],
    // οἱ πολλοί va por grForms (igualdad exacta) y no por gr (stem): el stem
    // πολλ- captura toda la familia de πολύς. Con 'πολλὰ' / 'πολλῶν' ('grandes
    // y numerosos', 1100b22 y 1101a12) el eje se activaba sin doxografia alguna.
    grForms: ['πολλοί', 'πολλοὶ'],
    // 'parece a todos' se retiro: colapsaba al unigrama 'parec' y disparaba en
    // 32/70 pasajes, midiendo un tic de la traduccion y no la doxografia.
    es: ['opinion', 'opiniones', 'los mas', 'la mayoria', 'vulgo', 'se dice', 'sabios', 'antiguos'],
  },
  {
    id: 'politike', label: 'Política', greek: 'πολιτική',
    // techne y los oficios estan aca solo porque el libro I los usa como
    // escalones del argumento arquitectonico. Es su lugar provisorio.
    gr: ['πολιτικὸν', 'ἀρχιτεκτονικῶν', 'νομοθέτης', 'νόμῳ', 'ἐπιστημῶν', 'τέχνη', 'δύναμιν'],
    es: ['politica', 'ciudad', 'legislador', 'ciencia', 'ciencias', 'arte', 'artes', 'arquitectonica', 'rectora', 'estrategia', 'medicina'],
  },
  {
    id: 'akroates', label: 'Oyente', greek: 'ἀκροατής',
    aliases: ['estudiante', 'alumno', 'capaz de aprender'],
    gr: ['ἀκροατής', 'νέος', 'ἄπειρος', 'παιδεία', 'μανθάνειν', 'γνῶσις'],
    es: ['joven', 'jovenes', 'oyente', 'inexperto', 'educacion', 'educado', 'aprender', 'ensenanza', 'pasiones', 'discipulo'],
  },
  {
    id: 'idea', label: 'Idea platónica', greek: 'ἰδέα',
    // NO poner 'el bien en si': con las stopwords fuera colapsa al unigrama
    // 'bien', que dispara en 45 pasajes. Medido. Ver COLLAPSED en vectorize.js.
    aliases: ['idea platonica', 'formas platonicas', 'idea del bien', 'bien separado'],
    // \u1F01\u03C0\u03BB\u1FF6\u03C2 retirado: es el adverbio "en sentido absoluto", no tiene
    // relacion con Platon. Falso amigo, como \u03C6\u03C5\u03C4\u03CC\u03BD/\u03C6\u03CD\u03C3\u03B9\u03C2 y \u1F14\u03B8\u03BD\u03BF\u03C2/\u1F14\u03B8\u03BF\u03C2.
    gr: ['ἰδέα', 'εἶδος', 'καθόλου', 'κοινόν', 'Πυθαγόρειοι'],
    es: ['idea', 'ideas', 'universal', 'en comun', 'separado', 'platon', 'pitagoricos', 'en si', 'amigos la verdad'],
  },
  {
    // BIOS: la vida BIOGRAFICA. El genero de vida que uno elige y el tramo que
    // dura. Por eso se dice bios teleios y nunca zoe teleia.
    // NO lleva el unigrama 'vida' ni 'toda la vida' (que colapsa a 'vida'):
    // esa era la puerta por la que el eje se volvia un detector de la palabra
    // 'vida' y aparecia en 26 de 70 pasajes, incluidos 5.a "completamente",
    // 7.g "caballo" y 3.c, donde no se habla de la vida de nadie.
    id: 'bios', label: 'Curso de vida', greek: 'βίος',
    gr: ['βίον', 'βίου', 'βίῳ', 'χρόνος'],
    aliases: ['cuanto dura la vida', 'a lo largo de la vida', 'que vida elegir', 'tipo de vida'],
    es: ['vida entera', 'vida completa', 'golondrina', 'un solo dia', ['tiempo', 0.5], 'mudanza', 'vicisitudes', 'genero de vida', 'generos de vida'],
  },
  {
    // ZOE: el VIVIR como actividad, no como biografia. Es el termino del
    // argumento del ergon (7.g, 7.h) y del eu zen (4.a, 8.b). Separado de
    // bios porque son dos conceptos distintos que compartian un solo eje.
    id: 'zoe', label: 'El vivir', greek: 'ζωή',
    gr: ['ζῆν', 'ζωή', 'ζωήν', 'ζωῆς', 'εὐζωία'],
    aliases: ['estar vivo', 'la vida humana', 'vida vegetativa'],
    es: [['vivir', 0.5], ['viviente', 0.5], ['vivientes', 0.5], ['vive', 0.5], ['viven', 0.5], 'vivir bien', 'plantas', 'animales'],
  },
  {
    // KALON: lo noble. Formas EXACTAS para no arrastrar el adverbio kalos
    // (que va a metodo) ni la belleza fisica de los atletas en 8.e.
    id: 'kalon', label: 'Lo noble', greek: 'καλόν',
    grForms: ['καλόν', 'καλὸν', 'καλά', 'καλὰ', 'καλῶν', 'καλαί', 'καλαὶ', 'καλαῖς', 'καλὴ', 'κάλλιον', 'κάλλιστα', 'κάλλιστον'],
    es: ['noble', 'nobles', 'hermoso', 'hermosa', 'hermosas', 'bello', 'bella', 'belleza', 'hechos nobles'],
  },
  {
    // THEION: lo divino en la praxis. Formas EXACTAS: la raiz "the-" arrastraria
    // theoria/theorein, que en el libro I significa casi siempre "examinar".
    id: 'theion', label: 'Lo divino', greek: 'θεῖον',
    grForms: [
      'θεῖον', 'θεῖόν', 'θείαν', 'θείων', 'θειότερον', 'θειότερόν', 'θειοτάτων',
      'θεός', 'θεοὺς', 'θεούς', 'θεῶν', 'θεῷ',
      ['μακάριον', 0.5], ['μακαρίους', 0.5], ['μακαρίζομεν', 0.5], ['μακαρίζει', 0.5],
    ],
    es: ['divino', 'divina', 'dios', 'dioses', 'bienaventurado', 'don de los dioses', 'providencia'],
  },
  {
    // ARKHE: en el libro I es sobre todo el punto de partida del RAZONAMIENTO
    // (4.b, 4.c, 4.d, 7.k, 8.a): los argumentos que parten de los principios
    // frente a los que conducen a ellos, el "que" como arche. En 12.d converge
    // con la causa: "principio y causa de los bienes" (arche kai aition).
    // NO entra el prefijo archi- de mando (architektonike, archikos, 1.b y
    // 2.b): es otra palabra y ese sentido ya vive en politike. El stem griego
    // los separa solo; verificado, df=8 sin 1.b ni 2.b.
    // Tampoco entra "comienzo": en 9.b es temporal ("lo que dijimos al
    // comienzo"), una referencia interna al tratado, no el concepto.
    id: 'arkhe', label: 'Principio', greek: 'ἀρχή',
    gr: ['ἀρχή', 'ἀρχὴ', 'ἀρχῆς', 'ἀρχῇ', 'ἀρχήν', 'ἀρχὴν', 'ἀρχάς', 'ἀρχὰς', 'ἀρχῶν'],
    es: ['principio', 'principios', 'punto de partida'],
  },
  {
    // TELEIOS: lo completo o acabado. Concepto propio, no un matiz de la
    // autarkeia. Cubre la cadena teleion -> autarkes -> eudaimonia del cap. 7
    // y el bios teleios, que ahora se pide combinando este eje con 'Curso de
    // vida'. Una forma griega POR STEM: teleion/teleios/teleion(gen. pl.)/
    // teleiotaton/teleioteron/teleioutai cubren los siete stems distintos.
    id: 'teleios', label: 'Lo completo', greek: 'τέλειος',
    gr: ['τέλειον', 'τέλειος', 'τελείων', 'τελειότατον', 'τελειότερον', 'τελειοῦται'],
    aliases: ['teleios', 'fin perfecto', 'fin acabado'],
    es: ['perfecto', 'perfecta', 'perfectos', 'perfectas', ['completo', 0.5], ['acabado', 0.5], ['cabal', 0.5], ['pleno', 0.5]],
  },
];

export const DEFAULT_WEIGHTS = { gr: 1.0, grForms: 1.0, es: 0.5 };

/* ---------------------------------------------------------------- GRUPOS ----
 * Familias tematicas de los ejes. Capa de ORGANIZACION, no de calculo:
 * el espacio vectorial sigue siendo plano y los 26 ejes siguen siendo
 * independientes entre si. Los grupos solo deciden como se muestran los chips
 * y, mas adelante, de que nodo padre cuelga cada eje en el grafo.
 *
 * Nada de lo que hay aca entra en vectorize() ni en topK(). Si algun dia se
 * usa el grupo para modular la cobertura o la relegacion, ese sera un cambio
 * de motor y hay que medirlo aparte.
 *
 * zoe va con psyche y no con bios: 'el vivir' es el principio vital del alma,
 * mas cerca de la antropologia que de la arquitectura del bien.
 * teleios va con autarkeia: son las dos condiciones que el cap. 7 le exige a
 * la eudaimonia, y salieron de la misma particion.
 */
export const AXIS_GROUPS = [
  { id: 'g1', label: 'Arquitectura del bien', axes: ['telos', 'agathon', 'ariston', 'eudaimonia', 'autarkeia', 'teleios', 'bios'] },
  { id: 'g2', label: 'Antropología y virtud', axes: ['ergon', 'arete', 'energeia', 'hexis', 'psyche', 'zoe', 'logos'] },
  { id: 'g3', label: 'Bienes rivales', axes: ['hedone', 'time', 'ploutos', 'tyche'] },
  { id: 'g4', label: 'Calificadores', axes: ['kalon', 'theion'] },
  { id: 'g5', label: 'Método y audiencia', axes: ['akribeia', 'endoxa', 'akroates'] },
  { id: 'g6', label: 'Polémica filosófica', axes: ['idea'] },
  { id: 'g7', label: 'Principios y estructura', axes: ['arkhe', 'politike'] },
];

// Guarda: todo eje pertenece a exactamente un grupo. Si se agrega un eje a
// AXES y se olvida el grupo, la interfaz lo perderia en silencio. Preferimos
// que reviente al cargar.
const _asignados = AXIS_GROUPS.flatMap((g) => g.axes);
const _huerfanos = AXES.filter((a) => !_asignados.includes(a.id)).map((a) => a.id);
const _repetidos = _asignados.filter((id, i) => _asignados.indexOf(id) !== i);
const _fantasmas = _asignados.filter((id) => !AXES.some((a) => a.id === id));
if (_huerfanos.length || _repetidos.length || _fantasmas.length) {
  throw new Error(`AXIS_GROUPS inconsistente | sin grupo: ${_huerfanos} | repetidos: ${_repetidos} | inexistentes: ${_fantasmas}`);
}

// Ejes en orden de grupo, para recorrer la sidebar sin rearmar el mapeo.
export const AXES_BY_GROUP = AXIS_GROUPS.map((g) => ({
  ...g,
  items: g.axes.map((id) => AXES.find((a) => a.id === id)),
}));
