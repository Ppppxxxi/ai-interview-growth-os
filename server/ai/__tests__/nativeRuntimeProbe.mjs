import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer, request } from 'node:http';
import { pathToFileURL } from 'node:url';

let fetchCalls = 0;
globalThis.fetch = async () => {
  fetchCalls += 1;
  throw new Error('Provider traffic is forbidden in the native runtime probe');
};
const entry = process.argv[2];
// No loader, bundler, resolver hook, or rewritten emitted source is involved.
const { default: handler } = await import(pathToFileURL(entry).href);
assert.equal(typeof handler, 'function');
const isStatus = entry.endsWith('/status.js') || entry.endsWith('\\status.js');
const server = createServer((req, res) => {
  Promise.resolve(handler(req, res)).catch(error => {
    res.destroy(error);
  });
});

function call(method, body) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const req = request({ hostname: '127.0.0.1', port: address.port,
      path: isStatus ? '/api/ai/status' : '/api/answers/rewrite', method,
      headers: { host: 'native-test.vercel.app', origin: 'https://native-test.vercel.app',
        'content-type': 'application/json', connection: 'close' },
    }, res => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { text += chunk; });
      res.on('error', reject);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(text) }));
    });
    req.on('error', reject);
    req.end(body);
  });
}

try {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  process.env.VERCEL = '1';
  process.env.NODEJS_HELPERS = '0';
  process.env.VERCEL_URL = 'native-test.vercel.app';
  for (const enabled of [undefined, 'false', 'true']) {
    if (enabled === undefined) delete process.env.AI_GENERATION_ENABLED;
    else process.env.AI_GENERATION_ENABLED = enabled;
    const response = await call(isStatus ? 'GET' : 'POST', isStatus ? undefined : '{}');
    assert.equal(response.status, isStatus ? 200 : 503);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.deepEqual(response.body, isStatus ? { available: false } : { error: { code: 'AI_UNAVAILABLE' } });
  }
  if (!isStatus) {
    // Fictional credentials exercise payload rejection, never a real provider.
    process.env.DEEPSEEK_API_KEY = 'fictional-native-test-key';
    process.env.DEEPSEEK_MODEL = 'fictional-native-test-model';
    for (const body of ['{}', '{']) {
      const response = await call('POST', body);
      assert.equal(response.status, 400);
      assert.equal(response.headers['cache-control'], 'no-store');
      assert.deepEqual(response.body, { error: { code: 'INVALID_REQUEST' } });
    }
  }
  assert.equal(fetchCalls, 0);
  console.log(JSON.stringify({ entry: isStatus ? 'api/ai/status.js' : 'api/answers/rewrite.js', fetchCalls, passed: true }));
} finally {
  server.closeAllConnections();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
