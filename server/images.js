// Example pictures for the "Did you know…?" and "Why?" screens. As with links, the AI never writes
// an image URL: it only suggests an encyclopedia article title. This module checks that the article
// exists (exact title, redirects followed, no disambiguation pages), takes ONLY its main image
// (pageimages) and accepts it only if the file is on Wikimedia Commons, with a known author and
// licence, served from upload.wikimedia.org. Anything doubtful: no image.

const { mediaWiki, SOURCES, LANGUAGE_CODES } = require('./encyclopedia');

const COMMONS = { name: 'Wikimedia Commons', host: 'commons.wikimedia.org', api: '/w/api.php' };
const THUMB_WIDTH = 600;
const MIN_WIDTH = 400;
const MIN_HEIGHT = 250;
const IMAGE_HOST = 'upload.wikimedia.org';

// Words in a file name that mean it is not a photo of the thing: maps, flags, coats of arms,
// diagrams, icons, logos (in the four languages of the app and in English, Commons' main language).
const REJECTED_WORDS = new Set([
  'map', 'maps', 'mapa', 'mapas', 'carte', 'cartes', 'karte', 'landkarte', 'locator', 'location', 'localisation', 'ubicacion', 'situacion',
  'flag', 'flags', 'bandera', 'banderas', 'drapeau', 'flagge',
  'escudo', 'coa', 'blason', 'wappen', 'emblem', 'emblema',
  'diagram', 'diagrama', 'diagramm', 'diagramme', 'scheme', 'schema', 'esquema', 'chart', 'grafico', 'graph', 'plan', 'plano',
  'icon', 'icono', 'icone', 'logo', 'logotipo', 'symbol', 'simbolo', 'pictogram', 'pictograma'
]);
// German compounds ("Deutschlandkarte", "Stadtwappen").
const REJECTED_ENDINGS = ['karte', 'wappen', 'flagge', 'diagramm'];
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png']);

const fold = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Why a Commons file is not used as an example picture, or null if it is fine. */
function rejectReason(info) {
  const name = String(info.name || '');
  if (!/\.(jpe?g|png)$/i.test(name) || (info.mime && !ALLOWED_MIME.has(info.mime))) return `formato no admitido (${info.mime || name.split('.').pop()})`;
  const words = fold(name.replace(/\.[a-z0-9]+$/i, '')).split(/[^a-z0-9]+/).filter(Boolean);
  const word =
    words.find(w => REJECTED_WORDS.has(w) || REJECTED_ENDINGS.some(e => w.length > e.length && w.endsWith(e))) ||
    (` ${words.join(" ")} `.includes(" coat of arms ") ? "coat of arms" : undefined);
  if (word) return `el nombre indica mapa, bandera, escudo, diagrama, icono o logo («${word}»)`;
  if (!(info.width >= MIN_WIDTH && info.height >= MIN_HEIGHT)) return `demasiado pequeña (${info.width}×${info.height})`;
  return null;
}

/** Plain text from Commons' HTML metadata ("<a href=…>Ana</a> from Sevilla" → "Ana from Sevilla"). */
function plainText(html) {
  const text = String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
  return text;
}

const UNKNOWN_AUTHOR = /^(unknown|anonymous|desconocido|an[oó]nimo|inconnu|anonyme|unbekannt)\b/i;

/** Author for the credit line, or null when Commons does not say who made it. */
function cleanAuthor(html) {
  let text = plainText(html);
  if (!text || UNKNOWN_AUTHOR.test(text)) return null;
  if (text.length > 80) text = text.slice(0, 79).replace(/\s+\S*$/, '') + '…';
  return text;
}

/** The thumbnail on upload.wikimedia.org without tracking parameters, or null. */
function imageUrl(raw) {
  try {
    const u = new URL(raw);
    // Commons now hands out thumbnails on thumb.wikimedia.org; the same path works on upload.
    if (u.hostname === 'thumb.wikimedia.org') u.hostname = IMAGE_HOST;
    if (u.protocol !== 'https:' || u.hostname !== IMAGE_HOST) return null;
    u.search = '';
    return u.toString();
  } catch {
    return null;
  }
}

function filePageUrl(raw) {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' || u.hostname !== COMMONS.host || !u.pathname.startsWith('/wiki/')) return null;
    u.search = '';
    return u.toString();
  } catch {
    return null;
  }
}

// The article's main image file name, or why there is none.
async function mainImageOf(source, term) {
  const data = await mediaWiki(source, {
    action: 'query', titles: term, redirects: '1', prop: 'pageprops|pageimages', ppprop: 'disambiguation', piprop: 'name'
  });
  const page = data?.query?.pages?.[0];
  if (!page || page.missing || page.invalid) return { reason: 'no existe el artículo' };
  if (page.pageprops && 'disambiguation' in page.pageprops) return { reason: 'es una página de desambiguación' };
  if (!page.pageimage) return { article: page.title, reason: 'el artículo no tiene imagen principal' };
  return { article: page.title, file: page.pageimage };
}

async function commonsInfo(file) {
  const data = await mediaWiki(COMMONS, {
    action: 'query', titles: `File:${file}`, prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: String(THUMB_WIDTH), iiextmetadatafilter: 'Artist|LicenseShortName'
  });
  const page = data?.query?.pages?.[0];
  const info = page?.imageinfo?.[0];
  if (!page || page.missing || !info) return null;
  return {
    name: file,
    mime: info.mime,
    width: info.width,
    height: info.height,
    thumb: info.thumburl || info.url,
    thumbWidth: info.thumbwidth || info.width,
    thumbHeight: info.thumbheight || info.height,
    filePage: info.descriptionurl,
    author: info.extmetadata?.Artist?.value,
    license: info.extmetadata?.LicenseShortName?.value
  };
}

/** Checks one article's main image; returns { image } or { reason }. */
async function checkImage(source, term) {
  const main = await mainImageOf(source, term);
  if (!main.file) return { reason: main.reason, article: main.article };
  const where = { article: main.article, file: main.file };
  const info = await commonsInfo(main.file);
  if (!info) return { ...where, reason: 'el archivo no está en Wikimedia Commons' };
  const rejected = rejectReason(info);
  if (rejected) return { ...where, reason: rejected };
  const autor = cleanAuthor(info.author);
  const licencia = plainText(info.license);
  if (!autor || !licencia) return { ...where, reason: !autor ? 'Commons no indica el autor' : 'Commons no indica la licencia' };
  const src = imageUrl(info.thumb);
  const archivo = filePageUrl(info.filePage);
  if (!src || !archivo) return { ...where, reason: 'la dirección de la imagen no es de upload.wikimedia.org' };
  return {
    image: { src, ancho: info.thumbWidth, alto: info.thumbHeight, autor, licencia: licencia.slice(0, 40), archivo, termino: term, articulo: main.article, fuente: source.name }
  };
}

/**
 * term: an encyclopedia article title suggested by the AI ("Farolero"). Tries the language's
 * sources in order (children's encyclopedia first) and returns the first good main image, or null.
 * Every discarded image is logged with its reason.
 */
async function findImage(term, languageName) {
  const clean = typeof term === 'string' ? term.trim() : '';
  if (!clean || clean.length > 60) return null;
  const sources = SOURCES[LANGUAGE_CODES[languageName]] || SOURCES.en;
  for (const source of sources) {
    try {
      const result = await checkImage(source, clean);
      if (result.image) {
        console.info(`[imagen] elegida: "${clean}" → ${source.name} "${result.image.articulo}" · ${result.image.archivo}`);
        return result.image;
      }
      if (result.file) console.info(`[imagen] descartada: "${clean}" → ${source.name} "${result.article}" · ${result.file} · ${result.reason}`);
      else console.info(`[imagen] sin imagen: "${clean}" en ${source.name}${result.article ? ` ("${result.article}")` : ''} · ${result.reason}`);
    } catch (err) {
      console.warn(`[imagen] fallo al consultar ${source.host}:`, err.message);
    }
  }
  return null;
}

/** Both pictures of a lesson; the "why" one is dropped if it is the same file as the fact's. */
async function findLessonImages({ dato, porque }, languageName) {
  const [imagenDato, imagenPorque] = await Promise.all([findImage(dato, languageName), findImage(porque, languageName)]);
  const same = imagenDato && imagenPorque && imagenDato.src === imagenPorque.src;
  if (same) console.info(`[imagen] descartada: "${porque}" · la misma imagen que en el dato`);
  return { imagen_dato: imagenDato, imagen_porque: same ? null : imagenPorque };
}

module.exports = { findImage, findLessonImages, rejectReason, cleanAuthor, imageUrl };
