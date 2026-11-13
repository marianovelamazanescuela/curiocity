// Try the study version on your computer without Google: a local stand-in for the spreadsheet that
// runs the real Apps Script (server/study-sheet.gs). Data is kept in .study-local/hoja.json.
//
//   node scripts/study-sheet-local.js            (listens on http://localhost:4300)
//   then start the server with STUDY_MODE=true, STUDY_SHEET_URL=http://localhost:4300 and
//   STUDY_SHEET_SECRET=local (README, "Versión de estudio", "Probarla en local").
//   http://localhost:4300/eventos.csv downloads the "eventos" tab, like the spreadsheet would.

const fs = require('fs');
const http = require('http');
const path = require('path');
const { createFakeSheet } = require('../server/study-sheet-fake');

const PORT = process.env.SHEET_PORT || 4300;
const SECRET = process.env.STUDY_SHEET_SECRET || 'local';
const DIR = path.join(__dirname, '..', '.study-local');
const FILE = path.join(DIR, 'hoja.json');

const sheet = createFakeSheet({ secret: SECRET });
// Replay what was saved, so the data survives a restart.
if (fs.existsSync(FILE)) {
  const saved = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  sheet.restore(saved);
}
const save = () => {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(sheet.dump()));
};

const csvCell = value => `"${String(value ?? '').replace(/"/g, '""')}"`;

http
  .createServer((req, res) => {
    if (req.method === 'GET' && req.url.startsWith('/eventos.csv')) {
      const rows = sheet.raw('eventos');
      res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8' });
      return res.end('﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n');
    }
    if (req.method !== 'POST') {
      res.writeHead(404);
      return res.end();
    }
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      let answer;
      try {
        answer = sheet.post(body);
      } catch (err) {
        answer = { ok: false, error: err.message };
      }
      save();
      const parsed = JSON.parse(body || '{}');
      console.log(new Date().toISOString(), parsed.accion, answer.ok ? (answer.codigo || `${(answer.ids || []).length} evento(s)`) : answer.error);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(answer));
    });
  })
  .listen(PORT, () => console.log(`Hoja local en http://localhost:${PORT} (CSV: /eventos.csv)`));
