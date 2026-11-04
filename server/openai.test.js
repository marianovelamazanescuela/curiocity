// @vitest-environment node
import { describe, expect, it } from 'vitest';
import openai from './openai.js';

const { buildRequest, DEFAULT_MODEL } = openai;

describe('buildRequest', () => {
  const body = { messages: [], max_tokens: 100, temperature: 0.35 };

  it('defaults to gpt-6-luna, the official replacement for the retired gpt-4o-mini', () => {
    expect(DEFAULT_MODEL).toBe('gpt-6-luna');
  });

  it('uses max_completion_tokens (newer models reject max_tokens) and no hidden reasoning', () => {
    const r = buildRequest(body, 'gpt-6-luna');
    expect(r).toMatchObject({ model: 'gpt-6-luna', max_completion_tokens: 100, temperature: 0.35, reasoning_effort: 'none' });
    expect(r).not.toHaveProperty('max_tokens');
  });

  it('does not send reasoning_effort to older models that do not support it', () => {
    const r = buildRequest(body, 'gpt-4o-mini');
    expect(r).toMatchObject({ model: 'gpt-4o-mini', max_completion_tokens: 100 });
    expect(r).not.toHaveProperty('reasoning_effort');
  });
});
