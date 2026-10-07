import { test, expect } from '@playwright/test';

const fixture = '/tests/fixtures/cinematic-page.html';

async function installLifecycleHarness(page) {
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
      disconnect() { this.targets.clear(); this.disconnected = true; }
    }
    window.IntersectionObserver = FakeIntersectionObserver;
    window.__cwTrigger = (target, ratio, kind = 'all') => {
      for (const observer of observers) {
        if (!observer.targets.has(target)) continue;
        const prefetch = observer.options.rootMargin === '100% 0px';
        if (kind === 'prefetch' && !prefetch) continue;
        if (kind === 'play' && prefetch) continue;
        observer.callback([{ target, isIntersecting: ratio > 0, intersectionRatio: ratio }], observer);
      }
    };
    window.__cwObserverCount = () => observers.length;
    window.__cwUnhandled = [];
    window.addEventListener('unhandledrejection', event => {
      window.__cwUnhandled.push(String(event.reason));
      event.preventDefault();
    });

    Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: false } });
    window.__cwRevokes = 0;
    window.fetch = async () => new Response(new Blob(['scrub-video']), { status: 200 });
    URL.createObjectURL = () => 'blob:mobile-lifecycle';
    URL.revokeObjectURL = () => { window.__cwRevokes += 1; };

    HTMLMediaElement.prototype.load = function () {
      this.__cwLoadCalls = (this.__cwLoadCalls ?? 0) + 1;
    };
    HTMLMediaElement.prototype.play = function () {
      this.__cwPlayCalls = (this.__cwPlayCalls ?? 0) + 1;
      this.__cwPlaying = true;
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

test('phone viewport chooses mobile video source and falls back to desktop when absent', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installLifecycleHarness(page);
  await page.goto(fixture);

  const result = await page.evaluate(async () => {
    const first = document.querySelector('[data-cw-kind="video"]');
    const firstVideo = first.querySelector('[data-cw-video]');
    firstVideo.dataset.srcMobile = '/media/mobile.mp4';
    firstVideo.dataset.src = '/media/desktop.mp4';

    const fallback = first.cloneNode(true);
    fallback.dataset.test = 'fallback-video';
    const fallbackVideo = fallback.querySelector('[data-cw-video]');
    fallbackVideo.removeAttribute('data-src-mobile');
    fallbackVideo.dataset.src = '/media/fallback-desktop.mp4';
    first.after(fallback);

    const { mountCinematicWeb } = await import('/skills/cinematic-web/references/cinematic-engine.js');
    mountCinematicWeb(document);

    const firstMedia = first.querySelector('[data-cw-media]');
    const fallbackMedia = fallback.querySelector('[data-cw-media]');
    window.__cwTrigger(firstMedia, 0.1, 'prefetch');
    window.__cwTrigger(fallbackMedia, 0.1, 'prefetch');

    return {
      mobile: firstVideo.getAttribute('src'),
      fallback: fallbackVideo.getAttribute('src'),
      muted: firstVideo.muted,
      inline: firstVideo.playsInline,
      controls: firstVideo.controls
    };
  });

  expect(result.mobile).toBe('/media/mobile.mp4');
  expect(result.fallback).toBe('/media/fallback-desktop.mp4');
  expect(result.muted).toBe(true);
  expect(result.inline).toBe(true);
  expect(result.controls).toBe(false);
});

test('mobile keeps semantic copy before media and CTA reachable before media playback', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(fixture);

  const order = await page.evaluate(() => {
    const section = document.querySelector('[data-cw-kind="video"]');
    const children = [...section.children];
    return {
      copyIndex: children.findIndex(child => child.classList.contains('cw-copy')),
      mediaIndex: children.findIndex(child => child.hasAttribute('data-cw-media')),
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });

  expect(order.copyIndex).toBeGreaterThanOrEqual(0);
  expect(order.copyIndex).toBeLessThan(order.mediaIndex);
  expect(order.overflowX).toBeLessThanOrEqual(1);
  await expect(page.locator('[data-test="primary-cta"]')).toBeVisible();
  await expect(page.locator('[data-test="semantic-copy"]')).toBeVisible();
});

test('stylesheet exposes approved layouts, safe-area padding, and reduced-motion fallback', async ({ page }) => {
  await page.goto(fixture);
  const css = await page.evaluate(async () => (await fetch('/skills/cinematic-web/references/cinematic.css')).text());

  expect(css).toMatch(/safe-area-inset-bottom/);
  expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
  expect(css).toMatch(/cw-layout--full-bleed/);
  expect(css).toMatch(/cw-layout--split/);
  expect(css).toMatch(/cw-layout--device/);
  expect(css).toMatch(/data-cw-kind=["']cards["']/);
  expect(css).toMatch(/data-cw-kind=["']cta["']/);
  expect(css).not.toMatch(/particle/i);
});

test('mount is idempotent; destroy pauses playback, revokes scrub URLs, and permits a clean remount', async ({ page }) => {
  await installLifecycleHarness(page);
  await page.goto(fixture);

  const result = await page.evaluate(async () => {
    const { mountCinematicWeb } = await import('/skills/cinematic-web/references/cinematic-engine.js');
    const first = mountCinematicWeb(document);
    const second = mountCinematicWeb(document);

    const media = document.querySelector('[data-cw-kind="video"] [data-cw-media]');
    const video = media.querySelector('[data-cw-video]');
    const scrub = document.querySelector('[data-cw-kind="scrub"]');
    window.__cwTrigger(media, 0.2, 'prefetch');
    window.__cwTrigger(media, 0.8, 'play');
    window.__cwTrigger(scrub, 1, 'prefetch');
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));

    const observersAfterDoubleMount = window.__cwObserverCount();
    const playsBeforeDestroy = video.__cwPlayCalls ?? 0;
    first.destroy();
    const pausesAfterDestroy = video.__cwPauseCalls ?? 0;
    const revokesAfterDestroy = window.__cwRevokes;
    first.destroy();

    const third = mountCinematicWeb(document);
    return {
      sameFirstTwo: first === second,
      thirdIsNew: third !== first,
      observersAfterDoubleMount,
      playsBeforeDestroy,
      pausesAfterDestroy,
      revokesAfterDestroy
    };
  });

  expect(result.sameFirstTwo).toBe(true);
  expect(result.thirdIsNew).toBe(true);
  expect(result.observersAfterDoubleMount).toBe(4);
  expect(result.playsBeforeDestroy).toBe(1);
  expect(result.pausesAfterDestroy).toBeGreaterThan(0);
  expect(result.revokesAfterDestroy).toBe(1);
});

test('visibility hide pauses active video and showing the tab reevaluates without unhandled rejections', async ({ page }) => {
  await installLifecycleHarness(page);
  await page.goto(fixture);

  const result = await page.evaluate(async () => {
    let hidden = false;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });

    const { mountCinematicWeb } = await import('/skills/cinematic-web/references/cinematic-engine.js');
    mountCinematicWeb(document);
    const media = document.querySelector('[data-cw-kind="video"] [data-cw-media]');
    const video = media.querySelector('[data-cw-video]');
    window.__cwTrigger(media, 0.2, 'prefetch');
    window.__cwTrigger(media, 0.8, 'play');
    await Promise.resolve();

    hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    const pausesHidden = video.__cwPauseCalls ?? 0;

    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve();
    await Promise.resolve();

    return {
      pausesHidden,
      playsAfterShow: video.__cwPlayCalls ?? 0,
      unhandled: window.__cwUnhandled
    };
  });

  expect(result.pausesHidden).toBeGreaterThan(0);
  expect(result.playsAfterShow).toBeGreaterThanOrEqual(2);
  expect(result.unhandled).toEqual([]);
});
