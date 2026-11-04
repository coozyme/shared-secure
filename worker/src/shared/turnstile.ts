import { z } from 'zod';
import { ChallengeFailedError, ServiceUnavailableError } from './errors';
import { log } from './logger';

export const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const MAX_TOKEN_LENGTH = 2048;
const VERIFY_TIMEOUT_MS = 5000;

const siteverifySchema = z.object({
  success: z.boolean(),
  'error-codes': z.array(z.string()).optional(),
  hostname: z.string().optional(),
});

export interface TurnstileCheck {
  readonly token: unknown;
  readonly remoteIp: string;
  readonly secretKey: string;
  /** Empty string disables the hostname check (local dev with test keys only). */
  readonly expectedHostname: string;
  readonly requestId?: string;
}

/**
 * Verifies a Turnstile token with Siteverify. Throws ChallengeFailedError for bad tokens and
 * ServiceUnavailableError (fail closed) if Siteverify cannot be reached or answers unexpectedly.
 */
export async function verifyTurnstile(
  check: TurnstileCheck,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const { token, requestId } = check;
  if (typeof token !== 'string' || token.length === 0 || token.length > MAX_TOKEN_LENGTH) {
    log('warn', 'turnstile_rejected', { ...(requestId && { requestId }), reasons: ['malformed'] });
    throw new ChallengeFailedError();
  }

  let payload: z.infer<typeof siteverifySchema>;
  try {
    const response = await fetcher(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: check.secretKey, response: token, remoteip: check.remoteIp }),
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`siteverify status ${String(response.status)}`);
    payload = siteverifySchema.parse(await response.json());
  } catch (error) {
    log('error', 'turnstile_unavailable', { ...(requestId && { requestId }) });
    throw new ServiceUnavailableError(error);
  }

  const hostnameMismatch =
    check.expectedHostname !== '' && payload.hostname !== check.expectedHostname;
  if (!payload.success || hostnameMismatch) {
    const reasons = [...(payload['error-codes'] ?? []), ...(hostnameMismatch ? ['hostname'] : [])];
    log('warn', 'turnstile_rejected', { ...(requestId && { requestId }), reasons });
    throw new ChallengeFailedError();
  }
}
