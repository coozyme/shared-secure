import { describe, expect, it, vi } from 'vitest';
import { ChallengeFailedError, ServiceUnavailableError } from '../../src/shared/errors';
import { TURNSTILE_VERIFY_URL, verifyTurnstile } from '../../src/shared/turnstile';

const base = {
  token: 'turnstile-token',
  remoteIp: '203.0.113.7',
  secretKey: 'secret',
  expectedHostname: 'shared.arysetyap.com',
};

const siteverify = (body: unknown, status = 200) =>
  vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe('verifyTurnstile', () => {
  it('accepts a successful verification for our hostname', async () => {
    const fetcher = siteverify({ success: true, hostname: 'shared.arysetyap.com' });
    await expect(verifyTurnstile(base, fetcher)).resolves.toBeUndefined();
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe(TURNSTILE_VERIFY_URL);
    expect(JSON.parse(init?.body as string)).toEqual({
      secret: 'secret',
      response: 'turnstile-token',
      remoteip: '203.0.113.7',
    });
  });

  it.each([undefined, '', 42, 'x'.repeat(2049)])('rejects malformed token %#', async (token) => {
    const fetcher = siteverify({ success: true });
    await expect(verifyTurnstile({ ...base, token }, fetcher)).rejects.toBeInstanceOf(
      ChallengeFailedError,
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects failed verifications', async () => {
    const fetcher = siteverify({ success: false, 'error-codes': ['timeout-or-duplicate'] });
    await expect(verifyTurnstile(base, fetcher)).rejects.toBeInstanceOf(ChallengeFailedError);
  });

  it('rejects tokens issued for another hostname', async () => {
    const fetcher = siteverify({ success: true, hostname: 'evil.example' });
    await expect(verifyTurnstile(base, fetcher)).rejects.toBeInstanceOf(ChallengeFailedError);
  });

  it('skips the hostname check only when explicitly disabled', async () => {
    const fetcher = siteverify({ success: true, hostname: 'example.com' });
    await expect(
      verifyTurnstile({ ...base, expectedHostname: '' }, fetcher),
    ).resolves.toBeUndefined();
  });

  it.each([
    ['network error', vi.fn<typeof fetch>().mockRejectedValue(new Error('offline'))],
    ['non-2xx', siteverify({}, 500)],
    ['unexpected payload', siteverify({ nope: true })],
  ])('fails closed on %s', async (_name, fetcher) => {
    await expect(verifyTurnstile(base, fetcher)).rejects.toBeInstanceOf(ServiceUnavailableError);
  });
});
