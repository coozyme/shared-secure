import { vi, type MockInstance } from 'vitest';
import { TURNSTILE_VERIFY_URL } from '../../src/shared/turnstile';

let spy: MockInstance<typeof fetch> | undefined;

/**
 * Replaces Turnstile Siteverify with a canned answer. Tests run in the same isolate as the Worker,
 * so spying on the global fetch intercepts the Worker's outbound call. Other URLs fail loudly.
 */
export function mockSiteverify(success: boolean): MockInstance<typeof fetch> {
  restoreSiteverify();
  spy = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url !== TURNSTILE_VERIFY_URL) return Promise.reject(new Error(`unexpected fetch ${url}`));
    const body = success
      ? { success: true, hostname: 'shared.arysetyap.com' }
      : { success: false, 'error-codes': ['invalid-input-response'] };
    return Promise.resolve(Response.json(body));
  });
  return spy;
}

export function restoreSiteverify(): void {
  spy?.mockRestore();
  spy = undefined;
}
