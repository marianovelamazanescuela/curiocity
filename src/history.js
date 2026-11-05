// Exploration history, stored ONLY on this device (localStorage): no accounts, no server.
// Each entry keeps a small thumbnail so the list is recognisable without storing big photos.
const KEY = 'curiocity_history_v1';
export const MAX_ENTRIES = 30;

export function loadHistory() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function save(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage full or blocked (private mode): history is a nice-to-have, never break the app.
  }
}

/** Adds an entry at the top (replacing an earlier one with the same object) and returns the new list. */
// Subjects are not stored: they are asked again (cached on the server) so the hooks match the age group.
export function addToHistory({ object, thumb }) {
  const entry = { id: Date.now(), date: new Date().toISOString(), object, thumb };
  const list = [entry, ...loadHistory().filter(e => e.object.toLowerCase() !== object.toLowerCase())].slice(0, MAX_ENTRIES);
  save(list);
  return list;
}

export function clearHistory() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  return [];
}
