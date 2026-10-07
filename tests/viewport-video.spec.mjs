import { test, expect } from '@playwright/test';

const fixture = '/tests/fixtures/cinematic-page.html';

async function installDeterministicMedia(page, { saveData = false } = {}) {
  await page.addInitScript(({ saveData }) => {
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
    window.__cwObserved = () => observers.map(observer => ({
      rootMargin: observer.options.rootMargin ?? '0px',
      targets: [...observer.targets].map(el => el.getAttribute('data-cw-media') !== null ? 'media' : el.tagName)
    }));

    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: { saveData }
    });

    const time = new WeakMap();
    Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
      configurable: true,
      get() { return time.get(this) ?? 0; },
      set(value) {
        this.__cwTimeWrites = (this.__cwTimeWrites ?? 0) + 1;
        time.set(this, value);
      }
    });
    HTMLMediaElement.prototype.load = function () {
      this.__cwLoadCalls = (this.__cwLoadCalls ?? 0) + 1;
    };
    HTMLMediaElement.prototype.play = function () {
      this.__cwPlayCalls = (this.__cwPlayCalls ?? 0) + 1;
      if (this.dataset.rejectPlay === 'true') return Promise.reject(new DOMException('blocked', 'NotAllowedError'));
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
  }, { saveData });
}

async function mount(page) {
  return page.evaluate(async () => {
    const { mountCinematicWeb } = await import('/skills/cinematic-web/references/cinematic-engine.js');
    mountCinematicWeb(document);
    return true;
  });
}

test('prefetches metadata, then plays muted inline at the entry threshold and pauses below exit threshold', async ({ page }) => {
  await installDeterministicMedia(page);
  await page.goto(fixture);
  await mount(page);

  const state = await page.evaluate(async () => {
    const media = document.querySelector('[data-cw-kind="video"] [data-cw-media]');
    const video = media.querySelector('[data-cw-video]');
    const before = { src: video.getAttribute('src'), preload: video.preload };

    window.__cwTrigger(media, 0.01, 'prefetch');
    const prefetched = { src: video.getAttribute('src'), preload: video.preload, loads: video.__cwLoadCalls ?? 0 };

    window.__cwTrigger(media, 0.60, 'play');
    await Promise.resolve();
    await Promise.resolve();
    const playing = {
      calls: video.__cwPlayCalls ?? 0,
      preload: video.preload,
      muted: video.muted,
      inline: video.playsInline,
      controls: video.controls,
      hasFrame: media.classList.contains('cw-has-frame')
    };

    window.__cwTrigger(media, 0.10, 'play');
    const paused = video.__cwPauseCalls ?? 0;
    window.dispatchEvent(new Event('scroll'));

    return { before, prefetched, playing, paused, timeWrites: video.__cwTimeWrites ?? 0 };
  });

  expect(state.before.src).toBeNull();
  expect(state.prefetched.src).toBe('/tests/fixtures/media/tiny.mp4');
  expect(state.prefetched.preload).toBe('metadata');
  expect(state.prefetched.loads).toBeGreaterThan(0);
  expect(state.playing.calls).toBeGreaterThan(0);
  expect(state.playing.preload).toBe('auto');
  expect(state.playing.muted).toBe(true);
  expect(state.playing.inline).toBe(true);
  expect(state.playing.controls).toBe(false);
  expect(state.playing.hasFrame).toBe(true);
  expect(state.paused).toBeGreaterThan(0);
  expect(state.timeWrites).toBe(0);
});

test('uses media-frame observation and stable hysteresis so overlapping videos do not thrash', async ({ page }) => {
  await installDeterministicMedia(page);
  await page.goto(fixture);
  const result = await page.evaluate(async () => {
    const firstSection = document.querySelector('[data-cw-kind="video"]');
    firstSection.style.minHeight = '250vh';
    const firstMedia = firstSection.querySelector('[data-cw-media]');
    firstMedia.style.height = '100vh';

    const second = firstSection.cloneNode(true);
    second.dataset.test = 'second-video';
    const secondVideo = second.querySelector('[data-cw-video]');
    secondVideo.removeAttribute('src');
    secondVideo.__cwPlayCalls = 0;
    firstSection.after(second);

    const { mountCinematicWeb } = await import('/skills/cinematic-web/references/cinematic-engine.js');
    mountCinematicWeb(document);

    const secondMedia = second.querySelector('[data-cw-media]');
    window.__cwTrigger(firstMedia, 0.7, 'prefetch');
    window.__cwTrigger(secondMedia, 0.9, 'prefetch');
    window.__cwTrigger(firstMedia, 0.7, 'play');
    await Promise.resolve();
    window.__cwTrigger(secondMedia, 0.55, 'play');
    await Promise.resolve();

    const beforeChallenge = {
      firstPlaying: firstMedia.querySelector('video').__cwPlaying === true,
      secondPlaying: secondVideo.__cwPlaying === true,
      observed: window.__cwObserved()
    };

    window.__cwTrigger(secondMedia, 0.9, 'play');
    await Promise.resolve();
    return {
      beforeChallenge,
      firstPlayingAfter: firstMedia.querySelector('video').__cwPlaying === true,
      secondPlayingAfter: secondVideo.__cwPlaying === true,
      firstPauseCalls: firstMedia.querySelector('video').__cwPauseCalls ?? 0
    };
  });

  expect(result.beforeChallenge.observed.some(o => o.targets.includes('media'))).toBe(true);
  expect(result.beforeChallenge.firstPlaying).toBe(true);
  expect(result.beforeChallenge.secondPlaying).toBe(false);
  expect(result.firstPlayingAfter).toBe(false);
  expect(result.secondPlayingAfter).toBe(true);
  expect(result.firstPauseCalls).toBeGreaterThan(0);
});

test('missing source and rejected autoplay leave poster and CTA usable', async ({ page }) => {
  await installDeterministicMedia(page);
  await page.goto(fixture);
  const result = await page.evaluate(async () => {
    const base = document.querySelector('[data-cw-kind="video"]');
    const missing = base.cloneNode(true);
    const missingVideo = missing.querySelector('video');
    missingVideo.removeAttribute('data-src');
    base.after(missing);

    const rejected = base.cloneNode(true);
    const rejectedVideo = rejected.querySelector('video');
    rejectedVideo.dataset.rejectPlay = 'true';
    missing.after(rejected);

    const { mountCinematicWeb } = await import('/skills/cinematic-web/references/cinematic-engine.js');
    mountCinematicWeb(document);

    const missingMedia = missing.querySelector('[data-cw-media]');
    const rejectedMedia = rejected.querySelector('[data-cw-media]');
    window.__cwTrigger(missingMedia, 0.8, 'prefetch');
    window.__cwTrigger(missingMedia, 0.8, 'play');
    window.__cwTrigger(rejectedMedia, 0.8, 'prefetch');
    window.__cwTrigger(rejectedMedia, 0.95, 'play');
    await Promise.resolve();
    await Promise.resolve();

    return {
      missingSrc: missingVideo.getAttribute('src'),
      missingFrame: missingMedia.classList.contains('cw-has-frame'),
      rejectedFrame: rejectedMedia.classList.contains('cw-has-frame'),
      overlays: document.querySelectorAll('[data-cw-play-overlay]').length
    };
  });

  expect(result.missingSrc).toBeNull();
  expect(result.missingFrame).toBe(false);
  expect(result.rejectedFrame).toBe(false);
  expect(result.overlays).toBe(0);
  await expect(page.locator('[data-test="primary-cta"]')).toBeVisible();
});

test('Save-Data and reduced motion keep viewport media static and unfetched', async ({ browser }) => {
  for (const mode of ['save-data', 'reduced-motion']) {
    const context = await browser.newContext({ reducedMotion: mode === 'reduced-motion' ? 'reduce' : 'no-preference' });
    const page = await context.newPage();
    await installDeterministicMedia(page, { saveData: mode === 'save-data' });
    await page.goto(fixture);
    await mount(page);
    const result = await page.evaluate(() => {
      const media = document.querySelector('[data-cw-kind="video"] [data-cw-media]');
      const video = media.querySelector('video');
      window.__cwTrigger(media, 0.9, 'all');
      return { src: video.getAttribute('src'), plays: video.__cwPlayCalls ?? 0 };
    });
    expect(result.src).toBeNull();
    expect(result.plays).toBe(0);
    await context.close();
  }
});

test('missing IntersectionObserver degrades to static content without throwing', async ({ page }) => {
  await page.addInitScript(() => { delete window.IntersectionObserver; });
  await page.goto(fixture);
  const error = await page.evaluate(async () => {
    try {
      const { mountCinematicWeb } = await import('/skills/cinematic-web/references/cinematic-engine.js');
      mountCinematicWeb(document);
      return null;
    } catch (err) {
      return String(err);
    }
  });
  expect(error).toBeNull();
  await expect(page.locator('[data-cw-poster]').first()).toBeVisible();
  await expect(page.locator('[data-test="primary-cta"]')).toBeVisible();
});

test('real tiny MP4 paints a frame in Chromium/WebKit without a click overlay', async ({ page }) => {
  await page.goto(fixture);
  await mount(page);
  const media = page.locator('[data-cw-kind="video"] [data-cw-media]');
  await media.scrollIntoViewIfNeeded();
  await expect(media).toHaveClass(/cw-has-frame/, { timeout: 10_000 });
  const video = media.locator('video');
  await expect(video).toHaveAttribute('playsinline', '');
  expect(await video.evaluate(v => v.muted && !v.controls)).toBe(true);
  await expect(page.locator('[data-cw-play-overlay]')).toHaveCount(0);
});
