// Study mode: anonymous usage log for a pilot study, kept only on this device.
//
// Switched off (the default), nothing is recorded: every call below returns at its first line and
// the storage code (./store.js, IndexedDB) is never even loaded. Switched on by an adult, each event
// is saved with an ISO timestamp, a random session id, the participant code and its type.
// Never recorded: photos or any image, location, device identifiers, IP, user agent or typed text.
// Nothing is sent to our server or to anyone else: the data only leaves the device when an adult
// exports it from the study panel.

import { cleanParticipant, loadStudyConfig, saveStudyConfig } from './config';

let state = loadStudyConfig(); // { active, participant }
let sessionId = null;
let queue = Promise.resolve();
let storePromise = null;
const listeners = new Set();

const loadStore = () => (storePromise ||= import('./store'));
const randomId = prefix => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

// Columns of their own in the export; everything else goes into "detalles".
const COLUMNS = ['leccion_id', 'objeto', 'asignatura', 'pantalla'];

function save(kind, record) {
  queue = queue
    .then(loadStore)
    .then(store => (kind === 'lesson' ? store.addLesson(record) : store.addEvent(record)))
    .catch(err => console.warn('Study log not saved:', err && err.message));
}

function notify() {
  for (const listener of listeners) listener(state);
}

export const isStudyActive = () => state.active;
export const studyParticipant = () => state.participant;

/** Calls listener({ active, participant }) whenever the mode changes. Returns an unsubscribe function. */
export function subscribeStudy(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Records one event. Does nothing at all while the study mode is off. */
export function track(tipo, detalles = {}) {
  if (!state.active) return;
  if (!sessionId) startSession();
  const event = { fecha: new Date().toISOString(), sesion: sessionId, participante: state.participant, tipo };
  const rest = {};
  for (const [key, value] of Object.entries(detalles || {})) {
    if (value === undefined) continue;
    if (COLUMNS.includes(key)) event[key] = value;
    else rest[key] = value;
  }
  event.detalles = rest;
  save('event', event);
}

// The lesson as the AI wrote it, without picture addresses (no image is ever stored).
function lessonText(lesson) {
  const copy = { ...lesson };
  for (const key of ['imagen_dato', 'imagen_porque']) {
    if (copy[key] && typeof copy[key] === 'object') {
      const { src, ancho, alto, ...credit } = copy[key];
      copy[key] = credit;
    }
  }
  return copy;
}

/**
 * Saves the lesson shown (once per lesson) and returns its id, to link it with the events.
 * Returns null while the study mode is off.
 */
export function trackLesson(lesson, { objeto, asignatura }) {
  if (!state.active || !lesson) return null;
  if (!sessionId) startSession();
  const id = randomId('L');
  save('lesson', { id, fecha: new Date().toISOString(), sesion: sessionId, participante: state.participant, objeto, asignatura, leccion: lessonText(lesson) });
  track('leccion', { leccion_id: id, objeto, asignatura, sin_conexion: lesson.offline === true });
  return id;
}

function startSession() {
  sessionId = randomId('S');
  track('sesion_inicio');
}

function endSession(motivo) {
  if (!state.active || !sessionId) return;
  track('sesion_fin', { motivo });
  sessionId = null;
}

/** When the app opens (or comes back from the browser's page cache) with the mode on. */
export function studyAppOpened() {
  if (state.active && !sessionId) startSession();
}

/** When the app is closed (best effort: the browser may not wait for the last write). */
export function studyAppClosed() {
  endSession('app_cerrada');
}

/** Switches the study mode on for a participant code. Returns false if the code is not valid. */
export function activateStudy(participant) {
  const code = cleanParticipant(participant);
  if (!code) return false;
  state = { active: true, participant: code };
  saveStudyConfig({ active: true, participant: code });
  startSession();
  notify();
  return true;
}

export function deactivateStudy() {
  endSession('desactivado');
  state = { active: false, participant: state.participant };
  saveStudyConfig({ active: false });
  notify();
}

/** Next participant on the same phone: closes this session and opens a new one. */
export function changeParticipant(participant) {
  const code = cleanParticipant(participant);
  if (!code || !state.active) return false;
  const previous = state.participant;
  endSession('cambio_participante');
  state = { active: true, participant: code };
  saveStudyConfig({ participant: code });
  startSession();
  track('cambio_participante', { anterior: previous });
  notify();
  return true;
}

/** Everything recorded so far (for the panel and the export). Loads the store. */
export async function readStudyData() {
  await queue;
  return (await loadStore()).readAll();
}

export async function clearStudyData() {
  await queue;
  await (await loadStore()).clearAll();
}

/** Tests: wait for pending writes, and whether the storage code was ever loaded. */
export const flushStudy = () => queue;
export const studyStoreLoaded = () => storePromise !== null;
export function resetStudyForTests() {
  state = loadStudyConfig();
  sessionId = null;
  queue = Promise.resolve();
  storePromise = null;
  listeners.clear();
}
