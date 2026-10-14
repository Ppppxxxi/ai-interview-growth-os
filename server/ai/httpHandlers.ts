import type { IncomingMessage, ServerResponse } from 'node:http';
import { LLM_LIMITS, RewriteRequestSchema } from '../../src/domain/llmContracts';
import { isAIAvailable, readAIConfig } from './config';
import { withDeadline } from './deadline';
import { AIError, errorStatus } from './errors';
import { rewriteAnswer, type RewriteDeps } from './rewrite';

function send(res: ServerResponse, status: number, value: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(value));
}

function checkHTTP(req: IncomingMessage, deps: RewriteDeps) {
  const { host, origin } = req.headers;
  if (req.method !== 'POST' || typeof origin !== 'string' || typeof host !== 'string' ||
      !deps.config.trustedOrigins.includes(origin) || new URL(origin).host !== host.toLowerCase() ||
      !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type'] ?? '') ||
      req.headers['content-encoding'] !== undefined) throw new AIError('INVALID_REQUEST');
  const length = req.headers['content-length'];
  if (length !== undefined && (!/^\d+$/.test(length) || Number(length) > LLM_LIMITS.maxRequestBytes))
    throw new AIError('INVALID_REQUEST');
}

function readRawJSON(req: IncomingMessage, signal: AbortSignal): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let bytes = 0;
    const chunks: Buffer[] = [];
    const cleanup = () => {
      req.off('data', data); req.off('end', end); req.off('error', error); req.off('aborted', error);
      signal.removeEventListener('abort', timeout);
    };
    const fail = (code: 'INVALID_REQUEST' | 'TIMEOUT') => {
      cleanup(); req.pause(); reject(new AIError(code));
    };
    const data = (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += buffer.byteLength;
      if (bytes > LLM_LIMITS.maxRequestBytes) { fail('INVALID_REQUEST'); return; }
      chunks.push(buffer);
    };
    const end = () => {
      cleanup();
      try {
        const text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
        resolve(JSON.parse(text));
      } catch { reject(new AIError('INVALID_REQUEST')); }
    };
    const error = () => fail('INVALID_REQUEST');
    const timeout = () => fail('TIMEOUT');
    req.on('data', data); req.once('end', end); req.once('error', error); req.once('aborted', error);
    signal.addEventListener('abort', timeout, { once: true });
    if (signal.aborted) timeout();
  });
}

export function createAIHandlers(deps: RewriteDeps) {
  return {
    async handleRewrite(req: IncomingMessage, res: ServerResponse): Promise<void> {
      const connection = new AbortController();
      let disconnected = Boolean(req.aborted || res.destroyed || res.writableEnded);
      const cancel = () => { disconnected = true; connection.abort(); };
      const responseClose = () => { if (!res.writableFinished) cancel(); };
      // A normal req.close can follow the completed upload; only real interruption cancels.
      req.on('aborted', cancel);
      res.on('close', responseClose);
      try {
        if (disconnected) return;
        if (!isAIAvailable(deps.config)) throw new AIError('AI_UNAVAILABLE');
        checkHTTP(req, deps);
        const result = await withDeadline(async signal => {
          const parsed = RewriteRequestSchema.safeParse(await readRawJSON(req, signal));
          if (!parsed.success) throw new AIError('INVALID_REQUEST');
          return rewriteAnswer(parsed.data, { ...deps, signal });
        }, connection.signal);
        if (!disconnected && !res.destroyed && !res.writableEnded) send(res, 200, result);
      } catch (error) {
        if (disconnected || res.destroyed || res.writableEnded) return;
        const code = error instanceof AIError ? error.code : 'UPSTREAM_ERROR';
        res.setHeader('Connection', 'close');
        send(res, errorStatus[code], { error: { code } });
      } finally {
        req.off('aborted', cancel);
        res.off('close', responseClose);
      }
    },
    handleAIStatus(req: IncomingMessage, res: ServerResponse): void {
      send(res, req.method === 'GET' ? 200 : 405, { available: req.method === 'GET' && isAIAvailable(deps.config) });
    },
  };
}

// Environment access happens only when a server handler is invoked, never on client import.
function runtimeHandlers() {
  return createAIHandlers({ config: readAIConfig(process.env), fetch: globalThis.fetch, now: () => new Date().toISOString() });
}
export async function handleRewrite(req: IncomingMessage, res: ServerResponse): Promise<void> {
  await runtimeHandlers().handleRewrite(req, res);
}
export function handleAIStatus(req: IncomingMessage, res: ServerResponse): void {
  runtimeHandlers().handleAIStatus(req, res);
}
