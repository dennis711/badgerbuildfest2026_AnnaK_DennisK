import {readFileSync, existsSync} from 'node:fs';

// Minimal .env loader so the prototype needs no extra dependency.
// Values already set in the real environment win over the file.
export function loadEnv(path = '.env') {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!match || line.trim().startsWith('#')) continue;
    const [, key, raw] = match;
    const value = raw.replace(/^(['"])(.*)\1$/, '$2');
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export const config = () => ({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
  model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
  fastModel: process.env.ANTHROPIC_FAST_MODEL || 'claude-haiku-4-5-20251001',
  maxSearches: Number(process.env.MAX_WEB_SEARCHES || 8),
  port: Number(process.env.PORT || 5173),
  httpsPort: Number(process.env.HTTPS_PORT || 5174),
  cacheHours: Number(process.env.CACHE_HOURS || 12),
});
