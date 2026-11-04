// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const realFetch = globalThis.fetch;
let server;
let base;
let mod;
let openaiReply; // what the mocked OpenAI returns next: string content, or { status }
let openaiCalls;

const post = (path, body, headers = {}) =>
  realFetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

beforeAll(async () => {
  process.env.OPENAI_API_KEY = 'sk-test';
  process.env.RATE_LIMIT_PER_15MIN = '1000';
  process.env.NODE_ENV = 'development';

  // Intercept only OpenAI calls; requests to our own server go through untouched.
  vi.stubGlobal('fetch', async (url, opts) => {
    if (String(url).startsWith('https://api.openai.com')) {
      openaiCalls.push(JSON.parse(opts.body));
      if (openaiReply && typeof openaiReply === 'object') {
        return new Response('upstream error', { status: openaiReply.status });
      }
      return Response.json({ choices: [{ message: { content: openaiReply } }] });
    }
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
  mod.cache.clear();
});

describe('isAllowedLink', () => {
  it.each([
    ['https://www.khanacademy.org/science', true],
    ['https://khanacademy.org', true],
    ['https://es.wikipedia.org/wiki/Manzana', true],
    ['https://khanacademy.org.evil.com/', false],
    ['https://notkhanacademy.org/', false],
    ['ftp://khanacademy.org/file', false]
  ])('%s → %s', (url, expected) => {
    expect(mod.isAllowedLink(new URL(url))).toBe(expected);
  });
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
  const valid = { objectName: 'apple', subject: 'Biology', language: 'Spanish' };

  it('rejects missing or oversized fields', async () => {
    expect((await post('/api/ai', {})).status).toBe(400);
    expect((await post('/api/ai', { ...valid, objectName: 'x'.repeat(101) })).status).toBe(400);
    expect((await post('/api/ai', { ...valid, subject: { evil: true } })).status).toBe(400);
    expect(openaiCalls).toHaveLength(0);
  });

  it('sanitises model output, filters links and caches the result', async () => {
    openaiReply = JSON.stringify({
      title: 'La manzana',
      text: 'Intro',
      explanation: ['Uno', 'Dos'],
      funFacts: ['a', 'b'],
      links: [
        { title: 'Khan', url: 'https://www.khanacademy.org/apple' },
        { title: 'Phish', url: 'https://khanacademy.org.evil.com/' },
        { title: 'Bad', url: 'not a url' }
      ],
      relatedObjects: ['pera', 'semilla', 'árbol', 'extra']
    });

    const r = await post('/api/ai', valid);
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.title).toBe('La manzana');
    expect(body.explanation).toBe('Uno\n\nDos');
    expect(body.links).toEqual([{ title: 'Khan', url: 'https://www.khanacademy.org/apple', source: '' }]);
    expect(body.relatedObjects).toEqual(['pera', 'semilla', 'árbol']);

    // The language reaches the prompt and JSON mode is requested
    expect(openaiCalls[0].response_format).toEqual({ type: 'json_object' });
    expect(openaiCalls[0].messages[0].content).toContain('Spanish');

    // Second identical request is served from the cache
    await post('/api/ai', { ...valid, objectName: '  APPLE ' });
    expect(openaiCalls).toHaveLength(1);
  });

  it('returns 502 when the model output is unusable, so the client can use its localized fallback', async () => {
    openaiReply = 'Sorry, I cannot help with that.';
    const r = await post('/api/ai', valid);
    expect(r.status).toBe(502);
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

  it('returns the detected object name, trimmed', async () => {
    openaiReply = ' "manzana roja". ';
    const r = await post('/api/detect', { image, language: 'Spanish' });
    expect(await r.json()).toEqual({ object: 'manzana roja' });
    expect(openaiCalls[0].messages[0].content[0].text).toContain('Spanish');
  });

  it('returns null when there is no clear object', async () => {
    openaiReply = 'none';
    const r = await post('/api/detect', { image });
    expect(await r.json()).toEqual({ object: null });
  });
});

describe('unknown API routes', () => {
  it('return JSON 404 instead of the SPA', async () => {
    const r = await realFetch(base + '/api/nope');
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ error: 'Not found' });
  });
});
