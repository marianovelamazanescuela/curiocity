/**
 * Curiocity · versión de estudio · script de la hoja de cálculo (Google Apps Script)
 *
 * Se pega en la hoja del equipo investigador: Extensiones > Apps Script (ver README,
 * "Versión de estudio"). Solo recibe datos de nuestro servidor, que envía el secreto
 * guardado en Propiedades del script > SECRETO (el mismo valor que STUDY_SHEET_SECRET en Render).
 *
 * - accion "eventos": añade una fila por evento en la pestaña "eventos", sin repetir
 *   los que ya estén (cada evento tiene un id), y devuelve los ids guardados.
 * - accion "codigo": reparte un código de participante nuevo (PALABRA-NN) que no se
 *   haya dado antes y lo apunta en la pestaña "codigos".
 *
 * Este archivo vive en el repositorio (server/study-sheet.gs) y tiene tests; si se cambia,
 * hay que volver a pegarlo en la hoja.
 */

var EVENT_COLUMNS = ['id', 'fecha', 'sesion', 'participante', 'tipo', 'leccion_id', 'objeto', 'asignatura', 'pantalla', 'detalles', 'recibido'];
var CODE_COLUMNS = ['codigo', 'creado'];

// Palabras cortas, sin tildes ni ñ, sin dobles sentidos y que no se confunden entre sí
// (dos palabras cualesquiera se diferencian en al menos dos letras). Cifras del 2 al 9,
// para que no se confundan con la O ni con la I: 40 palabras × 64 números = 2560 códigos.
var CODE_WORDS = [
  'LINCE', 'GARZA', 'NUTRIA', 'TEJON', 'ERIZO', 'CIERVO', 'LOBO', 'PUMA', 'KOALA', 'PANDA',
  'CEBRA', 'TIGRE', 'JIRAFA', 'MEDUSA', 'TORTUGA', 'RANA', 'GRILLO', 'ABEJA', 'HORMIGA', 'ARDILLA',
  'CASTOR', 'GACELA', 'CARACOL', 'COMETA', 'NUBE', 'LUNA', 'ROBLE', 'PINO', 'OLIVO', 'CEDRO',
  'TRIGO', 'GIRASOL', 'AMAPOLA', 'MANGO', 'KIWI', 'PERA', 'PATO', 'BISONTE', 'NARVAL', 'FLAMENCO'
];
var CODE_DIGITS = '23456789';

function doPost(e) {
  var request;
  try {
    request = JSON.parse(e.postData.contents);
  } catch (err) {
    return answer({ ok: false, error: 'json' });
  }
  var secret = PropertiesService.getScriptProperties().getProperty('SECRETO');
  if (!secret || request.secreto !== secret) return answer({ ok: false, error: 'secreto' });

  var lock = LockService.getScriptLock();
  lock.waitLock(20000); // two phones at once must not write the same rows
  try {
    if (request.accion === 'eventos') return answer({ ok: true, ids: saveEvents(request.eventos || []) });
    if (request.accion === 'codigo') return answer({ ok: true, codigo: newCode() });
    return answer({ ok: false, error: 'accion' });
  } finally {
    lock.releaseLock();
  }
}

function answer(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function getSheet(name, columns) {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = book.getSheetByName(name);
  if (!sheet) {
    sheet = book.insertSheet(name);
    sheet.getRange(1, 1, 1, columns.length).setValues([columns]);
    sheet.getRange(1, 1, sheet.getMaxRows(), columns.length).setNumberFormat('@'); // text, not dates or numbers
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function columnValues(sheet) {
  var last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, 1, last - 1, 1).getValues().map(function (row) { return String(row[0]); });
}

// A cell that starts like a formula is written as text (with a leading apostrophe).
function asCell(value) {
  if (value === undefined || value === null) return '';
  var text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function saveEvents(events) {
  var sheet = getSheet('eventos', EVENT_COLUMNS);
  var known = {};
  columnValues(sheet).forEach(function (id) { known[id] = true; });
  var now = new Date().toISOString();
  var rows = [];
  var ids = [];
  events.forEach(function (event) {
    if (!event || typeof event.id !== 'string') return;
    ids.push(event.id); // already in the sheet counts as saved: the phone can delete it
    if (known[event.id]) return;
    known[event.id] = true;
    rows.push(EVENT_COLUMNS.map(function (column) {
      if (column === 'recibido') return now;
      if (column === 'detalles') return asCell(event.detalles || {});
      return asCell(event[column]);
    }));
  });
  if (rows.length) sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, EVENT_COLUMNS.length).setValues(rows);
  return ids;
}

function newCode() {
  var sheet = getSheet('codigos', CODE_COLUMNS);
  var used = {};
  columnValues(sheet).forEach(function (code) { used[code] = true; });
  var code;
  for (var tries = 0; tries < 200; tries++) {
    var word = CODE_WORDS[Math.floor(Math.random() * CODE_WORDS.length)];
    var digits = CODE_DIGITS.charAt(Math.floor(Math.random() * 8)) + CODE_DIGITS.charAt(Math.floor(Math.random() * 8));
    code = word + '-' + digits;
    if (!used[code]) break;
    code = null;
  }
  if (!code) throw new Error('No quedan códigos libres');
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, 2).setValues([[code, new Date().toISOString()]]);
  return code;
}
