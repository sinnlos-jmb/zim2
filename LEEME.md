# Ética Nicomaquea I · sitio por secciones (v1.13)

Mismo shell de secciones de la v1.12 (Inicio, Búsquedas, Paseos, IA, Comunidad)
con tres ajustes visuales en Búsqueda libre y en la sidebar.

## Cómo abrirlo

- **Rápido:** doble click en `en1-servidor-v1.13/public/index.html`.
- **Como servidor:** `cd en1-servidor-v1.13 && npm install && npm start` → http://localhost:3000

## Qué cambió en esta versión

- **Búsqueda libre:** el textbox creció unos píxeles de alto (36px → 40px) y el
  botón grande "Buscar" que quedaba debajo se reemplazó por un ícono de lupa
  al lado del campo, del mismo alto.
- **Sidebar:** ahora arranca siempre desplegada en todas las secciones que la
  tienen (Búsquedas, Paseos), sin importar si en una visita anterior se había
  dejado colapsada. El botón de plegarla sigue funcionando dentro de la sesión.

## Mapa de archivos

```
en1-servidor-v1.13/public/
  index.html        Inicio: landing con la explicación del proyecto
  busquedas.html    Búsquedas (preguntas, definiciones, libre, categorías)
  ia.html           IA (en preparación)
  paseos.html       Paseos: el grafo, embebido en el shell
  comunidad.html    Comunidad (en preparación)
  grafo.html        el grafo en sí; con ?embed=1 esconde su cabecera
  css/app.css       tu hoja de estilos (tarjetas, chips, resultados)
  css/shell.css     barra de secciones, migas, sidebar, landing
  js/shell.js       arma la barra de secciones y dibuja las migas
  js/panels.js      plegado de la sidebar y de cada bloque (común a todas)
  js/ui.js          la app de búsquedas (motor + interfaz)
  js/lexicon.js     los 26 ejes y las 7 familias
  js/vectorize.js   vectorizado y ranking
  js/normalize.js   normalización de griego y castellano
  data/corpus.json  los 72 pasajes con sus tags
```

## Agregar una sección

Un objeto en el arreglo `SECTIONS` al principio de `js/shell.js` (con su
ícono en `ICONS`) alcanza para que aparezca en la barra de todas las páginas
y como tarjeta en Inicio. Después se copia cualquiera de las páginas "en
preparación" (`ia.html`) como molde.

## Agregar un paseo

En `paseos.html`, un `<button class="walk" data-walk="archivo.html?embed=1">`
nuevo en la sidebar.

---

## v1.14 — Ejes con más de un sentido

Algunos ejes traducen un término griego que en el Libro I se usa en dos acepciones
distintas. No se resolvió con ejes nuevos (partirían en dos el argumento del
capítulo 7, que justamente hace pasar el término de un sentido al otro) ni con
pesos por chunk (no se puede tocar el peso de un pasaje sin dañar todas las demás
consultas que lo alcanzan). Se resolvió con una **capa de sentidos**: el eje sigue
siendo uno solo, y cada aparición del término queda atribuida a una acepción.

El vector sigue teniendo **26 dimensiones**. Nada cambió en `corpus.json`.

### Cómo se declara un sentido (`js/lexicon.js`)

```js
{
  id: 'ergon', label: 'Función propia', greek: 'ἔργον',
  es: ['carpintero', 'zapatero'],   // vocabulario neutral: no elige sentido
  aliases: ['ergon'],
  senses: [
    {
      id: 'funcion', label: 'función propia', greek: 'ἔργον',
      grForms: ['ἔργον', 'ἔργου', 'ἔργῳ'],
      es: [['funcion', 0.6], 'función propia', 'tarea', 'oficio'],
      aliases: ['funcion caracteristica'],   // solo para consultas
    },
    { id: 'obra', label: 'obra, hecho realizado', greek: 'ἔργα',
      grForms: ['ἔργα', 'ἔργων', 'ἔργοις'], es: [['obra', 0.5]] },
  ],
}
```

Reglas que importan al editar el léxico:

- Un lema va **en el eje o en un sentido, nunca en los dos**: la guarda que evita
  contar dos veces el mismo término descartaría la copia y con ella la
  atribución de sentido.
- `weight` opcional en el sentido multiplica todos sus lemas (se usa `0.4` en el
  sentido `accion` de energeia: πρᾶξις arrastra al eje más flojo que ἐνέργεια).
- Los `aliases` de un sentido entran **solo por el índice de consulta**, nunca
  tocan el corpus. Un alias que es frase debe vivir en el sentido y no en el eje,
  porque las frases se resuelven antes que las palabras sueltas y se quedarían
  con la consulta sin marcar acepción.

### Qué hace el motor

1. Al construir el índice, cada pasaje calcula su **mezcla** por eje, por ejemplo
   `ergon: { obra: 0.65, funcion: 0.35 }`. Es una mezcla y no una etiqueta única
   porque 1097b22-1098a7 usan las dos acepciones a la vez, que es de lo que vive
   el argumento.
2. La consulta calcula su propia mezcla con el mismo mecanismo.
3. El puntaje final es `coseno × factor de sentido`, con `SENSE_LAMBDA = 0.25`.
   Si alguno de los dos lados no tiene señal de sentido, el factor es
   exactamente 1: sin acepción declarada, el buscador se comporta como antes.

En la tarjeta de resultado aparece un chip con la acepción (con el porcentaje
cuando está repartida) y el puntaje se pinta en naranja con un `↓` cuando bajó
porque la consulta pedía la otra acepción.

### Fijar el sentido a mano desde el `.txt`

El tag admite un campo nuevo, `sentido`, que **pisa** lo que deduce el motor:

```
{ "parrafo_nro": 42, "tags": [{"eje": "ergon", "sentido": "obra"}] }
```

Puede ir solo o combinado con un rol:

```
{ "parrafo_nro": 42, "tags": [{"rol": "define", "eje": "ergon", "peso": 0.9, "sentido": "funcion"}] }
```

Cuando un mismo párrafo usa los dos sentidos de un eje a la vez, se declaran
**dos tags** con el mismo `eje` y un `peso_sentido` cada uno (campo distinto de
`peso`, que pondera un tag de `rol`). Los `peso_sentido` de un mismo eje se
suman y se normalizan entre sí; no hace falta que sumen 1:

```
{ "parrafo_nro": 43, "tags": [
    {"eje": "arete", "sentido": "etica", "peso_sentido": 0.8},
    {"eje": "arete", "sentido": "dianoetica", "peso_sentido": 0.2}
] }
```

Valores válidos hoy: `ergon` → `funcion` | `obra`; `energeia` → `acto` | `accion`;
`arete` → `etica` | `dianoetica`.
`build-corpus.mjs` imprime la sección **=== SENTIDOS FIJADOS A MANO ===** con la
cuenta de sentidos fijados y avisa si un eje está mal escrito o si el sentido no
existe — es el único error que el formato de tag permite cometer en silencio.

### Limpieza de lemas incluida en esta versión

Dos lemas conflaban cosas distintas y se sacaron:

- `οἰκεῖον` / `ἴδιον` ("lo propio de") metían en ergon tres pasajes que no hablan
  de la función del hombre (1094b12, 1095b14, 1096a11). Ahora esos tres no tocan
  el eje.
- `κινήσεων` y el castellano `obrar` salieron de energeia: el primero es
  movimiento y no actividad, y el segundo comparte raíz con `obra`, del eje
  ergon, así que no podía distinguir un sentido de otro.
