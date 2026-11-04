# 0010. Styling: Tailwind CSS v4 on top of CSS design tokens

- Status: Accepted (owner decision, 2026-11-03)
- Date: 2026-11-03 (tailwindcss 4.3.4, @tailwindcss/vite 4.3.4)

## Context

The owner asked for Tailwind. The CSP forbids inline styles (`style-src 'self'`). Tailwind v4
compiles to one static stylesheet at build time, so it is compatible with that rule.

## Decision

- `tailwindcss` + `@tailwindcss/vite` (dev dependencies; nothing ships at runtime except CSS).
- Tokens live once in `apps/web/src/app.css` as CSS custom properties (light default, dark override
  under `[data-theme='dark']`). They are exposed to Tailwind through `@theme inline`, so utilities
  such as `bg-surface` and `text-muted` follow the active theme.
- Components use utility classes. Svelte `style:` directives and `style=` attributes are not
  allowed, because CSP blocks parsed style attributes. Dynamic visuals use native elements
  (`<progress>`) or classes.

## Consequences

- Two dev dependencies. No runtime JavaScript.
- Colors are checked against WCAG 2.2 AA in `docs/design-spec.md`.
