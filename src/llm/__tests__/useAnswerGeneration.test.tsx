// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import { useAnswerGeneration } from '../useAnswerGeneration';
import { request, response } from './fixtures';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function harness() {
  const calls: { input: ReturnType<typeof request>; signal: AbortSignal; deferred: ReturnType<typeof deferred<Response>> }[] = [];
  vi.stubGlobal('fetch', vi.fn((_url, options: RequestInit) => {
    const pending = deferred<Response>();
    calls.push({ input: JSON.parse(options.body as string), signal: options.signal as AbortSignal, deferred: pending });
    return pending.promise;
  }));
  const hook = renderHook(() => useAnswerGeneration(), { wrapper: StrictMode });
  const finish = async (index: number, status = 200) => {
    await act(async () => { calls[index].deferred.resolve(new Response(JSON.stringify(
      status === 200 ? response(calls[index].input) : { error: { code: 'RATE_LIMITED' } }), { status })); });
  };
  return { ...hook, calls, finish };
}
describe('generation lifecycle', () => {
  it('allows_one_inflight_request', async () => {
    const h = harness();
    expect(h.result.current.getState('q1')).toEqual({ status: 'idle' });
    act(() => { void h.result.current.generate(request()); void h.result.current.generate({ ...request(), questionId: 'q2' }); });
    expect(h.calls).toHaveLength(1);
    expect(h.result.current.getState('q1').status).toBe('pending');
    expect(h.result.current.getState('q2').status).toBe('idle');
    await h.finish(0);
    expect(h.result.current.getState('q1').status).toBe('success');
  });
  it('ignores_response_after_cancel', async () => {
    const h = harness();
    let pending!: ReturnType<typeof h.result.current.generate>;
    act(() => { pending = h.result.current.generate(request()); });
    act(() => h.result.current.cancel());
    expect(h.calls[0].signal.aborted).toBe(true);
    expect(h.result.current.getState('q1')).toEqual({ status: 'idle' });
    await h.finish(0);
    await expect(pending).resolves.toBeUndefined();
    expect(h.result.current.getState('q1')).toEqual({ status: 'idle' });
  });
  it('preserves_result_on_failure_cancel_and_generates_new_retry_ids', async () => {
    const h = harness();
    act(() => { void h.result.current.generate(request()); });
    await h.finish(0);
    const previous = h.result.current.getState('q1').result;
    act(() => { void h.result.current.generate(request()); });
    await h.finish(1, 429);
    expect(h.result.current.getState('q1')).toMatchObject({ status: 'error', result: previous, error: { code: 'RATE_LIMITED' } });
    act(() => { void h.result.current.generate(request()); });
    act(() => h.result.current.cancel());
    expect(h.result.current.getState('q1')).toEqual({ status: 'idle', result: previous });
    await h.finish(2);
    expect(h.result.current.getState('q1').result).toEqual(previous);
    expect(new Set(h.calls.map(call => call.input.generationId)).size).toBe(3);
    expect(h.calls[0].input.generationId).not.toBe('g1');
  });
  it('older_response_cannot_overwrite_new_request', async () => {
    const h = harness();
    act(() => { void h.result.current.generate(request()); });
    act(() => h.result.current.cancel());
    act(() => { void h.result.current.generate(request()); });
    await h.finish(0);
    expect(h.result.current.getState('q1').status).toBe('pending');
    await act(async () => {
      expect(await h.result.current.generate({ ...request(), questionId: 'q3' })).toBeUndefined();
    });
    expect(h.calls).toHaveLength(2);
    await h.finish(1);
    expect(h.result.current.getState('q1').result?.generationId).toBe(h.calls[1].input.generationId);
  });
  it('unmount_aborts_and_drops_late_response', async () => {
    const h = harness();
    let pending!: ReturnType<typeof h.result.current.generate>;
    act(() => { pending = h.result.current.generate(request()); });
    h.unmount();
    expect(h.calls[0].signal.aborted).toBe(true);
    await h.finish(0);
    await expect(pending).resolves.toBeUndefined();
  });
  it('keeps_questions_separate_and_sanitizes_network_failure', async () => {
    const h = harness();
    act(() => { void h.result.current.generate(request()); });
    await h.finish(0);
    act(() => { void h.result.current.generate({ ...request(), questionId: 'q2' }); });
    await act(async () => h.calls[1].deferred.reject(new Error('PRIVATE BODY')));
    expect(h.result.current.getState('q1').status).toBe('success');
    expect(h.result.current.getState('q2')).toMatchObject({ status: 'error', error: { code: 'UPSTREAM_ERROR' } });
    expect(h.result.current.getState('q2').error?.message).not.toContain('PRIVATE BODY');
  });
  it('cancel_invalidates_a_completed_result_without_deleting_it', async () => {
    const h = harness();
    act(() => { void h.result.current.generate(request()); });
    await h.finish(0);
    const previous = h.result.current.getState('q1').result;
    act(() => h.result.current.cancel());
    expect(h.result.current.getState('q1')).toEqual({ status: 'idle', result: previous });
  });
  it('cancel_prevents_queued_success_from_committing_after_an_edit', async () => {
    const h = harness();
    let pending!: ReturnType<typeof h.result.current.generate>;
    act(() => { pending = h.result.current.generate(request()); });
    await act(async () => {
      h.calls[0].deferred.resolve(new Response(JSON.stringify(response(h.calls[0].input))));
      await pending;
      h.result.current.cancel();
    });
    expect(h.result.current.getState('q1')).toEqual({ status: 'idle' });
  });
  it('completed_q1_survives_batched_start_of_q2', async () => {
    const h = harness();
    let first!: ReturnType<typeof h.result.current.generate>;
    act(() => { first = h.result.current.generate(request()); });
    const completed = response(h.calls[0].input);
    await act(async () => {
      h.calls[0].deferred.resolve(new Response(JSON.stringify(completed)));
      expect(await first).toEqual(completed);
      void h.result.current.generate({ ...request(), questionId: 'q2' });
      expect(h.calls).toHaveLength(2);
    });
    expect(h.result.current.getState('q2').status).toBe('pending');
    await h.finish(1);
    expect(h.result.current.getState('q2')).toEqual({ status: 'success', result: response(h.calls[1].input) });
    expect(h.result.current.getState('q1')).toEqual({ status: 'success', result: completed });
  });
  it('failed_batched_retry_retains_just_completed_result', async () => {
    const h = harness();
    let first!: ReturnType<typeof h.result.current.generate>;
    act(() => { first = h.result.current.generate(request()); });
    const completed = response(h.calls[0].input);
    await act(async () => {
      h.calls[0].deferred.resolve(new Response(JSON.stringify(completed)));
      expect(await first).toEqual(completed);
      void h.result.current.generate(request());
      expect(h.calls).toHaveLength(2);
    });
    expect(h.result.current.getState('q1').status).toBe('pending');
    await h.finish(1, 429);
    expect(h.result.current.getState('q1')).toMatchObject({ status: 'error', result: completed, error: { code: 'RATE_LIMITED' } });
    expect(h.calls[1].input.generationId).not.toBe(h.calls[0].input.generationId);
  });
});
