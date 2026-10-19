import { z } from 'zod';
import { PublicErrorCodeSchema, RewriteRequestSchema, RewriteResponseSchema,
  type PublicErrorCode, type RewriteRequest, type RewriteResponse } from '../domain/llmContracts';
import { validateEvidence } from './validateEvidence';

const messages: Record<PublicErrorCode, string> = {
  INVALID_REQUEST: '请求内容无效或超限，请检查问题并缩短内容或减少所选片段。',
  REQUEST_TOO_LARGE: '请求内容过长，请缩短内容或减少所选片段。',
  INVALID_RESPONSE: '生成结果格式或引用校验失败，请重试。',
  AI_UNAVAILABLE: '生成服务暂不可用，请稍后重试。',
  RATE_LIMITED: '请求过于频繁，请稍后重试。',
  QUOTA_EXCEEDED: '生成服务额度暂不可用，请稍后重试。',
  TIMEOUT: '生成超时，请稍后重试。',
  UPSTREAM_ERROR: '生成服务连接失败，请稍后重试。',
};
export class AIClientError extends Error {
  constructor(readonly code: PublicErrorCode) {
    super(messages[code]);
    this.name = 'AIClientError';
  }
}

const statusSchema = z.object({ available: z.boolean() }).strict();
const errorSchema = z.object({ error: z.object({ code: PublicErrorCodeSchema }).strict() }).strict();
const errorStatuses: Record<PublicErrorCode, number> = {
  INVALID_REQUEST: 400, REQUEST_TOO_LARGE: 400, AI_UNAVAILABLE: 503,
  RATE_LIMITED: 429, QUOTA_EXCEEDED: 503, TIMEOUT: 504, UPSTREAM_ERROR: 502, INVALID_RESPONSE: 502,
};
function fallbackCode(status: number): PublicErrorCode {
  if (status === 429) return 'RATE_LIMITED';
  if (status === 503) return 'AI_UNAVAILABLE';
  if (status === 504 || status === 408) return 'TIMEOUT';
  if (status === 413) return 'REQUEST_TOO_LARGE';
  if (status >= 400 && status < 500) return 'INVALID_REQUEST';
  return 'UPSTREAM_ERROR';
}

async function fetchJSON(path: string, options: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(path, { ...options, mode: 'same-origin', credentials: 'same-origin', redirect: 'error', cache: 'no-store' });
  } catch {
    if (options.signal?.aborted) throw new DOMException('请求已取消。', 'AbortError');
    throw new AIClientError('UPSTREAM_ERROR');
  }
  // WAF/proxies may send HTML; HTTP failure takes precedence over JSON parsing.
  if (!response.ok) {
    let code = fallbackCode(response.status);
    try {
      const parsed = errorSchema.safeParse(await response.json());
      if (parsed.success && errorStatuses[parsed.data.error.code] === response.status) code = parsed.data.error.code;
    } catch { /* Keep the status-derived public error for non-JSON responses. */ }
    throw new AIClientError(code);
  }
  try { return await response.json(); } catch { throw new AIClientError('INVALID_RESPONSE'); }
}

export async function getAIStatus(signal?: AbortSignal): Promise<{ available: boolean }> {
  const parsed = statusSchema.safeParse(await fetchJSON('/api/ai/status', { method: 'GET', signal }));
  if (!parsed.success) throw new AIClientError('INVALID_RESPONSE');
  return parsed.data;
}

export async function requestAnswerRewrite(request: RewriteRequest, signal?: AbortSignal): Promise<RewriteResponse> {
  const input = RewriteRequestSchema.safeParse(request);
  if (!input.success) throw new AIClientError('INVALID_REQUEST');
  const output = RewriteResponseSchema.safeParse(await fetchJSON('/api/answers/rewrite', {
    method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input.data),
  }));
  if (!output.success) throw new AIClientError('INVALID_RESPONSE');
  try { validateEvidence(input.data, output.data); } catch { throw new AIClientError('INVALID_RESPONSE'); }
  return output.data;
}
