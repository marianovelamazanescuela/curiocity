// Study data on this device only: an IndexedDB database of its own, separate from the history.
// Loaded only when the study mode is on, or when an adult opens the study panel.
// Two stores: "eventos" (one row per event) and "lecciones" (the AI lesson JSON shown, once each).

const DB_NAME = 'curiocity_estudio';
const VERSION = 1;

let dbPromise = null;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('eventos')) db.createObjectStore('eventos', { keyPath: 'n', autoIncrement: true });
        if (!db.objectStoreNames.contains('lecciones')) db.createObjectStore('lecciones', { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        dbPromise = null;
        reject(request.error);
      };
    });
  }
  return dbPromise;
}

function run(storeName, mode, action) {
  return open().then(
    db =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const result = action(tx.objectStore(storeName));
        tx.oncomplete = () => resolve(result && 'result' in result ? result.result : undefined);
        tx.onerror = () => reject(tx.error);
      })
  );
}

export const addEvent = event => run('eventos', 'readwrite', s => s.add(event));
export const addLesson = lesson => run('lecciones', 'readwrite', s => s.put(lesson));

/** Events in the order they happened, and every lesson. */
export async function readAll() {
  const [eventos, lecciones] = await Promise.all([run('eventos', 'readonly', s => s.getAll()), run('lecciones', 'readonly', s => s.getAll())]);
  const withoutKey = e => {
    const copy = { ...e };
    delete copy.n; // IndexedDB's own counter, not part of the event
    return copy;
  };
  return { eventos: (eventos || []).map(withoutKey), lecciones: lecciones || [] };
}

export async function clearAll() {
  await run('eventos', 'readwrite', s => s.clear());
  await run('lecciones', 'readwrite', s => s.clear());
}

/** Tests only: forget the open connection. */
export function closeForTests() {
  if (dbPromise) dbPromise.then(db => db.close()).catch(() => {});
  dbPromise = null;
}
