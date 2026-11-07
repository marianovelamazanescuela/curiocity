// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const realFetch = globalThis.fetch;
let server;
let base;
let mod;
let openaiReply; // what the mocked OpenAI returns: string content, { status }, or an array of those
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
  // Loose like the real search: any page sharing a word of 4+ letters with the term.
  const words = (u.searchParams.get('srsearch') || '').replace(/^intitle:/, '').toLowerCase().split(/\s+/).filter(w => w.length >= 4);
  const hits = [...pages].filter(p => words.some(w => p.toLowerCase().includes(w)));
  return Response.json({ query: { search: hits.map(title => ({ title })) } });
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
      // An array gives one reply per call (to test retries); an object { status } is an API error.
      const reply = Array.isArray(openaiReply) ? openaiReply.shift() : openaiReply;
      if (reply && typeof reply === 'object') {
        return new Response('upstream error', { status: reply.status });
      }
      return Response.json({ choices: [{ message: { content: reply } }] });
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
  const valid = { objectName: 'Farola', subject: 'History', language: 'Spanish' };
  const modelLesson = (extra = {}) =>
    JSON.stringify({
      pregunta_inicial: { pregunta: '¿Qué usaban antes para alumbrar las calles?', opciones: ['Lámparas de aceite', 'Paneles solares', 'Pantallas'], correcta: 0 },
      dato_sorprendente: 'Hubo personas cuyo trabajo era encender las farolas.',
      por_que: 'Antes no había luz eléctrica en las calles.',
      reto: 'Cuenta cuántas farolas ves desde donde estás.',
      reto_foto: false,
      reto_observacion: {
        pregunta: '¿Has contado más de cinco farolas?',
        opciones: [
          { texto: 'Sí', conclusion: 'Si hay muchas, puede ser porque la calle es larga.' },
          { texto: 'No', conclusion: 'Si hay pocas, puede ser porque la calle es corta.' }
        ]
      },
      para_seguir_pensando: '¿Cómo sería tu calle sin farolas?',
      ideas_pregunta_final: ['Estaría muy oscura.', 'Usaríamos linternas.'],
      conexion_debil: false,
      objetos_relacionados: ['vela', 'linterna'],
      terminos_busqueda: ['Farola'],
      ...extra
    });

  it('rejects missing or oversized fields', async () => {
    expect((await post('/api/ai', {})).status).toBe(400);
    expect((await post('/api/ai', { ...valid, objectName: 'x'.repeat(101) })).status).toBe(400);
    expect((await post('/api/ai', { ...valid, subject: { evil: true } })).status).toBe(400);
    expect(openaiCalls).toHaveLength(0);
  });

  it('returns a validated interactive lesson with the right answer marked', async () => {
    openaiReply = modelLesson();
    const body = await (await post('/api/ai', valid)).json();
    const q = body.pregunta_inicial;
    expect(q.opciones).toHaveLength(3);
    expect(q.opciones[q.correcta]).toBe('Lámparas de aceite');
    expect(body).toMatchObject({
      dato_sorprendente: expect.any(String),
      por_que: expect.any(String),
      reto: 'Cuenta cuántas farolas ves desde donde estás.',
      reto_foto: false,
      para_seguir_pensando: '¿Cómo sería tu calle sin farolas?',
      conexion_debil: false,
      objetos_relacionados: ['vela', 'linterna'],
      enlaces: []
    });
    expect(body).not.toHaveProperty('terminos_busqueda');
    expect(body).not.toHaveProperty('complete');
    expect(body.reto_observacion.opciones).toHaveLength(2);
    expect(body.ideas_pregunta_final).toEqual(['Estaría muy oscura.', 'Usaríamos linternas.']);
  });

  it('asks once more when the observation or the ideas are missing, and uses the complete answer', async () => {
    openaiReply = [modelLesson({ reto_observacion: null }), modelLesson()];
    const body = await (await post('/api/ai', valid)).json();
    expect(openaiCalls).toHaveLength(2);
    expect(body.reto_observacion.pregunta).toBe('¿Has contado más de cinco farolas?');
  });

  it('if they are still missing after the retry, serves the lesson without them', async () => {
    openaiReply = [modelLesson({ reto_observacion: null }), modelLesson({ ideas_pregunta_final: [] })];
    const r = await post('/api/ai', valid);
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(openaiCalls).toHaveLength(2);
    expect(body.reto).toBe('Cuenta cuántas farolas ves desde donde estás.');
    expect(body.ideas_pregunta_final).toEqual([]); // the last usable answer is kept
    expect(body.reto_observacion.opciones).toHaveLength(2);
  });

  it('keeps an incomplete lesson if the retry fails at the API', async () => {
    openaiReply = [modelLesson({ ideas_pregunta_final: ['una'] }), { status: 500 }];
    const r = await post('/api/ai', valid);
    expect(r.status).toBe(200);
    expect((await r.json()).ideas_pregunta_final).toEqual([]);
  });

  it('asks for structured output, accuracy and a low temperature, and caches', async () => {
    openaiReply = modelLesson();
    await post('/api/ai', valid);
    const call = openaiCalls[0];
    expect(call.response_format.type).toBe('json_schema');
    expect(call.response_format.json_schema.strict).toBe(true);
    expect(call.temperature).toBeLessThanOrEqual(0.4);
    expect(call.messages[0].content).toContain('Spanish');
    expect(call.messages[0].content).toMatch(/Never include URLs/);

    await post('/api/ai', { ...valid, objectName: '  FAROLA ' });
    expect(openaiCalls).toHaveLength(1);
  });

  it('never uses URLs from the model: links come from real encyclopedia pages', async () => {
    wikiPages = { 'es.vikidia.org': new Set(['Farola']), 'es.wikipedia.org': new Set(['Farola']) };
    openaiReply = modelLesson({ enlaces: [{ title: 'Invented', url: 'https://www.khanacademy.org/made-up' }] });

    const body = await (await post('/api/ai', valid)).json();
    expect(body.enlaces).toEqual([
      { title: 'Farola', url: 'https://es.vikidia.org/wiki/Farola', source: 'Vikidia' },
      { title: 'Farola', url: 'https://es.wikipedia.org/wiki/Farola', source: 'Wikipedia' }
    ]);
    expect(JSON.stringify(body)).not.toContain('made-up');
  });

  it('rejects loose matches that are real pages but not about the object', async () => {
    wikiPages = { 'es.vikidia.org': new Set(['Percepción pública de las matemáticas', 'Playa de la Concha', 'Bicicleta']) };
    openaiReply = modelLesson({ terminos_busqueda: ['Matemáticas de la bicicleta'] });
    const body = await (await post('/api/ai', { ...valid, objectName: 'Bicicleta' })).json();
    expect(body.enlaces).toEqual([{ title: 'Bicicleta', url: 'https://es.vikidia.org/wiki/Bicicleta', source: 'Vikidia' }]);
  });

  it('does not accept a page that only mentions the word (Playa de la Concha for concha)', async () => {
    wikiPages = { 'es.vikidia.org': new Set(['Playa de la Concha', 'Concha marina']) };
    openaiReply = modelLesson({ terminos_busqueda: ['Concha'] });
    const body = await (await post('/api/ai', { ...valid, objectName: 'Vieira' })).json();
    expect(body.enlaces.map(l => l.title)).toEqual(['Concha marina']);
  });

  it('uses the encyclopedias of the requested language', async () => {
    wikiPages = { 'klexikon.zum.de': new Set(['Laterne']) };
    openaiReply = modelLesson({ terminos_busqueda: ['Laterne'] });
    const body = await (await post('/api/ai', { ...valid, language: 'German' })).json();
    expect(body.enlaces).toEqual([{ title: 'Laterne', url: 'https://klexikon.zum.de/wiki/Laterne', source: 'Klexikon' }]);
    expect(new Set(wikiCalls)).toEqual(new Set(['klexikon.zum.de', 'de.wikipedia.org']));
  });

  it('writes for 8-10 year-olds and ignores any age group sent by old versions of the app', async () => {
    openaiReply = modelLesson();
    await post('/api/ai', { ...valid, ageGroup: '6-8' });
    expect(openaiCalls[0].messages[0].content).toMatch(/8-10 years old/);
    expect(openaiCalls[0].messages[0].content).not.toMatch(/6-8|9-12/);
    await post('/api/ai', { ...valid, ageGroup: '9-12' }); // same cache entry: the age is not part of the key
    await post('/api/ai', valid);
    expect(openaiCalls).toHaveLength(1);
  });

  it('retries once when the output is invalid', async () => {
    openaiReply = [modelLesson({ pregunta_inicial: { pregunta: '¿?', opciones: ['a', 'a', 'b'], correcta: 0 } }), modelLesson()];
    const r = await post('/api/ai', valid);
    expect(r.status).toBe(200);
    expect(openaiCalls).toHaveLength(2);
  });

  it('returns 502 when the output stays invalid, so the client can use its offline content', async () => {
    openaiReply = 'Sorry, I cannot help with that.';
    expect((await post('/api/ai', valid)).status).toBe(502);
    expect(openaiCalls).toHaveLength(2);
  });

  it('returns 502 without retrying when OpenAI fails', async () => {
    openaiReply = { status: 429 };
    expect((await post('/api/ai', valid)).status).toBe(502);
    expect(openaiCalls).toHaveLength(1);
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

describe('POST /api/subjects', () => {
  const all = ['biologia', 'geologia', 'historia', 'matematicas', 'lengua', 'musica', 'artes'];
  const scores = { historia: 3, matematicas: 2, artes: 2, biologia: 1, geologia: 0, lengua: 1, musica: 0 };
  const modelRanking = () =>
    JSON.stringify({ subjects: all.map(key => ({ key, score: scores[key], hook: scores[key] >= 2 ? `Gancho de ${key}` : '' })) });

  it('validates input', async () => {
    expect((await post('/api/subjects', {})).status).toBe(400);
    expect((await post('/api/subjects', { objectName: 'x'.repeat(101) })).status).toBe(400);
  });

  it('returns the 3 best subjects with a hook, the rest in order, and caches them', async () => {
    openaiReply = modelRanking();
    const body = await (await post('/api/subjects', { objectName: 'Farola', language: 'Spanish' })).json();
    expect(body.ranking.featured.map(f => f.key)).toEqual(['historia', 'matematicas', 'artes']);
    expect(body.ranking.featured[0].hook).toBe('Gancho de historia');
    expect(body.ranking.others).toEqual(['biologia', 'lengua', 'geologia', 'musica']);
    expect(openaiCalls[0].response_format.type).toBe('json_schema');
    expect(openaiCalls[0].messages[0].content).toMatch(/children \(8-10\)/);

    await post('/api/subjects', { objectName: 'farola', language: 'Spanish', ageGroup: '9-12' });
    expect(openaiCalls).toHaveLength(1);
  });

  it('returns ranking: null (show every subject) when the output is unusable', async () => {
    openaiReply = JSON.stringify({ subjects: [{ key: 'nope', score: 3, hook: 'x' }] });
    expect(await (await post('/api/subjects', { objectName: 'Farola' })).json()).toEqual({ ranking: null });
  });
});

describe('unknown API routes', () => {
  it('return JSON 404 instead of the SPA', async () => {
    const r = await realFetch(base + '/api/nope');
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ error: 'Not found' });
  });
});
