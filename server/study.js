// Study version (only with STUDY_MODE=true, see README "Versión de estudio").
//
// The phones send anonymous usage events here; this server checks them and forwards them to the
// research team's spreadsheet (Google Sheets, through the Apps Script in server/study-sheet.gs).
// Nothing is stored on this server. A batch only counts as received when the spreadsheet confirms
// it, so a phone keeps its events until then.
//
// Never stored or logged: IP, user agent or any other request data. Only the event fields listed in
// EVENT_FIELDS reach the spreadsheet; the rate limiter counts requests per IP in memory only.

const crypto = require('crypto');
const express = require('express');
const { rateLimit } = require('express-rate-limit');

const MAX_BATCH = 50;
const MAX_DETAILS = 4000; // characters of JSON
const MAX_LESSON = 40000; // a spreadsheet cell holds 50 000 characters
const SHEET_TIMEOUT_MS = 25000;

const EVENT_TYPES = [
  'sesion_inicio', 'sesion_fin', 'foto', 'asignaturas', 'pantalla', 'pregunta', 'reto',
  'ideas_final', 'final', 'error', 'leccion'
];
const SUBJECT_KEYS = ['biologia', 'geologia', 'historia', 'matematicas', 'lengua', 'musica', 'artes'];
// A word and two digits from 2 to 9, as handed out by the spreadsheet: "LINCE-47".
const PARTICIPANT_RE = /^[A-Z]{3,8}-[2-9]{2}$/;

const FIELD_CHECKS = {
  id: v => typeof v === 'string' && /^[a-z0-9-]{10,40}$/.test(v),
  fecha: v => typeof v === 'string' && v.length <= 30 && /^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(v) && !Number.isNaN(Date.parse(v)),
  sesion: v => typeof v === 'string' && /^S-[a-z0-9]{6,12}$/.test(v),
  participante: v => typeof v === 'string' && PARTICIPANT_RE.test(v),
  tipo: v => EVENT_TYPES.includes(v),
  leccion_id: v => typeof v === 'string' && /^L-[a-z0-9]{6,12}$/.test(v),
  objeto: v => typeof v === 'string' && v.length > 0 && v.length <= 80,
  asignatura: v => SUBJECT_KEYS.includes(v),
  pantalla: v => typeof v === 'string' && /^[a-z_]{1,20}$/.test(v),
  detalles: v => v !== null && typeof v === 'object' && !Array.isArray(v)
};
const EVENT_FIELDS = Object.keys(FIELD_CHECKS);
const REQUIRED = ['id', 'fecha', 'sesion', 'participante', 'tipo'];

// Defence in depth: no picture data may slip into the details (the app never sends any).
const hasPictureData = text => /data:image|base64,/i.test(text);

/** Returns the event with only the allowed fields, or null if it is not valid. */
function cleanEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) return null;
  const keys = Object.keys(event);
  if (keys.some(k => !EVENT_FIELDS.includes(k))) return null;
  if (REQUIRED.some(k => event[k] === undefined)) return null;
  const clean = {};
  for (const key of keys) {
    if (event[key] === undefined || event[key] === null) continue;
    if (!FIELD_CHECKS[key](event[key])) return null;
    clean[key] = event[key];
  }
  const details = JSON.stringify(clean.detalles || {});
  if (details.length > (clean.tipo === 'leccion' ? MAX_LESSON : MAX_DETAILS) || hasPictureData(details)) return null;
  return clean;
}

// Constant-time comparison, so the answer time gives nothing away.
function sameSecret(given, expected) {
  if (typeof given !== 'string' || !expected) return false;
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

function basicPassword(header) {
  const match = /^Basic ([A-Za-z0-9+/=]+)$/.exec(header || '');
  if (!match) return null;
  const decoded = Buffer.from(match[1], 'base64').toString('utf8');
  const colon = decoded.indexOf(':');
  return colon === -1 ? null : decoded.slice(colon + 1);
}

/**
 * Routes under /api/study. config: { key, adminPassword, sheetUrl, sheetSecret, fetchImpl }.
 * Mounted by app.js only when STUDY_MODE=true; otherwise these routes do not exist.
 */
function createStudyRouter({ key, adminPassword, sheetUrl, sheetSecret, fetchImpl = fetch, limits = {} }) {
  const router = express.Router();
  router.use(express.json({ limit: '256kb' }));

  // A whole class may share the school's IP address, so the limits are generous.
  const limiter = (limit, windowMs = 15 * 60 * 1000) =>
    rateLimit({ windowMs, limit, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many requests' } });
  const eventsLimiter = limiter(limits.events || 1500);
  const codeLimiter = limiter(limits.code || 100);
  const adminLimiter = limiter(limits.admin || 20);

  const requireKey = (req, res, next) => (sameSecret(req.get('X-Study-Key'), key) ? next() : res.status(401).json({ error: 'Invalid study key' }));

  // One request to the spreadsheet's Apps Script. Returns its JSON answer, or null if it failed.
  async function askSheet(payload) {
    if (!sheetUrl || !sheetSecret) return null;
    try {
      const response = await fetchImpl(sheetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secreto: sheetSecret, ...payload }),
        redirect: 'follow', // Apps Script answers with a redirect to the result
        signal: AbortSignal.timeout(SHEET_TIMEOUT_MS)
      });
      const data = response.ok ? await response.json() : null;
      if (!data || data.ok !== true) {
        console.error('[estudio] la hoja no confirmó:', response.status, data && data.error);
        return null;
      }
      return data;
    } catch (err) {
      console.error('[estudio] no se pudo contactar con la hoja:', err && err.name);
      return null;
    }
  }

  router.post('/events', eventsLimiter, requireKey, async (req, res) => {
    const eventos = req.body && req.body.eventos;
    if (!Array.isArray(eventos) || eventos.length === 0 || eventos.length > MAX_BATCH) {
      return res.status(400).json({ error: 'Invalid batch' });
    }
    const valid = [];
    const rejected = [];
    for (const event of eventos) {
      const clean = cleanEvent(event);
      if (clean) valid.push(clean);
      else if (event && FIELD_CHECKS.id(event.id)) rejected.push(event.id);
    }
    if (rejected.length) console.warn(`[estudio] ${rejected.length} evento(s) no válidos descartados`);
    if (valid.length === 0) return res.json({ ok: true, ids: [], rechazados: rejected });

    const answer = await askSheet({ accion: 'eventos', eventos: valid });
    if (!answer) return res.status(502).json({ error: 'Spreadsheet unavailable' });
    const sent = new Set(valid.map(e => e.id));
    const ids = Array.isArray(answer.ids) ? answer.ids.filter(id => sent.has(id)) : [];
    return res.json({ ok: true, ids, rechazados: rejected });
  });

  // A new participant code, unique for the whole study: the spreadsheet keeps the list.
  router.post('/codigo', codeLimiter, requireKey, async (req, res) => {
    const answer = await askSheet({ accion: 'codigo' });
    if (!answer || !PARTICIPANT_RE.test(answer.codigo || '')) return res.status(502).json({ error: 'Spreadsheet unavailable' });
    return res.json({ codigo: answer.codigo });
  });

  // The researcher's password, for /?reiniciar-estudio (HTTP basic authentication over HTTPS).
  router.post('/admin', adminLimiter, (req, res) => {
    if (!adminPassword) return res.status(503).json({ error: 'Study admin password not configured' });
    if (!sameSecret(basicPassword(req.get('Authorization')), adminPassword)) return res.status(401).json({ error: 'Wrong password' });
    return res.status(204).end();
  });

  return router;
}

/** Reads the study settings from the environment. Returns null when STUDY_MODE is not 'true'. */
function studyConfigFromEnv(env = process.env) {
  if (env.STUDY_MODE !== 'true') return null;
  const config = {
    key: env.STUDY_KEY,
    adminPassword: env.STUDY_ADMIN_PASSWORD,
    sheetUrl: env.STUDY_SHEET_URL,
    sheetSecret: env.STUDY_SHEET_SECRET
  };
  const missing = ['STUDY_KEY', 'STUDY_ADMIN_PASSWORD', 'STUDY_SHEET_URL', 'STUDY_SHEET_SECRET'].filter(name => !env[name]);
  if (missing.length) console.warn(`[estudio] Faltan variables: ${missing.join(', ')}. Los móviles guardarán los eventos hasta que estén.`);
  return config;
}

module.exports = { createStudyRouter, studyConfigFromEnv, cleanEvent, EVENT_TYPES, PARTICIPANT_RE, MAX_BATCH };
