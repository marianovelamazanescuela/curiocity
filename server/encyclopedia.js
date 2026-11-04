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

// 1) exact title (following redirects, skipping disambiguation pages), 2) best title match.
async function findInSource(source, term) {
  const exact = await mediaWiki(source, { action: 'query', titles: term, redirects: '1', prop: 'pageprops', ppprop: 'disambiguation' });
  const page = exact?.query?.pages?.[0];
  if (page && !page.missing && !page.invalid && !(page.pageprops && 'disambiguation' in page.pageprops)) {
    return page.title;
  }
  const search = await mediaWiki(source, { action: 'query', list: 'search', srsearch: `intitle:${term}`, srlimit: '1', srnamespace: '0' });
  return search?.query?.search?.[0]?.title || null;
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
      for (const term of cleanTerms) {
        try {
          const title = await findInSource(source, term);
          if (title) return { title, url: pageUrl(source, title), source: source.name };
        } catch (err) {
          console.warn(`Encyclopedia lookup failed (${source.host}):`, err.message);
          return null; // source unreachable: don't try more terms on it
        }
      }
      return null;
    })
  );
  return results.filter(Boolean);
}

module.exports = { findArticles, SOURCES };
