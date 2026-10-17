import { vi } from 'vitest';
// Unit-test stand-in only. Production requires the browser's actual Web Locks.
export function mockBrowserLocks() {
  let tail = Promise.resolve();
  vi.stubGlobal('navigator', { locks: { request: (_name: string, action: () => Promise<unknown>) => {
    const result = tail.then(action); tail = result.then(() => {}, () => {}); return result;
  } } });
}
