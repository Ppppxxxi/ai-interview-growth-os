export interface AIConfig {
  enabled: boolean;
  apiKey: string;
  model: string;
  trustedOrigins: string[];
}
export function readAIConfig(env: Record<string, string | undefined>, options?: { developmentOrigins?: string[] }): AIConfig {
  const trustedOrigins: string[] = [];
  if (env.VERCEL === '1') {
    for (const value of [env.VERCEL_URL, env.VERCEL_BRANCH_URL, env.VERCEL_PROJECT_PRODUCTION_URL]) {
      if (!value || !/^[a-z0-9.-]+$/i.test(value)) continue;
      try {
        const url = new URL(`https://${value}`);
        if (url.host === value.toLowerCase()) trustedOrigins.push(url.origin);
      } catch { /* Invalid deployment configuration stays closed. */ }
    }
  } else {
    for (const value of options?.developmentOrigins ?? []) {
      try {
        const url = new URL(value);
        if (url.origin === value && url.protocol === 'http:' &&
          ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) trustedOrigins.push(value);
      } catch { /* Only explicitly configured loopback origins are permitted. */ }
    }
  }
  const apiKey = env.DEEPSEEK_API_KEY?.trim() ?? '';
  const model = env.DEEPSEEK_MODEL?.trim() ?? '';
  return {
    enabled: env.AI_GENERATION_ENABLED === 'true' && (env.VERCEL !== '1' || env.NODEJS_HELPERS === '0'),
    apiKey: /[\r\n]/.test(apiKey) ? '' : apiKey,
    model: model.length <= 200 && !/[\r\n]/.test(model) ? model : '',
    trustedOrigins: [...new Set(trustedOrigins)],
  };
}

export const isAIAvailable = (config: AIConfig): boolean =>
  config.enabled && Boolean(config.apiKey && config.model) && config.trustedOrigins.length > 0;
