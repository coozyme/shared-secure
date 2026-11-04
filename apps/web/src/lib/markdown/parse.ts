import { Lexer, type Token, type Tokens } from 'marked';

/**
 * A closed, render-ready Markdown model (ADR 0012). Everything not listed here is rendered as plain
 * text. There is no HTML node type: nothing in this model can reach the DOM as markup.
 */
export type Inline =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'strong'; readonly children: readonly Inline[] }
  | { readonly kind: 'em'; readonly children: readonly Inline[] }
  | { readonly kind: 'del'; readonly children: readonly Inline[] }
  | { readonly kind: 'code'; readonly text: string }
  | { readonly kind: 'br' }
  | { readonly kind: 'link'; readonly href: string; readonly children: readonly Inline[] };

export type Block =
  | {
      readonly kind: 'heading';
      readonly level: 1 | 2 | 3 | 4 | 5 | 6;
      readonly children: readonly Inline[];
    }
  | { readonly kind: 'paragraph'; readonly children: readonly Inline[] }
  | { readonly kind: 'code'; readonly text: string }
  | { readonly kind: 'quote'; readonly children: readonly Block[] }
  | {
      readonly kind: 'list';
      readonly ordered: boolean;
      readonly start: number;
      readonly items: readonly ListItem[];
    }
  | { readonly kind: 'hr' }
  | {
      readonly kind: 'table';
      readonly header: readonly (readonly Inline[])[];
      readonly rows: readonly (readonly (readonly Inline[])[])[];
    };

export interface ListItem {
  /** null for a normal item, true/false for a task-list item. */
  readonly checked: boolean | null;
  readonly children: readonly Block[];
}

const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:']);
const MAX_DEPTH = 12;

/** Returns the href if it is an absolute http(s)/mailto URL, otherwise null. */
export function safeHref(href: string): string | null {
  try {
    const url = new URL(href);
    return SAFE_SCHEMES.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

const text = (value: string): Inline => ({ kind: 'text', text: value });

function inlines(tokens: readonly Token[] | undefined, depth: number): Inline[] {
  if (tokens === undefined || depth > MAX_DEPTH) return [];
  return tokens.flatMap((token) => inline(token, depth + 1));
}

function inline(token: Token, depth: number): Inline[] {
  switch (token.type) {
    case 'text': {
      const t = token as Tokens.Text;
      return t.tokens === undefined ? [text(t.text)] : inlines(t.tokens, depth);
    }
    case 'escape':
      return [text((token as Tokens.Escape).text)];
    case 'strong':
      return [{ kind: 'strong', children: inlines((token as Tokens.Strong).tokens, depth) }];
    case 'em':
      return [{ kind: 'em', children: inlines((token as Tokens.Em).tokens, depth) }];
    case 'del':
      return [{ kind: 'del', children: inlines((token as Tokens.Del).tokens, depth) }];
    case 'codespan':
      return [{ kind: 'code', text: (token as Tokens.Codespan).text }];
    case 'br':
      return [{ kind: 'br' }];
    case 'link': {
      const link = token as Tokens.Link;
      const href = safeHref(link.href);
      const children = inlines(link.tokens, depth);
      return href === null
        ? [...children, text(` (${link.href})`)]
        : [{ kind: 'link', href, children }];
    }
    case 'image': {
      // Never loaded: remote images would leak the reader's IP address.
      const image = token as Tokens.Image;
      return [text(`[image: ${image.text === '' ? image.href : image.text}]`)];
    }
    case 'checkbox':
      return [];
    default:
      // html, and anything unknown: show what the author typed, as text.
      return [text(token.raw)];
  }
}

function blocks(tokens: readonly Token[], depth: number): Block[] {
  if (depth > MAX_DEPTH)
    return [{ kind: 'paragraph', children: [text(tokens.map((t) => t.raw).join(''))] }];
  return tokens.flatMap((token) => block(token, depth + 1));
}

function block(token: Token, depth: number): Block[] {
  switch (token.type) {
    case 'space':
      return [];
    case 'heading': {
      const heading = token as Tokens.Heading;
      const level = Math.min(Math.max(heading.depth, 1), 6) as 1 | 2 | 3 | 4 | 5 | 6;
      return [{ kind: 'heading', level, children: inlines(heading.tokens, depth) }];
    }
    case 'paragraph':
      return [{ kind: 'paragraph', children: inlines((token as Tokens.Paragraph).tokens, depth) }];
    case 'text': {
      const t = token as Tokens.Text;
      return [
        {
          kind: 'paragraph',
          children: t.tokens === undefined ? [text(t.text)] : inlines(t.tokens, depth),
        },
      ];
    }
    case 'code':
      return [{ kind: 'code', text: (token as Tokens.Code).text }];
    case 'blockquote':
      return [{ kind: 'quote', children: blocks((token as Tokens.Blockquote).tokens, depth) }];
    case 'list': {
      const list = token as Tokens.List;
      const start = typeof list.start === 'number' ? list.start : 1;
      return [
        {
          kind: 'list',
          ordered: list.ordered,
          start,
          items: list.items.map((item) => ({
            checked: item.task ? (item.checked ?? false) : null,
            children: blocks(item.tokens, depth),
          })),
        },
      ];
    }
    case 'hr':
      return [{ kind: 'hr' }];
    case 'table': {
      const table = token as Tokens.Table;
      return [
        {
          kind: 'table',
          header: table.header.map((cell) => inlines(cell.tokens, depth)),
          rows: table.rows.map((row) => row.map((cell) => inlines(cell.tokens, depth))),
        },
      ];
    }
    default:
      // Block html and anything unknown: shown verbatim as a code block, never interpreted.
      return [{ kind: 'code', text: token.raw.replace(/\n+$/, '') }];
  }
}

/** Parses untrusted Markdown into the closed model above. Pure and synchronous. */
export function parseMarkdown(source: string): Block[] {
  return blocks(Lexer.lex(source, { gfm: true, breaks: false }), 0);
}
