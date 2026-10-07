import { test, expect } from '@playwright/test';

const fixture = '/tests/fixtures/cinematic-page.html';

async function installHarness(page) {
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
    window.__cwTriggerRace = (target, ratio, kind = 'play') => {
      for (const observer of observers) {
        if (!observer.targets.has(target)) continue;
        const prefetch = observer.options.rootMargin === '100% 0px';
        if (kind === 'prefetch' && !prefetch) continue;
        if (kind === 'play' && prefetch) continue;
        observer.callback([{ target, intersectionRatio: ratio, isIntersecting: ratio > 0 }], observer);
      }
    };

    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: { saveData: false }
    });

    HTMLMediaElement.prototype.load = function () {};
    HTMLMediaElement.prototype.pause = function () {
      this.__cwPlaying = false;
      this.__cwPauseCalls = (this.__cwPauseCalls ?? 0) + 1;
    };
    HTMLMediaElement.prototype.play = function () {
      this.__cwPlayCalls = (this.__cwPlayCalls ?? 0) + 1;
      this.__cwPlaying = true;
      return Promise.resolve();
    };
  });
}

test('a superseded delayed play cannot revive the old viewport video', async ({ page }) => {
  await installHarness(page);
  await page.goto(fixture);

  const result = await page.evaluate(async () => {
    const firstSection = document.querySelector('[data-cw-kind="video"]');
    const firstMedia = firstSection.querySelector('[data-cw-media]');
    const firstVideo = firstMedia.querySelector('[data-cw-video]');

    const secondSection = firstSection.cloneNode(true);
    const secondMedia = secondSection.querySelector('[data-cw-media]');
    const secondVideo = secondMedia.querySelector('[data-cw-video]');
    firstSection.after(secondSection);

    let releaseFirstPlay;
    firstVideo.play = function () {
      this.__cwPlayCalls = (this.__cwPlayCalls ?? 0) + 1;
      return new Promise(resolve => {
        releaseFirstPlay = () => {
          this.__cwPlaying = true;
          resolve();
        };
      });
    };

    const { mountCinematicWeb } = await import('/skills/cinematic-web/references/cinematic-engine.js');
    mountCinematicWeb(document);

    window.__cwTriggerRace(firstMedia, 0.8, 'prefetch');
    window.__cwTriggerRace(secondMedia, 0.95, 'prefetch');
    window.__cwTriggerRace(firstMedia, 0.8, 'play');
    await Promise.resolve();

    window.__cwTriggerRace(secondMedia, 0.95, 'play');
    await Promise.resolve();
    await Promise.resolve();

    const beforeRelease = {
      firstPlaying: firstVideo.__cwPlaying === true,
      secondPlaying: secondVideo.__cwPlaying === true,
      firstPauseCalls: firstVideo.__cwPauseCalls ?? 0
    };

    releaseFirstPlay();
    await Promise.resolve();
    await Promise.resolve();

    return {
      beforeRelease,
      firstPlayingAfterRelease: firstVideo.__cwPlaying === true,
      secondPlayingAfterRelease: secondVideo.__cwPlaying === true
    };
  });

  expect(result.beforeRelease.firstPlaying).toBe(false);
  expect(result.beforeRelease.secondPlaying).toBe(true);
  expect(result.beforeRelease.firstPauseCalls).toBeGreaterThan(0);
  expect(result.firstPlayingAfterRelease).toBe(false);
  expect(result.secondPlayingAfterRelease).toBe(true);
});
