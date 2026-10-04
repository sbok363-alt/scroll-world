import { test, expect } from '@playwright/test';

const fixture = '/tests/fixtures/cinematic-page.html';

test('semantic content remains usable with JavaScript disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(fixture);

  await expect(page.locator('h1')).toContainText('Cinematic pages');
  await expect(page.locator('[data-test="primary-cta"]')).toBeVisible();
  await expect(page.locator('[data-cw-poster]').first()).toBeVisible();
  await expect(page.locator('[data-test="semantic-copy"]')).toBeVisible();

  await context.close();
});

test('mount is idempotent and does not change natural section height', async ({ page }) => {
  await page.goto(fixture);
  const section = page.locator('[data-test="natural-section"]');
  const before = await section.evaluate(el => el.getBoundingClientRect().height);

  const result = await page.evaluate(async () => {
    const { mountCinematicWeb } = await import('/skills/cinematic-web/references/cinematic-engine.js');
    const first = mountCinematicWeb(document);
    const second = mountCinematicWeb(document);
    return {
      sameController: first === second,
      mounted: document.documentElement.hasAttribute('data-cw-mounted')
    };
  });

  const after = await section.evaluate(el => el.getBoundingClientRect().height);
  expect(result.sameController).toBe(true);
  expect(result.mounted).toBe(true);
  expect(Math.abs(after - before)).toBeLessThanOrEqual(1);
});

test('media frame reserves its geometry through poster to video takeover', async ({ page }) => {
  await page.goto(fixture);
  const media = page.locator('[data-cw-media]').first();
  const ratio = await media.evaluate(el => getComputedStyle(el).aspectRatio);
  expect(ratio).not.toBe('auto');

  const before = await media.boundingBox();
  await media.evaluate(el => el.classList.add('cw-has-frame'));
  const after = await media.boundingBox();

  expect(before).not.toBeNull();
  expect(after).not.toBeNull();
  expect(Math.abs(after.height - before.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.width - before.width)).toBeLessThanOrEqual(1);
});
