// Study mode settings, kept ONLY on this device (localStorage): whether it is on, the current
// participant code and the adult code (stored as a SHA-256 digest, never in plain text).
// No personal data: the participant code is something like "G1-P3", never a name.

const KEY = 'curiocity_study_v1';
export const DEFAULT_PIN = '2468';
export const MAX_PARTICIPANT = 12;

function read() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function write(patch) {
  const next = { ...read(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage blocked: the study mode cannot be switched on
  }
  return next;
}

export const loadStudyConfig = () => {
  const c = read();
  return { active: c.active === true && Boolean(c.participant), participant: c.participant || '' };
};

export const saveStudyConfig = patch => write(patch);

/** A participant code: 1 to 12 characters, no spaces (e.g. "G1-P3"). Returns the code or null. */
export function cleanParticipant(value) {
  if (typeof value !== 'string') return null;
  const code = value.trim();
  if (!code || code.length > MAX_PARTICIPANT || /\s/.test(code)) return null;
  return code;
}

export const isValidPin = pin => typeof pin === 'string' && /^\d{4}$/.test(pin);

async function digest(pin) {
  const bytes = new TextEncoder().encode(`curiocity-estudio:${pin}`);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** True if the 4-digit adult code is right (2468 until it is changed). */
export async function checkPin(pin) {
  if (!isValidPin(pin)) return false;
  const stored = read().pinHash;
  return (await digest(pin)) === (stored || (await digest(DEFAULT_PIN)));
}

export async function changePin(pin) {
  if (!isValidPin(pin)) return false;
  write({ pinHash: await digest(pin) });
  return true;
}
