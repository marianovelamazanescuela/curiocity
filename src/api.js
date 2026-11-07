import { buildFallbackContent } from './fallbackContent';
import { LANGUAGE_NAMES } from './i18n';

const PROXY_BASE = (import.meta.env.VITE_AI_PROXY_URL || '').replace(/\/$/, '');
const apiUrl = path => `${PROXY_BASE}${path}`;

async function postJson(path, body, signal) {
  const resp = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal
  });
  if (!resp.ok) throw new Error(`${path} responded ${resp.status}`);
  return resp.json();
}

// COCO-SSD + TensorFlow.js weigh several MB, so they are only downloaded the first time
// the Vision API fails, and the model is loaded once and reused.
let cocoModelPromise = null;
function loadCocoModel() {
  if (!cocoModelPromise) {
    cocoModelPromise = Promise.all([import('@tensorflow/tfjs'), import('@tensorflow-models/coco-ssd')])
      .then(([, cocoSsd]) => cocoSsd.load())
      .catch(err => {
        cocoModelPromise = null; // allow a retry next time
        throw err;
      });
  }
  return cocoModelPromise;
}

async function detectWithCoco(canvas) {
  const model = await loadCocoModel();
  const predictions = await model.detect(canvas);
  if (!predictions.length) return { object: null };
  const best = predictions.reduce((a, b) => (a.score > b.score ? a : b)).class;
  // Same rule as the server: never describe people.
  return best === 'person' ? { object: null, person: true } : { object: best };
}

/**
 * Returns { object, person }: object is the main object's name (in the user's language when the
 * Vision API answers) or null; person is true when the photo shows people.
 * Throws only if both detectors fail.
 */
export async function detectObject(canvas, lang, signal) {
  try {
    const data = await postJson('/api/detect', { image: canvas.toDataURL('image/jpeg', 0.8), language: LANGUAGE_NAMES[lang] }, signal);
    return { object: data.object || null, person: data.person === true };
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    console.info('Vision API unavailable, falling back to COCO-SSD:', err.message);
  }
  return detectWithCoco(canvas);
}

/**
 * How well each subject connects with the object: { featured: [{ key, hook }], others: [key] },
 * or null (= show every subject, no hooks) if the server can't say.
 */
export async function fetchRanking(objectName, lang, signal) {
  try {
    const data = await postJson('/api/subjects', { objectName, language: LANGUAGE_NAMES[lang] }, signal);
    const r = data && data.ranking;
    if (r && Array.isArray(r.featured) && r.featured.length && Array.isArray(r.others)) return r;
  } catch (err) {
    if (err.name === 'AbortError') throw err;
  }
  return null;
}

const isLesson = j =>
  j && j.pregunta_inicial && Array.isArray(j.pregunta_inicial.opciones) && j.pregunta_inicial.opciones.length === 3 &&
  Number.isInteger(j.pregunta_inicial.correcta) && j.dato_sorprendente && j.por_que && j.reto && j.para_seguir_pensando;

/** Interactive lesson from the AI server, or localized offline content if it is unavailable. */
export async function fetchContent({ objectName, subject, lang, signal }) {
  try {
    const json = await postJson('/api/ai', { objectName, subject: subject.aiName, language: LANGUAGE_NAMES[lang] }, signal);
    if (isLesson(json)) {
      return {
        ...json,
        enlaces: Array.isArray(json.enlaces) ? json.enlaces : [],
        objetos_relacionados: Array.isArray(json.objetos_relacionados) ? json.objetos_relacionados : []
      };
    }
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    console.info('AI server unavailable, using offline content:', err.message);
  }
  return buildFallbackContent(subject.key, lang);
}
