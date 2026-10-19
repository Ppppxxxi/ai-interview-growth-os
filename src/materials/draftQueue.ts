import type { MaterialRepository } from './repository';

export interface MaterialDraftQueue {
  // Use raw repository methods inside the callback; awaiting a nested run would deadlock.
  run<T>(operation: () => Promise<T>, options?: { maintenance: true }): Promise<T>;
  whenIdle(): Promise<void>;
}

const queues = new WeakMap<MaterialRepository, MaterialDraftQueue>();
type Guard = <T>(operation: () => Promise<T>, maintenance: boolean) => () => Promise<T>;
const guards = new WeakMap<MaterialRepository, Guard>();
export function setDraftQueueGuard(repository: MaterialRepository, guard: Guard) { guards.set(repository, guard); }

export function getMaterialDraftQueue(repository: MaterialRepository): MaterialDraftQueue {
  const existing = queues.get(repository);
  if (existing) return existing;
  let tail: Promise<void> = Promise.resolve();
  function schedule<T>(operation: () => Promise<T>, maintenance: boolean): Promise<T> {
      const guard = guards.get(repository);
      const guarded = guard ? guard(operation, maintenance) : operation;
      const result = tail.then(guarded);
      // Recover only the scheduling tail; callers still receive the original rejection.
      tail = result.then(() => {}, () => {});
      return result;
  }
  const queue: MaterialDraftQueue = {
    run: (operation, options) => schedule(operation, options?.maintenance === true),
    async whenIdle() {
      let observed: Promise<void>;
      do { observed = tail; await observed; } while (observed !== tail);
    },
  };
  queues.set(repository, queue);
  return queue;
}
