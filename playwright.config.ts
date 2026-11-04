import { defineConfig, devices } from '@playwright/test';

const PORT = 8790;

/**
 * End-to-end tests against the real built app served by `wrangler dev` (static assets + Worker +
 * Durable Objects), with Cloudflare's always-pass Turnstile test keys. Run `pnpm build` first.
 */
export default defineConfig({
  testDir: 'e2e',
  // One worker: the local RL_CREATE limit (10/min) is shared by every test.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${String(PORT)}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile\.spec/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec/ },
  ],
  webServer: {
    cwd: 'worker',
    command: [
      'pnpm exec wrangler dev',
      `--ip 127.0.0.1 --port ${String(PORT)}`,
      '--persist-to ../.wrangler/e2e-state',
      '--var ENVIRONMENT:development',
      '--var FEATURE_NOTES:true',
      '--var TURNSTILE_SITE_KEY:1x00000000000000000000AA',
      '--var TURNSTILE_SECRET_KEY:1x0000000000000000000000000000000AA',
      '--var TURNSTILE_EXPECTED_HOSTNAME:',
      '--var IP_HASH_SECRET:e2e-ip-hash-secret-0123456789abcdef',
      '--show-interactive-dev-session=false',
    ].join(' '),
    url: `http://127.0.0.1:${String(PORT)}/api/v1/health`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
