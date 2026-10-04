export function selectMediaSource(video, isMobile) {
  if (!video) return null;
  const mobile = video.getAttribute('data-src-mobile')?.trim();
  const desktop = video.getAttribute('data-src')?.trim();
  if (isMobile && mobile) return mobile;
  return desktop || null;
}

export function prefersReducedMotion(win = window) {
  return Boolean(win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

export function saveDataEnabled(nav = navigator) {
  return nav?.connection?.saveData === true;
}
