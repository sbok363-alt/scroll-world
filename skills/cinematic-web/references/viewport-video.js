import { prefersReducedMotion, saveDataEnabled, selectMediaSource } from './media-utils.js';

const DEFAULTS = Object.freeze({
  playThreshold: 0.50,
  pauseThreshold: 0.15,
  prefetchMargin: '100% 0px',
  challengerMargin: 0.10,
  mobileQuery: '(max-width: 860px)'
});

function setPlaybackAttributes(video) {
  video.muted = true;
  video.playsInline = true;
  video.controls = false;
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.removeAttribute('controls');
}

function staticController() {
  return { destroy() {} };
}

export function mountViewportVideos(root = document, options = {}) {
  const config = { ...DEFAULTS, ...options };
  const win = root.defaultView ?? root.ownerDocument?.defaultView ?? window;
  const doc = root.nodeType === 9 ? root : root.ownerDocument;
  const mediaFrames = [...root.querySelectorAll('[data-cw-kind="video"] [data-cw-media]')];
  const records = mediaFrames.map(media => ({
    media,
    video: media.querySelector('video[data-cw-video]'),
    ratio: 0,
    failed: false,
    sourceAssigned: false,
    activation: 0,
    prefetchIntersecting: false
  })).filter(record => record.video);

  for (const { video } of records) setPlaybackAttributes(video);
  if (!records.length) return staticController();
  if (typeof win.IntersectionObserver !== 'function') return staticController();

  const connection = win.navigator.connection ?? null;
  let dataSaving = saveDataEnabled(win.navigator);
  const isMobile = Boolean(win.matchMedia?.(config.mobileQuery).matches);
  const reducedMotionQuery = win.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null;
  let motionReduced = reducedMotionQuery ? reducedMotionQuery.matches : prefersReducedMotion(win);
  let active = null;
  let destroyed = false;

  function ensureSource(record, preload = 'metadata') {
    if (motionReduced || dataSaving || record.failed) return false;
    if (!record.sourceAssigned) {
      const source = selectMediaSource(record.video, isMobile);
      if (!source) return false;
      record.video.src = source;
      record.sourceAssigned = true;
      record.video.preload = preload;
      try { record.video.load(); } catch {}
      return true;
    }
    if (preload === 'auto' && record.video.preload !== 'auto') {
      record.video.preload = 'auto';
      try { record.video.load(); } catch {}
    }
    return true;
  }

  function showPoster(record) {
    record.media.classList.remove('cw-has-frame');
  }

  function markFirstFrame(record, activation) {
    if (destroyed || motionReduced || dataSaving || record.failed || (activation !== undefined && record.activation !== activation)) return;
    record.media.classList.add('cw-has-frame');
  }

  function waitForFirstFrame(record, activation) {
    const video = record.video;
    if (typeof video.requestVideoFrameCallback === 'function') {
      try {
        video.requestVideoFrameCallback(() => markFirstFrame(record, activation));
        return;
      } catch {}
    }

    let painted = false;
    const maybePaint = () => {
      if (painted || motionReduced || dataSaving || record.failed || record.activation !== activation) return;
      if (video.readyState >= 2 && !video.paused) {
        painted = true;
        markFirstFrame(record);
      }
    };
    video.addEventListener('loadeddata', maybePaint, { once: true });
    video.addEventListener('playing', maybePaint, { once: true });
    queueMicrotask(maybePaint);
  }

  function pauseRecord(record) {
    if (!record) return;
    record.activation += 1;
    try { record.video.pause(); } catch {}
  }

  async function activate(record) {
    if (!record || motionReduced || dataSaving || record.failed || destroyed) return;
    if (!ensureSource(record, 'auto')) return;
    if (active && active !== record) pauseRecord(active);
    active = record;
    const activation = ++record.activation;
    setPlaybackAttributes(record.video);
    try {
      await record.video.play();
      if (record.activation !== activation) {
        if (active !== record) pauseRecord(record);
        return;
      }
      if (destroyed || motionReduced || record.failed || active !== record) {
        pauseRecord(record);
        return;
      }
      waitForFirstFrame(record, activation);
    } catch {
      if (record.activation !== activation) return;
      showPoster(record);
      if (active === record) active = null;
    }
  }

  function bestCandidate() {
    return records
      .filter(record => !record.failed && record.ratio >= config.playThreshold)
      .sort((a, b) => b.ratio - a.ratio)[0] ?? null;
  }

  function reconcile() {
    if (destroyed || motionReduced || dataSaving || doc?.hidden) return;

    if (active && (active.failed || active.ratio < config.pauseThreshold)) {
      pauseRecord(active);
      active = null;
    }

    const challenger = bestCandidate();
    if (!challenger) return;

    if (!active) {
      void activate(challenger);
      return;
    }

    if (challenger === active) return;
    if (challenger.ratio >= active.ratio + config.challengerMargin) {
      void activate(challenger);
    }
  }

  const prefetchObserver = new win.IntersectionObserver(entries => {
    for (const entry of entries) {
      const record = records.find(item => item.media === entry.target);
      if (!record) continue;
      record.prefetchIntersecting = entry.isIntersecting;
      if (entry.isIntersecting && !dataSaving) ensureSource(record, 'metadata');
    }
  }, { rootMargin: config.prefetchMargin, threshold: 0 });

  const playObserver = new win.IntersectionObserver(entries => {
    for (const entry of entries) {
      const record = records.find(item => item.media === entry.target);
      if (record) record.ratio = entry.isIntersecting ? entry.intersectionRatio : 0;
    }
    reconcile();
  }, { threshold: [config.pauseThreshold, config.playThreshold, 1] });

  for (const record of records) {
    const onError = () => {
      record.failed = true;
      showPoster(record);
      if (active === record) {
        pauseRecord(record);
        active = null;
        reconcile();
      }
    };
    record.onError = onError;
    record.video.addEventListener('error', onError);
    prefetchObserver.observe(record.media);
    playObserver.observe(record.media);
  }

  const onReducedMotionChange = event => {
    motionReduced = event.matches;
    if (motionReduced) {
      pauseRecord(active);
      active = null;
      for (const record of records) showPoster(record);
      return;
    }
    for (const record of records) {
      if (record.prefetchIntersecting) ensureSource(record, 'metadata');
    }
    reconcile();
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
      pauseRecord(active);
      active = null;
      for (const record of records) {
        showPoster(record);
        record.video.removeAttribute('src');
        record.sourceAssigned = false;
        try { record.video.load(); } catch {}
      }
      return;
    }

    for (const record of records) {
      if (record.prefetchIntersecting) ensureSource(record, 'metadata');
    }
    reconcile();
  };
  if (typeof connection?.addEventListener === 'function') {
    connection.addEventListener('change', onSaveDataChange);
  }

  const onVisibilityChange = () => {
    if (doc.hidden) {
      pauseRecord(active);
      active = null;
    } else {
      reconcile();
    }
  };
  const onPageHide = () => {
    pauseRecord(active);
    active = null;
  };
  doc.addEventListener('visibilitychange', onVisibilityChange);
  win.addEventListener('pagehide', onPageHide);

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      prefetchObserver.disconnect();
      playObserver.disconnect();
      if (typeof reducedMotionQuery?.removeEventListener === 'function') {
        reducedMotionQuery.removeEventListener('change', onReducedMotionChange);
      } else if (typeof reducedMotionQuery?.removeListener === 'function') {
        reducedMotionQuery.removeListener(onReducedMotionChange);
      }
      if (typeof connection?.removeEventListener === 'function') {
        connection.removeEventListener('change', onSaveDataChange);
      }
      doc.removeEventListener('visibilitychange', onVisibilityChange);
      win.removeEventListener('pagehide', onPageHide);
      pauseRecord(active);
      active = null;
      for (const record of records) record.video.removeEventListener('error', record.onError);
    }
  };
}
