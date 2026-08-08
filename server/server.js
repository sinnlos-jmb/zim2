import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Para montarlo bajo un prefijo, cambiar '/' por '/en1' en esta linea.
app.use('/', express.static(path.join(__dirname, 'public'), {
  extensions: ['html'],
  setHeaders(res, file) {
    // el corpus cambia solo cuando se reconstruye: cache corta y revalidacion
    if (file.endsWith('corpus.json')) res.setHeader('Cache-Control', 'public, max-age=300');
  },
}));

app.listen(PORT, () => console.log('EN I · vectorizador en http://localhost:' + PORT));
