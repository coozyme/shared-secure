import { test as base, expect, type Page } from '@playwright/test';

export interface Violation {
  readonly directive: string;
  readonly blocked: string;
  readonly source: string;
}

declare global {
  interface Window {
    __cspViolations?: Violation[];
  }
}

/**
 * The one known, harmless violation. Anything else fails the test.
 * SvelteKit's route announcer is created with a `style` attribute, which our CSP blocks (app.css
 * hides the element anyway, ADR 0009).
 */
function isExpected(v: Violation): boolean {
  return v.directive === 'style-src-attr' && v.blocked === 'inline';
}

export const test = base.extend<{ cspGuard: undefined }>({
  cspGuard: [
    async ({ context }, use) => {
      await context.addInitScript(() => {
        window.__cspViolations = [];
        document.addEventListener('securitypolicyviolation', (event) => {
          window.__cspViolations?.push({
            directive: event.effectiveDirective,
            blocked: event.blockedURI,
            source: event.sourceFile,
          });
        });
      });
      await use(undefined);
      for (const page of context.pages()) {
        if (page.isClosed() || page.url() === 'about:blank') continue;
        const violations = await page.evaluate(() => window.__cspViolations ?? []);
        expect(
          violations.filter((v) => !isExpected(v)),
          `CSP violations on ${page.url()}`,
        ).toEqual([]);
      }
    },
    { auto: true },
  ],
});

export { expect };

async function choose(page: Page, label: string): Promise<void> {
  const radio = page.getByRole('radio', { name: label, exact: true });
  await page.locator('label').filter({ has: radio }).click();
  await expect(radio).toBeChecked();
}

/** Waits until Turnstile (test keys) has issued a token into the form. */
export async function waitForTurnstile(page: Page): Promise<void> {
  await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/, {
    timeout: 30_000,
  });
}

export interface NoteOptions {
  readonly title?: string;
  readonly body: string;
  readonly markdown?: boolean;
  readonly ttlLabel?: string;
  readonly burnAfterRead: boolean;
}

/** Creates a note through the UI and returns the share link and delete link. */
export async function createNoteViaUi(
  page: Page,
  options: NoteOptions,
): Promise<{ shareUrl: string; deleteUrl: string }> {
  await page.goto('/notes');
  if (options.title !== undefined) await page.getByLabel('Title').fill(options.title);
  await page.getByLabel('Note', { exact: true }).fill(options.body);
  // The radio inputs are visually hidden; people click their labels, so the test does too.
  if (options.markdown === true) await choose(page, 'Markdown');
  if (options.ttlLabel !== undefined) await choose(page, options.ttlLabel);
  const burn = page.getByRole('switch', { name: 'Delete after first read' });
  if ((await burn.isChecked()) !== options.burnAfterRead) await burn.click();
  await waitForTurnstile(page);
  await page.getByRole('button', { name: 'Create private link' }).click();
  await expect(page.getByRole('heading', { name: 'Your private link is ready' })).toBeFocused();
  const shareUrl = await page.getByLabel('Private sharing link').inputValue();
  await page.getByText('Delete this note later').click();
  const deleteUrl = await page.getByLabel('Private delete link').inputValue();
  return { shareUrl, deleteUrl };
}
