import { publicConfigSchema, type PublicConfig } from '@shared/schema';
import { apiRequest } from './api';

let pending: Promise<PublicConfig> | undefined;

/** Guest limits, TTL options and the Turnstile site key, fetched once per page load. */
export function loadConfig(): Promise<PublicConfig> {
  pending ??= apiRequest('/config', { schema: publicConfigSchema }).catch((error: unknown) => {
    pending = undefined;
    throw error;
  });
  return pending;
}
