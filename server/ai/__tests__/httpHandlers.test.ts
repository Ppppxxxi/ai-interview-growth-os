import { PassThrough, Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterEach, expect, it, vi } from 'vitest';
import { createAIHandlers } from '../httpHandlers';
import { readAIConfig } from '../config';
import { config, now, request, upstream } from './fixtures';

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
function req(body = JSON.stringify(request), headers: IncomingMessage['headers'] = {}, method = 'POST') {
  return Object.assign(Readable.from([Buffer.from(body)]), { method, url: '/api/answers/rewrite',
    headers: { host: 'demo.vercel.app', origin: 'https://demo.vercel.app', 'content-type': 'application/json', ...headers } }) as IncomingMessage;
}
function response() {
  const headers: Record<string, unknown> = {};
  let body = '';
  const events = new EventEmitter();
  const mock = Object.assign(events, { statusCode: 200, destroyed: false, writableFinished: false,
    setHeader: (key: string, value: unknown) => { headers[key] = value; },
    end: (value: string) => { body = value; mock.writableFinished = true; } });
  const res = mock as unknown as ServerResponse;
  return { res, events, headers, body: () => JSON.parse(body), raw: () => body };
}
function setup(aiConfig = config()) {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(upstream());
  return { fetch, handlers: createAIHandlers({ config: aiConfig, fetch, now }) };
}
it('accepts raw Node stream with JSON charset and server identities', async () => {
  const { fetch, handlers } = setup(); const out = response();
  await handlers.handleRewrite(req(undefined, { 'content-type': 'application/json; charset=utf-8' }), out.res);
  expect(out.res.statusCode).toBe(200);
  expect(out.body().questionId).toBe(request.questionId);
  expect(out.headers['Cache-Control']).toBe('no-store');
  expect(fetch).toHaveBeenCalledTimes(1);
});
it.each([['GET', 'application/json'], ['POST', 'text/plain']])('rejects invalid HTTP %s %s', async (method, type) => {
  const { fetch, handlers } = setup(); const out = response();
  await handlers.handleRewrite(req(undefined, { 'content-type': type }, method), out.res);
  expect(out.res.statusCode).toBe(400); expect(fetch).not.toHaveBeenCalled();
});
it.each(['model', 'url', 'prompt', 'messages', 'max_tokens'])('rejects unknown field %s', async key => {
  const { fetch, handlers } = setup(); const out = response();
  await handlers.handleRewrite(req(JSON.stringify({ ...request, [key]: 'forged' })), out.res);
  expect(out.body()).toEqual({ error: { code: 'INVALID_REQUEST' } }); expect(fetch).not.toHaveBeenCalled();
});
it.each(['{', 'null', '[]', JSON.stringify({ ...request, chunks: [{ ...request.chunks[0], extra: true }] })])('rejects malformed/invalid JSON', async body => {
  const { fetch, handlers } = setup(); const out = response();
  await handlers.handleRewrite(req(body), out.res);
  expect(out.res.statusCode).toBe(400); expect(fetch).not.toHaveBeenCalled();
});
it('rejects_128_kib_overflow before parse even whitespace and multibyte', async () => {
  const { fetch, handlers } = setup();
  for (const body of [' '.repeat(128 * 1024 + 1), '中'.repeat(44_000)]) {
    const out = response(); await handlers.handleRewrite(req(body), out.res);
    expect(out.body()).toEqual({ error: { code: 'INVALID_REQUEST' } });
  }
  expect(fetch).not.toHaveBeenCalled();
});
it('accepts exactly 128 KiB raw JSON', async () => {
  const { handlers } = setup(); const out = response();
  const body = JSON.stringify(request);
  await handlers.handleRewrite(req(body + ' '.repeat(128 * 1024 - Buffer.byteLength(body))), out.res);
  expect(out.res.statusCode).toBe(200);
  expect(out.body().generationId).toBe(request.generationId);
});
it('rejects overflow across chunks without waiting for end', async () => {
  const { fetch, handlers } = setup(); const out = response();
  const stream = new PassThrough();
  const input = Object.assign(stream, { method: 'POST', headers: req().headers }) as unknown as IncomingMessage;
  const pending = handlers.handleRewrite(input, out.res);
  stream.write(Buffer.alloc(128 * 1024)); stream.write(Buffer.from('x'));
  await pending;
  expect(out.res.statusCode).toBe(400); expect(fetch).not.toHaveBeenCalled(); stream.destroy();
});
it.each([
  { origin: 'https://evil.example' }, { origin: undefined }, { host: 'evil.example', origin: 'https://evil.example' },
  { host: 'evil.example', origin: 'https://demo.vercel.app', 'x-forwarded-host': 'demo.vercel.app' },
  { origin: 'https://demo.vercel.app/path' }, { origin: 'http://demo.vercel.app' },
])('rejects untrusted origin/host and ignores forwarded host', async headers => {
  const { fetch, handlers } = setup(); const out = response();
  await handlers.handleRewrite(req(undefined, headers), out.res);
  expect(out.res.statusCode).toBe(400); expect(fetch).not.toHaveBeenCalled();
});
it('development permits configured loopback only', async () => {
  const aiConfig = readAIConfig({ AI_GENERATION_ENABLED: 'true', DEEPSEEK_API_KEY: 'fake', DEEPSEEK_MODEL: 'fake' },
    { developmentOrigins: ['http://localhost:5173', 'http://evil.example'] });
  const { handlers } = setup(aiConfig);
  for (const [host, origin, status] of [['localhost:5173', 'http://localhost:5173', 200],
    ['localhost:5174', 'http://localhost:5174', 400], ['evil.example', 'http://evil.example', 400]] as const) {
    const out = response(); await handlers.handleRewrite(req(undefined, { host, origin }), out.res);
    expect(out.res.statusCode).toBe(status);
  }
});
it.each([[429, 429, 'RATE_LIMITED'], [402, 503, 'QUOTA_EXCEEDED'], [500, 502, 'UPSTREAM_ERROR']])('does_not_expose_provider_body %s', async (upstreamStatus, status, code) => {
  const { fetch, handlers } = setup(); fetch.mockResolvedValue(new Response('secret provider body fictional-test-key', { status: upstreamStatus as number }));
  const out = response(); await handlers.handleRewrite(req(), out.res);
  expect(out.res.statusCode).toBe(status); expect(out.body()).toEqual({ error: { code } });
  expect(out.headers['Cache-Control']).toBe('no-store'); expect(fetch).toHaveBeenCalledTimes(1);
});
it('disabled handler never reads body or calls fetch; status only available', async () => {
  const { fetch, handlers } = setup(readAIConfig({})); const out = response();
  await handlers.handleRewrite(req(), out.res);
  expect(out.res.statusCode).toBe(503); expect(fetch).not.toHaveBeenCalled();
  const status = response(); handlers.handleAIStatus(req('', {}, 'GET'), status.res);
  expect(status.body()).toEqual({ available: false }); expect(status.headers['Cache-Control']).toBe('no-store');
});
it('status only boolean for configured server, including unsupported methods', () => {
  const { handlers } = setup();
  for (const method of ['GET', 'POST']) {
    const out = response(); handlers.handleAIStatus(req('', {}, method), out.res);
    expect(out.body()).toEqual({ available: method === 'GET' });
    expect(out.headers['Cache-Control']).toBe('no-store');
  }
});
it('45 second total deadline includes stalled incoming body', async () => {
  vi.useFakeTimers(); const { fetch, handlers } = setup(); const out = response();
  const stream = new PassThrough();
  const input = Object.assign(stream, { method: 'POST', headers: req().headers }) as unknown as IncomingMessage;
  const pending = handlers.handleRewrite(input, out.res);
  await vi.advanceTimersByTimeAsync(45_000); await pending;
  expect(out.res.statusCode).toBe(504); expect(out.body()).toEqual({ error: { code: 'TIMEOUT' } });
  expect(fetch).not.toHaveBeenCalled(); stream.destroy();
});
it('incoming body time does not reset the upstream deadline', async () => {
  vi.useFakeTimers(); const { fetch, handlers } = setup(); const out = response();
  fetch.mockImplementation(() => new Promise(() => {}));
  const stream = new PassThrough();
  const input = Object.assign(stream, { method: 'POST', headers: req().headers }) as unknown as IncomingMessage;
  const pending = handlers.handleRewrite(input, out.res);
  await vi.advanceTimersByTimeAsync(40_000);
  stream.end(JSON.stringify(request));
  await vi.advanceTimersByTimeAsync(0);
  expect(fetch).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(5_000); await pending;
  expect(out.res.statusCode).toBe(504);
  expect((fetch.mock.calls[0][1]?.signal as AbortSignal).aborted).toBe(true);
});
it.each(['131073', 'invalid', '-1'])('rejects declared invalid/oversize length %s', async length => {
  const { fetch, handlers } = setup(); const out = response();
  await handlers.handleRewrite(req(undefined, { 'content-length': length }), out.res);
  expect(out.res.statusCode).toBe(400); expect(fetch).not.toHaveBeenCalled();
});
it('never reads Vercel parsed body helper and rejects invalid UTF-8', async () => {
  const { handlers } = setup(); const out = response(); const input = req();
  Object.defineProperty(input, 'body', { get: () => { throw new Error('Do not access body helper'); } });
  await handlers.handleRewrite(input, out.res); expect(out.res.statusCode).toBe(200);
  const invalid = Object.assign(Readable.from([Buffer.from([0xff])]), { method: 'POST', headers: req().headers }) as IncomingMessage;
  const bad = response(); await handlers.handleRewrite(invalid, bad.res); expect(bad.res.statusCode).toBe(400);
});
it('does not log request, response, key, provider body or exception', async () => {
  const spies = ['log', 'info', 'warn', 'error', 'debug'].map(method => vi.spyOn(console, method as 'log').mockImplementation(() => {}));
  const { fetch, handlers } = setup(); const out = response();
  fetch.mockRejectedValue(new Error('private input and fictional-test-key'));
  await handlers.handleRewrite(req(), out.res);
  expect(out.body()).toEqual({ error: { code: 'UPSTREAM_ERROR' } });
  spies.forEach(spy => expect(spy).not.toHaveBeenCalled());
});

it.each([
  ['fetch', 'aborted'], ['fetch', 'response-close'],
  ['body', 'aborted'], ['body', 'response-close'],
] as const)('client disconnect during upstream %s via %s aborts once, never writes, and cleans listeners', async (stage, event) => {
  const { fetch, handlers } = setup(); const out = response(); const input = req();
  let release: () => void = () => {};
  let started: () => void = () => {};
  const ready = new Promise<void>(resolve => { started = resolve; });
  fetch.mockImplementation(async () => {
    if (stage === 'fetch') return new Promise<Response>(resolve => {
      release = () => resolve(upstream()); started();
    });
    return { ok: true, json: () => new Promise(resolve => {
      release = () => resolve({ choices: [{ finish_reason: 'stop', message: {
        content: JSON.stringify({ answer: 'Answer', rewriteFocus: '', applicabilityBoundary: '', missingFacts: [], citations: [] }),
      } }] }); started();
    }) } as Response;
  });
  const pending = handlers.handleRewrite(input, out.res);
  await ready;
  if (event === 'aborted') input.emit('aborted');
  else out.events.emit('close');
  const signal = fetch.mock.calls[0][1]?.signal as AbortSignal;
  const abortedAtDisconnect = signal.aborted;
  // Release even a transport that ignores abort, so the red run cannot leave a pending timer.
  release(); await pending;
  expect(abortedAtDisconnect).toBe(true);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(out.raw()).toBe(''); expect(out.headers).toEqual({});
  expect(input.listenerCount('aborted')).toBe(0);
  expect(out.events.listenerCount('close')).toBe(0);
});

it('normal request close does not cancel generation and completed response close is harmless', async () => {
  const { fetch, handlers } = setup(); const input = req(); const out = response();
  let release: () => void = () => {}; let started: () => void = () => {};
  const ready = new Promise<void>(resolve => { started = resolve; });
  fetch.mockImplementation(() => new Promise<Response>(resolve => { release = () => resolve(upstream()); started(); }));
  const pending = handlers.handleRewrite(input, out.res); await ready;
  input.emit('close');
  const signal = fetch.mock.calls[0][1]?.signal as AbortSignal;
  expect(signal.aborted).toBe(false);
  release(); await pending;
  expect(out.res.statusCode).toBe(200); expect(out.body().questionId).toBe(request.questionId);
  out.events.emit('close'); expect(signal.aborted).toBe(false);
  expect(input.listenerCount('aborted')).toBe(0); expect(out.events.listenerCount('close')).toBe(0);
  expect(fetch).toHaveBeenCalledTimes(1);
});

it('already disconnected response never calls fetch or writes', async () => {
  const { fetch, handlers } = setup(); const out = response();
  out.res.destroyed = true;
  await handlers.handleRewrite(req(), out.res);
  expect(fetch).not.toHaveBeenCalled(); expect(out.raw()).toBe(''); expect(out.headers).toEqual({});
  expect(out.events.listenerCount('close')).toBe(0);
});
