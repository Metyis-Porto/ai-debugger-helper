import { attachListeners } from '../utils/attach-listeners.js';
import type { RecorderStore } from '../runtime/store.js';

const RESIZE_THROTTLE_MS = 150;

export function attachWindowCapture(store: RecorderStore): () => void {
  if (typeof window === 'undefined') return () => {};

  let resizeTimer: ReturnType<typeof setTimeout> | null = null;
  const onResize = () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      store.push({
        category: 'window',
        detail: { kind: 'resize', width: window.innerWidth, height: window.innerHeight }
      });
    }, RESIZE_THROTTLE_MS);
  };

  const onFocus = () => store.push({ category: 'window', detail: { kind: 'focus' } });
  const onBlur = () => store.push({ category: 'window', detail: { kind: 'blur' } });
  const onVisibilityChange = () =>
    store.push({
      category: 'window',
      detail: { kind: 'visibility-change', visibilityState: document.visibilityState }
    });

  const removeListeners = attachListeners([
    { target: window, type: 'resize', listener: onResize },
    { target: window, type: 'focus', listener: onFocus },
    { target: window, type: 'blur', listener: onBlur },
    { target: document, type: 'visibilitychange', listener: onVisibilityChange }
  ]);

  return () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    removeListeners();
  };
}
