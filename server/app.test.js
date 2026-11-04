// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const realFetch = globalThis.fetch;
let server;
let base;
let mod;
let openaiReply; // what the mocked OpenAI returns next: string content, or { status }
let openaiCalls;
let wikiPages; // host -> Set of existing page titles in the mocked encyclopedias
let wikiCalls;

const post = (path, body, headers = {}) =>
  realFetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

// Minimal MediaWiki API mock: exact-title lookup and intitle: search.
function mockMediaWiki(url) {
  const u = new URL(url);
  const pages = wikiPages[u.hostname] || new Set();
  wikiCalls.push(u.hostname);
  const titles = u.searchParams.get('titles');
  if (titles) {
    const found = pages.has(titles);
    return Response.json({ query: { pages: [found ? { pageid: 1, title: titles } : { title: titles, missing: true }] } });
  }
  const term = (u.searchParams.get('srsearch') || '').replace(/^intitle:/, '');
  const hit = [...pages].find(p => p.toLowerCase().includes(term.toLowerCase()));
  return Response.json({ query: { search: hit ? [{ title: hit }] : [] } });
}

beforeAll(async () => {
  process.env.OPENAI_API_KEY = 'sk-test';
  process.env.RATE_LIMIT_PER_15MIN = '1000';
  process.env.NODE_ENV = 'development';

  // Intercept OpenAI and encyclopedia calls; requests to our own server go through untouched.
  vi.stubGlobal('fetch', async (url, opts) => {
    const s = String(url);
    if (s.startsWith('https://api.openai.com')) {
      openaiCalls.push(JSON.parse(opts.body));
      if (openaiReply && typeof openaiReply === 'object') {
        return new Response('upstream error', { status: openaiReply.status });
      }
      return Response.json({ choices: [{ message: { content: openaiReply } }] });
    }
    if (/vikidia\.org|wikipedia\.org|klexikon\.zum\.de/.test(s)) return mockMediaWiki(s);
    return realFetch(url, opts);
  });

  mod = (await import('./app.js')).default;
  await new Promise(resolve => {
    server = mod.app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => {
  server && server.close();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  openaiCalls = [];
  openaiReply = '';
  wikiCalls = [];
  wikiPages = {};
  mod.cache.clear();
});

describe('GET /api/health', () => {
  it('responds ok', async () => {
    const r = await realFetch(base + '/api/health');
    expect(r.status).toBe(200);
    expect((await r.json()).ok).toBe(true);
  });
});

describe('CORS', () => {
  it('allows the configured dev origin', async () => {
    const r = await realFetch(base + '/api/health', { headers: { Origin: 'http://localhost:3000' } });
    expect(r.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
  });

  it('does not allow other origins', async () => {
    const r = await realFetch(base + '/api/health', { headers: { Origin: 'https://evil.example' } });
    expect(r.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('POST /api/ai', () => {
  const valid = { objectName: 'Girasol', subject: 'Biology', language: 'Spanish' };
  const modelContent = (extra = {}) =>
    JSON.stringify({
      title: 'El girasol',
      text: 'Intro',
      explanation: ['Uno', 'Dos'],
      funFacts: ['a', 'b'],
      relatedObjects: ['abeja', 'semilla', 'sol', 'extra'],
      searchTerms: ['Helianthus annuus'],
      ...extra
    });

  it('rejects missing or oversized fields', async () => {
    expect((await post('/api/ai', {})).status).toBe(400);
    expect((await post('/api/ai', { ...valid, objectName: 'x'.repeat(101) })).status).toBe(400);
    expect((await post('/api/ai', { ...valid, subject: { evil: true } })).status).toBe(400);
    expect(openaiCalls).toHaveLength(0);
  });

  it('never uses URLs from the model: links come from real encyclopedia pages', async () => {
    wikiPages = { 'es.vikidia.org': new Set(['Helianthus annuus']), 'es.wikipedia.org': new Set(['Helianthus annuus']) };
    openaiReply = modelContent({ links: [{ title: 'Invented', url: 'https://www.khanacademy.org/made-up' }] });

    const body = await (await post('/api/ai', valid)).json();
    expect(body.links).toEqual([
      { title: 'Helianthus annuus', url: 'https://es.vikidia.org/wiki/Helianthus_annuus', source: 'Vikidia' },
      { title: 'Helianthus annuus', url: 'https://es.wikipedia.org/wiki/Helianthus_annuus', source: 'Wikipedia' }
    ]);
    expect(JSON.stringify(body)).not.toContain('made-up');
    expect(body).not.toHaveProperty('searchTerms');
  });

  it('returns no links when no article exists', async () => {
    openaiReply = modelContent();
    const body = await (await post('/api/ai', valid)).json();
    expect(body.links).toEqual([]);
  });

  it('uses the encyclopedias of the requested language', async () => {
    wikiPages = { 'klexikon.zum.de': new Set(['Sonnenblume']) };
    openaiReply = modelContent({ searchTerms: ['Sonnenblume'] });
    const body = await (await post('/api/ai', { ...valid, language: 'German' })).json();
    expect(body.links).toEqual([{ title: 'Sonnenblume', url: 'https://klexikon.zum.de/wiki/Sonnenblume', source: 'Klexikon' }]);
    expect(new Set(wikiCalls)).toEqual(new Set(['klexikon.zum.de', 'de.wikipedia.org']));
  });

  it('sanitises output, asks for accuracy with a low temperature, and caches', async () => {
    openaiReply = modelContent();
    const body = await (await post('/api/ai', valid)).json();
    expect(body.title).toBe('El girasol');
    expect(body.explanation).toBe('Uno\n\nDos');
    expect(body.relatedObjects).toEqual(['abeja', 'semilla', 'sol']);

    const call = openaiCalls[0];
    expect(call.response_format).toEqual({ type: 'json_object' });
    expect(call.temperature).toBeLessThanOrEqual(0.4);
    expect(call.messages[0].content).toContain('Spanish');
    expect(call.messages[0].content).toMatch(/Never include URLs/);

    await post('/api/ai', { ...valid, objectName: '  GIRASOL ' });
    expect(openaiCalls).toHaveLength(1);
  });

  it('returns 502 when the model output is unusable, so the client can use its localized fallback', async () => {
    openaiReply = 'Sorry, I cannot help with that.';
    expect((await post('/api/ai', valid)).status).toBe(502);
  });

  it('returns 502 when OpenAI fails', async () => {
    openaiReply = { status: 429 };
    expect((await post('/api/ai', valid)).status).toBe(502);
  });
});

describe('POST /api/detect', () => {
  const image = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

  it('only accepts inline base64 images', async () => {
    expect((await post('/api/detect', { image: 'https://evil.example/x.jpg' })).status).toBe(400);
    expect((await post('/api/detect', { image: 'data:text/html;base64,PGgxPg==' })).status).toBe(400);
    expect(openaiCalls).toHaveLength(0);
  });

  it('returns the detected object name, trimmed, in the requested language', async () => {
    openaiReply = JSON.stringify({ object: ' "manzana roja". ', person: false });
    const r = await post('/api/detect', { image, language: 'Spanish' });
    expect(await r.json()).toEqual({ object: 'manzana roja' });
    expect(openaiCalls[0].messages[0].content[0].text).toContain('Spanish');
  });

  it('never describes people', async () => {
    openaiReply = JSON.stringify({ object: 'girl with glasses', person: true });
    const r = await post('/api/detect', { image });
    expect(await r.json()).toEqual({ object: null, person: true });
    expect(openaiCalls[0].messages[0].content[0].text).toMatch(/Never describe or identify people/);
  });

  it('returns null when there is no clear object', async () => {
    openaiReply = JSON.stringify({ object: null, person: false });
    expect(await (await post('/api/detect', { image })).json()).toEqual({ object: null });
  });
});

describe('unknown API routes', () => {
  it('return JSON 404 instead of the SPA', async () => {
    const r = await realFetch(base + '/api/nope');
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ error: 'Not found' });
  });
});
