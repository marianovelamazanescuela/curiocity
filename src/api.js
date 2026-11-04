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
 * Returns { object, person, subjects }: object is the main object's name (in the user's
 * language when the Vision API answers) or null; person is true when the photo shows people;
 * subjects lists the relevant subject keys, or null to show them all (e.g. on-device fallback).
 * Throws only if both detectors fail.
 */
export async function detectObject(canvas, lang, signal) {
  try {
    const data = await postJson('/api/detect', { image: canvas.toDataURL('image/jpeg', 0.8), language: LANGUAGE_NAMES[lang] }, signal);
    return { object: data.object || null, person: data.person === true, subjects: data.subjects || null };
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    console.info('Vision API unavailable, falling back to COCO-SSD:', err.message);
  }
  return { ...(await detectWithCoco(canvas)), subjects: null };
}

/** Relevant subject keys for an object name, or null (= show all) if the server can't say. */
export async function fetchSubjects(objectName, lang, signal) {
  try {
    const data = await postJson('/api/subjects', { objectName, language: LANGUAGE_NAMES[lang] }, signal);
    return data.subjects || null;
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    return null;
  }
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
