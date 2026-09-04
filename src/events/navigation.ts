import { attachListeners } from '../utils/attach-listeners.js';
import type { RecorderStore } from '../runtime/store.js';

/**
 * Captures the initial URL plus every route-change mechanism: History API
 * calls (what client-side routers use), back/forward navigation, and hash
 * changes. Patches `pushState`/`replaceState` for the lifetime of the
 * attachment and restores the originals on detach.
 */
export function attachNavigationCapture(store: RecorderStore): () => void {
  if (typeof window === 'undefined') return () => {};

  store.push({
    category: 'navigation',
    detail: { url: window.location.href, kind: 'load' }
  });

  const originalPushState = window.history.pushState.bind(window.history);
  const originalReplaceState = window.history.replaceState.bind(window.history);

  window.history.pushState = function patchedPushState(...args) {
    const result = originalPushState(...args);
    store.push({
      category: 'navigation',
      detail: { url: window.location.href, kind: 'push-state' }
    });
    return result;
  };

  window.history.replaceState = function patchedReplaceState(...args) {
    const result = originalReplaceState(...args);
    store.push({
      category: 'navigation',
      detail: { url: window.location.href, kind: 'replace-state' }
    });
    return result;
  };

  const onPopState = () => {
    store.push({
      category: 'navigation',
      detail: { url: window.location.href, kind: 'pop-state' }
    });
  };
  const onHashChange = () => {
    store.push({
      category: 'navigation',
      detail: { url: window.location.href, kind: 'hash-change' }
    });
  };

  const removeListeners = attachListeners([
    { target: window, type: 'popstate', listener: onPopState },
    { target: window, type: 'hashchange', listener: onHashChange }
  ]);

  return () => {
    window.history.pushState = originalPushState;
    window.history.replaceState = originalReplaceState;
    removeListeners();
  };
}
