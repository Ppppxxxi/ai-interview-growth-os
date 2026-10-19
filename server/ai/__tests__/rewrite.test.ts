import { afterEach, describe, expect, it, vi } from 'vitest';
import { rewriteAnswer } from '../rewrite';
import { readAIConfig } from '../config';
import { config, now, output, request, upstream } from './fixtures';

afterEach(() => vi.useRealTimers());
describe('rewriteAnswer', () => {
  it('calls_official_host_with_server_key', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(upstream());
    const result = await rewriteAnswer(request, { fetch, config: config(), now });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.deepseek.com/chat/completions');
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer fictional-test-key' });
    expect(init?.redirect).toBe('error');
    const body = JSON.parse(init?.body as string);
    expect(body).toMatchObject({ model: 'fictional-model', max_tokens: 4096, stream: false, response_format: { type: 'json_object' } });
    expect(body.messages[0].content).toContain('json');
    expect(body.messages[0].content).toContain('answerParagraphIndex');
    expect(result).toMatchObject({ ...output, questionId: request.questionId,
      generationId: request.generationId, model: 'fictional-model', generatedAt: now() });
  });
  it.each([429, 402, 500, 401])('does_not_retry or expose provider body (%s)', async status => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response('secret provider body', { status }));
    await expect(rewriteAnswer(request, { fetch, config: config(), now })).rejects.toMatchObject({
      message: status === 429 ? 'RATE_LIMITED' : status === 402 ? 'QUOTA_EXCEEDED' : 'UPSTREAM_ERROR',
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('network failure has no retry and no raw exception', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new Error('fictional-test-key'));
    await expect(rewriteAnswer(request, { fetch, config: config(), now })).rejects.toMatchObject({ message: 'UPSTREAM_ERROR' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each([
    { ...output, citations: [{ ...output.citations[0], chunkId: 'unknown' }] },
    { ...output, citations: [{ ...output.citations[0], quote: 'fabricated' }] },
    { ...output, citations: [{ ...output.citations[0], answerParagraphIndex: 99 }] },
    { ...output, model: 'forged' }, { ...output, questionId: 'forged' },
    { ...output, generationId: 'forged' }, { ...output, generatedAt: now() },
  ])('rejects_invalid_citation and unknown output fields', async value => {
    await expect(rewriteAnswer(request, { fetch: vi.fn().mockResolvedValue(upstream(value)), config: config(), now }))
      .rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it.each(['', 'not json', '{}'])('rejects invalid model content %s', async content => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content } }] })));
    await expect(rewriteAnswer(request, { fetch, config: config(), now })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it('rejects truncated output', async () => {
    await expect(rewriteAnswer(request, { fetch: vi.fn().mockResolvedValue(upstream(output, 'length')), config: config(), now }))
      .rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it.each(['fetch', 'body'])('times_out_at_45_seconds including %s', async stage => {
    vi.useFakeTimers();
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async () => {
      if (stage === 'fetch') return new Promise(() => {});
      return { ok: true, json: () => new Promise(() => {}) } as Response;
    });
    const pending = rewriteAnswer(request, { fetch, config: config(), now });
    const assertion = expect(pending).rejects.toMatchObject({ code: 'TIMEOUT' });
    await vi.advanceTimersByTimeAsync(44_999);
    expect((fetch.mock.calls[0][1]?.signal as AbortSignal).aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
    expect((fetch.mock.calls[0][1]?.signal as AbortSignal).aborted).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each([{}, { AI_GENERATION_ENABLED: 'TRUE' }, { AI_GENERATION_ENABLED: 'true' },
    { AI_GENERATION_ENABLED: 'false', DEEPSEEK_API_KEY: 'fake', DEEPSEEK_MODEL: 'fake' },
    { AI_GENERATION_ENABLED: 'true', DEEPSEEK_API_KEY: 'fake' }])('disabled_or_unconfigured_never_calls_fetch', async env => {
    const fetch = vi.fn();
    await expect(rewriteAnswer(request, { fetch, config: readAIConfig(env), now })).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects unknown request parameters even outside HTTP', async () => {
    const fetch = vi.fn();
    await expect(rewriteAnswer({ ...request, model: 'user-model' } as typeof request, { fetch, config: config(), now }))
      .rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(fetch).not.toHaveBeenCalled();
  });
});
