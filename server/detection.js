// Object detection: up to 4 main objects in the photo, each with an approximate position, so the
// child can choose which one to explore. People are never offered as objects.
// The model's output is never trusted: names are cleaned, positions clamped to 0-1, repeated
// names merged and anything that names a person or a body part is dropped.

const MAX_OBJECTS = 4;
const MAX_NAME = 60;

const DETECTION_SCHEMA = {
  name: 'detection',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['objects', 'person'],
    properties: {
      objects: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'x', 'y', 'size'],
          properties: {
            name: { type: 'string' },
            x: { type: 'number' },
            y: { type: 'number' },
            size: { type: 'number' }
          }
        }
      },
      person: { type: 'boolean' }
    }
  }
};

function detectionPrompt(language) {
  return `You identify objects for a children's learning app. The child will choose ONE object of the photo to explore.
List up to ${MAX_OBJECTS} main objects that are clearly visible, most relevant first (the biggest or most central first). Only distinct, recognisable things a child could explore (a dog, a tree, a bench, an apple); not the background, the floor, the sky or tiny details. If there is only one main object, list only that one.
For each object:
- name: its common name in ${language}, 1-3 words, lowercase, no punctuation (e.g. "apple", "red car", "golden retriever"). Be specific and accurate. Two different objects never get the same name; if there are several of the same thing, list it once.
- x, y: the approximate centre of the object in the photo, from 0 to 1 (x from left to right, y from top to bottom).
- size: approximately how big the object is, from 0 to 1, as a fraction of the photo's width (its largest side).
Never list people, faces or body parts (hands, fingers, feet…) as objects, and never describe or identify people. Set "person": true if there are people or body parts in the photo, false otherwise.
If there is no clear object, return an empty list.`;
}

// Names that mean a person or a body part, per language (whole words only, accents ignored).
const PERSON_WORDS = {
  English: ['person', 'people', 'man', 'men', 'woman', 'women', 'boy', 'girl', 'child', 'children', 'kid', 'kids', 'baby', 'face', 'hand', 'hands', 'finger', 'fingers', 'foot', 'feet', 'arm', 'leg', 'head', 'human', 'selfie'],
  Spanish: ['persona', 'personas', 'gente', 'hombre', 'mujer', 'nino', 'nina', 'ninos', 'ninas', 'chico', 'chica', 'bebe', 'cara', 'mano', 'manos', 'dedo', 'dedos', 'pie', 'pies', 'brazo', 'pierna', 'cabeza', 'humano', 'selfi'],
  French: ['personne', 'personnes', 'gens', 'homme', 'femme', 'garcon', 'fille', 'enfant', 'enfants', 'bebe', 'visage', 'main', 'mains', 'doigt', 'doigts', 'pied', 'pieds', 'bras', 'jambe', 'tete', 'humain', 'selfie'],
  German: ['person', 'personen', 'leute', 'mensch', 'menschen', 'mann', 'frau', 'junge', 'madchen', 'kind', 'kinder', 'baby', 'gesicht', 'hand', 'hande', 'finger', 'fuss', 'fusse', 'arm', 'bein', 'kopf', 'selfie']
};

const fold = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');

function namesPerson(name, language) {
  const words = PERSON_WORDS[language] || PERSON_WORDS.English;
  return fold(name).split(/[^a-z0-9]+/).some(w => words.includes(w));
}

const clamp01 = v => (typeof v === 'number' && Number.isFinite(v) ? Math.min(Math.max(v, 0), 1) : 0.5);
const round = v => Math.round(v * 1000) / 1000;

function cleanName(v) {
  if (typeof v !== 'string') return '';
  const name = v.trim().replace(/^["'.\s]+|["'.\s]+$/g, '').replace(/\s+/g, ' ');
  if (!name || name.length > MAX_NAME || /^(none|null|nothing|ninguno|nada|rien|nichts)$/i.test(name)) return '';
  return name;
}

/**
 * Normalises the model's answer into { objects: [{ name, x, y, size }], person }.
 * objects: at most 4, in the model's order, without people or repeated names; positions in 0-1.
 * person: true only when people are in the photo AND there is no object to offer.
 */
function cleanDetection(parsed, language = 'English') {
  const list = Array.isArray(parsed?.objects) ? parsed.objects : [];
  const seen = new Set();
  const objects = [];
  let droppedPerson = false;
  for (const o of list) {
    const name = cleanName(o && o.name);
    if (!name) continue;
    if (namesPerson(name, language)) {
      droppedPerson = true;
      continue;
    }
    const key = fold(name);
    if (seen.has(key)) continue;
    seen.add(key);
    objects.push({ name, x: round(clamp01(o.x)), y: round(clamp01(o.y)), size: round(clamp01(o.size)) });
    if (objects.length === MAX_OBJECTS) break;
  }
  const person = objects.length === 0 && (parsed?.person === true || droppedPerson);
  return { objects, person };
}

module.exports = { DETECTION_SCHEMA, detectionPrompt, cleanDetection, MAX_OBJECTS };
