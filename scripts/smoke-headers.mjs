#!/usr/bin/env node
// End-to-end security-header check against `wrangler dev` (static assets + Worker together).
// Run after `pnpm build`. Exits non-zero on any missing or wrong header.
import { spawn } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE_HEADERS, TURNSTILE_ORIGIN, apiHeaders, documentCsp } from '@shared/security-headers';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const port = 8787 + Math.floor(Math.random() * 1000);
const base = `http://127.0.0.1:${port}`;

const vars = {
  ENVIRONMENT: 'development',
  TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
  TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
  TURNSTILE_EXPECTED_HOSTNAME: '',
  IP_HASH_SECRET: 'smoke-test-ip-hash-secret-0123456789',
};

const wrangler = spawn(
  'pnpm',
  [
    'exec',
    'wrangler',
    'dev',
    '--ip',
    '127.0.0.1',
    '--port',
    String(port),
    '--show-interactive-dev-session=false',
    ...Object.entries(vars).flatMap(([k, v]) => ['--var', `${k}:${v}`]),
  ],
  { cwd: join(root, 'worker'), stdio: ['ignore', 'pipe', 'pipe'], detached: true },
);
let output = '';
wrangler.stdout.on('data', (d) => (output += d));
wrangler.stderr.on('data', (d) => (output += d));

const failures = [];
const check = (label, condition, detail = '') => {
  if (!condition) failures.push(`${label}${detail ? `: ${detail}` : ''}`);
};

async function waitForServer() {
  for (let i = 0; i < 120; i++) {
    try {
      await fetch(`${base}/robots.txt`);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`wrangler dev did not start:\n${output}`);
}

function expectHeaders(label, response, expected) {
  for (const [name, value] of Object.entries(expected)) {
    const actual = response.headers.get(name);
    check(
      `${label} ${name}`,
      actual === value,
      `expected ${JSON.stringify(value)}, got ${JSON.stringify(actual)}`,
    );
  }
}

/** Splits a (possibly comma-joined) CSP header into individual policies. */
const policies = (header) =>
  (header ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

try {
  await waitForServer();
  // The build hashes SvelteKit's inline bootstrap scripts into _headers (ADR 0009).
  const headersFile = await readFile(join(root, 'apps/web/dist/_headers'), 'utf8');
  const scriptHashes = [...new Set(headersFile.match(/sha256-[A-Za-z0-9+/]{43}=/g) ?? [])].sort();
  check('_headers has script hashes', scriptHashes.length > 0);
  const strictCsp = documentCsp({ allowTurnstile: false, scriptHashes });
  const creatorCsp = documentCsp({ allowTurnstile: true, scriptHashes });

  for (const path of ['/', '/notes', '/files', '/privacy', '/terms', '/report']) {
    const res = await fetch(`${base}${path}`, { redirect: 'manual' });
    check(`${path} status`, res.status === 200, String(res.status));
    expectHeaders(path, res, BASE_HEADERS);
    check(`${path} CSP`, policies(res.headers.get('Content-Security-Policy')).includes(creatorCsp));
    check(
      `${path} CSP has no unsafe-inline`,
      !(res.headers.get('Content-Security-Policy') ?? '').includes('unsafe-'),
    );
  }

  const unknown = await fetch(`${base}/some/unknown/route`);
  check('unknown route status', unknown.status === 404, String(unknown.status));
  expectHeaders('unknown route', unknown, BASE_HEADERS);

  for (const path of ['/n/AAAAAAAAAAAAAAAAAAAAAA', '/n/AAAAAAAAAAAAAAAAAAAAAA/delete']) {
    const res = await fetch(`${base}${path}`, { redirect: 'manual' });
    check(`${path} status`, res.status === 200, String(res.status));
    expectHeaders(path, res, BASE_HEADERS);
    const csp = policies(res.headers.get('Content-Security-Policy'));
    // Every policy is enforced; the strict one must be present so Turnstile is blocked.
    check(`${path} strict CSP`, csp.includes(strictCsp), JSON.stringify(csp));
    check(
      `${path} CSP blocks Turnstile`,
      csp.some((p) => !p.includes(TURNSTILE_ORIGIN)),
    );
    const html = await res.text();
    check(`${path} serves the viewer shell`, html.includes('/_app/immutable/'), 'no app bootstrap');
  }

  for (const path of ['/f/AAAAAAAAAAAAAAAAAAAAAA', '/l/AAAAAAAAAAAAAAAAAAAAAA']) {
    const res = await fetch(`${base}${path}`);
    check(`${path} status (not built yet)`, res.status === 404, String(res.status));
    const csp = policies(res.headers.get('Content-Security-Policy'));
    check(`${path} strict CSP`, csp.includes(strictCsp), JSON.stringify(csp));
  }

  const entryDir = join(root, 'apps/web/dist/_app/immutable/entry');
  for (const asset of await readdir(entryDir)) {
    const res = await fetch(`${base}/_app/immutable/entry/${asset}`);
    check(`asset ${asset} status`, res.status === 200, String(res.status));
    expectHeaders(`asset ${asset}`, res, BASE_HEADERS);
  }

  const config = await fetch(`${base}/api/v1/config`);
  check('config status', config.status === 200, `${config.status} ${await config.text()}`);
  expectHeaders('/api/v1/config', config, apiHeaders());

  const health = await fetch(`${base}/api/v1/health`);
  check('health status', health.status === 200, `${health.status} ${await health.text()}`);
  expectHeaders('/api/v1/health', health, apiHeaders());

  const missing = await fetch(`${base}/api/v1/does-not-exist`);
  check('api 404 status', missing.status === 404, String(missing.status));
  check(
    'api 404 is JSON',
    (missing.headers.get('Content-Type') ?? '').startsWith('application/json'),
  );
  expectHeaders('/api 404', missing, apiHeaders());
} catch (error) {
  failures.push(String(error));
} finally {
  try {
    process.kill(-wrangler.pid, 'SIGTERM');
  } catch {
    // already exited
  }
}

if (failures.length > 0) {
  console.error(`Header smoke test failed (${failures.length}):\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('Header smoke test passed.');
