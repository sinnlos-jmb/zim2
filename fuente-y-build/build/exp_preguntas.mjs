/* exp_preguntas.mjs - valida las preguntas frecuentes del menu.
   Una pregunta solo entra al menu si activa ejes y devuelve un top-1 defendible. */
import fs from 'node:fs';
import { vectorize, cosine } from '../src/vectorize.js';
import { AXES } from '../src/lexicon.js';

const CORPUS = JSON.parse(fs.readFileSync('/data/en1/app/data/corpus.json', 'utf8'));
const P = CORPUS.passages.map((p) => ({ ...p, ...vectorize(p.esOnly, p.glosses) }));

const GRUPOS = [
  ['Definiciones', [
    '¿qué es la felicidad?',
    '¿qué es la energeia o actividad?',
    '¿qué es la virtud?',
    '¿qué es el bien supremo?',
    '¿qué es la verdad?',
  ]],
  ['Discusiones', [
    '¿qué dice contra la idea platónica del bien?',
    '¿qué piensan los muchos sobre la felicidad?',
    '¿qué dicen los poetas y los sabios antiguos?',
    '¿hay que preferir la verdad a los amigos?',
  ]],
  ['Método', [
    '¿con cuánta exactitud se puede tratar la política?',
    '¿hay que partir de los principios o llegar a ellos?',
    '¿puede un joven estudiar política?',
    '¿se debe exigir la causa en todas las cuestiones?',
  ]],
  ['Fin y bienes', [
    '¿todas las cosas tienden a algún fin?',
    '¿hay algún fin que queramos por sí mismo?',
    '¿por qué la felicidad es autosuficiente y perfecta?',
    '¿el placer es el bien supremo?',
  ]],
  ['Vida y fortuna', [
    '¿alcanza con ser rico para vivir bien?',
    '¿la virtud basta o hacen falta bienes exteriores?',
    '¿hay que esperar el fin de la vida para llamar feliz a alguien?',
    '¿la fortuna puede cambiar la felicidad?',
  ]],
  ['Alma y virtud', [
    '¿cuál es la función propia del hombre?',
    '¿cómo se divide el alma?',
    '¿alcanza con tener la virtud o hay que ejercerla?',
    '¿en qué se diferencian las virtudes éticas de las dianoéticas?',
  ]],
];

let malas = 0;
for (const [cat, qs] of GRUPOS) {
  console.log('\n=== ' + cat + ' ===');
  for (const q of qs) {
    const { vector, hits } = vectorize(q, []);
    const on = vector.map((v, i) => ({ v, ax: AXES[i] })).filter((x) => x.v > 0)
      .sort((a, b) => b.v - a.v);
    if (!on.length) {
      malas++;
      console.log('  [CERO] ' + q);
      continue;
    }
    const top = P.map((p) => ({ id: p.id, s: cosine(vector, p.vector) }))
      .sort((a, b) => b.s - a.s).slice(0, 3);
    console.log('  ' + q);
    console.log('      ejes: ' + on.map((x) => x.ax.label).join(', '));
    console.log('      top : ' + top.map((t) => t.id + ' ' + t.s.toFixed(3)).join(' | '));
  }
}
console.log('\npreguntas sin cobertura: ' + malas);
