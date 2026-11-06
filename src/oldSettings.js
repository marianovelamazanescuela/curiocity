// Settings that earlier versions saved on the device and that the app no longer uses:
// the voice choice (the read-aloud voice was removed) and the age group (there is now a single
// audience, 8–10). They are deleted at start-up so no orphaned data stays on the device.
const OLD_KEYS = ['curiocity_voice', 'curiocity_age'];

export function removeOldSettings() {
  for (const key of OLD_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      // localStorage may be blocked (private mode): then nothing was saved either
    }
  }
}
