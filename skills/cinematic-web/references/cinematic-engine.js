import { mountViewportVideos } from './viewport-video.js';

const mounts = new WeakMap();

function resolveHost(root) {
  if (!root || typeof root.querySelectorAll !== 'function') {
    throw new TypeError('mountCinematicWeb root must be a Document or Element');
  }
  return root.nodeType === 9 ? root.documentElement : root;
}

export function mountCinematicWeb(root = document, options = {}) {
  const existing = mounts.get(root);
  if (existing) return existing;

  const host = resolveHost(root);
  host.setAttribute('data-cw-mounted', '');
  const viewportVideos = mountViewportVideos(root, options.viewportVideo);

  let destroyed = false;
  const controller = {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      viewportVideos.destroy();
      host.removeAttribute('data-cw-mounted');
      mounts.delete(root);
    }
  };

  mounts.set(root, controller);
  return controller;
}
