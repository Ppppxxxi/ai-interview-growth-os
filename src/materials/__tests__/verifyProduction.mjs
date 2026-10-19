// Run with PLAYWRIGHT_PACKAGE_PATH pointing to a locally available playwright package.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const outDir = resolve(root, '.superpowers/sdd/2026-10-13-my-materials-deepseek-plan/production-check');
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE_PATH || 'playwright');

await build({
  root, base: '/demo/', configFile: false, logLevel: 'warn',
  build: {
    outDir, emptyOutDir: true,
    rollupOptions: {
      input: resolve(here, '../importDocument.ts'), preserveEntrySignatures: 'strict',
      output: { entryFileNames: 'materials.js' },
    },
  },
});
const requests = [];
const server = createServer(async (request, response) => {
  requests.push(request.url);
  if (request.url === '/demo/') {
    response.setHeader('Content-Type', 'text/html');
    response.end('<!doctype html><title>Material parser verification</title>');
    return;
  }
  const path = resolve(outDir, decodeURIComponent(request.url?.replace(/^\/demo\//, '') || ''));
  if (!path.startsWith(outDir + sep)) { response.writeHead(403).end(); return; }
  try {
    const bytes = await readFile(path);
    response.setHeader('Content-Type', ['.js', '.mjs'].includes(extname(path)) ? 'text/javascript' : 'application/octet-stream');
    response.end(bytes);
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH });
  const page = await browser.newPage();
  const external = [];
  const workers = [];
  page.on('worker', worker => workers.push(worker.url()));
  await page.route('**/*', route => {
    if (!route.request().url().startsWith(origin + '/')) {
      external.push(route.request().url());
      return route.abort();
    }
    return route.continue();
  });
  await page.goto(origin + '/demo/');
  for (const [name, expected] of [
    ['synthetic.pdf', 'Synthetic project alpha\n\nSynthetic research beta'],
    ['chinese.pdf', '虚构项目用户研究'],
    ['active-content.pdf', 'Synthetic project alpha\n\nSynthetic research beta'],
    ['synthetic.docx', 'Synthetic project alpha\n\nSynthetic link label\n\n'],
  ]) {
    const bytes = await readFile(resolve(here, 'fixtures', name));
    const result = await page.evaluate(async ({ name, bytes }) => {
      const { importDocument } = await import('/demo/materials.js');
      const text = await importDocument(new File([Uint8Array.from(bytes)], name));
      return { text: text.text, executed: 'fixtureExecuted' in globalThis };
    }, { name, bytes: [...bytes] });
    assert.equal(result.text, expected, name);
    assert.equal(result.executed, false, name);
  }
  for (const [name, code] of [['encrypted.pdf', 'ENCRYPTED_PDF'], ['encrypted-empty-password.pdf', 'ENCRYPTED_PDF'], ['scanned.pdf', 'SCANNED_PDF'], ['mixed-scan.pdf', 'SCANNED_PDF']]) {
    const bytes = await readFile(resolve(here, 'fixtures', name));
    const actual = await page.evaluate(async ({ name, bytes }) => {
      const { importDocument } = await import('/demo/materials.js');
      try { await importDocument(new File([Uint8Array.from(bytes)], name)); return 'accepted'; }
      catch (error) { return error.code; }
    }, { name, bytes: [...bytes] });
    assert.equal(actual, code, name);
  }
  assert.deepEqual(external, []);
  assert.ok(workers.length > 0, 'A real browser worker must start, not just a fake-worker fallback');
  assert.ok(workers.every(url => url.startsWith(origin + '/demo/assets/pdf.worker.min-')));
  assert.ok(requests.some(url => /\/demo\/assets\/pdf.worker.min-.*\.mjs$/.test(url)));
  console.log(JSON.stringify({ result: 'PASS', fixtures: 8, worker: workers[0], externalRequests: external.length }));
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
