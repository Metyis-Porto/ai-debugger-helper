import { attachListeners } from '../utils/attach-listeners.js';
import { buildDomReference } from '../utils/dom-reference.js';
import type { RecorderStore } from '../runtime/store.js';
import type { ScrollEventDetail, DomReference } from '../types/index.js';

const THROTTLE_MS = 200;

function referenceFor(target: EventTarget): DomReference {
  if (target instanceof Element) return buildDomReference(target);
  return { selector: 'window', tag: 'window' };
}

function positionOf(target: EventTarget): { x: number; y: number } {
  if (target instanceof Element) return { x: target.scrollLeft, y: target.scrollTop };
  return { x: window.scrollX, y: window.scrollY };
}

/** Throttled and direction-aware — a raw scroll listener fires far too often to log 1:1. */
export function attachScrollCapture(store: RecorderStore): () => void {
  if (typeof document === 'undefined') return () => {};

  const lastPosition = new WeakMap<EventTarget, { x: number; y: number }>();
  let lastPushedAt = 0;

  const onScroll = (event: Event) => {
    const target = event.target === document ? window : event.target;
    if (!target) return;

    const now = Date.now();
    const previous = lastPosition.get(target) ?? positionOf(target);
    const current = positionOf(target);
    lastPosition.set(target, current);

    if (now - lastPushedAt < THROTTLE_MS) return;

    const deltaX = current.x - previous.x;
    const deltaY = current.y - previous.y;
    if (deltaX === 0 && deltaY === 0) return;

    const direction: ScrollEventDetail['direction'] =
      Math.abs(deltaY) >= Math.abs(deltaX)
        ? deltaY > 0
          ? 'down'
          : 'up'
        : deltaX > 0
          ? 'right'
          : 'left';

    lastPushedAt = now;
    store.push({
      category: 'scroll',
      detail: { container: referenceFor(target), direction, position: current }
    });
  };

  return attachListeners([
    {
      target: document,
      type: 'scroll',
      listener: onScroll,
      options: { capture: true, passive: true }
    }
  ]);
}
