import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { createMaterialRepository } from '../repository';
import { getMaterialDraftQueue } from '../draftQueue';

const draft = { id: 'queue-fixture', kind: 'knowledge' as const, title: '虚构排序笔记', text: '虚构正文',
  tags: [], sourceFormat: 'paste' as const, selectedChunks: [], updatedAt: '2026-01-01' };

function barrier() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}

describe('repository-scoped draft queue', () => {
  it('reuses_one_queue_for_the_same_repository_only', () => {
    const repo = createMaterialRepository(new IDBFactory());
    expect(getMaterialDraftQueue(repo)).toBe(getMaterialDraftQueue(repo));
    expect(getMaterialDraftQueue(createMaterialRepository(new IDBFactory()))).not.toBe(getMaterialDraftQueue(repo));
  });
  it('serializes_write_read_and_delete_using_real_storage', async () => {
    const repo = createMaterialRepository(new IDBFactory()); const queue = getMaterialDraftQueue(repo);
    const blocked = barrier(); const started = barrier(); const order: string[] = [];
    const write = queue.run(async () => { started.release(); await blocked.promise; await repo.saveDraft(draft); order.push('write'); });
    const read = queue.run(async () => { order.push('read'); return repo.listDrafts(); });
    const remove = queue.run(async () => { await repo.deleteDraft(draft.id); order.push('delete'); });
    await started.promise;
    expect(order).toEqual([]);
    blocked.release(); await write; expect(await read).toEqual([draft]); await remove;
    await queue.whenIdle(); expect(order).toEqual(['write', 'read', 'delete']); expect(await repo.listDrafts()).toEqual([]);
  });
  it('propagates_operation_failure_without_poisoning_later_operations', async () => {
    const repo = createMaterialRepository(new IDBFactory()); const queue = getMaterialDraftQueue(repo);
    const failure = new Error('synthetic save failure');
    await expect(queue.run(async () => { throw failure; })).rejects.toBe(failure);
    await queue.run(() => repo.saveDraft(draft));
    expect(await queue.run(() => repo.listDrafts())).toEqual([draft]);
  });
  it('offers_an_exclusive_barrier_for_future_clear_coordination', async () => {
    const repo = createMaterialRepository(new IDBFactory()); const queue = getMaterialDraftQueue(repo);
    const blocked = barrier(); const started = barrier();
    const oldWrite = queue.run(async () => { started.release(); await blocked.promise; await repo.saveDraft(draft); });
    const clear = queue.run(() => repo.clearAll());
    const read = queue.run(() => repo.listDrafts());
    await started.promise; blocked.release(); await oldWrite; await clear;
    expect(await read).toEqual([]); await queue.whenIdle();
  });
});
