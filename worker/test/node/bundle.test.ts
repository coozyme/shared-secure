import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Structural guarantee that the server can never handle keys: the browser-only crypto package
 * must not be a dependency of, nor part of the bundle of, the Worker. See ADR 0004.
 */

const workerRoot = resolve(import.meta.dirname, '../..');
const outDir = mkdtempSync(join(tmpdir(), 'shared-worker-bundle-'));

interface Metafile {
  inputs: Record<string, unknown>;
}

let metafile: Metafile;
let bundle: string;

beforeAll(() => {
  execFileSync(
    'pnpm',
    [
      'exec',
      'wrangler',
      'deploy',
      '--dry-run',
      '--outdir',
      outDir,
      '--metafile',
      join(outDir, 'meta.json'),
    ],
    { cwd: workerRoot, stdio: 'pipe' },
  );
  metafile = JSON.parse(readFileSync(join(outDir, 'meta.json'), 'utf8')) as Metafile;
  bundle = readFileSync(join(outDir, 'index.js'), 'utf8');
});

afterAll(() => {
  rmSync(outDir, { recursive: true, force: true });
});

describe('worker isolation from @shared/crypto', () => {
  it('does not declare @shared/crypto as a dependency', () => {
    const pkg = JSON.parse(readFileSync(join(workerRoot, 'package.json'), 'utf8')) as Record<
      string,
      Record<string, string> | undefined
    >;
    for (const field of [
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies',
    ]) {
      expect(Object.keys(pkg[field] ?? {}), field).not.toContain('@shared/crypto');
    }
  });

  it('bundle inputs contain no file from packages/crypto', () => {
    const inputs = Object.keys(metafile.inputs);
    expect(inputs.some((path) => path.includes('src/index.ts'))).toBe(true);
    expect(inputs.filter((path) => path.includes('packages/crypto'))).toEqual([]);
  });

  it('bundle output contains no crypto package marker', () => {
    expect(bundle.length).toBeGreaterThan(0);
    expect(bundle).not.toContain('@shared/crypto');
  });
});
