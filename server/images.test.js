// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { findImage, findLessonImages, rejectReason, cleanAuthor, imageUrl } = require('./images.js');

// Mocked encyclopedias: host -> { title: { pageimage?, redirectTo?, disambiguation? } }; Commons: file -> imageinfo.
let wikis;
let commons;
const photo = (over = {}) => ({
  mime: 'image/jpeg',
  width: 2000,
  height: 1500,
  thumburl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Farolero.jpg/960px-Farolero.jpg?utm_source=commons.wikimedia.org',
  thumbwidth: 600,
  thumbheight: 450,
  descriptionurl: 'https://commons.wikimedia.org/wiki/File:Farolero.jpg',
  extmetadata: { Artist: { value: '<a href="https://example.org/ana">Ana Ruiz</a>' }, LicenseShortName: { value: 'CC BY-SA 4.0' } },
  ...over
});

beforeEach(() => {
  wikis = {};
  commons = {};
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.stubGlobal('fetch', async url => {
    const u = new URL(url);
    const title = u.searchParams.get('titles');
    if (u.hostname === 'commons.wikimedia.org') {
      const file = title.replace(/^File:/, '');
      return Response.json({ query: { pages: [commons[file] ? { title, imageinfo: [commons[file]] } : { title, missing: true }] } });
    }
    const page = (wikis[u.hostname] || {})[title];
    if (!page) return Response.json({ query: { pages: [{ title, missing: true }] } });
    return Response.json({
      query: {
        pages: [{ title: page.redirectTo || title, pageimage: page.pageimage, pageprops: page.disambiguation ? { disambiguation: '' } : {} }]
      }
    });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('findImage', () => {
  it('takes the main image of the exact article, from Commons, with author and licence', async () => {
    wikis = { 'es.vikidia.org': { Farolero: { pageimage: 'Farolero.jpg' } } };
    commons = { 'Farolero.jpg': photo() };
    expect(await findImage('Farolero', 'Spanish')).toEqual({
      src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Farolero.jpg/960px-Farolero.jpg',
      ancho: 600,
      alto: 450,
      autor: 'Ana Ruiz',
      licencia: 'CC BY-SA 4.0',
      archivo: 'https://commons.wikimedia.org/wiki/File:Farolero.jpg',
      termino: 'Farolero',
      articulo: 'Farolero',
      fuente: 'Vikidia'
    });
  });

  it('follows redirects and falls back to the next encyclopedia of the language', async () => {
    wikis = {
      'es.vikidia.org': { 'Lámpara de gas': {} }, // article without a main image
      'es.wikipedia.org': { 'Lámpara de gas': { redirectTo: 'Lámpara de gas (iluminación)', pageimage: 'Gas.jpg' } }
    };
    commons = { 'Gas.jpg': photo() };
    const image = await findImage('Lámpara de gas', 'Spanish');
    expect(image.fuente).toBe('Wikipedia');
    expect(image.articulo).toBe('Lámpara de gas (iluminación)');
  });

  it('never uses a missing article or a disambiguation page', async () => {
    wikis = { 'es.vikidia.org': { Banco: { pageimage: 'Banco.jpg', disambiguation: true } } };
    commons = { 'Banco.jpg': photo() };
    expect(await findImage('Banco', 'Spanish')).toBeNull();
    expect(await findImage('No existe', 'Spanish')).toBeNull();
    expect(await findImage('', 'Spanish')).toBeNull();
  });

  it('gives no image when the file is not on Commons', async () => {
    wikis = { 'es.vikidia.org': { Farolero: { pageimage: 'Local.jpg' } } };
    expect(await findImage('Farolero', 'Spanish')).toBeNull();
  });

  it('gives no image without an author or a licence', async () => {
    wikis = { 'es.vikidia.org': { Farolero: { pageimage: 'Farolero.jpg' } } };
    commons = { 'Farolero.jpg': photo({ extmetadata: { LicenseShortName: { value: 'CC BY 2.0' } } }) };
    expect(await findImage('Farolero', 'Spanish')).toBeNull();
    commons = { 'Farolero.jpg': photo({ extmetadata: { Artist: { value: 'Ana Ruiz' } } }) };
    expect(await findImage('Farolero', 'Spanish')).toBeNull();
    commons = { 'Farolero.jpg': photo({ extmetadata: { Artist: { value: 'Unknown author' }, LicenseShortName: { value: 'Public domain' } } }) };
    expect(await findImage('Farolero', 'Spanish')).toBeNull();
  });

  it('gives no image if the picture is not served from upload.wikimedia.org', async () => {
    wikis = { 'es.vikidia.org': { Farolero: { pageimage: 'Farolero.jpg' } } };
    commons = { 'Farolero.jpg': photo({ thumburl: 'https://example.org/Farolero.jpg' }) };
    expect(await findImage('Farolero', 'Spanish')).toBeNull();
  });

  it('uses the encyclopedias of the child’s language', async () => {
    wikis = { 'klexikon.zum.de': { Laterne: { pageimage: 'Laterne.jpg' } } };
    commons = { 'Laterne.jpg': photo() };
    expect((await findImage('Laterne', 'German')).fuente).toBe('Klexikon');
    expect(await findImage('Laterne', 'Spanish')).toBeNull();
  });
});

describe('findLessonImages', () => {
  it('drops the "why" picture when it is the same as the fact’s', async () => {
    wikis = { 'es.vikidia.org': { Farolero: { pageimage: 'Farolero.jpg' }, Farolillo: { redirectTo: 'Farolero', pageimage: 'Farolero.jpg' } } };
    commons = { 'Farolero.jpg': photo() };
    const r = await findLessonImages({ dato: 'Farolero', porque: 'Farolillo' }, 'Spanish');
    expect(r.imagen_dato.termino).toBe('Farolero');
    expect(r.imagen_porque).toBeNull();
  });

  it('gives null for empty terms without asking anyone', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    expect(await findLessonImages({ dato: '', porque: null }, 'Spanish')).toEqual({ imagen_dato: null, imagen_porque: null });
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('image filters', () => {
  const ok = { mime: 'image/jpeg', width: 1200, height: 800 };
  it('accepts ordinary photos', () => {
    expect(rejectReason({ ...ok, name: 'Farolero_en_Sevilla_1900.jpg' })).toBeNull();
    expect(rejectReason({ ...ok, name: 'Foto.PNG', mime: 'image/png' })).toBeNull();
    expect(rejectReason({ ...ok, name: 'Photograph_of_a_seal.jpg' })).toBeNull();
  });

  it('rejects SVG, GIF and other formats', () => {
    expect(rejectReason({ ...ok, name: 'Farola.svg', mime: 'image/svg+xml' })).toMatch(/formato/);
    expect(rejectReason({ ...ok, name: 'Farola.gif', mime: 'image/gif' })).toMatch(/formato/);
    expect(rejectReason({ ...ok, name: 'Farola.jpg', mime: 'image/svg+xml' })).toMatch(/formato/);
  });

  it('rejects maps, flags, coats of arms, diagrams, icons and logos by file name', () => {
    for (const name of [
      'Mapa_de_Andalucía.png', 'Spain_location_map.jpg', 'Flag_of_Spain.png', 'Bandera_de_Sevilla.jpg',
      'Escudo_de_Sevilla.png', 'Coat_of_arms_of_Seville.png', 'Stadtwappen_Köln.png', 'Deutschlandkarte.jpg',
      'Diagrama_de_una_flor.png', 'Apple_diagram.jpg', 'Icono_manzana.png', 'Apple_logo.png'
    ]) {
      expect(rejectReason({ ...ok, name }), name).toMatch(/nombre/);
    }
  });

  it('rejects very small images', () => {
    expect(rejectReason({ ...ok, name: 'Farola.jpg', width: 300, height: 800 })).toMatch(/pequeña/);
    expect(rejectReason({ ...ok, name: 'Farola.jpg', width: 1200, height: 200 })).toMatch(/pequeña/);
  });

  it('cleans the author and the image address', () => {
    expect(cleanAuthor('<a href="x">Abhijit</a> from Mumbai, India')).toBe('Abhijit from Mumbai, India');
    expect(cleanAuthor('  ')).toBeNull();
    expect(cleanAuthor('Desconocido')).toBeNull();
    expect(cleanAuthor('a '.repeat(100)).length).toBeLessThanOrEqual(80);
    expect(imageUrl('https://upload.wikimedia.org/wikipedia/commons/a/ab/X.jpg?utm_source=y')).toBe('https://upload.wikimedia.org/wikipedia/commons/a/ab/X.jpg');
    expect(imageUrl('http://upload.wikimedia.org/x.jpg')).toBeNull();
    expect(imageUrl('https://upload.wikimedia.org.evil.com/x.jpg')).toBeNull();
  });
});
