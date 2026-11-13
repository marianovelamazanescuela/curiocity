// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { createStudyRouter, cleanEvent, studyConfigFromEnv } = require('./study');
const { createFakeSheet, fakeSheetFetch } = require('./study-sheet-fake');

const KEY = 'clave-de-prueba';
const PASSWORD = 'contraseña-investigadora';
const SECRET = 'secreto-hoja';

const servers = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(s => new Promise(r => s.close(r))));
  vi.restoreAllMocks();
});

async function start(app) {
  const server = await new Promise(resolve => {
    const s = app.listen(0, () => resolve(s));
  });
  servers.push(server);
  return `http://127.0.0.1:${server.address().port}`;
}

async function studyServer({ fail = () => false, ...config } = {}) {
  const sheet = createFakeSheet({ secret: SECRET });
  const sent = []; // every body sent to the spreadsheet
  const fetchToSheet = fakeSheetFetch(sheet, { fail });
  const app = express();
  app.set('trust proxy', 1);
  app.use(
    '/api/study',
    createStudyRouter({
      key: KEY,
      adminPassword: PASSWORD,
      sheetUrl: 'https://script.google.com/macros/s/prueba/exec',
      sheetSecret: SECRET,
      fetchImpl: (url, options) => {
        sent.push(options.body);
        return fetchToSheet(url, options);
      },
      ...config
    })
  );
  return { base: await start(app), sheet, sent };
}

const event = (n, extra = {}) => ({
  id: `mabc${String(n).padStart(4, '0')}-x1y2z3`,
  fecha: '2026-11-11T09:30:00.000Z',
  sesion: 'S-a1b2c3d4',
  participante: 'LINCE-47',
  tipo: 'pantalla',
  pantalla: 'dato',
  objeto: 'Plátano',
  asignatura: 'biologia',
  leccion_id: 'L-q1w2e3r4',
  detalles: { accion: 'entrada', numero: 2, total: 6 },
  ...extra
});

const postJson = (url, body, headers = {}) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

describe('study version: off by default', () => {
  it('without STUDY_MODE=true there is no study configuration', () => {
    expect(studyConfigFromEnv({})).toBeNull();
    expect(studyConfigFromEnv({ STUDY_MODE: 'false', STUDY_KEY: 'x' })).toBeNull();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(studyConfigFromEnv({ STUDY_MODE: 'true', STUDY_KEY: 'k' })).toMatchObject({ key: 'k' });
  });

  it('the main app has no study routes (404 like any unknown API route)', async () => {
    vi.stubEnv('STUDY_MODE', '');
    vi.resetModules();
    const { app } = require('./app');
    const base = await start(app);
    for (const route of ['/api/study/events', '/api/study/codigo', '/api/study/admin']) {
      const res = await postJson(base + route, { eventos: [event(1)] }, { 'X-Study-Key': KEY });
      expect(res.status).toBe(404);
    }
    vi.unstubAllEnvs();
  });
});

describe('POST /api/study/events', () => {
  it('rejects a missing or wrong key, and saves nothing', async () => {
    const { base, sheet, sent } = await studyServer();
    expect((await postJson(`${base}/api/study/events`, { eventos: [event(1)] })).status).toBe(401);
    expect((await postJson(`${base}/api/study/events`, { eventos: [event(1)] }, { 'X-Study-Key': 'otra' })).status).toBe(401);
    expect(sent).toHaveLength(0);
    expect(sheet.rows('eventos')).toHaveLength(0);
  });

  it('forwards a valid batch to the spreadsheet and confirms each id', async () => {
    const { base, sheet } = await studyServer();
    const res = await postJson(`${base}/api/study/events`, { eventos: [event(1), event(2)] }, { 'X-Study-Key': KEY });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ids).toEqual([event(1).id, event(2).id]);
    const rows = sheet.rows('eventos');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ participante: 'LINCE-47', tipo: 'pantalla', pantalla: 'dato', asignatura: 'biologia' });
    expect(JSON.parse(rows[0].detalles)).toEqual({ accion: 'entrada', numero: 2, total: 6 });
    expect(rows[0].recibido).toMatch(/^\d{4}-/);
  });

  it('a batch sent twice (lost confirmation) is not duplicated', async () => {
    const { base, sheet } = await studyServer();
    await postJson(`${base}/api/study/events`, { eventos: [event(1)] }, { 'X-Study-Key': KEY });
    const res = await postJson(`${base}/api/study/events`, { eventos: [event(1), event(2)] }, { 'X-Study-Key': KEY });
    expect((await res.json()).ids).toEqual([event(1).id, event(2).id]);
    expect(sheet.rows('eventos').map(r => r.id)).toEqual([event(1).id, event(2).id]);
  });

  it('never stores the IP, the user agent or any other request data', async () => {
    const { base, sheet, sent } = await studyServer();
    const logs = [];
    for (const level of ['log', 'info', 'warn', 'error']) vi.spyOn(console, level).mockImplementation((...a) => logs.push(a.join(' ')));
    await postJson(
      `${base}/api/study/events`,
      { eventos: [event(1)] },
      { 'X-Study-Key': KEY, 'User-Agent': 'NavegadorDePrueba/9.9', 'X-Forwarded-For': '203.0.113.77' }
    );
    const everything = JSON.stringify(sheet.raw('eventos')) + sent.join('') + logs.join('\n');
    expect(everything).not.toContain('203.0.113.77');
    expect(everything).not.toContain('127.0.0.1');
    expect(everything).not.toContain('NavegadorDePrueba');
    expect(Object.keys(JSON.parse(sent[0]))).toEqual(['secreto', 'accion', 'eventos']);
  });

  it('drops invalid events (and reports them) but keeps the valid ones', async () => {
    const { base, sheet } = await studyServer();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bad = [
      event(2, { tipo: 'inventado' }),
      event(3, { ip: '1.2.3.4' }), // unknown field
      event(4, { participante: 'Marta López' }),
      event(5, { detalles: { foto: 'data:image/jpeg;base64,AAAA' } }),
      event(6, { detalles: { texto: 'x'.repeat(5000) } }),
      event(7, { asignatura: 'quimica' })
    ];
    const res = await postJson(`${base}/api/study/events`, { eventos: [event(1), ...bad] }, { 'X-Study-Key': KEY });
    const body = await res.json();
    expect(body.ids).toEqual([event(1).id]);
    expect(body.rechazados).toEqual(bad.map(e => e.id));
    expect(sheet.rows('eventos')).toHaveLength(1);
  });

  it('rejects empty, oversized or malformed batches', async () => {
    const { base } = await studyServer();
    const send = body => postJson(`${base}/api/study/events`, body, { 'X-Study-Key': KEY });
    expect((await send({ eventos: [] })).status).toBe(400);
    expect((await send({})).status).toBe(400);
    expect((await send({ eventos: Array.from({ length: 51 }, (_, i) => event(i)) })).status).toBe(400);
    const huge = { eventos: [event(1, { detalles: { a: 'x'.repeat(300000) } })] };
    expect((await send(huge)).status).toBe(413);
  });

  it('when the spreadsheet does not answer, nothing is confirmed (the phone keeps the events)', async () => {
    const { base } = await studyServer({ fail: () => true });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await postJson(`${base}/api/study/events`, { eventos: [event(1)] }, { 'X-Study-Key': KEY });
    expect(res.status).toBe(502);
  });

  it('without the spreadsheet configured, nothing is confirmed either', async () => {
    const { base } = await studyServer({ sheetUrl: '' });
    const res = await postJson(`${base}/api/study/events`, { eventos: [event(1)] }, { 'X-Study-Key': KEY });
    expect(res.status).toBe(502);
  });

  it('has a request limit', async () => {
    const { base } = await studyServer({ limits: { events: 2 } });
    const send = () => postJson(`${base}/api/study/events`, { eventos: [event(1)] }, { 'X-Study-Key': KEY });
    await send();
    await send();
    expect((await send()).status).toBe(429);
  });
});

describe('cleanEvent', () => {
  it('keeps the lesson JSON (up to the spreadsheet cell size)', () => {
    const lesson = event(1, { tipo: 'leccion', pantalla: undefined, detalles: { leccion: { dato_sorprendente: 'x'.repeat(20000) } } });
    expect(cleanEvent(lesson)).not.toBeNull();
    expect(cleanEvent({ ...lesson, detalles: { leccion: 'x'.repeat(41000) } })).toBeNull();
  });

  it('requires an ISO date, a session and a participant code', () => {
    expect(cleanEvent(event(1, { fecha: 'ayer' }))).toBeNull();
    expect(cleanEvent({ ...event(1), sesion: undefined })).toBeNull();
    expect(cleanEvent(event(1, { participante: 'LINCE-17' }))).toBeNull(); // digits 2-9 only
  });
});

describe('participant codes and the researcher password', () => {
  it('hands out codes the spreadsheet has never given before', async () => {
    const { base, sheet } = await studyServer();
    const codes = new Set();
    for (let i = 0; i < 30; i++) {
      const res = await postJson(`${base}/api/study/codigo`, {}, { 'X-Study-Key': KEY });
      const { codigo } = await res.json();
      expect(codigo).toMatch(/^[A-Z]{3,8}-[2-9]{2}$/);
      codes.add(codigo);
    }
    expect(codes.size).toBe(30);
    expect(sheet.rows('codigos')).toHaveLength(30);
  });

  it('needs the study key for a code', async () => {
    const { base } = await studyServer();
    expect((await postJson(`${base}/api/study/codigo`, {})).status).toBe(401);
  });

  it('checks the researcher password (basic authentication)', async () => {
    const { base } = await studyServer();
    const auth = password => ({ Authorization: `Basic ${Buffer.from(`investigador:${password}`).toString('base64')}` });
    expect((await postJson(`${base}/api/study/admin`, {}, auth(PASSWORD))).status).toBe(204);
    expect((await postJson(`${base}/api/study/admin`, {}, auth('otra'))).status).toBe(401);
    expect((await postJson(`${base}/api/study/admin`, {})).status).toBe(401);
  });
});

describe('the spreadsheet script (study-sheet.gs)', () => {
  it('refuses requests without the shared secret', () => {
    const sheet = createFakeSheet({ secret: SECRET });
    expect(sheet.post(JSON.stringify({ secreto: 'no', accion: 'codigo' }))).toEqual({ ok: false, error: 'secreto' });
    expect(sheet.post('no es json')).toEqual({ ok: false, error: 'json' });
  });

  it('writes cells that look like formulas as text', () => {
    const sheet = createFakeSheet({ secret: SECRET });
    sheet.post(JSON.stringify({ secreto: SECRET, accion: 'eventos', eventos: [event(1, { objeto: '=HYPERLINK("x")' })] }));
    expect(sheet.rows('eventos')[0].objeto).toBe('\'=HYPERLINK("x")');
  });

  it('code words are short, plain and never one letter apart', () => {
    const words = createFakeSheet({ secret: SECRET }).words();
    const distance = (a, b) => {
      const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
      for (let j = 1; j <= b.length; j++) d[0][j] = j;
      for (let i = 1; i <= a.length; i++)
        for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      return d[a.length][b.length];
    };
    expect(new Set(words).size).toBe(words.length);
    for (const w of words) expect(w).toMatch(/^[A-Z]{3,8}$/);
    for (let i = 0; i < words.length; i++) for (let j = i + 1; j < words.length; j++) expect(distance(words[i], words[j]), `${words[i]} ${words[j]}`).toBeGreaterThanOrEqual(2);
  });
});
