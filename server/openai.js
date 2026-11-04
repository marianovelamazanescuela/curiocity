// Thin wrapper around the OpenAI Chat Completions API. The key only lives on the server.
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

// gpt-4o-mini is retired by OpenAI on 2027-01-14; gpt-6-luna is its official replacement.
// OPENAI_MODEL lets you switch (e.g. back to gpt-4o-mini to compare) without code changes.
const DEFAULT_MODEL = 'gpt-6-luna';
const getModel = () => process.env.OPENAI_MODEL || DEFAULT_MODEL;

// Older models (GPT-4o / GPT-4.1 families) don't know `reasoning_effort`.
const isReasoningModel = model => !/^gpt-4(o|\.1)/.test(model);

/**
 * Adapts our request to the model:
 * - `max_completion_tokens` instead of `max_tokens` (newer models reject max_tokens with HTTP 400)
 * - reasoning models get `reasoning_effort: 'none'`: our tasks are short and factual, so there is
 *   no need to pay for (or wait for) hidden reasoning tokens. Temperature is accepted with 'none'.
 */
function buildRequest(body, model = getModel()) {
  const { max_tokens: maxTokens, ...rest } = body;
  const request = { model, ...rest };
  if (maxTokens !== undefined) request.max_completion_tokens = maxTokens;
  if (isReasoningModel(model) && request.reasoning_effort === undefined) request.reasoning_effort = 'none';
  return request;
}

/** Returns the model's text, or null if the API answered with an error. */
async function callOpenAI(body) {
  const resp = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify(buildRequest(body))
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

module.exports = { callOpenAI, parseModelJson, buildRequest, DEFAULT_MODEL };
