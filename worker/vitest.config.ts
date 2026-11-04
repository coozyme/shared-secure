import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [
          cloudflareTest({
            wrangler: { configPath: './wrangler.jsonc' },
            miniflare: {
              bindings: {
                ENVIRONMENT: 'development',
                FEATURE_NOTES: 'true',
                FEATURE_FILES: 'true',
                TURNSTILE_SECRET_KEY: 'test-turnstile-secret',
                TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
                // SHA-256 of 'a' * 43, base64url. Tests use that token as the admin bearer token.
                ADMIN_TOKEN_HASH: 'ZtNPunH49FD35FWYhT5Tv8I7vRKQJ8uxMaL0_9eHjNA',
                TURNSTILE_EXPECTED_HOSTNAME: 'shared.arysetyap.com',
                IP_HASH_SECRET: 'test-ip-hash-secret-0123456789abcdef',
                MAX_FILE_BYTES_GUEST: '52428800',
                MAX_FILE_CHUNKS: '200',
              },
            },
          }),
        ],
        test: { name: 'workers', include: ['test/workers/**/*.test.ts'] },
      },
      {
        test: {
          name: 'node',
          include: ['test/node/**/*.test.ts'],
          environment: 'node',
          testTimeout: 120_000,
        },
      },
    ],
  },
});
