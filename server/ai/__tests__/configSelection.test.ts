import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfigFromFile } from 'vite';
import { expect, it } from 'vitest';
import { scripts } from '../../../package.json';

it.each(['dev', 'build', 'preview', 'test', 'test:watch'] as const)('%s selects TS config with an existing same-name JS artifact', async name => {
  const root = mkdtempSync(join(fileURLToPath(new URL('../../../', import.meta.url)), '.task4-config-selection-'));
  const oldConfig = 'export default { envDir: false, plugins: [{ name: "old-artifact" }] };';
  try {
    writeFileSync(join(root, 'vite.config.js'), oldConfig);
    writeFileSync(join(root, 'vite.config.ts'), 'export default { envDir: false, plugins: [{ name: "new-ts-config" }] };');
    const defaultConfig = await loadConfigFromFile({ command: 'build', mode: 'test' }, undefined, root);
    expect(defaultConfig?.path).toMatch(/vite\.config\.js$/);
    const explicitConfig = scripts[name].match(/--config\s+(\S+)/)?.[1];
    expect(explicitConfig).toBe('vite.config.ts');
    const selected = await loadConfigFromFile({ command: 'build', mode: 'test' }, join(root, explicitConfig!), root);
    expect(selected?.config.plugins).toEqual([{ name: 'new-ts-config' }]);
    expect(readFileSync(join(root, 'vite.config.js'), 'utf8')).toBe(oldConfig);
  } finally {
    // Only this test's freshly generated directory is removed, never repository artifacts.
    rmSync(root, { recursive: true, force: true });
  }
});

it('explicit repository TS config has the dev adapter and envDir protection without loading env', async () => {
  const path = fileURLToPath(new URL('../../../vite.config.ts', import.meta.url));
  const selected = await loadConfigFromFile({ command: 'build', mode: 'test' }, path);
  expect(selected?.config.envDir).toBe(false);
  expect(selected?.config.plugins?.flat().some(plugin => plugin && 'name' in plugin && plugin.name === 'server-ai-api')).toBe(true);
});
