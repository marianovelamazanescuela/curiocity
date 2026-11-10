// Study export (CSV and JSON) and the per-participant summary. Pure functions, except exportFile,
// which hands the file to the system share sheet or, if there is none, downloads it.

export const CSV_COLUMNS = ['fecha', 'sesion', 'participante', 'tipo', 'leccion_id', 'objeto', 'asignatura', 'pantalla', 'detalles'];

// A cell that starts like a formula (=, +, -, @) is prefixed with ' so spreadsheets show it as text.
function cell(value) {
  let text = value === undefined || value === null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** One row per event, flat columns and the details as JSON. With BOM so accents open well. */
export function toCSV(eventos) {
  const rows = [CSV_COLUMNS.map(cell).join(',')];
  for (const e of eventos) rows.push(CSV_COLUMNS.map(c => cell(c === 'detalles' ? e.detalles || {} : e[c])).join(','));
  return '﻿' + rows.join('\r\n') + '\r\n';
}

export function toJSON({ eventos, lecciones }, now = new Date()) {
  return JSON.stringify({ app: 'Curiocity', exportado: now.toISOString(), eventos, lecciones }, null, 2);
}

const pad = n => String(n).padStart(2, '0');

/** curiocity-estudio-AAAAMMDD-HHMM (local time), without the extension. */
export const exportName = (now = new Date()) =>
  `curiocity-estudio-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;

/**
 * Per participant: photos, lessons started and completed (reached "Sigue explorando"), right
 * answers out of questions, challenges done and total time (each session from its first to its last
 * event, so a phone left lying around does not count).
 */
export function summarize(eventos) {
  const people = new Map();
  const sessions = new Map();
  for (const e of eventos) {
    if (!people.has(e.participante)) {
      people.set(e.participante, { participante: e.participante, fotos: 0, lecciones: 0, completadas: new Set(), preguntas: 0, aciertos: 0, retos: 0, sesiones: new Set() });
    }
    const p = people.get(e.participante);
    const d = e.detalles || {};
    p.sesiones.add(e.sesion);
    if (e.tipo === 'foto' && d.accion === 'detectada') p.fotos++;
    if (e.tipo === 'leccion') p.lecciones++;
    if (e.tipo === 'pantalla' && e.pantalla === 'explorar' && d.accion === 'entrada') p.completadas.add(e.leccion_id);
    if (e.tipo === 'pregunta') {
      p.preguntas++;
      if (d.acierta) p.aciertos++;
    }
    if (e.tipo === 'reto' && d.resultado === 'hecho') p.retos++;
    const t = Date.parse(e.fecha);
    const key = `${e.participante}|${e.sesion}`;
    const s = sessions.get(key) || { participante: e.participante, from: t, to: t };
    s.from = Math.min(s.from, t);
    s.to = Math.max(s.to, t);
    sessions.set(key, s);
  }
  const time = new Map();
  for (const s of sessions.values()) time.set(s.participante, (time.get(s.participante) || 0) + (s.to - s.from));
  return [...people.values()].map(p => ({
    participante: p.participante,
    sesiones: p.sesiones.size,
    fotos: p.fotos,
    lecciones: p.lecciones,
    completadas: p.completadas.size,
    preguntas: p.preguntas,
    aciertos: p.aciertos,
    retos: p.retos,
    minutos: Math.round((time.get(p.participante) || 0) / 6000) / 10
  }));
}

/** Shares the file with the system sheet if the browser can; otherwise downloads it. */
export async function exportFile(name, text, type) {
  const file = new File([text], name, { type });
  if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return 'shared';
    } catch (err) {
      if (err && err.name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
