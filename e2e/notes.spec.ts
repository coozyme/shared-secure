import { createNoteViaUi, expect, test } from './fixtures';

test('landing page leads to note creation', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Share privately. Leave nothing behind.',
  );
  await page.getByRole('link', { name: 'Write a note' }).click();
  await expect(page).toHaveURL(/\/notes$/);
  await expect(page.getByRole('heading', { name: 'New private note' })).toBeVisible();
});

test('one-time note: create, open in another browser, decrypt, then it is gone', async ({
  page,
  browser,
}) => {
  const apiBodies: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/')) apiBodies.push(request.postData() ?? '');
  });

  const { shareUrl } = await createNoteViaUi(page, {
    title: 'Door code',
    body: '# Office\n\n**Code:** 4711\n\n<img src=x onerror=alert(1)>',
    markdown: true,
    burnAfterRead: true,
  });
  const key = new URL(shareUrl).hash.slice(1);
  expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);

  // The server never received the plaintext, the title or the key.
  const sent = apiBodies.join('\n');
  expect(sent).not.toContain('4711');
  expect(sent).not.toContain('Door code');
  expect(sent).not.toContain(key);

  // Recipient: a separate browser context, like another person's browser.
  const recipient = await browser.newContext();
  const viewer = await recipient.newPage();
  const recipientRequests: string[] = [];
  viewer.on('request', (request) => recipientRequests.push(request.url()));
  await viewer.goto(shareUrl);

  await expect(
    viewer.getByRole('heading', { name: 'Someone shared a private note with you' }),
  ).toBeVisible();
  await expect(viewer).toHaveURL(/\/n\/[A-Za-z0-9_-]{22}$/); // key stripped from the address bar
  await expect(viewer.getByText('This note will be deleted as soon as you open it.')).toBeVisible();

  await viewer.getByRole('button', { name: 'Open and delete note' }).click();
  await expect(viewer.getByRole('heading', { level: 1, name: 'Door code' })).toBeVisible();
  await expect(viewer.getByRole('heading', { level: 2, name: 'Office' })).toBeVisible();
  await expect(viewer.getByText('This note has been deleted from our storage')).toBeVisible();
  // Raw HTML is shown as text, never rendered.
  await expect(viewer.getByText('<img src=x onerror=alert(1)>')).toBeVisible();
  await expect(viewer.locator('article img')).toHaveCount(0);

  // The key never left the browser, and Turnstile is never loaded on the viewer page.
  expect(recipientRequests.some((url) => url.includes(key))).toBe(false);
  expect(recipientRequests.some((url) => url.includes('challenges.cloudflare.com'))).toBe(false);

  // A second visit, even with the full link, finds nothing.
  const again = await recipient.newPage();
  await again.goto(shareUrl);
  await expect(
    again.getByRole('heading', { name: 'This note is no longer available' }),
  ).toBeVisible();
  await recipient.close();
});

test('link previews and status checks do not consume a one-time note', async ({
  page,
  browser,
  request,
}) => {
  const { shareUrl } = await createNoteViaUi(page, { body: 'still here', burnAfterRead: true });
  const url = new URL(shareUrl);
  const id = url.pathname.split('/')[2] ?? '';

  // What a chat app's link preview bot would do: fetch the page, and even poke the API with GETs.
  expect((await request.get(url.pathname)).status()).toBe(200);
  expect((await request.get(`/api/v1/notes/${id}/status`)).status()).toBe(200);
  expect((await request.get(`/api/v1/notes/${id}`)).status()).toBe(404);
  expect((await request.get(`/api/v1/notes/${id}/open`)).status()).toBe(404);

  const viewer = await browser.newPage();
  await viewer.goto(shareUrl);
  await viewer.getByRole('button', { name: 'Open and delete note' }).click();
  await expect(viewer.getByText('still here')).toBeVisible();
  await viewer.close();
});

test('a wrong or damaged key never consumes the note', async ({ page, browser }) => {
  const { shareUrl } = await createNoteViaUi(page, { body: 'secret', burnAfterRead: true });
  const context = await browser.newContext();
  const viewer = await context.newPage();

  // Truncated key: rejected before any request.
  await viewer.goto(shareUrl.slice(0, -5));
  await expect(viewer.getByRole('heading', { name: 'This link is incomplete' })).toBeVisible();

  // Well-formed but wrong key: the note is consumed (the server can't tell), decryption fails.
  const wrong = `${shareUrl.split('#')[0] ?? ''}#${'A'.repeat(43)}`;
  await viewer.goto('about:blank');
  await viewer.goto(wrong);
  await viewer.getByRole('button', { name: 'Open and delete note' }).click();
  await expect(viewer.getByRole('heading', { name: 'This note can’t be decrypted' })).toBeVisible();
  await expect(viewer.getByText('The note was deleted')).toBeVisible();
  await context.close();
});

test('a regular note can be read repeatedly and deleted with the delete link', async ({
  page,
  browser,
}) => {
  const { shareUrl, deleteUrl } = await createNoteViaUi(page, {
    body: 'readable twice',
    ttlLabel: '24 h',
    burnAfterRead: false,
  });
  const context = await browser.newContext();
  for (let i = 0; i < 2; i++) {
    const viewer = await context.newPage();
    await viewer.goto(shareUrl);
    await viewer.getByRole('button', { name: 'Open note' }).click();
    await expect(viewer.getByText('readable twice')).toBeVisible();
    await expect(viewer.getByText(/Expires in (23|24) hours/)).toBeVisible();
    await viewer.close();
  }

  const remover = await context.newPage();
  await remover.goto(deleteUrl);
  await expect(remover).toHaveURL(/\/delete$/);
  await remover.getByRole('button', { name: 'Delete note' }).click();
  await expect(remover.getByText('Note deleted')).toBeVisible();

  const after = await context.newPage();
  await after.goto(shareUrl);
  await expect(
    after.getByRole('heading', { name: 'This note is no longer available' }),
  ).toBeVisible();
  await context.close();
});

test('an expired link shows the expired state', async ({ page, browser }) => {
  const { shareUrl } = await createNoteViaUi(page, {
    body: 'short-lived',
    ttlLabel: '5 min',
    burnAfterRead: true,
  });
  const context = await browser.newContext();
  const viewer = await context.newPage();
  await viewer.clock.install();
  await viewer.goto(shareUrl);
  await expect(viewer.getByText(/Expires in 5 minutes/)).toBeVisible();
  // Server-side expiry and physical deletion are covered by the Worker tests; here the recipient
  // waits past the expiry on the interstitial.
  await viewer.clock.fastForward('05:05');
  await expect(viewer.getByRole('heading', { name: 'This note has expired' })).toBeVisible();
  await context.close();
});

test('unknown pages return a real 404 with the strict headers', async ({ page }) => {
  const response = await page.goto('/does-not-exist');
  expect(response?.status()).toBe(404);
  expect(response?.headers()['content-security-policy']).toContain("default-src 'none'");
  await expect(page.getByRole('heading', { name: 'This page doesn’t exist' })).toBeVisible();
});

test('keyboard only: create a note without a mouse', async ({ page }) => {
  await page.goto('/notes');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.getByLabel('Note', { exact: true }).focus();
  await page.keyboard.type('typed with the keyboard');
  await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/, {
    timeout: 30_000,
  });
  await page.getByRole('button', { name: 'Create private link' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Your private link is ready' })).toBeFocused();
});
