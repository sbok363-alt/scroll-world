import { test, expect } from '@playwright/test';

const fixture = '/tests/fixtures/cinematic-page.html';

test('diagnose viewport resize delivery for scrub geometry', async ({ page, browserName }) => {
  await page.addInitScript(() => {
    class FakeIntersectionObserver {
      observe() {}
      disconnect() {}
    }
    window.IntersectionObserver = FakeIntersectionObserver;
    window.__resizeTrace = [];
    window.addEventListener('resize', () => {
      window.__resizeTrace.push({ width: window.innerWidth, height: window.innerHeight, at: performance.now() });
    });
  });

  await page.setViewportSize({ width: 1000, height: 700 });
  await page.goto(fixture);
  await page.evaluate(async () => {
    const { mountCinematicWeb } = await import('/skills/cinematic-web/references/cinematic-engine.js');
    mountCinematicWeb(document);
  });

  await page.setViewportSize({ width: 1000, height: 600 });
  await page.waitForTimeout(30);
  await page.setViewportSize({ width: 900, height: 600 });
  await page.waitForTimeout(30);

  const data = await page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
    trace: window.__resizeTrace,
    scrubHeight: document.querySelector('[data-cw-kind="scrub"]').style.getPropertyValue('--cw-scrub-height')
  }));

  console.log(`RESIZE_DIAGNOSTIC ${browserName} ${JSON.stringify(data)}`);
  expect(data.width).toBe(900);
  expect(data.height).toBe(600);
  expect(data.trace.length).toBeGreaterThanOrEqual(1);
});
