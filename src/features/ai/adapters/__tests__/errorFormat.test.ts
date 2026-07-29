import { describe, it, expect } from 'vitest';
import { formatAdapterError } from '../errorFormat';

describe('formatAdapterError', () => {
  it('包含 url + model + status + body', () => {
    const msg = formatAdapterError(
      'OpenAI',
      404,
      'https://api.openai.com/v1/chat/completions',
      'gpt-nonexistent',
      '404 page not found',
    );
    expect(msg).toContain('OpenAI API 404');
    expect(msg).toContain('url=https://api.openai.com/v1/chat/completions');
    expect(msg).toContain('model=gpt-nonexistent');
    expect(msg).toContain('404 page not found');
  });

  it('body 为空时 fallback 到 "No body"', () => {
    const msg = formatAdapterError('Claude', 500, 'https://x.com/messages', 'sonnet', '');
    expect(msg).toContain('No body');
    expect(msg.endsWith(': No body')).toBe(true);
  });

  it('body 仅空白时也 fallback', () => {
    const msg = formatAdapterError('Qwen', 401, 'https://x.com', 'turbo', '   ');
    expect(msg).toContain('No body');
  });

  it('不同 provider 标签正常显示', () => {
    expect(formatAdapterError('Custom', 403, 'u', 'm', 'b').startsWith('Custom API')).toBe(true);
  });
});