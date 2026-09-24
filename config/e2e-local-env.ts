import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const fileName = '.env.e2e.local';
const supportedKeys = new Set(['E2E_DATABASE_URL', 'E2E_DIRECT_URL']);

const unquote = (value: string) => {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  )
    return trimmed.slice(1, -1);
  return trimmed;
};

/**
 * Loads only the two isolated E2E connection variables. Values already
 * provided by the shell take precedence, which keeps CI configuration intact.
 */
export const loadLocalE2EEnvironment = (directory = process.cwd()) => {
  const path = resolve(directory, fileName);
  if (!existsSync(path)) return false;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (!supportedKeys.has(key))
      throw new Error('E2E_LOCAL_ENV_CONTAINS_UNSUPPORTED_KEY');
    if (!process.env[key]) process.env[key] = unquote(rawValue);
  }
  return true;
};
