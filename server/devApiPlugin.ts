import { loadEnv, type Plugin } from 'vite';
import { readAIConfig } from './ai/config';
import { createAIHandlers } from './ai/httpHandlers';

export function devApiPlugin(): Plugin {
  return {
    name: 'server-ai-api', apply: 'serve',
    configureServer(server) {
      // Only a running dev server loads local server variables. Test/build imports do not.
      const local = loadEnv(server.config.mode, server.config.root, ['DEEPSEEK_', 'AI_GENERATION_']);
      const env = { ...local, ...process.env };
      const handlers = () => {
        const port = server.httpServer?.address();
        const actualPort = typeof port === 'object' && port ? port.port : server.config.server.port ?? 5173;
        return createAIHandlers({ config: readAIConfig(env, { developmentOrigins:
          ['localhost', '127.0.0.1', '[::1]'].map(host => `http://${host}:${actualPort}`) }),
          fetch: globalThis.fetch, now: () => new Date().toISOString() });
      };
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0];
        if (path === '/api/answers/rewrite') { void handlers().handleRewrite(req, res); return; }
        if (path === '/api/ai/status') { handlers().handleAIStatus(req, res); return; }
        next();
      });
    },
  };
}
