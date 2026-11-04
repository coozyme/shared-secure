/**
 * The single source of truth for HTTP security headers.
 *
 * The Worker applies these to `/api/*` responses. The web build renders them into the static-asset
 * `_headers` file, so both sides cannot drift apart. See docs/decisions/0005-security-headers-and-csp.md.
 */

export type HeaderMap = Readonly<Record<string, string>>;

export const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';

/** Path prefixes that render shared content. They never load Turnstile and get the strictest CSP. */
export const VIEWER_PATH_PREFIXES = ['/n/', '/f/', '/l/'] as const;

const PERMISSIONS_POLICY = [
  'accelerometer=()',
  'autoplay=()',
  'browsing-topics=()',
  'camera=()',
  'display-capture=()',
  'encrypted-media=()',
  'fullscreen=()',
  'geolocation=()',
  'gyroscope=()',
  'hid=()',
  'idle-detection=()',
  'magnetometer=()',
  'microphone=()',
  'midi=()',
  'payment=()',
  'publickey-credentials-get=()',
  'screen-wake-lock=()',
  'serial=()',
  'usb=()',
  'xr-spatial-tracking=()',
].join(', ');

/** Headers sent on every response, static or dynamic. */
export const BASE_HEADERS: HeaderMap = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': PERMISSIONS_POLICY,
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Cache-Control': 'no-store',
};

type Directives = Readonly<Record<string, readonly string[]>>;

function serializeCsp(directives: Directives): string {
  return Object.entries(directives)
    .map(([name, values]) => (values.length > 0 ? `${name} ${values.join(' ')}` : name))
    .join('; ');
}

export interface DocumentCspOptions {
  /** Allow the Cloudflare Turnstile script and iframe. Only creation pages need this. */
  readonly allowTurnstile: boolean;
  /**
   * Build-time `sha256-…` hashes of the framework's inline bootstrap scripts (ADR 0009). Only exact
   * script bodies produced by our own build can run; there is no `unsafe-inline` and no nonce.
   */
  readonly scriptHashes?: readonly string[];
}

const SCRIPT_HASH = /^sha256-[A-Za-z0-9+/]{43}=$/;

/** CSP for HTML documents. No inline scripts or styles, no eval, no third-party origins by default. */
export function documentCsp(options: DocumentCspOptions): string {
  const turnstile = options.allowTurnstile ? [TURNSTILE_ORIGIN] : [];
  const hashes = [...new Set(options.scriptHashes ?? [])].sort();
  for (const hash of hashes) {
    if (!SCRIPT_HASH.test(hash)) throw new Error('invalid script hash');
  }
  return serializeCsp({
    'default-src': ["'none'"],
    'script-src': ["'self'", ...hashes.map((hash) => `'${hash}'`), ...turnstile],
    'style-src': ["'self'"],
    'img-src': ["'self'"],
    'font-src': ["'self'"],
    'connect-src': ["'self'"],
    'manifest-src': ["'self'"],
    'frame-src': options.allowTurnstile ? turnstile : ["'none'"],
    'worker-src': ["'self'"],
    'base-uri': ["'none'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'upgrade-insecure-requests': [],
  });
}

/** CSP for API responses: nothing may load or execute, even if a response is opened directly. */
export function apiCsp(): string {
  return serializeCsp({
    'default-src': ["'none'"],
    'base-uri': ["'none'"],
    'form-action': ["'none'"],
    'frame-ancestors': ["'none'"],
    sandbox: [],
  });
}

export function apiHeaders(): HeaderMap {
  return { ...BASE_HEADERS, 'Content-Security-Policy': apiCsp() };
}

/**
 * Renders the Workers Static Assets `_headers` file.
 *
 * `/*` gets the Turnstile-capable document CSP. Viewer paths get a second, strict CSP. Workers joins
 * repeated headers with a comma, which browsers treat as two policies that must both pass. The
 * effective policy on viewer pages is therefore the strict one.
 */
export function renderHeadersFile(
  options: { readonly scriptHashes?: readonly string[] } = {},
): string {
  const scriptHashes = options.scriptHashes ?? [];
  const block = (pattern: string, headers: HeaderMap): string =>
    [pattern, ...Object.entries(headers).map(([name, value]) => `  ${name}: ${value}`)].join('\n');

  const blocks = [
    block('/*', {
      ...BASE_HEADERS,
      'Content-Security-Policy': documentCsp({ allowTurnstile: true, scriptHashes }),
    }),
    ...VIEWER_PATH_PREFIXES.map((prefix) =>
      block(`${prefix}*`, {
        'Content-Security-Policy': documentCsp({ allowTurnstile: false, scriptHashes }),
      }),
    ),
  ];
  return `# Generated from packages/security-headers. Do not edit.\n${blocks.join('\n\n')}\n`;
}
