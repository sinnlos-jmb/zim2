# Tags: implementacion basica (FAQ + Definiciones)

## Que se hizo
1. `parse.js` ahora reconoce el centinela `{ "parrafo_nro": N, "tags": [...] }`
   del .txt fuente: lo saca del cuerpo de la traduccion y ata su `tags` al
   parrafo siguiente (via `bufTags` en paralelo a `buf`, propagado a
   `blocks` y a cada `unit`). Tagueo parcial soportado: un renglon puede
   numerar el parrafo sin tener rol todavia.
2. `build-corpus.mjs` apunta ahora a `EN_libro1_v7_tags_fixed.txt`, propaga
   `tags`/`parrafoNro` a traves del chunker (se queda solo en el primer
   fragmento al dividir; se acumulan al fusionar parrafos cortos) y escribe
   `tags`/`parrafoNros` en cada pasaje de `corpus.json`. Reporte de build
   agregado: cuenta parrafos numerados y tags por rol.
3. Resultado del build sobre el archivo v7: **51/51 parrafos numerados
   resueltos**, 16 pasajes con al menos un tag (7 define, 5 afirma, 12 faq).
4. `ui.js`: el menu "Preguntas" del header ya no es una lista escrita a
   mano; sale de agrupar los tags `rol:"faq"` del corpus por texto de
   pregunta (9 preguntas distintas sobre 12 tags). Nuevo menu
   "Definiciones" al lado, con los tags `rol:"define"` agrupados por eje o
   concepto (6 conceptos: agathon, autarkeia, ergon, eudaimonia, makarion,
   teleios).
5. Al hacer click en una pregunta o definicion, la tarjeta de resultado NO
   sale de la busqueda vectorial: muestra directamente el/los pasaje(s) que
   el traductor marco en el tag, con una etiqueta "tag - FAQ" / "tag -
   Definicion" y un panel lateral "Cita directa por tag" (mas la nota/rta
   del traductor si el tag la trae). La busqueda por texto libre y por ejes
   sigue funcionando exactamente igual que antes (probado con "la
   felicidad" -> pasaje top con score 0.961).

## Verificacion (Playwright, headless, sobre el server local)
- Preguntas listadas: 9 (los 9 textos reales de los tags).
- Click en la primera -> devuelve exactamente el pasaje EN.I.7.g con badge
  "tag - FAQ" y el panel de cita directa.
- Definiciones listadas: 6 (Bienes/agathon, Autarquia, Funcion propia/ergon,
  Felicidad/eudaimonia, makarion, Lo completo/teleios).
- Click en "Bienes (agathon)" -> devuelve los 2 pasajes que lo definen
  (EN.I.1.a y EN.I.7.a), ambos con badge "tag - Definicion".
- Sin errores de consola ni de pagina durante toda la prueba.
- Screenshot adjunto: screenshot-faq.png (menu de Preguntas abierto).

## Que NO se hizo (a proposito)
- El query builder (busqueda estructurada por `afirma`, con roles
  define/afirma/faq combinados) queda pendiente, tal como se pidio.

## Contenido del zip
- `en1-servidor-v1.11/`: server listo para correr (`npm install && npm start`
  o el server ya trae su propio `node_modules` si lo tenia v1.10 -- revisar).
  Ahi esta el corpus ya reconstruido con tags (`server/public/data/corpus.json`,
  72 pasajes) y el `ui.js`/`app.css`/`index.html` actualizados.
- `fuente-y-build/`: el `.txt` con tags, los `src/*.js` fuente (incluye el
  `parse.js` modificado) y los scripts de build (`build-corpus.mjs`,
  `build-app.mjs`) por si hace falta reconstruir el corpus de nuevo.
- `screenshot-faq.png`: captura del menu de Preguntas ya andando.
