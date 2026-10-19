import { useCallback, useEffect, useRef, useState } from 'react';
import type { RewriteRequest, RewriteResponse } from '../domain/llmContracts';
import { AIClientError, requestAnswerRewrite } from './client';

export type AnswerGenerationState = {
  status: 'idle' | 'pending' | 'success' | 'error';
  result?: RewriteResponse;
  error?: AIClientError;
};
type Flight = { questionId: string; sequence: number; controller: AbortController };
const idle: AnswerGenerationState = { status: 'idle' };
function readState(states: Record<string, AnswerGenerationState>, questionId: string): AnswerGenerationState {
  return Object.prototype.hasOwnProperty.call(states, questionId) ? states[questionId] : idle;
}

export function useAnswerGeneration() {
  const [states, setStates] = useState<Record<string, AnswerGenerationState>>({});
  const mounted = useRef(true);
  // Only explicit cancellation/unmount invalidates accepted, queued completions.
  const sequence = useRef(0);
  const active = useRef<Flight | null>(null);
  const lastQuestionId = useRef<string | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      sequence.current += 1;
      active.current?.controller.abort();
      active.current = null;
    };
  }, []);

  const cancel = useCallback(() => {
    const flight = active.current;
    const questionId = flight?.questionId ?? lastQuestionId.current;
    sequence.current += 1;
    active.current = null;
    flight?.controller.abort();
    if (questionId !== null && mounted.current) {
      setStates(previous => {
        const result = readState(previous, questionId).result;
        return { ...previous, [questionId]: { status: 'idle', ...(result ? { result } : {}) } };
      });
    }
  }, []);

  const generate = useCallback(async (request: RewriteRequest): Promise<RewriteResponse | undefined> => {
    // Ref locking is immediate, including two clicks before React's next render.
    if (!mounted.current || active.current) return undefined;
    const flight: Flight = { questionId: request.questionId, sequence: sequence.current, controller: new AbortController() };
    active.current = flight;
    lastQuestionId.current = flight.questionId;
    const isCurrent = () => mounted.current && sequence.current === flight.sequence && active.current === flight;
    setStates(previous => ({ ...previous, [flight.questionId]: {
      status: 'pending', result: readState(previous, flight.questionId).result,
    } }));
    try {
      const result = await requestAnswerRewrite({ ...request, generationId: crypto.randomUUID() }, flight.controller.signal);
      if (!isCurrent()) return undefined;
      setStates(previous => {
        // React can apply a queued update after an edit/cancel invalidated this run.
        if (!mounted.current || sequence.current !== flight.sequence) return previous;
        return { ...previous, [flight.questionId]: { status: 'success', result } };
      });
      return result;
    } catch (error) {
      if (!isCurrent()) return undefined;
      const publicError = error instanceof AIClientError ? error : new AIClientError('UPSTREAM_ERROR');
      setStates(previous => {
        if (!mounted.current || sequence.current !== flight.sequence) return previous;
        return { ...previous, [flight.questionId]: {
          status: 'error', result: readState(previous, flight.questionId).result, error: publicError,
        } };
      });
      return undefined;
    } finally {
      // An older request must not release the lock belonging to its replacement.
      if (active.current === flight) active.current = null;
    }
  }, []);

  const getState = useCallback((questionId: string) => readState(states, questionId), [states]);
  return { states, getState, generate, cancel };
}
