import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ViteDevServer } from 'vite';
import { afterEach, expect, it, vi } from 'vitest';
import { handleRewrite, handleAIStatus } from '../httpHandlers';
import rewriteEntry from '../../../api/answers/rewrite';
import statusEntry from '../../../api/ai/status';
import deployment from '../../../vercel.json';
import { devApiPlugin } from '../../devApiPlugin';
import { request, upstream } from './fixtures';

vi.mock('vite', async importOriginal => ({ ...await importOriginal<typeof import('vite')>(), loadEnv: vi.fn(() => ({})) }));
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it('Vercel TypeScript entries export the same Node handlers and real duration paths', () => {
  expect(rewriteEntry).toBe(handleRewrite); expect(statusEntry).toBe(handleAIStatus);
  expect(deployment.functions['api/answers/rewrite.ts'].maxDuration).toBe(60);
  expect(deployment.functions['api/ai/status.ts'].maxDuration).toBe(60);
});
it('dev adapter forwards known routes and falls through unrelated routes while closed', async () => {
  vi.stubEnv('AI_GENERATION_ENABLED', 'false'); vi.stubEnv('DEEPSEEK_API_KEY', 'fake');
  vi.stubEnv('DEEPSEEK_MODEL', 'fake'); vi.stubEnv('VERCEL', '');
  const { loadEnv } = await import('vite');
  const plugin = devApiPlugin();
  const middlewares: Array<(req: IncomingMessage, res: ServerResponse, next: () => void) => void> = [];
  const configure = plugin.configureServer as (server: ViteDevServer) => void;
  configure({ config: { mode: 'test', root: '/fictional', server: { port: 5173 } },
    httpServer: { address: () => ({ port: 5174 }) }, middlewares: { use: (fn: typeof middlewares[number]) => middlewares.push(fn) } } as unknown as ViteDevServer);
  expect(loadEnv).toHaveBeenCalledWith('test', '/fictional', ['DEEPSEEK_', 'AI_GENERATION_']);
  for (const [url, method, expected] of [['/api/ai/status?x=1', 'GET', { available: false }],
    ['/api/answers/rewrite', 'POST', { error: { code: 'AI_UNAVAILABLE' } }]] as const) {
    const req = Object.assign(Readable.from([]), { url, method, headers: {} }) as IncomingMessage;
    const events = new EventEmitter();
    const result = new Promise<string>(resolve => events.once('end', resolve));
    const headers: Record<string, unknown> = {};
    const res = Object.assign(events, { setHeader: (key: string, value: unknown) => { headers[key] = value; },
      end: (body: string) => events.emit('end', body) }) as unknown as ServerResponse;
    middlewares[0](req, res, vi.fn());
    expect(JSON.parse(await result)).toEqual(expected); expect(headers['Cache-Control']).toBe('no-store');
  }
  const next = vi.fn();
  middlewares[0]({ url: '/other' } as IncomingMessage, {} as ServerResponse, next);
  expect(next).toHaveBeenCalledOnce();
});
it('dev adapter uses actual bound port and the shared rewrite handler with fake fetch', async () => {
  vi.stubEnv('AI_GENERATION_ENABLED', 'true'); vi.stubEnv('DEEPSEEK_API_KEY', 'fake');
  vi.stubEnv('DEEPSEEK_MODEL', 'fake'); vi.stubEnv('VERCEL', '');
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(upstream());
  vi.stubGlobal('fetch', fetch);
  let middleware: (req: IncomingMessage, res: ServerResponse, next: () => void) => void = () => {};
  const configure = devApiPlugin().configureServer as (server: ViteDevServer) => void;
  configure({ config: { mode: 'test', root: '/fictional', server: { port: 5173 } },
    httpServer: { address: () => ({ port: 5174 }) },
    middlewares: { use: (fn: typeof middleware) => { middleware = fn; } } } as unknown as ViteDevServer);
  for (const [port, status] of [[5174, 200], [5173, 400]]) {
    const req = Object.assign(Readable.from([Buffer.from(JSON.stringify(request))]), {
      method: 'POST', url: '/api/answers/rewrite', headers: { host: `localhost:${port}`,
        origin: `http://localhost:${port}`, 'content-type': 'application/json' },
    }) as IncomingMessage;
    const events = new EventEmitter();
    const result = new Promise<string>(resolve => events.once('end', resolve));
    const res = Object.assign(events, { statusCode: 0, setHeader: () => {}, end: (body: string) => events.emit('end', body) }) as unknown as ServerResponse;
    middleware(req, res, vi.fn()); const output = JSON.parse(await result);
    expect(res.statusCode).toBe(status);
    if (status === 200) expect(output).toMatchObject({ questionId: request.questionId, generationId: request.generationId, model: 'fake' });
  }
  expect(fetch).toHaveBeenCalledTimes(1);
});
