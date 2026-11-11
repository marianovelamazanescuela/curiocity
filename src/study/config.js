// Is this the study version? __STUDY__ is fixed when the app is built (STUDY_MODE=true, see
// vite.config.mjs) and written into each file as true or false, so in the main version every study
// branch, and the study files themselves, are dropped from the build. Use __STUDY__ directly: an
// imported constant would keep them.

// Sent with every batch so the server can turn away stray requests. It is inside the app's files,
// so it is not a secret: the real protection is the server's validation and limits.
export const STUDY_KEY = import.meta.env.VITE_STUDY_KEY || '';
