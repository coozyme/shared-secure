import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import adapterStatic from '@sveltejs/adapter-static';
import type { Adapter } from '@sveltejs/kit';
import { renderHeadersFile } from '@shared/security-headers';

const INLINE_SCRIPT = /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;

async function htmlFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => join(entry.parentPath, entry.name));
}

/** SHA-256 hashes (CSP source-expression form) of every inline script in the given HTML. */
export function inlineScriptHashes(html: string): string[] {
  return [...html.matchAll(INLINE_SCRIPT)].map(
    ([, body = '']) => `sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}`,
  );
}

/** Patterns our CSP would block, or that must never appear in shipped HTML. */
export function cspViolations(html: string): string[] {
  const problems: string[] = [];
  if (/<style\b/i.test(html)) problems.push('inline <style>');
  if (/\sstyle=/i.test(html)) problems.push('style attribute');
  if (/\son[a-z]+=/i.test(html)) problems.push('inline event handler');
  if (/(src|href)="(https?:)?\/\//i.test(html)) problems.push('external URL');
  return problems;
}

/**
 * Wraps adapter-static (ADR 0009). After the static output is written, it hashes SvelteKit's
 * inline bootstrap scripts into `_headers`, so the CSP stays in HTTP headers (which, unlike a
 * `<meta>` CSP, enforce `frame-ancestors`) with no `unsafe-inline`. Fails the build on anything
 * the CSP would block.
 */
export function staticWithHashedCsp(outDir: string): Adapter {
  const inner = adapterStatic({
    pages: outDir,
    assets: outDir,
    fallback: '404.html',
    strict: true,
  });
  return {
    name: 'static-with-hashed-csp',
    async adapt(builder) {
      await inner.adapt(builder);
      const hashes = new Set<string>();
      const problems: string[] = [];
      for (const file of await htmlFiles(outDir)) {
        const html = await readFile(file, 'utf8');
        for (const hash of inlineScriptHashes(html)) hashes.add(hash);
        for (const problem of cspViolations(html)) {
          problems.push(`${relative(outDir, file)}: ${problem}`);
        }
      }
      if (problems.length > 0) throw new Error(`CSP-incompatible output:\n${problems.join('\n')}`);
      await writeFile(
        join(outDir, '_headers'),
        renderHeadersFile({ scriptHashes: [...hashes].sort() }),
      );
      builder.log.minor(`Wrote _headers with ${String(hashes.size)} inline script hash(es)`);
    },
  };
}
