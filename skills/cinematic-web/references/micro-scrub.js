import { prefersReducedMotion, saveDataEnabled, selectMediaSource } from './media-utils.js';

const DEFAULT_SCROLL_VH = 2;
const MIN_SCROLL_VH = 1;
const MAX_SCROLL_VH = 3;

export function clampScrollVh(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_SCROLL_VH;
  return Math.min(MAX_SCROLL_VH, Math.max(MIN_SCROLL_VH, parsed));
}

function noopController() {
  return { destroy() {} };
}

export function mountMicroScrubs(root = document, options = {}) {
  const win = root.defaultView ?? root.ownerDocument?.defaultView ?? window;
  const doc = root.nodeType === 9 ? root : root.ownerDocument;
  const sections = [...root.querySelectorAll('[data-cw-kind="scrub"]')];
  if (!sections.length) return noopController();
  if (typeof win.IntersectionObserver !== 'function') return noopController();

  const connection = win.navigator.connection ?? null;
  let dataSaving = saveDataEnabled(win.navigator);
  const reducedMotionQuery = win.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null;
  let motionReduced = prefersReducedMotion(win);

  let baselineWidth = win.innerWidth;
  let baselineHeight = win.innerHeight;
  let destroyed = false;
  let rafId = 0;
  let scrollListening = false;

  const records = sections.map(section => {
    const video = section.querySelector('video[data-cw-scrub-video]');
    const media = section.querySelector('[data-cw-media]');
    const resolved = clampScrollVh(section.getAttribute('data-cw-scroll-vh'));
    return {
      section,
      media,
      video,
      resolved,
      active: false,
      intersecting: false,
      prefetchIntersecting: false,
      loading: false,
      loaded: false,
      failed: false,
      pendingSeek: false,
      objectUrl: null,
      abortController: null
    };
  }).filter(record => record.video && record.media);

  if (!records.length) return noopController();

  function applyGeometry(record) {
    if (motionReduced || dataSaving) {
      clearGeometry(record);
      return;
    }
    record.section.setAttribute('data-cw-scroll-vh-resolved', String(record.resolved));
    record.section.style.setProperty('--cw-scrub-height', `${(record.resolved + 1) * baselineHeight}px`);
    record.section.style.setProperty('--cw-scrub-viewport', `${baselineHeight}px`);
    record.section.classList.add('cw-scrub--enhanced');
  }

  function clearGeometry(record) {
    record.section.classList.remove('cw-scrub--enhanced');
    record.section.style.removeProperty('--cw-scrub-height');
    record.section.style.removeProperty('--cw-scrub-viewport');
  }

  function enforceVideoAttributes(video) {
    video.muted = true;
    video.playsInline = true;
    video.controls = false;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.removeAttribute('controls');
  }

  for (const record of records) {
    enforceVideoAttributes(record.video);
    applyGeometry(record);
  }

  const isMobile = Boolean(win.matchMedia?.(options.mobileQuery ?? '(max-width: 860px)').matches);

  async function loadRecord(record) {
    if (destroyed || motionReduced || dataSaving || record.loading || record.loaded || record.failed) return;
    const source = selectMediaSource(record.video, isMobile);
    if (!source) {
      record.failed = true;
      clearGeometry(record);
      return;
    }

    record.loading = true;
    const abortController = new AbortController();
    record.abortController = abortController;
    try {
      const response = await win.fetch(source, { signal: abortController.signal });
      if (!response.ok) throw new Error(`Scrub media request failed: ${response.status}`);
      const blob = await response.blob();
      if (destroyed || abortController.signal.aborted) return;
      const objectUrl = win.URL.createObjectURL(blob);
      record.objectUrl = objectUrl;
      record.video.src = objectUrl;
      record.video.preload = 'auto';
      try { record.video.load(); } catch {}
      record.loaded = true;
    } catch (error) {
      if (!abortController.signal.aborted) {
        record.failed = true;
        clearGeometry(record);
      }
    } finally {
      if (record.abortController === abortController) record.loading = false;
    }
  }

  function progressFor(record) {
    const denominator = record.section.offsetHeight - baselineHeight;
    if (!(denominator > 0)) return 0;
    const top = record.section.getBoundingClientRect().top;
    return Math.min(1, Math.max(0, -top / denominator));
  }

  function seekRecord(record) {
    if (destroyed || motionReduced || dataSaving || !record.active || !record.loaded || record.failed) return;
    const duration = record.video.duration;
    if (!Number.isFinite(duration) || duration <= 0) return;

    if (record.video.seeking) {
      record.pendingSeek = true;
      return;
    }

    const progress = progressFor(record);
    const maxTime = Math.max(0, duration - 0.001);
    const target = Math.min(progress * duration, maxTime);
    record.pendingSeek = false;
    if (Math.abs(record.video.currentTime - target) > 0.001) {
      try { record.video.currentTime = target; } catch {}
    }
  }

  function runFrame() {
    rafId = 0;
    if (destroyed || motionReduced || dataSaving) return;
    for (const record of records) seekRecord(record);
  }

  function scheduleFrame() {
    if (destroyed || motionReduced || dataSaving || rafId) return;
    rafId = win.requestAnimationFrame(runFrame);
  }

  function onScroll() {
    if (records.some(record => record.active)) scheduleFrame();
  }

  function updateScrollListener() {
    const shouldListen = records.some(record => record.active);
    if (shouldListen && !scrollListening) {
      win.addEventListener('scroll', onScroll, { passive: true });
      scrollListening = true;
    } else if (!shouldListen && scrollListening) {
      win.removeEventListener('scroll', onScroll);
      scrollListening = false;
    }
  }

  for (const record of records) {
    record.onSeeked = () => {
      if (record.loaded && !record.failed) record.media.classList.add('cw-has-frame');
      if (record.pendingSeek) scheduleFrame();
    };
    record.video.addEventListener('seeked', record.onSeeked);
  }

  const prefetchObserver = new win.IntersectionObserver(entries => {
    for (const entry of entries) {
      const record = records.find(item => item.section === entry.target);
      if (!record) continue;
      record.prefetchIntersecting = entry.isIntersecting;
      if (entry.isIntersecting && !dataSaving) void loadRecord(record);
    }
  }, { rootMargin: options.prefetchMargin ?? '100% 0px', threshold: 0 });

  const activeObserver = new win.IntersectionObserver(entries => {
    for (const entry of entries) {
      const record = records.find(item => item.section === entry.target);
      if (!record) continue;
      record.intersecting = entry.isIntersecting;
      if (motionReduced || dataSaving) {
        record.active = false;
        continue;
      }
      record.active = record.intersecting;
      if (record.active) {
        void loadRecord(record);
        scheduleFrame();
      }
    }
    updateScrollListener();
  }, { threshold: 0 });

  for (const record of records) {
    prefetchObserver.observe(record.section);
    activeObserver.observe(record.section);
  }

  function onResize() {
    if (destroyed) return;
    if (win.innerWidth === baselineWidth) return;
    baselineWidth = win.innerWidth;
    baselineHeight = win.innerHeight;
    for (const record of records) {
      if (!record.failed) applyGeometry(record);
    }
    if (records.some(record => record.active)) scheduleFrame();
  }
  win.addEventListener('resize', onResize, { passive: true });

  const onReducedMotionChange = event => {
    motionReduced = event.matches;
    if (motionReduced) {
      if (rafId) win.cancelAnimationFrame(rafId);
      rafId = 0;
      if (scrollListening) win.removeEventListener('scroll', onScroll);
      scrollListening = false;
      for (const record of records) {
        record.active = false;
        record.pendingSeek = false;
        record.media.classList.remove('cw-has-frame');
        record.abortController?.abort();
        record.abortController = null;
        record.loading = false;
        record.loaded = false;
        if (record.objectUrl) win.URL.revokeObjectURL(record.objectUrl);
        record.objectUrl = null;
        record.video.removeAttribute('src');
        try { record.video.load(); } catch {}
        clearGeometry(record);
      }
      return;
    }

    if (dataSaving) {
      for (const record of records) {
        record.active = false;
        clearGeometry(record);
      }
      updateScrollListener();
      return;
    }

    for (const record of records) {
      if (!record.failed) applyGeometry(record);
      record.active = record.intersecting;
      const rect = record.section.getBoundingClientRect();
      const nearViewport = rect.top <= win.innerHeight * 2 && rect.bottom >= -win.innerHeight;
      if (record.active || nearViewport) void loadRecord(record);
    }
    updateScrollListener();
    if (records.some(record => record.active)) scheduleFrame();
  };
  if (typeof reducedMotionQuery?.addEventListener === 'function') {
    reducedMotionQuery.addEventListener('change', onReducedMotionChange);
  } else if (typeof reducedMotionQuery?.addListener === 'function') {
    reducedMotionQuery.addListener(onReducedMotionChange);
  }

  const onSaveDataChange = () => {
    const enabled = saveDataEnabled(win.navigator);
    if (enabled === dataSaving) return;
    dataSaving = enabled;
    if (dataSaving) {
      if (rafId) win.cancelAnimationFrame(rafId);
      rafId = 0;
      if (scrollListening) win.removeEventListener('scroll', onScroll);
      scrollListening = false;
      for (const record of records) {
        record.active = false;
        record.pendingSeek = false;
        record.media.classList.remove('cw-has-frame');
        record.abortController?.abort();
        record.abortController = null;
        record.loading = false;
        record.loaded = false;
        if (record.objectUrl) win.URL.revokeObjectURL(record.objectUrl);
        record.objectUrl = null;
        record.video.removeAttribute('src');
        try { record.video.load(); } catch {}
        clearGeometry(record);
      }
      return;
    }

    for (const record of records) {
      if (!record.failed) applyGeometry(record);
      record.active = !motionReduced && record.intersecting;
      const rect = record.section.getBoundingClientRect();
      const nearViewport = rect.top <= win.innerHeight * 2 && rect.bottom >= -win.innerHeight;
      if (!motionReduced && (record.prefetchIntersecting || record.active || nearViewport)) void loadRecord(record);
    }
    updateScrollListener();
    if (records.some(record => record.active)) scheduleFrame();
  };
  if (typeof connection?.addEventListener === 'function') {
    connection.addEventListener('change', onSaveDataChange);
  }

  const coarsePointer = Boolean(win.matchMedia?.('(pointer: coarse)').matches);
  const prime = () => {
    if (!coarsePointer) return;
    for (const record of records) {
      if (!record.loaded || record.failed) continue;
      Promise.resolve(record.video.play()).then(() => record.video.pause()).catch(() => {});
    }
  };
  if (coarsePointer) doc.addEventListener('pointerdown', prime, { once: true, passive: true });

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      prefetchObserver.disconnect();
      activeObserver.disconnect();
      if (rafId) win.cancelAnimationFrame(rafId);
      if (scrollListening) win.removeEventListener('scroll', onScroll);
      win.removeEventListener('resize', onResize);
      if (typeof reducedMotionQuery?.removeEventListener === 'function') {
        reducedMotionQuery.removeEventListener('change', onReducedMotionChange);
      } else if (typeof reducedMotionQuery?.removeListener === 'function') {
        reducedMotionQuery.removeListener(onReducedMotionChange);
      }
      if (typeof connection?.removeEventListener === 'function') {
        connection.removeEventListener('change', onSaveDataChange);
      }
      if (coarsePointer) doc.removeEventListener('pointerdown', prime);
      for (const record of records) {
        record.abortController?.abort();
        record.video.removeEventListener('seeked', record.onSeeked);
        if (record.objectUrl) win.URL.revokeObjectURL(record.objectUrl);
        clearGeometry(record);
      }
    }
  };
}
