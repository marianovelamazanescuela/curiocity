// Study version: anonymous usage log for a pilot study (README, "Versión de estudio").
//
// Only in the study version (__STUDY__, fixed at build time). In the main version every function below
// returns at its first line and the build drops the rest, so it records and sends nothing.
//
// Each phone is used by one child, with a participant code handed out by the research team's
// spreadsheet the first time the app opens ("LINCE-47"). Events (ISO time, random session id,
// participant code, type and details) wait in an outbox on the phone (./queue.js, IndexedDB) and go
// to our server in batches; an event is only deleted from the phone once the server confirms it.
// Never recorded: photos or any image, location, device identifiers, user agent or typed text.

import { STUDY_KEY } from './config';

const STORAGE_KEY = 'curiocity_estudio'; // { codigo, visto }
const CODE_RE = /^[A-Z]{3,8}-[2-9]{2}$/;
const BATCH = 50;
const SEND_DELAY_MS = 3000; // gather the events of a few seconds into one request
const FIRST_RETRY_MS = 5000; // then 10 s, 20 s… up to 5 minutes
const MAX_RETRY_MS = 5 * 60 * 1000;
const NEW_SESSION_AFTER_MS = 30 * 60 * 1000; // back after half an hour in the background: new session

// Columns of their own in the spreadsheet; everything else goes into "detalles".
const COLUMNS = ['leccion_id', 'objeto', 'asignatura', 'pantalla'];

let sessionId = null;
let writes = Promise.resolve();
let queuePromise = null;
let sending = null;
let timer = null;
let failures = 0;
let sequence = 0;
const listeners = new Set();

const loadQueue = () => (queuePromise ||= import('./queue'));

function randomText(length) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, b => (b % 36).toString(36)).join('');
}
// Starts with the time (and a counter), so the outbox reads oldest first. Random, not a device id.
const newEventId = () => `${Date.now().toString(36).padStart(9, '0')}-${(sequence++ % 1296).toString(36).padStart(2, '0')}${randomText(8)}`;

function readState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function writeState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // private mode: the code lasts until the app is closed
  }
  notify();
}

function notify() {
  for (const listener of listeners) listener();
}

/** Calls listener() when the code or the outbox change. Returns an unsubscribe function. */
export function subscribeStudy(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const studyParticipant = () => (__STUDY__ ? readState().codigo || null : null);
export const studyCodeSeen = () => __STUDY__ && Boolean(readState().visto);

export function markCodeSeen() {
  if (!__STUDY__) return;
  writeState({ ...readState(), visto: true });
}

const headers = () => ({ 'Content-Type': 'application/json', 'X-Study-Key': STUDY_KEY });

async function fetchNewCode() {
  const res = await fetch('/api/study/codigo', { method: 'POST', headers: headers(), body: '{}' });
  const data = res.ok ? await res.json() : null;
  if (!data || !CODE_RE.test(data.codigo || '')) throw new Error('No participant code');
  return data.codigo;
}

/**
 * The phone's participant code: the saved one, or a new one from the server the first time
 * (it needs a connection; nothing is recorded until there is a code).
 */
export async function ensureParticipant() {
  if (!__STUDY__) return null;
  const saved = studyParticipant();
  if (saved) return saved;
  const codigo = await fetchNewCode();
  writeState({ codigo, visto: false });
  startSession();
  return codigo;
}

/** Records one event. Does nothing at all in the main version or before the phone has a code. */
export function track(tipo, detalles = {}, when = new Date()) {
  if (!__STUDY__) return null;
  const participante = studyParticipant();
  if (!participante) return null;
  if (!sessionId) startSession();
  const event = { id: newEventId(), fecha: when.toISOString(), sesion: sessionId, participante, tipo };
  const rest = {};
  for (const [key, value] of Object.entries(detalles || {})) {
    if (value === undefined || value === null) continue;
    if (COLUMNS.includes(key)) event[key] = value;
    else rest[key] = value;
  }
  event.detalles = rest;
  writes = writes
    .then(loadQueue)
    .then(queue => queue.addEvent(event))
    .then(notify)
    .catch(err => console.warn('Study event not saved:', err && err.message));
  scheduleSend(SEND_DELAY_MS);
  return event;
}

// The lesson as the AI wrote it, without picture addresses (no image is ever recorded).
function lessonText(lesson) {
  const copy = { ...lesson };
  for (const key of ['imagen_dato', 'imagen_porque']) {
    if (copy[key] && typeof copy[key] === 'object') {
      const credit = { ...copy[key] };
      delete credit.src;
      delete credit.ancho;
      delete credit.alto;
      copy[key] = credit;
    }
  }
  return copy;
}

/** Records the lesson shown (once per lesson) and returns its id, to link it with the events. */
export function trackLesson(lesson, { objeto, asignatura }) {
  if (!__STUDY__ || !lesson || !studyParticipant()) return null;
  const id = `L-${randomText(8)}`;
  track('leccion', { leccion_id: id, objeto, asignatura, sin_conexion: lesson.offline === true, leccion: lessonText(lesson) });
  return id;
}

function startSession() {
  sessionId = `S-${randomText(8)}`;
  track('sesion_inicio');
}

function endSession(motivo, when) {
  if (!sessionId) return null;
  const event = track('sesion_fin', { motivo }, when);
  sessionId = null;
  return event;
}

// ---- Sending ----

/** Sends events to the server; returns the ids it confirmed (saved or rejected), or null. */
async function post(eventos, keepalive = false) {
  try {
    const res = await fetch('/api/study/events', { method: 'POST', headers: headers(), body: JSON.stringify({ eventos }), keepalive });
    if (!res.ok) return null;
    const data = await res.json();
    return [...(data.ids || []), ...(data.rechazados || [])];
  } catch {
    return null; // offline or server asleep: the events stay on the phone
  }
}

function scheduleSend(delay) {
  if (timer) return; // a send (or a retry with its waiting time) is already planned
  timer = setTimeout(sendNow, delay);
}

function retryLater() {
  failures++;
  clearTimeout(timer);
  timer = setTimeout(sendNow, Math.min(FIRST_RETRY_MS * 2 ** (failures - 1), MAX_RETRY_MS));
}

/** Sends everything in the outbox, batch by batch. Resolves true when it is empty. */
export function sendNow() {
  if (!__STUDY__) return Promise.resolve(true);
  clearTimeout(timer);
  timer = null;
  sending ||= (async () => {
    try {
      await writes;
      const queue = await loadQueue();
      for (;;) {
        const batch = await queue.firstEvents(BATCH);
        if (batch.length === 0) {
          failures = 0;
          return true;
        }
        const confirmed = await post(batch);
        if (!confirmed || confirmed.length === 0) {
          retryLater();
          return false;
        }
        failures = 0;
        await queue.removeEvents(confirmed);
        notify();
      }
    } catch (err) {
      console.warn('Study events not sent:', err && err.message);
      retryLater();
      return false;
    }
  })().finally(() => {
    sending = null;
  });
  return sending;
}

/** How many events are still on the phone, waiting to be sent. */
export async function pendingCount() {
  if (!__STUDY__) return 0;
  await writes;
  return (await loadQueue()).countEvents();
}

/** Backup: a CSV of the events still on the phone, shared or downloaded. */
export async function exportBackup() {
  if (!__STUDY__) return null;
  await writes;
  const [queue, { toCSV, exportName, exportFile }] = await Promise.all([loadQueue(), import('./export')]);
  const eventos = await queue.allEvents();
  return exportFile(exportName(studyParticipant()), toCSV(eventos), 'text/csv');
}

/**
 * When the app opens: a session, the first send, and the listeners that keep sending (back online,
 * app hidden or closed). Returns the cleanup function.
 */
export function startStudy() {
  if (!__STUDY__) return () => {};
  let hiddenAt = null;
  if (studyParticipant() && !sessionId) startSession();
  sendNow();

  const onOnline = () => {
    failures = 0;
    sendNow();
  };
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      sendNow();
    } else {
      if (hiddenAt && Date.now() - hiddenAt > NEW_SESSION_AFTER_MS && sessionId) {
        endSession('inactividad', new Date(hiddenAt));
        startSession();
      }
      hiddenAt = null;
      sendNow();
    }
  };
  // Closing the app: the end of the session goes out at once (keepalive survives the page);
  // it is also in the outbox, in case this last request does not arrive.
  const onPageHide = () => {
    const last = endSession('app_cerrada');
    if (last) post([last], true);
  };
  const onPageShow = e => {
    if (e.persisted && studyParticipant() && !sessionId) startSession();
  };
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);
  return () => {
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('pageshow', onPageShow);
  };
}

function basicAuth(password) {
  const bytes = new TextEncoder().encode(`investigador:${password}`);
  return `Basic ${btoa(String.fromCharCode(...bytes))}`;
}

/**
 * /?reiniciar-estudio (researcher only): checks the password, sends everything pending and gives
 * the phone a new participant code. Nothing is deleted if something is left unsent.
 * Resolves { ok: true, codigo } or { ok: false, reason: 'password' | 'offline' | 'pending', left }.
 */
export async function resetParticipant(password) {
  if (!__STUDY__) return { ok: false, reason: 'offline' };
  let check;
  try {
    check = await fetch('/api/study/admin', { method: 'POST', headers: { Authorization: basicAuth(password) } });
  } catch {
    return { ok: false, reason: 'offline' };
  }
  if (check.status === 401) return { ok: false, reason: 'password' };
  if (!check.ok) return { ok: false, reason: 'offline' };

  endSession('reinicio');
  failures = 0;
  await sendNow();
  await sendNow(); // in case a send was already under way when the session ended
  const left = await pendingCount();
  if (left > 0) return { ok: false, reason: 'pending', left };

  let codigo;
  try {
    codigo = await fetchNewCode();
  } catch {
    return { ok: false, reason: 'offline' };
  }
  writeState({ codigo, visto: false });
  startSession();
  return { ok: true, codigo };
}

/** Tests: wait for pending writes, and start again from scratch. */
export const studyWrites = () => writes;
export function resetStudyForTests() {
  clearTimeout(timer);
  timer = null;
  sessionId = null;
  writes = Promise.resolve();
  sending = null;
  failures = 0;
  listeners.clear();
}
