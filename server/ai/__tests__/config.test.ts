import { expect, it } from 'vitest';
import { readAIConfig, isAIAvailable } from '../config';

const fake = { AI_GENERATION_ENABLED: 'true', DEEPSEEK_API_KEY: 'fake', DEEPSEEK_MODEL: 'fake' };
it('fails closed without trusted deployment or dev host', () => {
  expect(isAIAvailable(readAIConfig(fake))).toBe(false);
});
it('Vercel requires explicitly disabled body helpers', () => {
  expect(isAIAvailable(readAIConfig({ ...fake, VERCEL: '1', VERCEL_URL: 'demo.vercel.app' }))).toBe(false);
});
it('uses platform domain env and not wildcard or request forwarding', () => {
  const config = readAIConfig({ ...fake, VERCEL: '1', NODEJS_HELPERS: '0',
    VERCEL_URL: 'preview.vercel.app', VERCEL_BRANCH_URL: 'branch.vercel.app',
    VERCEL_PROJECT_PRODUCTION_URL: 'example.com' });
  expect(config.trustedOrigins).toEqual(['https://preview.vercel.app', 'https://branch.vercel.app', 'https://example.com']);
  expect(isAIAvailable(config)).toBe(true);
});
it.each(['https://demo.vercel.app', 'demo.vercel.app/evil', '*.vercel.app', 'user@demo.vercel.app'])('rejects invalid platform domain %s', VERCEL_URL => {
  expect(isAIAvailable(readAIConfig({ ...fake, VERCEL: '1', NODEJS_HELPERS: '0', VERCEL_URL }))).toBe(false);
});
it('does not enable uppercase or whitespace switches, and requires a model', () => {
  for (const AI_GENERATION_ENABLED of ['TRUE', '1', ' true', 'true ', 'false']) {
    expect(isAIAvailable(readAIConfig({ ...fake, AI_GENERATION_ENABLED }, { developmentOrigins: ['http://127.0.0.1:5173'] }))).toBe(false);
  }
  expect(readAIConfig({ ...fake, DEEPSEEK_MODEL: undefined }).model).toBe('');
});
