# Vectorizador · Ética Nicomaquea, libro I — versión para servidor

La misma app que el archivo único, pero sin empaquetar: CSS aparte, motor en
módulos ES nativos y corpus servido como JSON. Requiere un servidor HTTP —con
`file://` los `import` fallan por CORS, por eso existen las dos versiones.

## Correr

```bash
npm install
npm start          # http://localhost:3000
```

## Montar dentro de tu Express

No hace falta `server.js`. Copiá `public/` a tu proyecto y agregá:

```js
app.use('/en1', express.static(path.join(__dirname, 'public/en1')));
```

Funciona en cualquier prefijo (`/`, `/en1`, `/etica/libro1`) sin tocar una
línea: `ui.js` resuelve el corpus con `new URL('../data/corpus.json',
import.meta.url)`, o sea contra la URL del módulo y no contra la del
documento. Si usara una ruta relativa común, montarlo en `/en1` sin barra
final rompería el `fetch`.

## Estructura

```
server.js               Express mínimo (opcional)
public/
  index.html            solo marcado: <link> al css, <script type="module">
  css/app.css           11 KB
  js/normalize.js       normalización castellana y griega, stemming
  js/lexicon.js         los 24 ejes semánticos — el archivo que vas a editar
  js/vectorize.js       índice invertido, tf, coseno, topK
  js/ui.js              interfaz
  data/corpus.json      70 pasajes (esOnly, glosas, griego paralelo, hash)
```

`js/` es una copia literal de `src/`: los mismos módulos que usan los scripts
de análisis en Node. No hay bundler ni paso de compilación; editás y recargás.

## Qué corre en el navegador

Al abrir, `ui.js` vectoriza los 70 pasajes (unos pocos milisegundos) y guarda
el resultado en `localStorage` bajo `en1:index:v3`. En las visitas siguientes
lo recupera de ahí y revectoriza sólo los pasajes cuyo `textHash` cambió.

**Al tocar el léxico hay que subir `STORE_KEY` en `js/ui.js`.** Si no, un
navegador que ya abrió la versión anterior recupera un índice con otra
cantidad de dimensiones y el coseno compara vectores incompatibles. El cambio
de traducción no necesita eso: lo cubre el `textHash` por pasaje.

## Paso siguiente

Cuando el corpus pase a MariaDB, lo único que cambia es de dónde sale
`data/corpus.json`: un endpoint en vez de un archivo. `lexicon.js` y
`vectorize.js` deben seguir siendo **los mismos módulos** importados desde el
servidor y desde el navegador — el servidor vectoriza los pasajes para la
columna `VECTOR`, el navegador vectoriza la consulta. Si se duplican, un día
cambia un peso de un lado y el sistema devuelve resultados sutilmente mal sin
fallar nunca.
