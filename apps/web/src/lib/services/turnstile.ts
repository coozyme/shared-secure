import { TURNSTILE_ORIGIN } from '@shared/security-headers';

/** Minimal typing for the parts of the Turnstile API we use (explicit rendering). */
interface TurnstileApi {
  render(container: HTMLElement, options: TurnstileRenderOptions): string | undefined;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

export interface TurnstileRenderOptions {
  readonly sitekey: string;
  readonly action?: string;
  readonly theme?: 'light' | 'dark' | 'auto';
  readonly size?: 'normal' | 'flexible' | 'compact';
  readonly callback: (token: string) => void;
  readonly 'expired-callback': () => void;
  readonly 'error-callback': () => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_URL = `${TURNSTILE_ORIGIN}/turnstile/v0/api.js?render=explicit`;
let loading: Promise<TurnstileApi> | undefined;

/**
 * Loads Cloudflare Turnstile on demand. Only creation pages call this, and only their CSP allows
 * the Turnstile origin (ADR 0005); on viewer pages the browser would refuse it.
 */
export function loadTurnstile(): Promise<TurnstileApi> {
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    if (window.turnstile !== undefined) {
      resolve(window.turnstile);
      return;
    }
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.referrerPolicy = 'no-referrer';
    script.addEventListener('load', () => {
      if (window.turnstile === undefined) reject(new Error('turnstile unavailable'));
      else resolve(window.turnstile);
    });
    script.addEventListener('error', () => {
      reject(new Error('turnstile unavailable'));
    });
    document.head.append(script);
  }).catch((error: unknown) => {
    loading = undefined;
    throw error;
  });
  return loading;
}
