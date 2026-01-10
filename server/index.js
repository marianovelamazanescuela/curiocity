require('dotenv').config();
const path = require('path');
const express = require('express');
// Use built-in global fetch when available (Node 18+). Only dynamically import node-fetch
// as a fallback for older Node versions. This avoids adding node-fetch to package.json.
let fetchFunc;
if (typeof globalThis.fetch === 'function') {
  fetchFunc = globalThis.fetch.bind(globalThis);
} else {
  fetchFunc = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args)).catch(() => {
    throw new Error('Fetch is unavailable and node-fetch is not installed');
  });
}
const fetch = (...args) => fetchFunc(...args);
const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());
// Simple CORS middleware so the browser can call this proxy from a different port
app.use((req, res, next) => {
  // Allow any origin for local development. For production, restrict this to your domain.
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  // Allow credentials if needed
  // res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// ---- API routes ----
// Simple health endpoint
app.get('/api/health', (req, res) => res.json({ ok: true, time: Date.now() }));

// Simple in-memory cache: key -> { data, expiresAt }
const cache = new Map();
const CACHE_TTL = parseInt(process.env.CACHE_TTL_SECONDS || '3600', 10);

app.post('/api/ai', async (req, res) => {
  const { objectName, subject } = req.body || {};
  if (!objectName || !subject) {
    return res.status(400).json({ error: 'Missing objectName or subject' });
  }

  const cacheKey = `${String(objectName).toLowerCase().trim()}::${String(subject).toLowerCase().trim()}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return res.json(cached.data);
  }

  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_KEY) {
    return res.status(500).json({ error: 'Server missing OPENAI_API_KEY' });
  }

  try {
    const systemMessage = `You are a friendly, simple teacher creating short, child-friendly educational text for ages 6-12. Output ONLY a JSON object with the fields: title (short string), text (one short intro paragraph), explanation (1-3 short paragraphs), funFacts (an array of 2-6 short bullet strings), links (an array of objects with fields {title, url, source}) and relatedObjects (an array of 1-3 short related object names as simple nouns). Links should be to trustworthy educational resources (Khan Academy, OpenStax, OER Commons, PBS, National Geographic, Wikimedia, YouTube educational videos, etc.) when available. If you are not certain of a valid URL, return an empty array for links. Keep language simple and positive.`;
    const userMessage = `Create educational content about the object named "${objectName}" from the perspective of the subject "${subject}". Make the text engaging for children (6-12), include one clear, simple explanation and 2-5 fun activity/fact bullets. Also include a field "relatedObjects" listing 1 to 3 short related object names (single words or short phrases). If you cannot think of related objects, return an empty array for that field. If possible return up to 4 trustworthy resource links (title and url). Respond with JSON only.`;

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage }
        ],
        max_tokens: 500,
        temperature: 0.8,
        n: 1
      })
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.warn('OpenAI proxy response not ok', resp.status, resp.statusText, text);
      return res.status(502).json({ error: 'OpenAI API error', status: resp.status, body: text });
    }

    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || '';

    // Try to parse JSON from model output
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        const jsonSub = raw.substring(start, end + 1);
        try {
          parsed = JSON.parse(jsonSub);
        } catch (ee) {
          console.warn('Failed to parse JSON from model output', ee);
        }
      }
    }

    if (parsed && parsed.title && parsed.text) {
      // Validate and filter any provided links to avoid model-hallucinated or unsafe URLs.
      const allowedDomains = [
        'khanacademy.org', 'youtube.com', 'youtube-nocookie.com', 'oercommons.org',
        'openstax.org', 'wikimedia.org', 'pbs.org', 'nationalgeographic.com', 'edutopia.org', 'creativecommons.org'
      ];
      if (Array.isArray(parsed.links)) {
        const filtered = [];
        for (const l of parsed.links) {
          try {
            const u = new URL(String(l.url));
            const hostname = u.hostname.toLowerCase();
            if (allowedDomains.some(d => hostname.includes(d))) {
              filtered.push({ title: l.title || u.hostname, url: u.href, source: l.source || '' });
            }
          } catch (e) {
            // skip invalid URL
          }
        }
        parsed.links = filtered;
      } else {
        parsed.links = [];
      }

      // Ensure relatedObjects is a clean array of up to 3 short strings
      if (!Array.isArray(parsed.relatedObjects)) parsed.relatedObjects = [];
      parsed.relatedObjects = parsed.relatedObjects.map(r => String(r).trim()).filter(r => r.length > 0).slice(0, 3);

      // store in cache
      try {
        cache.set(cacheKey, { data: parsed, expiresAt: Date.now() + CACHE_TTL * 1000 });
      } catch (e) {
        console.warn('Cache set failed', e && e.message ? e.message : e);
      }

      return res.json(parsed);
    }

    // As a safe fallback, return a minimal templated response when parsing fails
    return res.json({
      title: `${subject}: Getting to know ${objectName}`,
      text: `Let's discover what ${objectName} is and why it's interesting from the ${subject} perspective.`,
      explanation: `Observe ${objectName} and ask: what is it, how does it work and why does it matter?`,
      funFacts: [`Ask curious questions and try simple experiments or drawings.`]
    });
  } catch (err) {
    console.error('Proxy /api/ai error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---- Static frontend (Render web service) ----
const buildDir = path.join(__dirname, '..', 'build');
app.use(express.static(buildDir));

// SPA fallback to index.html for non-API routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(buildDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Web + API server listening on http://localhost:${PORT}`);
});
