const path = require('path');
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { callOpenAI, parseModelJson } = require('./openai');
const { findArticles } = require('./encyclopedia');
const { RANKING_SCHEMA, LESSON_SCHEMA, rankingPrompts, lessonPrompts, cleanRanking, validateLesson } = require('./content');

const app = express();

// Render (and most PaaS) sit behind a reverse proxy; trust it so req.ip is the real
// client IP. Without this, rate limiting would treat every user as the same client.
app.set('trust proxy', 1);

// Images are resized to ~800px JPEG on the client (~100-300 KB as base64).
// 2 MB leaves headroom without letting anyone push huge payloads to OpenAI.
app.use(express.json({ limit: '2mb' }));

// ---- CORS ----
// Same-origin requests (frontend served by this server, or the Vite dev proxy) don't need CORS.
// Only origins listed in ALLOWED_ORIGINS (comma-separated) may call the API cross-origin.
// Note: CORS only restricts browsers; the rate limiter below is what protects the OpenAI key from scripts.
const DEFAULT_DEV_ORIGINS = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000';
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || DEFAULT_DEV_ORIGINS)
    .split(',')
    .map(o => o.trim().replace(/\/$/, ''))
    .filter(Boolean)
);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// ---- Rate limiting (protects the OpenAI key and your bill) ----
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: parseInt(process.env.RATE_LIMIT_PER_15MIN || '60', 10),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/ai', apiLimiter);
app.use('/api/detect', apiLimiter);
app.use('/api/subjects', apiLimiter);

// ---- Helpers ----

// Bounded in-memory cache: key -> { data, expiresAt }.
// Map keeps insertion order, so deleting the first key evicts the oldest entry.
const cache = new Map();
const CACHE_TTL = parseInt(process.env.CACHE_TTL_SECONDS || '3600', 10);
const CACHE_MAX_ENTRIES = parseInt(process.env.CACHE_MAX_ENTRIES || '500', 10);
function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.data;
}
function cacheSet(key, data) {
  cache.delete(key);
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL * 1000 });
  while (cache.size > CACHE_MAX_ENTRIES) {
    cache.delete(cache.keys().next().value);
  }
}

const MAX_TEXT_FIELD = 100;
const isShortString = v => typeof v === 'string' && v.trim().length > 0 && v.length <= MAX_TEXT_FIELD;

// Low temperature: the content must be accurate, not creative.
const CONTENT_TEMPERATURE = 0.35;

// Structured output: the model must answer with JSON that matches the schema.
const jsonSchema = schema => ({ type: 'json_schema', json_schema: schema });

/**
 * Asks the model and validates its JSON. One retry if the answer is unusable (it happens rarely,
 * e.g. two identical options), because a second attempt is cheaper than losing the content.
 * Returns the validated value, null if the output stayed invalid, or undefined if the API failed.
 */
async function askValidated(request, validate, attempts = 2) {
  for (let i = 0; i < attempts; i++) {
    const raw = await callOpenAI(request);
    if (raw === null) return undefined;
    const result = validate(parseModelJson(raw));
    if (result) return result;
    console.warn('Invalid model output, attempt', i + 1);
  }
  return null;
}

// ---- API routes ----

app.get('/api/health', (req, res) => res.json({ ok: true, time: Date.now() }));

// Interactive lesson for one object + subject: question → surprising fact → why → challenge → open question.
app.post('/api/ai', async (req, res) => {
  const { objectName, subject, language = 'English' } = req.body || {};
  if (!objectName || !subject) {
    return res.status(400).json({ error: 'Missing objectName or subject' });
  }
  // These strings go into the prompt; keep them short to limit abuse and prompt injection.
  if (![objectName, subject, language].every(isShortString)) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  const cacheKey = ['lesson', objectName, subject, language].map(s => s.toLowerCase().trim()).join('::');
  const cached = cacheGet(cacheKey);
  if (cached) return res.json(cached);

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'Server missing OPENAI_API_KEY' });
  }

  try {
    const { system, user } = lessonPrompts({ objectName, subject, language });
    const result = await askValidated(
      {
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        response_format: jsonSchema(LESSON_SCHEMA),
        max_tokens: 900,
        temperature: CONTENT_TEMPERATURE
      },
      parsed => validateLesson(parsed)
    );
    if (result === undefined) return res.status(502).json({ error: 'OpenAI API error' });
    // The client has localized offline content, so signal failure instead of inventing text here.
    if (result === null) return res.status(502).json({ error: 'Invalid model output' });

    const lesson = { ...result.lesson, enlaces: await findArticles([...result.searchTerms, objectName], language) };
    cacheSet(cacheKey, lesson);
    return res.json(lesson);
  } catch (err) {
    console.error('/api/ai error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Object detection only: what is the main thing in the photo (never describing people).
app.post('/api/detect', async (req, res) => {
  const { image, language = 'English' } = req.body || {};
  if (!image) {
    return res.status(400).json({ error: 'Missing image data' });
  }
  // Only accept inline base64 images; never let the client make OpenAI fetch arbitrary URLs.
  if (typeof image !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image)) {
    return res.status(400).json({ error: 'Invalid image data' });
  }
  if (!isShortString(language)) {
    return res.status(400).json({ error: 'Invalid input' });
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'Server missing OPENAI_API_KEY' });
  }

  try {
    const raw = await callOpenAI({
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You identify objects for a children's learning app. Look at the main thing in this photo and answer ONLY with a JSON object {"object": string or null, "person": boolean}.
- object: the common name of the main object in ${language}, 1-3 words, lowercase, no punctuation (e.g. "apple", "red car", "golden retriever"). Be specific and accurate.
- If the main subject is a person, people or a body part (face, hand…), set "person": true and "object": null. Never describe or identify people.
- If there is no clear object, set "object": null.`
            },
            { type: 'image_url', image_url: { url: image, detail: 'low' } }
          ]
        }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 60,
      temperature: 0.2
    });
    if (raw === null) return res.status(502).json({ error: 'Vision API error' });

    const parsed = parseModelJson(raw) || {};
    if (parsed.person === true) return res.json({ object: null, person: true });
    const objectName = typeof parsed.object === 'string' ? parsed.object.trim().replace(/^["'.\s]+|["'.\s]+$/g, '') : '';
    if (!objectName || objectName.toLowerCase() === 'none') return res.json({ object: null });
    return res.json({ object: objectName.slice(0, MAX_TEXT_FIELD) });
  } catch (err) {
    console.error('/api/detect error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Which subjects connect best with an object: the 3 best with a one-line hook, the rest in order.
// Used after a photo, for related objects and for history entries.
app.post('/api/subjects', async (req, res) => {
  const { objectName, language = 'English' } = req.body || {};
  if (![objectName, language].every(isShortString)) {
    return res.status(400).json({ error: 'Invalid input' });
  }
  const cacheKey = ['subjects', objectName, language].map(s => s.toLowerCase().trim()).join('::');
  const cached = cacheGet(cacheKey);
  if (cached) return res.json(cached);
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'Server missing OPENAI_API_KEY' });
  }

  try {
    const { system, user } = rankingPrompts({ objectName, language });
    const ranking = await askValidated(
      {
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        response_format: jsonSchema(RANKING_SCHEMA),
        max_tokens: 500,
        temperature: CONTENT_TEMPERATURE
      },
      cleanRanking
    );
    if (ranking === undefined) return res.status(502).json({ error: 'OpenAI API error' });
    // ranking: null = the client shows every subject, without hooks
    const result = { ranking };
    if (ranking) cacheSet(cacheKey, result);
    return res.json(result);
  } catch (err) {
    console.error('/api/subjects error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Unknown API routes: JSON 404 instead of the SPA's index.html.
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// ---- Static frontend (Render web service) ----
const buildDir = path.join(__dirname, '..', 'build');
app.use(express.static(buildDir));

// SPA fallback to index.html for everything else.
app.get('*', (req, res) => {
  res.sendFile(path.join(buildDir, 'index.html'));
});

module.exports = { app, cache };
