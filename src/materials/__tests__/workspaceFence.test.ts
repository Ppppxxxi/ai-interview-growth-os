import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureWorkspaceFence } from '../workspaceFence';
import { createMaterialRepository } from '../repository';
import { getMaterialDraftQueue } from '../draftQueue';
import { clearAllUserData } from '../workspaceDataCoordinator';
import { createEmptyPersonalWorkspaceData } from '../../workflow/personalWorkspace';
import { mockBrowserLocks } from './browserLocks';

afterEach(() => vi.unstubAllGlobals());
function fixture() {
  mockBrowserLocks(); const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  const factory = new IDBFactory(); const first = createMaterialRepository(factory), second = createMaterialRepository(factory);
  const scope = crypto.randomUUID(); configureWorkspaceFence(first, storage, scope); configureWorkspaceFence(second, storage, scope);
  return { first, second };
}
describe('browser workspace fence', () => {
  it('rejects_old_tab_writes_even_without_receiving_the_broadcast', async () => {
    const { first, second } = fixture();
    await clearAllUserData(first, { read: createEmptyPersonalWorkspaceData, write: async () => {} });
    const oldWrite = vi.fn(async () => {});
    await expect(getMaterialDraftQueue(second).run(oldWrite)).rejects.toThrow('已变更'); expect(oldWrite).not.toHaveBeenCalled();
  });
  it('captures_enqueue_epoch_so_queued_old_local_writes_cannot_revive_data', async () => {
    const { first } = fixture();
    const clearing = clearAllUserData(first, { read: createEmptyPersonalWorkspaceData, write: async () => {} });
    const oldWrite = vi.fn(async () => {}); const stale = getMaterialDraftQueue(first).run(oldWrite); void stale.catch(() => {});
    await clearing; await expect(stale).rejects.toThrow('已变更'); expect(oldWrite).not.toHaveBeenCalled();
  });
  it('fails_explicitly_when_web_locks_are_unavailable', async () => {
    const { first } = fixture(); vi.stubGlobal('navigator', {});
    await expect(clearAllUserData(first, { read: createEmptyPersonalWorkspaceData, write: async () => {} })).rejects.toThrow('不支持');
    expect(await first.listDeletions()).toEqual([]);
  });
});
