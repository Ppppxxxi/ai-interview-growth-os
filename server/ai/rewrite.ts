import { z } from 'zod';
import { LLM_LIMITS, ModelRewriteResponseSchema, RewriteRequestSchema, RewriteResponseSchema,
  type RewriteRequest, type RewriteResponse } from '../../src/domain/llmContracts.js';
import { validateEvidence } from '../../src/llm/validateEvidence.js';
import { isAIAvailable, type AIConfig } from './config.js';
import { withDeadline } from './deadline.js';
import { AIError } from './errors.js';
import { rewriteMessages } from './prompts.js';

export interface RewriteDeps { fetch: typeof fetch; config: AIConfig; now: () => string; signal?: AbortSignal }
const envelopeSchema = z.object({ choices: z.array(z.object({
  finish_reason: z.literal('stop'), message: z.object({ content: z.string().min(1) }),
})).length(1) });

export async function rewriteAnswer(request: RewriteRequest, deps: RewriteDeps): Promise<RewriteResponse> {
  if (!isAIAvailable(deps.config)) throw new AIError('AI_UNAVAILABLE');
  const parsed = RewriteRequestSchema.safeParse(request);
  if (!parsed.success) throw new AIError('INVALID_REQUEST');
  return withDeadline(async signal => {
    if (signal.aborted) throw new AIError('TIMEOUT');
    let upstream: Response;
    try {
      upstream = await deps.fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST', redirect: 'error', signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deps.config.apiKey}` },
        body: JSON.stringify({ model: deps.config.model, messages: rewriteMessages(parsed.data),
          response_format: { type: 'json_object' }, max_tokens: LLM_LIMITS.maxTokens, stream: false }),
      });
    } catch {
      throw new AIError(signal.aborted ? 'TIMEOUT' : 'UPSTREAM_ERROR');
    }
    if (!upstream.ok) {
      void upstream.body?.cancel().catch(() => {});
      throw new AIError(upstream.status === 429 ? 'RATE_LIMITED' : upstream.status === 402 ? 'QUOTA_EXCEEDED' : 'UPSTREAM_ERROR');
    }
    try {
      const envelope = envelopeSchema.parse(await upstream.json());
      const modelOutput = ModelRewriteResponseSchema.parse(JSON.parse(envelope.choices[0].message.content));
      const response = RewriteResponseSchema.parse({ ...modelOutput,
        questionId: parsed.data.questionId, generationId: parsed.data.generationId,
        model: deps.config.model, generatedAt: deps.now() });
      validateEvidence(parsed.data, response);
      return response;
    } catch {
      throw new AIError(signal.aborted ? 'TIMEOUT' : 'INVALID_RESPONSE');
    }
  }, deps.signal);
}
