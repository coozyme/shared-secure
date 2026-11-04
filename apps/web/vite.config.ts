import { resolve } from 'node:path';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { staticWithHashedCsp } from './scripts/csp-adapter.ts';

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit({
      // The Worker serves dist/ as static assets (ADR 0003). Tests build elsewhere to avoid races.
      adapter: staticWithHashedCsp(
        process.env['SHARED_WEB_OUT_DIR'] ?? resolve(import.meta.dirname, 'dist'),
      ),
      // Hourly version polling would add network requests on pages that hold keys.
      version: { pollInterval: 0 },
    }),
  ],
  build: {
    assetsInlineLimit: 0,
    sourcemap: false,
    target: 'es2023',
  },
  server: {
    // `pnpm dev`: the Worker runs on 8787 (wrangler dev); the UI proxies its API calls there.
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
});
