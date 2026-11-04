import { devices } from '@playwright/test';
import { createNoteViaUi, expect, test } from './fixtures';

test('the create and read flow fits a phone screen', async ({ page, browser }) => {
  for (const path of ['/', '/notes', '/privacy']) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow, `${path} scrolls sideways`).toBe(false);
  }

  const { shareUrl } = await createNoteViaUi(page, {
    body: 'a very-long-unbroken-token-' + 'x'.repeat(200),
    burnAfterRead: true,
  });
  const context = await browser.newContext({ ...devices['Pixel 7'] });
  const viewer = await context.newPage();
  await viewer.goto(shareUrl);
  const open = viewer.getByRole('button', { name: 'Open and delete note' });
  const box = await open.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44); // comfortable tap target
  await open.click();
  await expect(viewer.getByText(/a very-long-unbroken-token/)).toBeVisible();
  expect(
    await viewer.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
  ).toBe(false);
  await context.close();
});
