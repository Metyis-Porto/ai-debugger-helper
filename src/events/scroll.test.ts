import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { attachScrollCapture } from './scroll.js';
import { createRecorderStore } from '../runtime/store.js';

function setScrollTop(element: Element, value: number) {
  Object.defineProperty(element, 'scrollTop', { value, configurable: true });
}

describe('attachScrollCapture', () => {
  let detach: (() => void) | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    detach?.();
    detach = null;
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('does not record the very first scroll notification (no prior position to diff against)', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachScrollCapture(store);

    const container = document.createElement('div');
    document.body.appendChild(container);
    container.dispatchEvent(new Event('scroll', { bubbles: true }));

    expect(store.getTimeline().events).toHaveLength(0);
  });

  it('records a downward scroll once the position has actually changed', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachScrollCapture(store);

    const container = document.createElement('div');
    document.body.appendChild(container);
    container.dispatchEvent(new Event('scroll', { bubbles: true })); // baseline, unrecorded

    setScrollTop(container, 100);
    container.dispatchEvent(new Event('scroll', { bubbles: true }));

    const [event] = store.getTimeline().events;
    expect(event?.category).toBe('scroll');
    expect(event?.detail).toMatchObject({
      direction: 'down',
      position: { x: 0, y: 100 }
    });
  });

  it('throttles a second scroll that arrives within the throttle window', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachScrollCapture(store);

    const container = document.createElement('div');
    document.body.appendChild(container);
    container.dispatchEvent(new Event('scroll', { bubbles: true })); // baseline
    setScrollTop(container, 100);
    container.dispatchEvent(new Event('scroll', { bubbles: true })); // recorded

    setScrollTop(container, 200);
    container.dispatchEvent(new Event('scroll', { bubbles: true })); // throttled

    expect(store.getTimeline().events).toHaveLength(1);
  });

  it('records the next scroll once the throttle window has elapsed', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachScrollCapture(store);

    const container = document.createElement('div');
    document.body.appendChild(container);
    container.dispatchEvent(new Event('scroll', { bubbles: true })); // baseline
    setScrollTop(container, 100);
    container.dispatchEvent(new Event('scroll', { bubbles: true })); // recorded (down)

    vi.advanceTimersByTime(201);
    setScrollTop(container, 40);
    container.dispatchEvent(new Event('scroll', { bubbles: true })); // recorded (up)

    const events = store.getTimeline().events;
    expect(events).toHaveLength(2);
    expect(events[1]?.detail).toMatchObject({ direction: 'up' });
  });

  it('picks the horizontally-dominant direction when horizontal delta exceeds vertical', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachScrollCapture(store);

    const container = document.createElement('div');
    document.body.appendChild(container);
    container.dispatchEvent(new Event('scroll', { bubbles: true })); // baseline

    Object.defineProperty(container, 'scrollLeft', { value: 50, configurable: true });
    container.dispatchEvent(new Event('scroll', { bubbles: true }));

    const [event] = store.getTimeline().events;
    expect(event?.detail).toMatchObject({ direction: 'right' });
  });

  it('treats a scroll on the document itself as a window scroll', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachScrollCapture(store);

    document.dispatchEvent(new Event('scroll', { bubbles: true })); // baseline
    Object.defineProperty(window, 'scrollY', { value: 300, configurable: true });
    document.dispatchEvent(new Event('scroll', { bubbles: true }));

    const [event] = store.getTimeline().events;
    expect(event?.detail).toMatchObject({
      container: { selector: 'window', tag: 'window' },
      direction: 'down'
    });

    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  });

  it('stops recording once detached', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachScrollCapture(store);
    detach();
    detach = null;

    const container = document.createElement('div');
    document.body.appendChild(container);
    container.dispatchEvent(new Event('scroll', { bubbles: true }));
    setScrollTop(container, 999);
    container.dispatchEvent(new Event('scroll', { bubbles: true }));

    expect(store.getTimeline().events).toHaveLength(0);
  });
});
