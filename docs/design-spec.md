# Design spec

Direction: **minimalist security utility**. Calm, light by default, few colors, generous spacing.
The interface explains what happens to your data in plain words and stays out of the way.

Source of truth for tokens: [`apps/web/src/app.css`](../apps/web/src/app.css) (ADR 0010).

## Color tokens

Light is the default. Dark applies only when the user picks it (stored locally, applied before
first paint by `static/theme-init.js`).

| Token            | Light     | Dark      | Use                                |
| ---------------- | --------- | --------- | ---------------------------------- |
| `background`     | `#f6f8f9` | `#0e1316` | Page                               |
| `surface`        | `#ffffff` | `#151c20` | Panels, inputs                     |
| `surface-sunken` | `#eef2f3` | `#11171a` | Wells, segmented controls, code    |
| `foreground`     | `#202a35` | `#e3e9ec` | Text                               |
| `muted`          | `#5b6872` | `#9aa8b0` | Secondary text                     |
| `primary`        | `#244d4a` | `#8cc4bc` | Primary actions, links, focus ring |
| `accent`         | `#72948e` | `#6f948e` | Decorative only (never text)       |
| `border`         | `#e6ebed` | `#263036` | Dividers, panel edges (decorative) |
| `border-strong`  | `#7d8a91` | `#5d6b73` | Input boundaries (must be visible) |
| `success`        | `#397b5d` | `#7cc7a1` | Deleted / done                     |
| `warning`        | `#866a34` | `#d9b36e` | One-time / irreversible            |
| `danger`         | `#b45353` | `#ec9a9a` | Errors, destructive actions        |

**Deviation from the prompt palette:** the suggested `muted` `#82909a` is 3.1:1 on the background,
below WCAG AA for text, so muted text uses `#5b6872` (5.4:1). `#72948e` (3.1:1) is kept for
decoration only. Input borders use `border-strong` (3.3:1) because WCAG 1.4.11 needs 3:1 for
control boundaries; `#e6ebed` is too faint for that.

Checked contrast (light, on `background` / `surface`): foreground 13.7 / 14.5, muted 5.4 / 5.7,
primary 8.8 / 9.4, success 4.7 / 5.0, warning 4.8 / 5.1, danger 4.6 / 4.9, white on primary 9.4.
Dark: every text token ≥ 7:1 on its surfaces.

## Type, shape, spacing

- System UI font stack (no web fonts: no extra requests, no layout shift). Monospace only for links,
  keys and code.
- Radii: controls `0.5rem`, panels `0.875rem`. One soft shadow, used only on panels that sit above
  the page (settings panel, cards, dialog).
- Layout widths: reading pages `max-w-2xl`, creation `max-w-6xl` with a 22rem settings column from
  `lg`. Below `lg` everything stacks in reading order (editor, then settings).
- Touch targets ≥ 44 px for primary actions (e2e-checked on a Pixel 7 viewport).
- Motion: color transitions only; the only animation is the loading spinner/skeleton.
  `prefers-reduced-motion` turns transitions off.

## Components

`apps/web/src/lib/components/`

| Folder      | Components                                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `layout/`   | `AppHeader`, `AppFooter`, `PageContainer`, `Prose`, `Logo`                                                                                        |
| `ui/`       | `Button`, `LinkButton`, `Field`, `Input`, `Textarea`, `SegmentedControl`, `Switch`, `Dialog`, `Alert`, `Badge`, `Spinner`, `CopyField`, `Toaster` |
| `notes/`    | `NoteEditor`, `NoteSettings`, `NoteShareResult`, `NoteInterstitial`, `NoteViewer`, `MarkdownView` (+ blocks/inline)                               |
| `security/` | `SecurityNotice`, `ExpirationStatus`, `TurnstileWidget`                                                                                           |

Business logic lives in `lib/services/` (API client, notes, config, fragment, Turnstile, clipboard);
components only render and forward events.

Accessibility choices:

- Native elements first: radio groups for segmented controls, `role="switch"` checkbox, modal
  `<dialog>` (focus trap and Escape for free), `<details>` for the delete-link disclosure.
- Skip link; one `h1` per page; Markdown headings render one level below the note title.
- Focus moves to the result heading after a note is created. Errors use `role="alert"`, other
  updates `role="status"`.
- Visible focus ring (`primary`, 2 px) on every interactive element.

## Page states

| Page             | States                                                                                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/notes`         | config loading (skeleton), config failed (retry), notes disabled, editing, too long, submitting, Turnstile loading/failed, error, created, deleted                                   |
| `/n/<id>`        | checking, incomplete link, ready (one-time or reusable), opening, opened, expired (live countdown), unavailable, can't decrypt (with "it was deleted" when one-time), failed (retry) |
| `/n/<id>/delete` | incomplete link, confirm, deleting, deleted, nothing to delete                                                                                                                       |
| `/files`         | Coming soon (Phase 2)                                                                                                                                                                |

## Guardrails

- No inline scripts except SvelteKit's hashed bootstrap; no inline styles; no third-party resources
  except Turnstile on `/notes`.
- No `{@html}` anywhere (build test).
- Copy says "end-to-end encrypted, zero-knowledge by design" and is honest about limits; never
  "100% secure".
