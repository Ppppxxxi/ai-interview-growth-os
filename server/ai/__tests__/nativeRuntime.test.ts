import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../../', import.meta.url));
function emitAPI(emitted: string) {
  const config = ts.readConfigFile(join(root, 'tsconfig.server.json'), ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  // Preserve the deployment-style ESM emit; Node, not Vitest/Vite, resolves it below.
  const program = ts.createProgram(['api/ai/status.ts', 'api/answers/rewrite.ts'].map(path => join(root, path)), {
    ...parsed.options, noEmit: false, rootDir: root, outDir: emitted,
  });
  const result = program.emit();
  const diagnostics = [...ts.getPreEmitDiagnostics(program), ...result.diagnostics];
  expect(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: path => path, getCurrentDirectory: () => root, getNewLine: () => '\n',
  })).toBe('');
  writeFileSync(join(emitted, 'package.json'), JSON.stringify({ type: 'module' }));
  const require = createRequire(import.meta.url);
  cpSync(dirname(require.resolve('zod/package.json')), join(emitted, 'node_modules/zod'), { recursive: true });
}

it.each(['api/ai/status.js', 'api/answers/rewrite.js'])('native Node ESM loads and serves %s without provider traffic', entry => {
  const emitted = mkdtempSync(join(tmpdir(), 'ai-native-esm-'));
  try {
    emitAPI(emitted);
    const result = spawnSync(process.execPath, [
      fileURLToPath(new URL('./nativeRuntimeProbe.mjs', import.meta.url)), resolve(emitted, entry),
    ], {
      cwd: emitted, encoding: 'utf8', timeout: 15_000,
      // Do not inherit real provider credentials, Node loaders, or generation settings.
      env: { SystemRoot: process.env.SystemRoot, TEMP: tmpdir(), TMP: tmpdir() },
    });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ entry, fetchCalls: 0, passed: true });
  } finally {
    // Only remove the unique directory created by this test, never a workspace path.
    rmSync(emitted, { recursive: true, force: true });
  }
}, 30_000);
