// Thin wrapper around the OpenAI Chat Completions API. The key only lives on the server.
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

/** Returns the model's text, or null if the API answered with an error. */
async function callOpenAI(body) {
  const resp = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({ model: OPENAI_MODEL, ...body })
  });
  if (!resp.ok) {
    const text = await resp.text();
    console.warn('OpenAI API error', resp.status, text.slice(0, 500));
    return null;
  }
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || '';
}

/** Parses JSON from model output, tolerating text around the object. */
function parseModelJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(raw.substring(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

module.exports = { callOpenAI, parseModelJson };
