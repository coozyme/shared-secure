# 0012. Markdown rendering without HTML injection

- Status: Accepted (owner decision, 2026-11-03)
- Date: 2026-11-03 (marked 18.1.3)

## Context

Spec §6.4: render notes as text by default. Markdown must be sanitized, with no raw HTML and no
remote images, since images leak the viewer's IP. The usual approach (Markdown → HTML string →
DOMPurify → `{@html}`) puts a sanitizer between untrusted input and `innerHTML`.

## Decision

- Use `marked`'s **lexer only** to produce tokens. A Svelte component renders an allowlisted subset
  (headings, paragraphs, emphasis, strong, strikethrough, inline code, code blocks, blockquotes,
  lists, horizontal rules, line breaks, tables, links) as Svelte elements with text interpolation.
- No `{@html}` anywhere in the app. A test fails the build if it appears.
- Raw HTML tokens are shown as literal text. Images are shown as text (`[image: alt]`) and never
  loaded.
- Links: only `https:`, `http:` and `mailto:`. Each shows its target URL, uses
  `rel="noopener noreferrer nofollow"` and `target="_blank"`, and `Referrer-Policy: no-referrer`
  applies. Other schemes are shown as plain text.
- Default view for Markdown notes is rendered, with a toggle to see the source.

## Consequences

- One runtime dependency (`marked`, no transitive dependencies). DOMPurify isn't needed.
- No HTML ever reaches the DOM from note content, so a sanitizer bypass isn't possible.
