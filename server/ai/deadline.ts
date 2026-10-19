import { LLM_LIMITS } from '../../src/domain/llmContracts.js';
import { AIError } from './errors.js';

// Race as well as abort: a stalled/custom transport must not defeat the deadline.
export async function withDeadline<T>(work: (signal: AbortSignal) => Promise<T>, parent?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  parent?.addEventListener('abort', abort, { once: true });
  if (parent?.aborted) abort();
  const timer = setTimeout(abort, LLM_LIMITS.timeoutMs);
  let onAbort: () => void = () => {};
  const timeout = new Promise<never>((_, reject) => {
    onAbort = () => reject(new AIError('TIMEOUT'));
    controller.signal.addEventListener('abort', onAbort, { once: true });
    if (controller.signal.aborted) onAbort();
  });
  try {
    return await Promise.race([timeout, work(controller.signal)]);
  } finally {
    clearTimeout(timer);
    parent?.removeEventListener('abort', abort);
    controller.signal.removeEventListener('abort', onAbort);
  }
}
