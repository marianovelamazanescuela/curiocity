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
  if (!predictions.length) return null;
  return predictions.reduce((a, b) => (a.score > b.score ? a : b)).class;
}

/**
 * Returns the main object's name (in the user's language when the Vision API answers),
 * or null if nothing recognisable is in the picture. Throws only if both detectors fail.
 */
export async function detectObject(canvas, lang, signal) {
  try {
    const data = await postJson('/api/detect', { image: canvas.toDataURL('image/jpeg', 0.8), language: LANGUAGE_NAMES[lang] }, signal);
    return data.object || null;
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    console.info('Vision API unavailable, falling back to COCO-SSD:', err.message);
  }
  return detectWithCoco(canvas);
}

/** Educational content from the AI server, or localized offline templates if it is unavailable. */
export async function fetchContent({ objectName, subject, subjectLabel, lang, signal }) {
  try {
    const json = await postJson('/api/ai', { objectName, subject: subject.aiName, language: LANGUAGE_NAMES[lang] }, signal);
    if (json && json.title && json.text) {
      return {
        ...json,
        funFacts: Array.isArray(json.funFacts) ? json.funFacts : [],
        links: Array.isArray(json.links) ? json.links : [],
        relatedObjects: Array.isArray(json.relatedObjects) ? json.relatedObjects : []
      };
    }
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    console.info('AI server unavailable, using offline templates:', err.message);
  }
  return buildFallbackContent(objectName, subject.key, subjectLabel, lang);
}
