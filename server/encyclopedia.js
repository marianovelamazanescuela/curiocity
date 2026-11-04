// Real links for children: we never ask the AI for URLs. The AI only suggests search words;
// this module looks them up in children's encyclopedias and returns pages that really exist.

// Wikimedia-style APIs ask for a descriptive User-Agent.
const USER_AGENT = 'Curiocity/1.0 (educational research prototype, EASD Sevilla; https://github.com/marianovelamazanescuela/curiocity)';
const TIMEOUT_MS = 4000;

// Per language: a children's encyclopedia first, then a general one.
const SOURCES = {
  es: [
    { name: 'Vikidia', host: 'es.vikidia.org', api: '/w/api.php' },
    { name: 'Wikipedia', host: 'es.wikipedia.org', api: '/w/api.php' }
  ],
  fr: [
    { name: 'Vikidia', host: 'fr.vikidia.org', api: '/w/api.php' },
    { name: 'Wikipédia', host: 'fr.wikipedia.org', api: '/w/api.php' }
  ],
  en: [
    { name: 'Vikidia', host: 'en.vikidia.org', api: '/w/api.php' },
    { name: 'Simple English Wikipedia', host: 'simple.wikipedia.org', api: '/w/api.php' }
  ],
  de: [
    { name: 'Klexikon', host: 'klexikon.zum.de', api: '/api.php' },
    { name: 'Wikipedia', host: 'de.wikipedia.org', api: '/w/api.php' }
  ]
};

const LANGUAGE_CODES = { English: 'en', Spanish: 'es', French: 'fr', German: 'de' };

async function mediaWiki(source, params) {
  const url = new URL(`https://${source.host}${source.api}`);
  for (const [k, v] of Object.entries({ ...params, format: 'json', formatversion: '2' })) url.searchParams.set(k, v);
  const resp = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!resp.ok) throw new Error(`${source.host} responded ${resp.status}`);
  return resp.json();
}

const pageUrl = (source, title) => `https://${source.host}/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;

const normalize = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

// Exact title, following redirects (Girasol → Helianthus annuus) and skipping disambiguation pages.
async function findExact(source, term) {
  const exact = await mediaWiki(source, { action: 'query', titles: term, redirects: '1', prop: 'pageprops', ppprop: 'disambiguation' });
  const page = exact?.query?.pages?.[0];
  if (page && !page.missing && !page.invalid && !(page.pageprops && 'disambiguation' in page.pageprops)) {
    return page.title;
  }
  return null;
}

// Approximate title match, accepted only if the title starts with the term ("Concha marina" for
// "concha"). Loose matches are real pages but useless for the child: "Playa de la Concha" for
// "concha", or "Percepción pública de las matemáticas" for "matemáticas de la bicicleta".
async function findApproximate(source, term) {
  const search = await mediaWiki(source, { action: 'query', list: 'search', srsearch: `intitle:${term}`, srlimit: '5', srnamespace: '0' });
  const hits = search?.query?.search || [];
  const hit = hits.find(h => normalize(h.title).startsWith(normalize(term)));
  return hit ? hit.title : null;
}

// All exact lookups first (most specific term wins), then approximate ones.
async function findInSource(source, terms) {
  for (const term of terms) {
    const title = await findExact(source, term);
    if (title) return title;
  }
  for (const term of terms) {
    const title = await findApproximate(source, term);
    if (title) return title;
  }
  return null;
}

/**
 * terms: search words suggested by the AI (e.g. ["Girasol"]), best first.
 * Returns up to one link per source: [{ title, url, source }].
 */
async function findArticles(terms, languageName) {
  const sources = SOURCES[LANGUAGE_CODES[languageName]] || SOURCES.en;
  const cleanTerms = [...new Set(terms.map(t => String(t).trim()).filter(t => t && t.length <= 60))].slice(0, 3);
  if (!cleanTerms.length) return [];

  const results = await Promise.all(
    sources.map(async source => {
      try {
        const title = await findInSource(source, cleanTerms);
        return title ? { title, url: pageUrl(source, title), source: source.name } : null;
      } catch (err) {
        console.warn(`Encyclopedia lookup failed (${source.host}):`, err.message);
        return null; // source unreachable: no link from it
      }
    })
  );
  return results.filter(Boolean);
}

module.exports = { findArticles, SOURCES };
