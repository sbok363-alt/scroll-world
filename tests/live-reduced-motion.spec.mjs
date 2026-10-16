import { test, expect } from '@playwright/test';

const fixture = '/tests/fixtures/cinematic-page.html';

async function installDeterministicViewportMedia(page, { deferPlay = false } = {}) {
  await page.addInitScript(({ deferPlay }) => {
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

    window.__cwDeferPlay = deferPlay;
    window.__cwPendingPlays = [];
    HTMLMediaElement.prototype.load = function () {};
    HTMLMediaElement.prototype.play = function () {
      this.__cwPlayCalls = (this.__cwPlayCalls ?? 0) + 1;
      if (window.__cwDeferPlay) {
        return new Promise((resolve, reject) => {
          window.__cwPendingPlays.push({
            video: this,
            resolve: () => {
              this.__cwPlaying = true;
              queueMicrotask(() => {
                this.dispatchEvent(new Event('loadeddata'));
                this.dispatchEvent(new Event('playing'));
              });
              resolve();
            },
            reject
          });
        });
      }
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
  }, { deferPlay });
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
    return { playing: video.__cwPlaying === true, hasFrame: media.classList.contains('cw-has-frame') };
  });
  expect(before.playing).toBe(true);
  expect(before.hasFrame).toBe(true);

  await page.emulateMedia({ reducedMotion: 'reduce' });

  await expect.poll(() => page.evaluate(() => {
    const media = document.querySelector('[data-cw-kind="video"] [data-cw-media]');
    const video = media.querySelector('video');
    return {
      playing: video.__cwPlaying === true,
      pausedAtLeastOnce: (video.__cwPauseCalls ?? 0) > 0,
      hasFrame: media.classList.contains('cw-has-frame')
    };
  })).toEqual({ playing: false, pausedAtLeastOnce: true, hasFrame: false });
});

test('mounting with reduced motion keeps the listener and reconsiders prefetched media when it turns off', async ({ page }) => {
  await installDeterministicViewportMedia(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(fixture);

  await page.evaluate(async () => {
    const { mountCinematicWeb } = await import('/skills/cinematic-web/references/cinematic-engine.js');
    mountCinematicWeb(document);
    const media = document.querySelector('[data-cw-kind="video"] [data-cw-media]');
    window.__cwTrigger(media, 0.9, 'prefetch');
    window.__cwTrigger(media, 0.1, 'play');
  });

  const reducedState = await page.evaluate(() => {
    const video = document.querySelector('[data-cw-kind="video"] video');
    return { hasSource: video.hasAttribute('src'), playCalls: video.__cwPlayCalls ?? 0 };
  });
  expect(reducedState).toEqual({ hasSource: false, playCalls: 0 });

  await page.emulateMedia({ reducedMotion: 'no-preference' });

  await expect.poll(() => page.evaluate(() => {
    const video = document.querySelector('[data-cw-kind="video"] video');
    return { hasSource: video.hasAttribute('src'), preload: video.preload, playCalls: video.__cwPlayCalls ?? 0 };
  })).toEqual({ hasSource: true, preload: 'metadata', playCalls: 0 });

  await page.evaluate(() => {
    const media = document.querySelector('[data-cw-kind="video"] [data-cw-media]');
    window.__cwTrigger(media, 0.9, 'play');
  });
  await expect.poll(() => page.evaluate(() => document.querySelector('[data-cw-kind="video"] video').__cwPlayCalls ?? 0)).toBe(1);
});

test('a stale play rejection cannot clear a newer activation of the same video', async ({ page }) => {
  await installDeterministicViewportMedia(page, { deferPlay: true });
  await page.goto(fixture);

  await page.evaluate(async () => {
    const { mountCinematicWeb } = await import('/skills/cinematic-web/references/cinematic-engine.js');
    mountCinematicWeb(document);
    const media = document.querySelector('[data-cw-kind="video"] [data-cw-media]');
    window.__cwTrigger(media, 0.9, 'prefetch');
    window.__cwTrigger(media, 0.9, 'play');
  });

  await expect.poll(() => page.evaluate(() => window.__cwPendingPlays.length)).toBe(1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect.poll(() => page.evaluate(() => window.__cwPendingPlays.length)).toBe(2);

  await page.evaluate(() => window.__cwPendingPlays[0].reject(new Error('stale play rejection')));
  await page.evaluate(() => window.__cwPendingPlays[1].resolve());

  await expect.poll(() => page.evaluate(() => {
    const media = document.querySelector('[data-cw-kind="video"] [data-cw-media]');
    const video = media.querySelector('video');
    return {
      playing: video.__cwPlaying === true,
      hasFrame: media.classList.contains('cw-has-frame'),
      playCalls: video.__cwPlayCalls
    };
  })).toEqual({ playing: true, hasFrame: true, playCalls: 2 });
});
