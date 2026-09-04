import { afterEach, describe, expect, it, vi } from 'vitest';

import { attachConsoleCapture } from './console.js';
import { createRecorderStore } from '../runtime/store.js';

describe('attachConsoleCapture', () => {
  let detach: (() => void) | null = null;
  const originalLog = console.log;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalError = console.error;

  afterEach(() => {
    detach?.();
    detach = null;
    console.log = originalLog;
    console.info = originalInfo;
    console.warn = originalWarn;
    console.error = originalError;
  });

  it('records a console.log call and still invokes the original console.log', () => {
    const store = createRecorderStore();
    store.start();
    const logSpy = vi.fn();
    console.log = logSpy;
    detach = attachConsoleCapture(store);

    console.log('hello', 42);

    expect(logSpy).toHaveBeenCalledWith('hello', 42);
    const [event] = store.getTimeline().events;
    expect(event?.category).toBe('console');
    expect(event?.detail).toMatchObject({
      severity: 'log',
      arguments: ['hello', '42']
    });
  });

  it('attaches a stack trace only for console.error, never for the other severities', () => {
    const store = createRecorderStore();
    store.start();
    console.info = vi.fn();
    console.error = vi.fn();
    detach = attachConsoleCapture(store);

    console.info('just info');
    console.error('boom');

    const [infoEvent, errorEvent] = store.getTimeline().events;
    expect(infoEvent?.detail).toMatchObject({ severity: 'info', stack: undefined });
    expect(errorEvent?.detail).toMatchObject({ severity: 'error' });
    expect((errorEvent?.detail as { stack?: string }).stack).toBeTruthy();
  });

  it('records console.warn under its own severity', () => {
    const store = createRecorderStore();
    store.start();
    console.warn = vi.fn();
    detach = attachConsoleCapture(store);

    console.warn('careful');

    const [event] = store.getTimeline().events;
    expect(event?.detail).toMatchObject({ severity: 'warn' });
  });

  it('restores the original console methods on detach', () => {
    const store = createRecorderStore();
    store.start();
    const logSpy = vi.fn();
    console.log = logSpy;
    detach = attachConsoleCapture(store);
    detach();
    detach = null;

    console.log('after detach');

    expect(logSpy).toHaveBeenCalledWith('after detach');
    expect(store.getTimeline().events).toHaveLength(0);
  });
});
