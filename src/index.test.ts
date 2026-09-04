import { afterEach, describe, expect, it } from 'vitest';

import {
  clearRecording,
  disposeRecorder,
  exportRecording,
  getStore,
  getTimeline,
  initializeBrowserDebugRecorder,
  isRecording,
  pauseRecording,
  recordAction,
  resumeRecording,
  startRecording,
  stopRecording
} from './index.js';

afterEach(() => {
  disposeRecorder();
});

// Real html2canvas rendering isn't needed (or wanted — it's slow and noisy
// under jsdom) to test the public API's orchestration; a fake stands in.
const fakeScreenshot = async () => 'data:image/png;base64,AAA';

describe('initializeBrowserDebugRecorder', () => {
  it('does nothing when not enabled and no NODE_ENV override applies', () => {
    expect(initializeBrowserDebugRecorder({ enabled: false })).toBeNull();
    expect(getStore()).toBeNull();
  });

  it('attaches the store when explicitly enabled', () => {
    const store = initializeBrowserDebugRecorder({
      enabled: true,
      captureScreenshot: fakeScreenshot
    });
    expect(store).not.toBeNull();
    expect(getStore()).toBe(store);
  });

  it('is idempotent — a second call reuses the same store', () => {
    const first = initializeBrowserDebugRecorder({
      enabled: true,
      captureScreenshot: fakeScreenshot
    });
    const second = initializeBrowserDebugRecorder({
      enabled: true,
      captureScreenshot: fakeScreenshot
    });
    expect(second).toBe(first);
  });
});

describe('recording lifecycle through the public API', () => {
  it('drives start/pause/resume/stop and reports isRecording accurately', () => {
    initializeBrowserDebugRecorder({
      enabled: true,
      captureScreenshot: fakeScreenshot
    });
    expect(isRecording()).toBe(false);

    startRecording();
    expect(isRecording()).toBe(true);

    pauseRecording();
    expect(isRecording()).toBe(false);

    resumeRecording();
    expect(isRecording()).toBe(true);

    stopRecording();
    expect(isRecording()).toBe(false);
  });

  it('records a custom action with a name and detail payload', () => {
    initializeBrowserDebugRecorder({
      enabled: true,
      captureScreenshot: fakeScreenshot
    });
    startRecording();
    recordAction('edit-layout-on', { breakpoint: 'lg' });

    const timeline = getTimeline();
    const action = timeline?.events.find((event) => event.category === 'action');
    expect(action?.detail).toEqual({
      name: 'edit-layout-on',
      detail: { breakpoint: 'lg' }
    });
  });

  it('ignores lifecycle calls before initialization instead of throwing', () => {
    expect(() => {
      startRecording();
      recordAction('noop');
      stopRecording();
    }).not.toThrow();
    expect(getTimeline()).toBeNull();
  });

  it('clearRecording resets the timeline to empty', () => {
    initializeBrowserDebugRecorder({
      enabled: true,
      captureScreenshot: fakeScreenshot
    });
    startRecording();
    recordAction('one');
    clearRecording();
    expect(getTimeline()?.events).toHaveLength(0);
  });
});

describe('disposeRecorder', () => {
  it('drops the store so a subsequent call must re-initialize', () => {
    const first = initializeBrowserDebugRecorder({
      enabled: true,
      captureScreenshot: fakeScreenshot
    });
    disposeRecorder();
    expect(getStore()).toBeNull();

    const second = initializeBrowserDebugRecorder({
      enabled: true,
      captureScreenshot: fakeScreenshot
    });
    expect(second).not.toBe(first);
  });
});

describe('exportRecording', () => {
  it('is a no-op when there is nothing to export', async () => {
    await expect(exportRecording()).resolves.toBeUndefined();
  });
});
