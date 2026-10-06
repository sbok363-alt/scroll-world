import { test, expect } from '@playwright/test';

const fixture = '/tests/fixtures/cinematic-page.html';

async function installScrubHarness(page, { saveData = false } = {}) {
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
    window.__cwTriggerScrub = (target, ratio, kind = 'all') => {
      for (const observer of observers) {
        if (!observer.targets.has(target)) continue;
        const prefetch = observer.options.rootMargin === '100% 0px';
        if (kind === 'prefetch' && !prefetch) continue;
        if (kind === 'active' && prefetch) continue;
        observer.callback([{ target, isIntersecting: ratio > 0, intersectionRatio: ratio }], observer);
      }
    };

    Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData } });
    window.__cwFetchCount = 0;
    window.__cwRevokes = 0;
    window.fetch = async (_url, options = {}) => {
      window.__cwFetchCount += 1;
      if (options.signal?.aborted) throw new DOMException('aborted', 'AbortError');
      return new Response(new Blob(['fake-video']), { status: 200 });
    };
    URL.createObjectURL = () => 'blob:cinematic-test';
    URL.revokeObjectURL = () => { window.__cwRevokes += 1; };

    const state = new WeakMap();
    function mediaState(video) {
      if (!state.has(video)) state.set(video, { time: 0, writes: 0, seeking: false, duration: 10 });
      return state.get(video);
    }
    Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
      configurable: true,
      get() { return mediaState(this).time; },
      set(value) { const s = mediaState(this); s.time = value; s.writes += 1; }
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'duration', {
      configurable: true,
      get() { return mediaState(this).duration; }
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'seeking', {
      configurable: true,
      get() { return mediaState(this).seeking; }
    });
    window.__cwSetSeeking = (video, value) => { mediaState(video).seeking = value; };
    window.__cwSetDuration = (video, value) => { mediaState(video).duration = value; };
    window.__cwTimeWrites = video => mediaState(video).writes;
    HTMLMediaElement.prototype.load = function () {};
    HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
    HTMLMediaElement.prototype.pause = function () {};
  }, { saveData });
}

test('clamps scrub progress budget to 1..3 and defaults invalid input to 2', async ({ page }) => {
  await page.goto(fixture);
  const values = await page.evaluate(async () => {
    const { clampScrollVh } = await import('/skills/cinematic-web/references/micro-scrub.js');
    return [clampScrollVh(0), clampScrollVh(1), clampScrollVh(2), clampScrollVh(99), clampScrollVh('bad')];
  });
  expect(values).toEqual([1, 1, 2, 3, 2]);
});

test('uses a stable pixel viewport baseline across height-only URL-bar resizes', async ({ page }) => {
  await installScrubHarness(page);
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.goto(fixture);
  await page.evaluate(async () => {
    const { mountCinematicWeb } = await import('/skills/cinematic-web/references/cinematic-engine.js');
    mountCinematicWeb(document);
  });

  const section = page.locator('[data-cw-kind="scrub"]');
  await expect(section).toHaveAttribute('data-cw-scroll-vh-resolved', '2');
  expect(await section.evaluate(el => el.style.getPropertyValue('--cw-scrub-height'))).toBe('2100px');

  await page.setViewportSize({ width: 1000, height: 600 });
  await expect.poll(() => page.evaluate(() => ({ width: innerWidth, height: innerHeight })))
    .toEqual({ width: 1000, height: 600 });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(await section.evaluate(el => el.style.getPropertyValue('--cw-scrub-height'))).toBe('2100px');

  await page.setViewportSize({ width: 900, height: 600 });
  await expect.poll(() => section.evaluate(el => el.style.getPropertyValue('--cw-scrub-height')))
    .toBe('1800px');
});

test('reduced motion and Save-Data keep scrub natural-height and unfetched', async ({ browser }) => {
  for (const mode of ['save-data', 'reduced-motion']) {
    const context = await browser.newContext({ reducedMotion: mode === 'reduced-motion' ? 'reduce' : 'no-preference' });
    const page = await context.newPage();
    await installScrubHarness(page, { saveData: mode === 'save-data' });
    await page.goto(fixture);
    await page.evaluate(async () => {
      const { mountCinematicWeb } = await import('/skills/cinematic-web/references/cinematic-engine.js');
      mountCinematicWeb(document);
    });
    const state = await page.evaluate(() => {
      const section = document.querySelector('[data-cw-kind="scrub"]');
      return {
        enhanced: section.classList.contains('cw-scrub--enhanced'),
        height: section.style.getPropertyValue('--cw-scrub-height'),
        fetches: window.__cwFetchCount
      };
    });
    expect(state.enhanced).toBe(false);
    expect(state.height).toBe('');
    expect(state.fetches).toBe(0);
    await context.close();
  }
});

test('coalesces seeks and performs one final catch-up after seeked even if scrolling stopped', async ({ page }) => {
  await installScrubHarness(page);
  await page.goto(fixture);
  const state = await page.evaluate(async () => {
    const section = document.querySelector('[data-cw-kind="scrub"]');
    const video = section.querySelector('[data-cw-scrub-video]');
    Object.defineProperty(section, 'offsetHeight', { configurable: true, get: () => 3000 });
    let top = -750;
    section.getBoundingClientRect = () => ({ top, bottom: top + 3000, left: 0, right: 1000, width: 1000, height: 3000 });

    const { mountCinematicWeb } = await import('/skills/cinematic-web/references/cinematic-engine.js');
    mountCinematicWeb(document);
    window.__cwTriggerScrub(section, 1, 'prefetch');
    await new Promise(resolve => setTimeout(resolve, 0));
    window.__cwTriggerScrub(section, 1, 'active');
    window.dispatchEvent(new Event('scroll'));
    await new Promise(requestAnimationFrame);
    const firstWrites = window.__cwTimeWrites(video);
    const firstTime = video.currentTime;

    window.__cwSetSeeking(video, true);
    top = -1500;
    window.dispatchEvent(new Event('scroll'));
    await new Promise(requestAnimationFrame);
    const duringWrites = window.__cwTimeWrites(video);

    window.__cwSetSeeking(video, false);
    video.dispatchEvent(new Event('seeked'));
    await new Promise(requestAnimationFrame);
    const finalWrites = window.__cwTimeWrites(video);

    return { firstWrites, firstTime, duringWrites, finalWrites, finalTime: video.currentTime };
  });

  expect(state.firstWrites).toBe(1);
  expect(state.firstTime).toBeGreaterThan(0);
  expect(state.duringWrites).toBe(state.firstWrites);
  expect(state.finalWrites).toBe(state.firstWrites + 1);
  expect(state.finalTime).toBeGreaterThan(state.firstTime);
});

test('does not seek with invalid duration and tears down object URLs cleanly', async ({ page }) => {
  await installScrubHarness(page);
  await page.goto(fixture);
  const state = await page.evaluate(async () => {
    const section = document.querySelector('[data-cw-kind="scrub"]');
    const video = section.querySelector('[data-cw-scrub-video]');
    Object.defineProperty(section, 'offsetHeight', { configurable: true, get: () => 3000 });
    section.getBoundingClientRect = () => ({ top: -1000, bottom: 2000, left: 0, right: 1000, width: 1000, height: 3000 });

    const { mountCinematicWeb } = await import('/skills/cinematic-web/references/cinematic-engine.js');
    const controller = mountCinematicWeb(document);
    window.__cwTriggerScrub(section, 1, 'prefetch');

    const deadline = performance.now() + 1000;
    while (!video.src.startsWith('blob:') && performance.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    const loaded = video.src.startsWith('blob:');

    window.__cwTriggerScrub(section, 1, 'active');
    window.__cwSetDuration(video, Number.NaN);
    window.dispatchEvent(new Event('scroll'));
    await new Promise(requestAnimationFrame);
    const writes = window.__cwTimeWrites(video);
    controller.destroy();
    return { loaded, writes, revokes: window.__cwRevokes };
  });
  expect(state.loaded).toBe(true);
  expect(state.writes).toBe(0);
  expect(state.revokes).toBe(1);
});

test('a page with no scrub sections installs no scrub animation work', async ({ page }) => {
  await installScrubHarness(page);
  await page.goto(fixture);
  const result = await page.evaluate(async () => {
    document.querySelector('[data-cw-kind="scrub"]').remove();
    let rafCalls = 0;
    const nativeRaf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => { rafCalls += 1; return nativeRaf(callback); };
    const { mountCinematicWeb } = await import('/skills/cinematic-web/references/cinematic-engine.js');
    mountCinematicWeb(document);
    const before = rafCalls;
    window.dispatchEvent(new Event('scroll'));
    await new Promise(resolve => setTimeout(resolve, 30));
    return { before, after: rafCalls };
  });
  expect(result.after).toBe(result.before);
});
