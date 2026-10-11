import { test, expect } from '@playwright/test';

const fixture = '/tests/fixtures/cinematic-page.html';

async function installDeterministicViewportMedia(page) {
  await page.addInitScript(() => {
    const observers = [];
    class FakeIntersectionObserver {
      constructor(callback, options = {}) {
        this.callback = callback;
        this.options = options;
        this.targets = new Set();
        observers.push(this);
      }
      observe(target) { this.targets.add(target); }
      unobserve(target) { this.targets.delete(target); }
      disconnect() { this.targets.clear(); }
    }
    window.IntersectionObserver = FakeIntersectionObserver;
    window.__cwTrigger = (target, ratio, kind = 'all') => {
      for (const observer of observers) {
        if (!observer.targets.has(target)) continue;
        const isPrefetch = observer.options.rootMargin === '100% 0px';
        if (kind === 'prefetch' && !isPrefetch) continue;
        if (kind === 'play' && isPrefetch) continue;
        observer.callback([{ target, intersectionRatio: ratio, isIntersecting: ratio > 0 }], observer);
      }
    };

    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: { saveData: false }
    });

    HTMLMediaElement.prototype.load = function () {};
    HTMLMediaElement.prototype.play = function () {
      this.__cwPlayCalls = (this.__cwPlayCalls ?? 0) + 1;
      this.__cwPlaying = true;
      queueMicrotask(() => {
        this.dispatchEvent(new Event('loadeddata'));
        this.dispatchEvent(new Event('playing'));
      });
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function () {
      this.__cwPauseCalls = (this.__cwPauseCalls ?? 0) + 1;
      this.__cwPlaying = false;
    };
    HTMLVideoElement.prototype.requestVideoFrameCallback = function (callback) {
      queueMicrotask(() => callback(performance.now(), {}));
      return 1;
    };
  });
}

test('switching reduced motion on stops active viewport video and restores its poster', async ({ page }) => {
  await installDeterministicViewportMedia(page);
  await page.goto(fixture);

  await page.evaluate(async () => {
    const { mountCinematicWeb } = await import('/skills/cinematic-web/references/cinematic-engine.js');
    mountCinematicWeb(document);
    const media = document.querySelector('[data-cw-kind="video"] [data-cw-media]');
    window.__cwTrigger(media, 0.9, 'prefetch');
    window.__cwTrigger(media, 0.9, 'play');
    await Promise.resolve();
    await Promise.resolve();
  });

  const before = await page.evaluate(() => {
    const media = document.querySelector('[data-cw-kind="video"] [data-cw-media]');
    const video = media.querySelector('video');
    return {
      playing: video.__cwPlaying === true,
      hasFrame: media.classList.contains('cw-has-frame')
    };
  });
  expect(before.playing).toBe(true);
  expect(before.hasFrame).toBe(true);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(50);

  const after = await page.evaluate(() => {
    const media = document.querySelector('[data-cw-kind="video"] [data-cw-media]');
    const video = media.querySelector('video');
    return {
      playing: video.__cwPlaying === true,
      pauses: video.__cwPauseCalls ?? 0,
      hasFrame: media.classList.contains('cw-has-frame')
    };
  });

  expect(after.playing).toBe(false);
  expect(after.pauses).toBeGreaterThan(0);
  expect(after.hasFrame).toBe(false);
});
