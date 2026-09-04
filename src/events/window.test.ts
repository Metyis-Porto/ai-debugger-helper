import { afterEach, describe, expect, it, vi } from 'vitest';

import { attachWindowCapture } from './window.js';
import { createRecorderStore } from '../runtime/store.js';

describe('attachWindowCapture', () => {
  let detach: (() => void) | null = null;

  afterEach(() => {
    detach?.();
    detach = null;
    vi.useRealTimers();
  });

  it('records a throttled resize with the current viewport dimensions', () => {
    vi.useFakeTimers();
    const store = createRecorderStore();
    store.start();
    detach = attachWindowCapture(store);

    window.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('resize'));
    vi.advanceTimersByTime(200);

    const events = store.getTimeline().events;
    expect(events).toHaveLength(1);
    expect(events[0]?.detail).toMatchObject({ kind: 'resize' });
  });

  it('records focus, blur and visibility changes', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachWindowCapture(store);

    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('blur'));
    document.dispatchEvent(new Event('visibilitychange'));

    const kinds = store
      .getTimeline()
      .events.map((event) => (event.detail as { kind: string }).kind);
    expect(kinds).toEqual(['focus', 'blur', 'visibility-change']);
  });
});
