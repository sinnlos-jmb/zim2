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
//             Dos sentidos del mismo eje a la vez van en DOS tags con el
//             mismo "eje" y su propio "peso_sentido" (ver applySenseTags en
//             vectorize.js):
//               { "parrafo_nro": 43, "tags": [
//                   {"eje": "arete", "sentido": "etica", "peso_sentido": 0.8},
//                   {"eje": "arete", "sentido": "dianoetica", "peso_sentido": 0.2}
//               ] }
//
// Cualquier termino admite la forma [termino, peso] para ajustarlo caso por caso.

export const AXES = [
  {
    id: 'telos', label: 'Fin', greek: 'τέλος',
    gr: ['τέλος', 'τέλη', 'ἐφίεσθαι', 'προαίρεσις', 'ἕνεκα'],
    es: [['fin', 0.5], ['fines', 0.5], 'tender', 'tienden', ['aquello a que', 0.6], 'en vista de', 'subordinada', 'subordinan'],
  },
  {
    // AGATHON: los bienes, en plural y enumerables. NO el bien supremo (ver ariston).
    id: 'agathon', label: 'Bienes', greek: 'ἀγαθόν',
    gr: ['ἀγαθόν', 'τἀγαθόν', 'εὖ', ['βέλτιον', 0.4]],
    es: [['bien', 0.2], ['bueno', 0.3]],
  },
  {
    // ARISTON: el fin unico y superlativo. Se apoya en el griego; el castellano
    // "mejor" es comparativo corriente en 30/70 pasajes y quedaria fuera.
    id: 'ariston', label: 'Bien supremo', greek: 'ἄριστον',
    gr: ['ἄριστον', 'ἀρίσταις', 'βέλτιστον', 'ἀκρότατον', 'κυριώτατα'],
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
    es: ['felicidad', 'feliz', 'dichoso', 'vivir bien', 'obrar bien', 'desdichado', 'venturoso'],
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
        grForms: ['ἔργον', 'ἔργου', 'ἔργῳ', ['ἀργόν', 0.5]],
        es: [['funcion', 0.6], 'función propia', 'tarea', 'oficio', 'propio del hombre'],
        aliases: ['funcion caracteristica', 'funcion del hombre', 'para que sirve el hombre'],
      },
      {
        id: 'obra', label: 'obra, hecho realizado', greek: 'ἔργα',
        grForms: ['ἔργα', 'ἔργων', 'ἔργοις'],
        es: [['obra', 0.5], 'hechos realizados'],
        aliases: ['obra realizada', 'hechos y obras', 'las obras del hombre'],
      },
    ],
  },
  {
    // ARETE: eje con dos sentidos, declarados abajo en `senses`.
    //   etica      -> virtudes del caracter (valentia, justicia, templanza...)
    //   dianoetica -> virtudes del intelecto (techne, phronesis, sophia...)
    // Cuando el parrafo habla de la virtud en general sin distinguir tipo, no
    // se tagea ningun sentido: el eje queda neutral, igual que
    // carpintero/zapatero en ergon.
    // 'etica' (palabra suelta) BAJO al sentido 'etica'. El comentario viejo la
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
    es: ['virtud', 'excelencia', 'esforzado'],
    senses: [
      {
        id: 'etica', label: 'virtud ética (del carácter)', greek: 'ἠθική',
        // Formas adjetivas de σώφρων/ἀνδρεῖος y "valiente"/"templado" sumadas
        // tras revisar 13.g (parrafo 50): el eje daba 0 pese a nombrar
        // sophrosyne/andreia, porque solo tenia las formas sustantivas
        // (σωφροσύνη, ἀνδρείαν) y el stem no une adjetivo con sustantivo.
        // Medido contra los 72 pasajes: solo mueven 12.b, 13.g y 13.h, sin
        // ninguna regresion. ἐγκρατοῦς/"continente" queda afuera a proposito:
        // en 13.f y 13.g es ejemplo de la estructura del alma, no la virtud
        // en discusion, y es un concepto aristotelico distinto (la
        // continencia, libro VII) que todavia no se midio.
        gr: ['ἀνδρείαν', 'δίκαια', 'σωφροσύνη', 'ἠθικαί', 'ἀνδρείου', 'σώφρονος', 'σώφρων'],
        es: ['valentía', 'justicia', 'justo', 'valiente', 'templado', 'etica'],
        // continente/incontinente entran SOLO como alias, coherente con
        // la nota de arriba: siguen fuera del indice del corpus (no son
        // la virtud en discusion en 13.f/13.g) pero ya no son invisibles
        // para la busqueda libre, que hasta ahora no devolvia NADA y
        // dejaba el tema colgado del unico tag manual de 13.f.
        aliases: ['virtud moral', 'virtudes del caracter', 'excelencia moral', 'excelencia etica', 'continente', 'incontinente', 'continencia', 'el continente y el incontinente'],
      },
      {
        id: 'dianoetica', label: 'virtud dianoética (del intelecto)', greek: 'διανοητική',
        // φρόνησις/σοφία/σύνεσις y sus castellanos VINIERON de logos: nombran
        // virtudes del intelecto, no la facultad. Estaban solo como aliases
        // (lado consulta), asi que 13.h --el parrafo que dice que la
        // sabiduria, la inteligencia y la prudencia son dianoeticas-- no
        // llegaba a este sentido por si solo y hubo que tagearlo a mano.
        // A mirar: 4.b (parrafo 18) los nombra en una lista doxografica de
        // bienes candidatos; ahi el sentido activa sin discutir la virtud.
        gr: ['διανοητικαί', 'φρόνησις', 'σοφία', 'σύνεσις'],
        es: ['dianoetica', 'prudencia', 'sabiduría'],
        aliases: ['techne', 'phronesis', 'sophia', 'episteme', 'nous'],
      },
    ],
  },
  {
    // ENERGEIA: eje con dos sentidos, declarados abajo en `senses`.
    //   acto   -> el estar-en-acto, ἐνέργεια propiamente dicha
    //   accion -> la praxis humana, πρᾶξις / πράττειν
    //
    // LIMPIEZA MEDIDA: πρᾶξις y πράττειν activaban este eje en 26 de los 72
    // pasajes, y 17 de ellos NO contienen una sola ocurrencia de ἐνέργεια. El
    // eje "Actividad" era en realidad dos ejes solapados. Ahora la praxis
    // entra por el sentido 'accion' con weight 0.4: sigue aportando, pero un
    // pasaje que solo habla de acciones ya no pesa como uno que habla del
    // estar-en-acto.
    //
    // κινήσεων salio del todo: aparecia solo en 13.e, que ya entra por
    // ἐνέργεια, y en Aristoteles la kinesis se OPONE a la energeia.
    // 'obrar' tambien salio: su raiz castellana es la misma que la de 'obra'
    // (eje ergon), asi que no puede distinguir un sentido de otro.
    id: 'energeia', label: 'Actividad', greek: 'ἐνέργεια',
    // 'acto' lo descarta la guarda: "en acto" ya colapsa a ese mismo unigrama.
    // Solo queda arriba el nombre del eje, que es neutral entre los dos
    // sentidos. Cada alias que SI elige un sentido baja al sentido: si se queda
    // aca, la consulta activa el eje sin decir en que acepcion pregunta.
    aliases: ['energeia'],
    senses: [
      {
        id: 'acto', label: 'estar-en-acto', greek: 'ἐνέργεια',
        gr: ['ἐνέργεια'],
        // 'en acto' SALIO de es: con las stopwords fuera colapsa al unigrama
        // 'acto', y las unicas cuatro ocurrencias castellanas de "acto/actos"
        // en el libro son 1.c, 7.a y 7.c ("el fin de nuestros actos",
        // πρακτῶν: lo realizable, con τέλος en la misma glosa) y 7.e ("hay
        // que tomarla en acto", κατ᾽ ἐνέργειαν). O sea 3 de 4 le daban el
        // sentido 'acto' a pasajes cuyo tema es la accion, invirtiendo el
        // sentido dominante. La cuarta, la legitima, ya entra por la glosa.
        // Efecto lateral bueno: el alias 'acto' estaba MUERTO, porque
        // 'en acto' ocupaba la clave es|acto y la guarda DUPLICATE_TERMS lo
        // descartaba en silencio. Ahora revive del lado de la consulta.
        //
        // 'ejercicio' bajo a aliases: sus dos unicas ocurrencias estan en
        // 9.b (parrafo 34), "por algun otro ejercicio", "cierto aprendizaje
        // o ejercicio", que es la ADQUISICION de la eudaimonia (hexis) y no
        // el estar-en-acto. Ojo: hexis no lo caza, porque 'ejercitar' stemea
        // ejercit y 'ejercicio' stemea ejercici.
        es: ['actividad', 'actividades'],
        aliases: ['acto', 'actualidad', 'estar en acto', 'estar en obra', 'ejercicio', 'being at work'],
      },
      {
        id: 'accion', label: 'acción, praxis', greek: 'πρᾶξις', weight: 0.4,
        gr: ['πρᾶξις', 'πράξεις', 'πράττειν', 'πρακτῶν'],
        es: ['accion'],
        // Las tres frases nuevas son alias de CONSULTA: la pregunta libre
        // "las cosas que se pueden hacer" no devolvia nada porque ninguno
        // de sus tokens [cosa, pueden, hacer] estaba en el lexico. Hacen
        // falta las dos formas: 'pueden' no stemea igual que 'puede', asi
        // que "lo que se puede hacer" da [pued, hacer] y la otra
        // [cosa, pueden, hacer]. Del lado del corpus el concepto ya entra
        // por la glosa πρακτῶν, que esta en este mismo sentido: los
        // pasajes son 1094a19 y 1097a15.
        aliases: ['praxis', 'accion humana', 'conducta', 'lo que se puede hacer', 'las cosas que se pueden hacer', 'lo realizable'],
      },
    ],
  },
  {
    id: 'psyche', label: 'Alma', greek: 'ψυχή',
    aliases: ['psique', 'parte racional del alma', 'parte irracional'],
    gr: ['ψυχή', 'σώματος', 'ἄλογον', 'μόριον', 'ἐπιθυμητικόν', 'θρεπτικόν'],
    es: ['alma', 'cuerpo', 'irracional', 'apetitivo', 'nutritivo', 'vegetativo', 'partes del alma'],
  },
  {
    // LOGOS: eje con dos sentidos, declarados abajo en `senses`.
    //   razon     -> la facultad racional: κατὰ λόγον, μετὰ λόγου, τὸ λόγον ἔχον
    //   argumento -> el razonamiento del tratado: οἱ λόγοι, μαρτυρεῖ τῷ λόγῳ
    //
    // El eje "Razón" era en realidad dos ejes solapados, igual que lo era
    // "Actividad" antes de separar acto de accion. Medido sobre los 72
    // pasajes: 5 parrafos usan el argumento (6, 9, 21, 30, 38) y 5 la
    // facultad (7, 26, 27, 37, 49/50). Casi la mitad del eje no hablaba de
    // la razon como potencia del alma sino del hilo argumental del libro.
    //
    // Las formas van por grForms (igualdad exacta) y no por gr (raiz): el
    // stem λογ- no distingue el λόγον que se TIENE del λόγος que se
    // ARGUMENTA, y el caso gramatical los separa casi sin ruido, igual que
    // la oposicion ἔργον / ἔργα en ergon.
    //   acusativo/genitivo (λόγον, λόγου) -> facultad
    //   nominativo/plural/dativo (λόγος, λόγοι, λόγοις, λόγῳ) -> argumento
    //
    // OJO con 6.d (parrafo 16): ahi λόγος es la DEFINICION ("la definicion
    // de hombre en si mismo"), un tercer uso que cae en 'argumento' por la
    // regla de caso. Es el pasaje a mirar si el sentido queda raro; su tema
    // real es la polemica con Platon (eje idea).
    //
    // SALIERON DEL EJE:
    //   'λόγον ἔχον' : termino muerto. Frase de dos tokens, y la glosa
    //                  indexada dice solo (λόγον); ἔχοντος vive en el griego
    //                  paralelo, que no se indexa. Nunca matcheo.
    //   'racional'   : df 0. La unica forma que aparece en el libro es
    //                  'irracional' (13.f-13.g), que es de psyche. Sobrevive
    //                  como alias 'parte racional', del lado de la consulta.
    //   φρόνησις, σοφία, σύνεσις, 'prudencia', 'sabiduría' -> arete/dianoetica.
    //                  Nombran VIRTUDES, no la facultad. Estando aca, un
    //                  pasaje que las nombraba puntuaba logos y nunca
    //                  arete/dianoetica: por eso 13.h necesito tag manual.
    //   ἀλήθειαν, ὀρθῶς -> akribeia. En los pasajes medidos son metodo
    //                  ("mostrar la verdad a grandes rasgos", "juzgar
    //                  rectamente"), nunca la facultad. Mismo caso que καλῶς.
    //
    // 'razon' baja de 0.45 a 0.3: es un detector de modismos de la
    // traduccion ("con razon" 1.a, "por esta razon" 4.b, "muchas razones"
    // 6.a), el mismo tic que 'vida' en bios. El peso se corre al griego.
    id: 'logos', label: 'Razón', greek: 'λόγος',
    aliases: ['logos', ['razon', 0.3]],
    gr: ['νοῦς'],
    // 'razon' vive en los ALIAS del eje y ya no en 'es'. buildIndex solo
    // carga ax.aliases con withAliases=true, o sea en INDEX_Q (la consulta)
    // y nunca en INDEX (los pasajes): se lo puede seguir escribiendo en el
    // buscador, pero deja de entrar en el vector de cada pasaje.
    // Estaba en 'es' con peso 0.3 y era un detector de modismos de la
    // traduccion ("con razon" 1.a, "por esta razon" 4.b, "muchas razones"
    // 6.a). Con 0.3 le ganaba a 'nuestro razonamiento' (0.5 * 0.4 = 0.2), el
    // termino preciso del sentido. Y como no vota ningun sentido, esos
    // pasajes quedaban sin mezcla en el eje: senseAgreement devuelve null,
    // no entra en el promedio y senseFactor queda en 1. Eran inmunes al
    // filtro de acepcion justo los que entraban por un modismo.
    // Sigue sin sentido asignado a proposito: esStem() corta el sufijo
    // -amiento, asi que esTokens('razonamiento') devuelve ['razon'] y el
    // castellano no puede separar la facultad del argumento. Esa distincion
    // queda en manos de las formas griegas, que si son inequivocas.
    // Si viviera dentro de un sentido, el OTRO sentido perderia su termino
    // castellano en silencio: la guarda DUPLICATE_TERMS de buildIndex usa un
    // solo Set por eje, compartido por todos sus sentidos.
    senses: [
      {
        id: 'razon', label: 'la razón (facultad)', greek: 'λόγον ἔχον',
        grForms: ['λόγον', 'λόγου'],
        es: ['entendimiento', 'inteligencia', 'obedecer a la razon'],
        aliases: ['facultad racional', 'parte racional', 'lo que tiene razon'],
      },
      {
        id: 'argumento', label: 'el razonamiento, el discurso', greek: 'λόγοι', weight: 0.4,
        grForms: ['λόγος', 'λόγοι', 'λόγοις', 'λόγῳ'],
        // 'nuestro razonamiento' tokeniza como el bigrama ['nuestr','razon'],
        // asi que sobrevive al colapso de -amiento y marca exactamente los
        // pasajes donde λόγος es el hilo del tratado: "de acuerdo con nuestro
        // razonamiento" (8.a) y "apoya nuestro razonamiento" (10.h).
        es: ['nuestro razonamiento'],
        aliases: ['argumento', 'discurso', 'definicion'],
      },
    ],
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
      'habito', 'costumbre', 'acostumbrar', 'disposicion', 'disposiciones', 'ejercitar',
      // posesion inerte. Pesos bajos en los genericos: "poseer" e "inactivo"
      // aparecen tambien en 7.g y 10.c/10.i, donde el tema es otro.
      'dormido', 'durmiendo', 'duerme', 'sueno',
      ['poseer', 0.5], ['posesion', 0.5], ['inactivo', 0.5],
      // 'sin ejercitar' SALIO: con 'sin' fuera por stopword colapsa al
      // unigrama 'ejercit', que ya ocupa 'ejercitar', y la guarda
      // DUPLICATE_TERMS la descartaba en silencio: era un termino muerto.
      // 'ejercicio' ocupa su lugar con peso bajo. Stemea 'ejercici', que
      // es un slot libre, y rescata 9.b (parrafo 34), "cierto aprendizaje
      // o ejercicio": la ADQUISICION de la eudaimonia, que quedo huerfana
      // cuando 'ejercicio' bajo de energeia/acto a sus aliases.
      ['ejercicio', 0.5],
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
    gr: ['τιμήν', 'τιμίων', 'ἐπαινετῶν', 'ἐπαινοῦμεν', 'ἐπαίνων'],
    es: ['honor', 'honra', 'elogio', 'reputacion', 'estima', 'alabanza', 'encomio'],
  },
  {
    id: 'ploutos', label: 'Riqueza', greek: 'πλοῦτος',
    gr: ['πλοῦτος', 'χρήσιμον', 'ὄργανα', 'χρηματιστής'],
    es: ['riqueza', 'rico', 'dinero', 'util', 'instrumento', 'negocio', 'lucro'],
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
    aliases: ['autosuficiencia', 'autarkeia'],
    es: ['autosuficiente', 'autarquia', 'por si mismo', 'elegible', 'deseable', 'no necesita nada'],
  },
  {
    id: 'akribeia', label: 'Método', greek: 'ἀκρίβεια',
    gr: ['ἀκρίβειαν', 'μέθοδος', 'ὕλην', 'ὑποτυπῶσαι', 'ἐπαγωγῇ', 'ἐπισκεπτέον', 'ἀλήθειαν'],
    // kalos adverbial ("delimitar bien", "juzgar bien") es METODO, no lo noble.
    grForms: [['καλῶς', 0.6], ['ὀρθῶς', 0.6]],
    es: ['exactitud', 'rigor', 'metodo', 'bosquejo', 'materia', 'precision', 'contentarse', 'grandes rasgos', 'investigacion'],
  },
  {
    id: 'endoxa', label: 'Opiniones recibidas', greek: 'ἔνδοξα',
    aliases: ['que dice la gente', 'opinion comun', 'creencia comun', 'endoxa'],
    gr: ['δόξαν', 'συνᾴδει', 'λέγεται', 'σοφοί'],
    // οἱ πολλοί va por grForms (igualdad exacta) y no por gr (stem): el stem
    // πολλ- captura toda la familia de πολύς. Con 'πολλὰ' / 'πολλῶν' ('grandes
    // y numerosos', 1100b22 y 1101a12) el eje se activaba sin doxografia alguna.
    grForms: ['πολλοί'],
    // 'parece a todos' se retiro: colapsaba al unigrama 'parec' y disparaba en
    // 32/70 pasajes, midiendo un tic de la traduccion y no la doxografia.
    es: ['opinion', 'opiniones', 'los mas', 'la mayoria', 'vulgo', 'se dice', 'sabios', 'antiguos'],
  },
  {
    id: 'politike', label: 'Política', greek: 'πολιτική',
    // techne y los oficios estan aca solo porque el libro I los usa como
    // escalones del argumento arquitectonico. Es su lugar provisorio.
    gr: ['πολιτικὸν', 'ἀρχιτεκτονικῶν', 'νομοθέτης', 'νόμῳ', 'ἐπιστημῶν', 'τέχνη', 'δύναμιν'],
    es: ['politica', 'ciudad', 'legislador', 'ciencia', 'arte', 'arquitectonica', 'rectora', 'estrategia', 'medicina'],
  },
  {
    id: 'akroates', label: 'Oyente', greek: 'ἀκροατής',
    aliases: ['estudiante', 'alumno', 'capaz de aprender'],
    gr: ['ἀκροατής', 'νέος', 'ἄπειρος', 'παιδεία', 'μανθάνειν', 'γνῶσις'],
    es: ['joven', 'oyente', 'inexperto', 'educacion', 'educado', 'aprender', 'ensenanza', 'pasiones', 'discipulo'],
  },
  {
    id: 'idea', label: 'Idea platónica', greek: 'ἰδέα',
    // NO poner 'el bien en si': con las stopwords fuera colapsa al unigrama
    // 'bien', que dispara en 45 pasajes. Medido. Ver COLLAPSED en vectorize.js.
    aliases: ['idea platonica', 'formas platonicas', 'idea del bien', 'bien separado'],
    // ἁπλῶς retirado: es el adverbio "en sentido absoluto", no tiene
    // relacion con Platon. Falso amigo, como φυτόν/φύσις y ἔθνος/ἔθος.
    gr: ['ἰδέα', 'εἶδος', 'καθόλου', 'κοινόν', 'Πυθαγόρειοι'],
    es: ['idea', 'universal', 'en comun', 'separado', 'platon', 'pitagoricos', 'en si', 'amigos la verdad'],
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
    es: ['vida entera', 'vida completa', 'golondrina', 'un solo dia', ['tiempo', 0.5], 'mudanza', 'vicisitudes', 'genero de vida'],
  },
  {
    // ZOE: el VIVIR como actividad, no como biografia. Es el termino del
    // argumento del ergon (7.g, 7.h) y del eu zen (4.a, 8.b). Separado de
    // bios porque son dos conceptos distintos que compartian un solo eje.
    id: 'zoe', label: 'El vivir', greek: 'ζωή',
    gr: ['ζῆν', 'ζωή', 'ζωήν', 'ζωῆς', 'εὐζωία'],
    aliases: ['estar vivo', 'la vida humana', 'vida vegetativa'],
    es: [['vivir', 0.5], ['viviente', 0.5], ['vive', 0.5], ['viven', 0.5], 'vivir bien', 'plantas', 'animales'],
  },
  {
    // KALON: lo noble. Formas EXACTAS para no arrastrar el adverbio kalos
    // (que va a metodo) ni la belleza fisica de los atletas en 8.e.
    id: 'kalon', label: 'Lo noble', greek: 'καλόν',
    grForms: ['καλόν', 'καλά', 'καλῶν', 'καλαί', 'καλαῖς', 'καλὴ', 'κάλλιον', 'κάλλιστα', 'κάλλιστον'],
    es: ['noble', 'hermoso', 'bello', 'belleza', 'hechos nobles'],
  },
  {
    // THEION: lo divino en la praxis. Formas EXACTAS: la raiz "the-" arrastraria
    // theoria/theorein, que en el libro I significa casi siempre "examinar".
    id: 'theion', label: 'Lo divino', greek: 'θεῖον',
    grForms: [
      'θεῖον', 'θείαν', 'θείων', 'θειότερον', 'θειοτάτων',
      'θεός', 'θεοὺς', 'θεῶν', 'θεῷ',
      ['μακάριον', 0.5], ['μακαρίους', 0.5], ['μακαρίζομεν', 0.5], ['μακαρίζει', 0.5],
    ],
    es: ['divino', 'dios', 'bienaventurado', 'don de los dioses', 'providencia'],
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
    gr: ['ἀρχή', 'ἀρχάς', 'ἀρχῶν'],
    es: ['principio', 'punto de partida'],
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
    es: ['perfecto', ['completo', 0.5], ['acabado', 0.5], ['cabal', 0.5], ['pleno', 0.5]],
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
