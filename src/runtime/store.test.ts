import { describe, expect, it } from 'vitest';

import { createRecorderStore } from './store.js';

describe('createRecorderStore', () => {
  it('starts idle and only accepts pushes while recording', () => {
    const store = createRecorderStore();
    expect(store.getStatus()).toBe('idle');

    store.push({ category: 'action', detail: { name: 'ignored', detail: {} } });
    expect(store.getTimeline().events).toHaveLength(0);

    store.start();
    expect(store.getStatus()).toBe('recording');
    store.push({ category: 'action', detail: { name: 'recorded', detail: {} } });
    expect(store.getTimeline().events).toHaveLength(1);
  });

  it('drops pushes while paused, resumes accepting them afterward', () => {
    const store = createRecorderStore();
    store.start();
    store.push({ category: 'action', detail: { name: 'one', detail: {} } });
    store.pause();
    expect(store.getStatus()).toBe('paused');
    store.push({ category: 'action', detail: { name: 'ignored', detail: {} } });
    expect(store.getTimeline().events).toHaveLength(1);

    store.resume();
    store.push({ category: 'action', detail: { name: 'two', detail: {} } });
    expect(store.getTimeline().events).toHaveLength(2);
  });

  it('never exports partial sessions automatically — stop freezes state until export', () => {
    const store = createRecorderStore();
    store.start();
    store.push({ category: 'action', detail: { name: 'one', detail: {} } });
    store.stop();
    expect(store.getStatus()).toBe('stopped');
    store.push({ category: 'action', detail: { name: 'ignored', detail: {} } });
    expect(store.getTimeline().events).toHaveLength(1);
  });

  it('clear resets to idle with an empty timeline', () => {
    const store = createRecorderStore();
    store.start();
    store.push({ category: 'action', detail: { name: 'one', detail: {} } });
    store.clear();
    expect(store.getStatus()).toBe('idle');
    expect(store.getTimeline().events).toHaveLength(0);
  });

  it('assigns strictly increasing sequence numbers', () => {
    const store = createRecorderStore();
    store.start();
    store.push({ category: 'action', detail: { name: 'one', detail: {} } });
    store.push({ category: 'action', detail: { name: 'two', detail: {} } });
    const [first, second] = store.getTimeline().events;
    expect(second!.sequence).toBeGreaterThan(first!.sequence);
  });

  it('caps retained events at maxEvents, dropping the oldest', () => {
    const store = createRecorderStore({ maxEvents: 2 });
    store.start();
    store.push({ category: 'action', detail: { name: 'one', detail: {} } });
    store.push({ category: 'action', detail: { name: 'two', detail: {} } });
    store.push({ category: 'action', detail: { name: 'three', detail: {} } });
    const events = store.getTimeline().events;
    expect(events).toHaveLength(2);
    expect((events[0]!.detail as { name: string }).name).toBe('two');
  });

  it('notifies subscribers of every status transition', () => {
    const store = createRecorderStore();
    const seen: string[] = [];
    const unsubscribe = store.subscribe((status) => seen.push(status));

    store.start();
    store.pause();
    store.resume();
    store.stop();
    unsubscribe();
    store.clear();

    expect(seen).toEqual(['recording', 'paused', 'recording', 'stopped']);
  });

  it('exposes the last recorded sequence for runtime-error correlation', () => {
    const store = createRecorderStore();
    expect(store.getLastSequence()).toBeNull();
    store.start();
    store.push({ category: 'action', detail: { name: 'one', detail: {} } });
    expect(store.getLastSequence()).toBe(1);
  });

  describe('screenshot capture', () => {
    it('captures a screenshot for action/runtime/navigation events only', async () => {
      const captured: string[] = [];
      const store = createRecorderStore({
        captureScreenshot: async () => {
          captured.push('shot');
          return 'data:image/png;base64,AAA';
        }
      });
      store.start();
      store.push({ category: 'action', detail: { name: 'one', detail: {} } });
      store.push({
        category: 'mouse',
        detail: { kind: 'click', target: { selector: 'body', tag: 'body' }, x: 0, y: 0 }
      });
      store.push({
        category: 'runtime',
        detail: { kind: 'exception', message: 'boom', triggeredBySequence: null }
      });
      await store.waitForPendingScreenshots();

      expect(captured).toHaveLength(2);
      const [action, mouse, runtime] = store.getTimeline().events;
      expect(action?.screenshot).toBe('data:image/png;base64,AAA');
      expect(mouse?.screenshot).toBeUndefined();
      expect(runtime?.screenshot).toBe('data:image/png;base64,AAA');
    });

    it('leaves the event without a screenshot when capture fails, without throwing', async () => {
      const store = createRecorderStore({
        captureScreenshot: async () => {
          throw new Error('capture failed');
        }
      });
      store.start();
      store.push({ category: 'action', detail: { name: 'one', detail: {} } });
      await expect(store.waitForPendingScreenshots()).resolves.toBeUndefined();
      expect(store.getTimeline().events[0]?.screenshot).toBeUndefined();
    });

    it('does not attempt capture when no captureScreenshot is configured', async () => {
      const store = createRecorderStore();
      store.start();
      store.push({ category: 'action', detail: { name: 'one', detail: {} } });
      await store.waitForPendingScreenshots();
      expect(store.getTimeline().events[0]?.screenshot).toBeUndefined();
    });

    it('resolves immediately when nothing is pending', async () => {
      const store = createRecorderStore();
      await expect(store.waitForPendingScreenshots()).resolves.toBeUndefined();
    });
  });
});
