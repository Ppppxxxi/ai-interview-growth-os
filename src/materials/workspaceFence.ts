import type { MaterialRepository } from './repository';
import { setDraftQueueGuard } from './draftQueue';
import type { StorageLike } from '../workflow/personalWorkspace';

type Fence = { invalidate(): void; accept(): void; subscribe(listener: () => void): () => void };
const fences = new WeakMap<MaterialRepository, Fence>();
export function ensureWorkspaceFence(repo: MaterialRepository): void {
  if (fences.has(repo) || typeof window === 'undefined') return;
  configureWorkspaceFence(repo, window.localStorage, 'ai-interview-growth-os');
}
export function configureWorkspaceFence(repo: MaterialRepository, storage: StorageLike, scope: string): Fence {
  const prior = fences.get(repo); if (prior) return prior;
  const key = `${scope}:epoch`; const lockName = `${scope}:maintenance`;
  const read = () => storage.getItem(key) ?? 'initial';
  let epoch = read();
  const listeners = new Set<() => void>();
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(lockName) : undefined;
  if (channel) channel.onmessage = () => { if (read() !== epoch) listeners.forEach(listener => listener()); };
  const fence: Fence = {
    invalidate() { epoch = crypto.randomUUID(); storage.setItem(key, epoch); channel?.postMessage('changed'); },
    accept() { epoch = read(); },
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
  setDraftQueueGuard(repo, (operation, maintenance) => {
    const expectedEpoch = epoch;
    return async () => {
      if (!globalThis.navigator?.locks) throw new Error('浏览器不支持安全的数据管理，请更换浏览器');
      return navigator.locks.request(lockName, async () => {
        if (!maintenance && (expectedEpoch !== read() || (await repo.listDeletions()).length)) throw new Error('本地数据已变更或尚未恢复，请重新加载');
        return operation();
      });
    };
  });
  fences.set(repo, fence); return fence;
}
export function invalidateWorkspaceEpoch(repo: MaterialRepository): void { fences.get(repo)?.invalidate(); }
export function acceptWorkspaceEpoch(repo: MaterialRepository): void { fences.get(repo)?.accept(); }
