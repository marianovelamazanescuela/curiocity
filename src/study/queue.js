// The study version's outbox: events wait here (IndexedDB, on this phone only) until the server
// confirms it has them. Its own database, separate from the exploration history.
// Event ids start with the time, so reading in key order reads the oldest events first.

const DB_NAME = 'curiocity_estudio';
const STORE = 'cola';

let dbPromise = null;

function openDb() {
  dbPromise ||= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function run(mode, work) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const result = work(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(result && 'result' in result ? result.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const addEvent = event => run('readwrite', store => store.put(event));

/** The oldest events, at most `limit`. */
export const firstEvents = limit => run('readonly', store => store.getAll(null, limit));

export const allEvents = () => run('readonly', store => store.getAll());

export const countEvents = () => run('readonly', store => store.count());

export const removeEvents = ids => run('readwrite', store => ids.forEach(id => store.delete(id)));

export async function closeQueueForTests() {
  if (!dbPromise) return;
  (await dbPromise).close();
  dbPromise = null;
}
