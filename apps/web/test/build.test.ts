import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { renderHeadersFile } from '@shared/security-headers';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cspViolations, inlineScriptHashes } from '../scripts/csp-adapter';

const root = resolve(import.meta.dirname, '..');
let outDir: string;
let htmlFiles: string[];

async function filesUnder(dir: string, suffix: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(suffix))
    .map((e) => join(e.parentPath, e.name));
}

beforeAll(async () => {
  outDir = await mkdtemp(join(tmpdir(), 'shared-web-build-'));
  // A real `vite build` in a child process: SvelteKit skips prerendering and adapters under Vitest.
  const { VITEST: _vitest, VITEST_MODE: _mode, NODE_ENV: _env, ...env } = process.env;
  await promisify(execFile)('pnpm', ['exec', 'vite', 'build', '--logLevel', 'error'], {
    cwd: root,
    env: { ...env, SHARED_WEB_OUT_DIR: outDir },
  });
  htmlFiles = await filesUnder(outDir, '.html');
}, 120_000);

afterAll(async () => {
  await rm(outDir, { recursive: true, force: true });
});

describe('static output', () => {
  it('prerenders every page, including the viewer shells and the 404 fallback', () => {
    const pages = htmlFiles.map((f) => f.slice(outDir.length + 1)).sort();
    expect(pages).toEqual(
      expect.arrayContaining([
        'index.html',
        'notes.html',
        'files.html',
        'privacy.html',
        'terms.html',
        'report.html',
        'n/_.html',
        'n/_/delete.html',
        '404.html',
      ]),
    );
  });

  it('maps recipient links onto the shells', async () => {
    const redirects = await readFile(join(outDir, '_redirects'), 'utf8');
    expect(redirects).toContain('/n/:id/delete /n/_/delete 200');
    expect(redirects).toContain('/n/:id /n/_ 200');
    expect(redirects.indexOf('/n/:id/delete')).toBeLessThan(redirects.indexOf('/n/:id /n/_'));
  });
});

describe('production build is compatible with the strict CSP (ADR 0009)', () => {
  it('has no inline styles, style attributes, event handlers or external URLs in any page', async () => {
    for (const file of htmlFiles) {
      expect(cspViolations(await readFile(file, 'utf8')), file).toEqual([]);
    }
  });

  it('allows exactly the inline scripts it ships, by hash, in _headers', async () => {
    const hashes = new Set<string>();
    for (const file of htmlFiles) {
      for (const hash of inlineScriptHashes(await readFile(file, 'utf8'))) hashes.add(hash);
    }
    expect(hashes.size).toBeGreaterThan(0);
    const headers = await readFile(join(outDir, '_headers'), 'utf8');
    expect(headers).toBe(renderHeadersFile({ scriptHashes: [...hashes].sort() }));
    expect(headers).not.toContain('unsafe-inline');
    expect(headers).not.toContain('unsafe-eval');
  });

  it('does not use eval or inline data: assets in bundles', async () => {
    for (const file of await filesUnder(outDir, '.js')) {
      const content = await readFile(file, 'utf8');
      expect(content, file).not.toMatch(/\beval\(|new Function\(/);
      expect(content, file).not.toContain('data:image');
    }
  });

  it('never renders note content as HTML: no {@html} in the source (ADR 0012)', async () => {
    for (const file of await filesUnder(resolve(root, 'src'), '.svelte')) {
      expect(await readFile(file, 'utf8'), file).not.toContain('{@html');
    }
  });

  it('loads Turnstile only from the creation page code path', async () => {
    const withTurnstile: string[] = [];
    for (const file of await filesUnder(outDir, '.js')) {
      if ((await readFile(file, 'utf8')).includes('challenges.cloudflare.com'))
        withTurnstile.push(file);
    }
    // One chunk (the creation page). Viewer pages also get a CSP that blocks it.
    expect(withTurnstile.length).toBeGreaterThan(0);
    expect(withTurnstile.length).toBeLessThanOrEqual(2);
  });
});
