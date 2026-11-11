// What the study log needs to remember while one lesson is open: its id, when the current screen
// was entered and how it is being left. In the main version (__STUDY__ false) it is an object that
// does nothing, and the build drops the rest.

import { track, trackLesson } from './index';

const NO_TRACKER = {
  lesson() {},
  enter: () => undefined,
  leaving() {},
  event() {},
  msSinceEntered: () => 0
};

export function createLessonTracker() {
  if (!__STUDY__) return NO_TRACKER;
  const state = { lessonId: null, enteredAt: 0, exit: null };
  const context = (objeto, asignatura) => ({ leccion_id: state.lessonId || undefined, objeto, asignatura });

  return {
    /** The lesson once, and whether it is the offline one (an error for the study). */
    lesson(content, objeto, asignatura) {
      if (!content) return;
      if (!state.lessonId) state.lessonId = trackLesson(content, { objeto, asignatura });
      if (content.offline) track('error', { motivo: 'contenido_sin_conexion', objeto, asignatura });
    },

    /** Entry into a screen; returns the function that records its exit, with its duration. */
    enter({ objeto, asignatura, pantalla, numero, total }) {
      const ctx = { ...context(objeto, asignatura), pantalla };
      const start = Date.now();
      state.enteredAt = start;
      track('pantalla', { ...ctx, accion: 'entrada', numero, total });
      return () => {
        track('pantalla', { ...ctx, accion: 'salida', duracion_ms: Date.now() - start, salida: state.exit || 'cerrada' });
        state.exit = null;
      };
    },

    /** How the current screen is being left: 'avance', 'retroceso', 'salida_x', 'otra_foto'… */
    leaving(reason) {
      state.exit = reason;
    },

    event(tipo, objeto, asignatura, details) {
      track(tipo, { ...context(objeto, asignatura), ...details });
    },

    msSinceEntered() {
      return Date.now() - state.enteredAt;
    }
  };
}
