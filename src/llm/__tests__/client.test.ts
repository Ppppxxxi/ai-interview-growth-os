import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAIStatus, requestAnswerRewrite } from '../client';
import { request, response } from './fixtures';

afterEach(() => vi.unstubAllGlobals());
function serve(body: unknown, status = 200) {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
describe('same-origin client', () => {
  it.each([[429, 'RATE_LIMITED'], [503, 'AI_UNAVAILABLE'], [504, 'TIMEOUT']])('handles_html_%s', async (status, code) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>PRIVATE MATERIAL</html>', { status })));
    for (const operation of [() => getAIStatus(), () => requestAnswerRewrite(request())]) {
      await expect(operation()).rejects.toMatchObject({ code, message: expect.stringMatching(/[\u4e00-\u9fff]/) });
      await operation().catch(error => expect(String(error)).not.toContain('PRIVATE MATERIAL'));
    }
  });
  it.each(['QUOTA_EXCEEDED', 'AI_UNAVAILABLE'])('reads_new_server_503_contract_%s', async code => {
    serve({ error: { code } }, 503);
    await expect(requestAnswerRewrite(request())).rejects.toMatchObject({ code });
  });
  it('rejects_wrong_generation_id', async () => {
    serve({ ...response(), generationId: 'wrong' });
    await expect(requestAnswerRewrite(request())).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it.each([
    { ...response(), questionId: 'wrong' },
    { ...response(), model: undefined },
    { ...response(), citations: [{ chunkId: 'unknown', quote: 'Measured', answerParagraphIndex: 0 }] },
    { ...response(), citations: [{ chunkId: 'c1', quote: 'Invented', answerParagraphIndex: 0 }] },
    { ...response(), citations: [{ chunkId: 'c1', quote: 'Measured', answerParagraphIndex: 1 }] },
  ])('rejects_invalid_response_or_evidence', async body => {
    serve(body);
    await expect(requestAnswerRewrite(request())).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it('uses_relative_urls_no_redirects_and_passes_signal', async () => {
    const input = request();
    const signal = new AbortController().signal;
    const fetch = serve(response());
    await expect(requestAnswerRewrite(input, signal)).resolves.toEqual(response());
    expect(fetch).toHaveBeenCalledWith('/api/answers/rewrite', expect.objectContaining({
      method: 'POST', mode: 'same-origin', credentials: 'same-origin', redirect: 'error', signal,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
    }));
    serve({ available: false });
    await expect(getAIStatus(signal)).resolves.toEqual({ available: false });
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/ai/status', expect.objectContaining({ method: 'GET', mode: 'same-origin', signal }));
  });
  it.each([{ available: 'false' }, { available: true, secret: 'PRIVATE' }, null])('validates_status_schema', async body => {
    serve(body);
    await expect(getAIStatus()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it('does_not_parse_success_on_error_status', async () => {
    serve(response(), 400);
    await expect(requestAnswerRewrite(request())).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
  });
  it('sanitizes_network_and_json_errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('PRIVATE BODY')));
    await expect(getAIStatus()).rejects.toMatchObject({ code: 'UPSTREAM_ERROR' });
    await getAIStatus().catch(error => expect(String(error)).not.toContain('PRIVATE BODY'));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('PRIVATE BODY')));
    await expect(requestAnswerRewrite(request())).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it('rejects_request_before_fetch_without_leaking_input', async () => {
    const fetch = serve(response());
    await expect(requestAnswerRewrite({ ...request(), question: 'PRIVATE'.repeat(2000) })).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('snapshots_request_identity_during_fetch', async () => {
    const input = request();
    serve(response());
    const pending = requestAnswerRewrite(input);
    input.generationId = 'mutated';
    await expect(pending).resolves.toEqual(response());
  });
});
