// The phone's backup copy (CSV) of the events still waiting to be sent. Pure functions, except
// exportFile, which hands the file to the system share sheet or, if there is none, downloads it.

export const CSV_COLUMNS = ['id', 'fecha', 'sesion', 'participante', 'tipo', 'leccion_id', 'objeto', 'asignatura', 'pantalla', 'detalles'];

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

const pad = n => String(n).padStart(2, '0');

/** curiocity-estudio-CODIGO-AAAAMMDD-HHMM.csv (local time). */
export const exportName = (codigo, now = new Date()) =>
  `curiocity-estudio-${codigo || 'sin-codigo'}-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.csv`;

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
