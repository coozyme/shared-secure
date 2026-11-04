import { describe, expect, it } from 'vitest';
import { parseMarkdown, safeHref, type Block, type Inline } from '../src/lib/markdown/parse';

const collectText = (value: unknown): string => JSON.stringify(value);

function allInlines(blocks: readonly Block[]): Inline[] {
  const out: Inline[] = [];
  const walkInline = (nodes: readonly Inline[]): void => {
    for (const node of nodes) {
      out.push(node);
      if ('children' in node) walkInline(node.children);
    }
  };
  const walk = (list: readonly Block[]): void => {
    for (const block of list) {
      if (block.kind === 'heading' || block.kind === 'paragraph') walkInline(block.children);
      if (block.kind === 'quote') walk(block.children);
      if (block.kind === 'list') for (const item of block.items) walk(item.children);
      if (block.kind === 'table') {
        for (const cell of block.header) walkInline(cell);
        for (const row of block.rows) for (const cell of row) walkInline(cell);
      }
    }
  };
  walk(blocks);
  return out;
}

describe('safeHref', () => {
  it.each(['https://example.com/a?b#c', 'http://example.com', 'mailto:a@example.com'])(
    'allows %s',
    (href) => {
      expect(safeHref(href)).not.toBeNull();
    },
  );

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,x',
    'vbscript:x',
    '/relative',
    '#frag',
    'blob:x',
  ])('blocks %s', (href) => {
    expect(safeHref(href)).toBeNull();
  });
});

describe('parseMarkdown', () => {
  it('keeps raw HTML as literal text', () => {
    const blocks = parseMarkdown('<script>alert(1)</script>\n\nHi <img src=x onerror=alert(1)>');
    expect(blocks[0]).toEqual({ kind: 'code', text: '<script>alert(1)</script>' });
    const inline = allInlines(blocks);
    expect(
      inline.some((n) => n.kind === 'text' && n.text.includes('<img src=x onerror=alert(1)>')),
    ).toBe(true);
  });

  it('never produces a link with an unsafe scheme', () => {
    const blocks = parseMarkdown('[click](javascript:alert(1)) [ok](https://example.com)');
    const links = allInlines(blocks).filter((n) => n.kind === 'link');
    expect(links).toEqual([
      { kind: 'link', href: 'https://example.com/', children: [{ kind: 'text', text: 'ok' }] },
    ]);
    expect(collectText(blocks)).toContain('(javascript:alert(1))');
  });

  it('turns images into text so nothing is fetched', () => {
    const blocks = parseMarkdown('![tracker](https://evil.example/pixel.png)');
    expect(collectText(blocks)).not.toContain('"kind":"image"');
    expect(allInlines(blocks)).toContainEqual({ kind: 'text', text: '[image: tracker]' });
  });

  it('supports the documented subset', () => {
    const blocks = parseMarkdown(
      '# Title\n\n**b** *i* ~~d~~ `c`\n\n> q\n\n1. one\n2. two\n\n- [x] done\n\n---\n\n| a |\n|---|\n| 1 |\n\n```\ncode\n```',
    );
    expect(blocks.map((b) => b.kind)).toEqual([
      'heading',
      'paragraph',
      'quote',
      'list',
      'list',
      'hr',
      'table',
      'code',
    ]);
    const task = blocks[4];
    expect(task?.kind === 'list' && task.items[0]?.checked).toBe(true);
  });

  it('bounds nesting depth', () => {
    expect(() => parseMarkdown(`${'> '.repeat(500)}deep`)).not.toThrow();
  });
});
