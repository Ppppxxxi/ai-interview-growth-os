import type { MaterialRepository } from './repository';

export interface MaterialDraftQueue {
  // Use raw repository methods inside the callback; awaiting a nested run would deadlock.
  run<T>(operation: () => Promise<T>): Promise<T>;
  whenIdle(): Promise<void>;
}

const queues = new WeakMap<MaterialRepository, MaterialDraftQueue>();

export function getMaterialDraftQueue(repository: MaterialRepository): MaterialDraftQueue {
  const existing = queues.get(repository);
  if (existing) return existing;
  let tail: Promise<void> = Promise.resolve();
  const queue: MaterialDraftQueue = {
    run<T>(operation: () => Promise<T>): Promise<T> {
      const result = tail.then(operation);
      // Recover only the scheduling tail; callers still receive the original rejection.
      tail = result.then(() => {}, () => {});
      return result;
    },
    async whenIdle() {
      let observed: Promise<void>;
      do { observed = tail; await observed; } while (observed !== tail);
    },
  };
  queues.set(repository, queue);
  return queue;
}
