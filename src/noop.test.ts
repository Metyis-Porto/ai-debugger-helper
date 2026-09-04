import { describe, expect, it } from 'vitest';

import * as noop from './noop.js';
import * as real from './index.js';

describe('noop', () => {
  it('exports the same public API surface as the real index', () => {
    const publicNames = Object.keys(real).filter(
      (name) => name !== 'RecorderErrorBoundaryProps' && name !== 'RecorderToolbarProps'
    );
    for (const name of publicNames) {
      if (typeof (real as Record<string, unknown>)[name] !== 'function') continue;
      expect(noop, `noop is missing "${name}"`).toHaveProperty(name);
    }
  });

  it('initializeBrowserDebugRecorder always returns null', () => {
    expect(noop.initializeBrowserDebugRecorder()).toBeNull();
    expect(noop.initializeBrowserDebugRecorder({ enabled: true })).toBeNull();
  });

  it('every lifecycle function is a silent no-op', () => {
    expect(() => {
      noop.startRecording();
      noop.pauseRecording();
      noop.resumeRecording();
      noop.stopRecording();
      noop.clearRecording();
      noop.recordAction('anything', { some: 'detail' });
      noop.disposeRecorder();
    }).not.toThrow();
    expect(noop.getStore()).toBeNull();
    expect(noop.getTimeline()).toBeNull();
    expect(noop.isRecording()).toBe(false);
  });

  it('exportRecording resolves without doing anything', async () => {
    await expect(noop.exportRecording()).resolves.toBeUndefined();
  });

  it('RecorderErrorBoundary renders its children through unchanged', () => {
    expect(
      noop.RecorderErrorBoundary({ store: null as never, children: 'hello' })
    ).toBe('hello');
    expect(
      noop.RecorderErrorBoundary({ store: null as never, children: undefined })
    ).toBeNull();
  });

  it('RecorderToolbar renders nothing', () => {
    expect(
      noop.RecorderToolbar({ store: null as never, onExport: () => {} })
    ).toBeNull();
  });
});
