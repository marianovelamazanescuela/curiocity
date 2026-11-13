// A stand-in for Google Sheets that runs the real Apps Script (study-sheet.gs) in Node, for the
// tests and for trying the study version locally (scripts/study-sheet-local.js). Each tab is an
// array of rows; nothing here is used in production.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SCRIPT = fs.readFileSync(path.join(__dirname, 'study-sheet.gs'), 'utf8');

function createFakeSheet({ secret }) {
  const tabs = new Map(); // name -> rows (arrays), header included

  const makeSheet = name => {
    const rows = [];
    tabs.set(name, rows);
    const sheet = {
      getLastRow: () => rows.length,
      getMaxRows: () => 1000,
      setFrozenRows: () => {},
      getRange: (row, col, numRows, numCols) => ({
        setNumberFormat: () => {},
        setValues: values => {
          values.forEach((v, i) => {
            rows[row - 1 + i] = [...(rows[row - 1 + i] || [])];
            v.forEach((cell, j) => (rows[row - 1 + i][col - 1 + j] = cell));
          });
        },
        getValues: () => rows.slice(row - 1, row - 1 + numRows).map(r => r.slice(col - 1, col - 1 + numCols))
      })
    };
    return sheet;
  };
  const sheets = new Map();
  const context = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: name => sheets.get(name) || null,
        insertSheet: name => {
          const sheet = makeSheet(name);
          sheets.set(name, sheet);
          return sheet;
        }
      })
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => (key === 'SECRETO' ? secret : null) }) },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: text => ({ text, setMimeType() { return this; } })
    }
  };
  vm.createContext(context);
  vm.runInContext(SCRIPT, context);

  return {
    /** Same as an HTTP POST to the Apps Script web app: body text in, JSON answer out. */
    post(bodyText) {
      return JSON.parse(context.doPost({ postData: { contents: bodyText } }).text);
    },
    /** The tab as objects (header row as keys). */
    rows(name) {
      const [header, ...rest] = tabs.get(name) || [[]];
      return rest.map(r => Object.fromEntries(header.map((h, i) => [h, r[i]])));
    },
    raw: name => tabs.get(name) || [],
    /** Every tab, to save it (scripts/study-sheet-local.js), and back. */
    dump: () => Object.fromEntries(tabs),
    restore(saved) {
      for (const [name, rows] of Object.entries(saved)) {
        const sheet = context.SpreadsheetApp.getActiveSpreadsheet().insertSheet(name);
        sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
      }
    },
    words: () => [...context.CODE_WORDS]
  };
}

/** A fetch() replacement that sends to the fake sheet, as the server does to Apps Script. */
function fakeSheetFetch(sheet, { fail = () => false } = {}) {
  return async (url, options) => {
    if (fail()) throw Object.assign(new Error('offline'), { name: 'TypeError' });
    const data = sheet.post(options.body);
    return { ok: true, status: 200, json: async () => data };
  };
}

module.exports = { createFakeSheet, fakeSheetFetch };
