# Ética Nicomaquea I · sitio por secciones (v1.12)

Primera versión con la estructura de secciones: la app que venías usando pasa a
ser **una** de las secciones (Búsquedas) y el sitio gana una barra superior con
las cinco secciones previstas.

## Cómo abrirlo

- **Rápido:** doble click en `en1-servidor-v1.12/public/index.html`.
- **Como servidor:** `cd en1-servidor-v1.12 && npm install && npm start` → http://localhost:3000

## Mapa de archivos

```
en1-servidor-v1.12/public/
  index.html        Inicio: landing con la explicación del proyecto
  busquedas.html    Búsquedas (la app de antes, reorganizada)
  ia.html           IA (en preparación)
  paseos.html       Paseos: el grafo, embebido en el shell
  comunidad.html    Comunidad (en preparación)
  grafo.html        el grafo en sí; con ?embed=1 esconde su cabecera
  css/app.css       tu hoja de estilos (tarjetas, chips, resultados)
  css/shell.css     capa nueva: barra de secciones, migas, sidebar, landing
  js/shell.js       arma la barra de secciones y dibuja las migas
  js/panels.js      plegado de la sidebar y de cada bloque (comun a todas)
  js/ui.js          la app de búsquedas (motor + interfaz)
  js/lexicon.js     los 26 ejes y las 7 familias
  js/vectorize.js   vectorizado y ranking
  js/normalize.js   normalizacion de griego y castellano
  data/corpus.json  los 72 pasajes con sus tags
```

## Agregar una sección

Un solo lugar: el arreglo `SECTIONS` al principio de `js/shell.js`. Agregar ahí
un objeto `{ id, href, label, title }` y su icono en `ICONS` hace aparecer la
sección en la barra de **todas** las páginas y como tarjeta en Inicio. Después
se copia cualquiera de las páginas "en preparación" (`ia.html`) como molde.

## Agregar un paseo

En `paseos.html`, un `<button class="walk" data-walk="archivo.html?embed=1">`
nuevo en la sidebar. El grafo se sirve embebido, así que cada paseo puede ser
su propio archivo con su propio bloque `GRAFO`.

## Qué cambió en la sección Búsquedas

- Preguntas, Definiciones y Búsqueda libre dejaron de ser menús del encabezado:
  ahora son bloques plegables de la sidebar, arriba de Categorías.
- Arriba del main hay migas clickeables: `Inicio › Búsquedas › <puerta> › <consulta>`.
  La miga del medio abre su bloque en la sidebar, así que también funciona como menú.
- El item elegido queda marcado en la sidebar, y solo uno a la vez.
- El estado plegado de cada bloque se recuerda por sección en localStorage.
- El motor de búsqueda no se tocó: mismos vectores, mismos puntajes.
