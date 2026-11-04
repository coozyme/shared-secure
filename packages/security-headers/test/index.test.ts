import { describe, expect, it } from 'vitest';
import {
  BASE_HEADERS,
  TURNSTILE_ORIGIN,
  apiCsp,
  apiHeaders,
  documentCsp,
  renderHeadersFile,
} from '../src/index';

const parseCsp = (csp: string): Map<string, string[]> =>
  new Map(
    csp.split(';').map((part) => {
      const [name = '', ...values] = part.trim().split(/\s+/);
      return [name, values];
    }),
  );

describe('documentCsp', () => {
  it.each([true, false])('is strict with allowTurnstile=%s', (allowTurnstile) => {
    const csp = parseCsp(documentCsp({ allowTurnstile }));
    expect(csp.get('default-src')).toEqual(["'none'"]);
    expect(csp.get('base-uri')).toEqual(["'none'"]);
    expect(csp.get('frame-ancestors')).toEqual(["'none'"]);
    expect(csp.get('form-action')).toEqual(["'self'"]);
    expect(csp.get('style-src')).toEqual(["'self'"]);
    const scriptSrc = csp.get('script-src') ?? [];
    expect(scriptSrc).toContain("'self'");
    for (const unsafe of ["'unsafe-inline'", "'unsafe-eval'", "'wasm-unsafe-eval'", 'data:', '*']) {
      expect(documentCsp({ allowTurnstile })).not.toContain(unsafe);
    }
  });

  it('only allows Turnstile when asked', () => {
    expect(documentCsp({ allowTurnstile: false })).not.toContain(TURNSTILE_ORIGIN);
    const csp = parseCsp(documentCsp({ allowTurnstile: true }));
    expect(csp.get('script-src')).toEqual(["'self'", TURNSTILE_ORIGIN]);
    expect(csp.get('frame-src')).toEqual([TURNSTILE_ORIGIN]);
  });
});

describe('script hashes', () => {
  const hash = `sha256-${'A'.repeat(43)}=`;

  it('adds build-time hashes to script-src on both policies, never unsafe-inline', () => {
    for (const allowTurnstile of [true, false]) {
      const csp = documentCsp({ allowTurnstile, scriptHashes: [hash, hash] });
      expect(parseCsp(csp).get('script-src')).toEqual([
        "'self'",
        `'${hash}'`,
        ...(allowTurnstile ? [TURNSTILE_ORIGIN] : []),
      ]);
      expect(csp).not.toContain('unsafe-inline');
    }
  });

  it.each(["'unsafe-inline'", 'sha256-short', `sha384-${'A'.repeat(43)}=`, `${'A'.repeat(43)}=`])(
    'rejects anything that is not a sha256 hash: %s',
    (value) => {
      expect(() => documentCsp({ allowTurnstile: false, scriptHashes: [value] })).toThrow();
    },
  );

  it('renders hashes into every _headers policy', () => {
    const file = renderHeadersFile({ scriptHashes: [hash] });
    const policies = file.split('\n').filter((line) => line.includes('Content-Security-Policy'));
    expect(policies.length).toBe(4);
    for (const line of policies) expect(line).toContain(`'${hash}'`);
  });
});

describe('apiHeaders', () => {
  it('locks down API responses', () => {
    const headers = apiHeaders();
    expect(headers['Content-Security-Policy']).toBe(apiCsp());
    expect(apiCsp()).toContain("default-src 'none'");
    expect(apiCsp()).toContain('sandbox');
    expect(headers['Cache-Control']).toBe('no-store');
    expect(headers['Referrer-Policy']).toBe('no-referrer');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
  });
});

describe('renderHeadersFile', () => {
  const file = renderHeadersFile();

  it('applies every base header to all paths', () => {
    const [globalBlock = ''] = file.split('\n\n');
    expect(globalBlock).toContain('\n/*\n');
    for (const [name, value] of Object.entries(BASE_HEADERS)) {
      expect(globalBlock).toContain(`  ${name}: ${value}`);
    }
  });

  it('adds a strict CSP for viewer paths', () => {
    for (const prefix of ['/n/*', '/f/*', '/l/*']) {
      expect(file).toContain(
        `${prefix}\n  Content-Security-Policy: ${documentCsp({ allowTurnstile: false })}`,
      );
    }
  });

  it('respects Workers _headers limits (100 rules, 2000 chars per line)', () => {
    const rules = file.split('\n').filter((line) => line.startsWith('/'));
    expect(rules.length).toBeLessThanOrEqual(100);
    for (const line of file.split('\n')) expect(line.length).toBeLessThanOrEqual(2000);
  });
});
