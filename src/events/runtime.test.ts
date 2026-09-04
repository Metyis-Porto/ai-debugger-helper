import { afterEach, describe, expect, it } from 'vitest';

import {
  attachRuntimeCapture,
  captureErrorBoundary,
  captureReactError
} from './runtime.js';
import { createRecorderStore } from '../runtime/store.js';

describe('attachRuntimeCapture', () => {
  let detach: (() => void) | null = null;

  afterEach(() => {
    detach?.();
    detach = null;
  });

  it('records an uncaught exception with its message, stack, and triggering sequence', () => {
    const store = createRecorderStore();
    store.start();
    store.push({ category: 'mouse', detail: { kind: 'click' } as never });
    detach = attachRuntimeCapture(store);

    const error = new Error('boom');
    window.dispatchEvent(new ErrorEvent('error', { message: 'boom', error }));

    const events = store.getTimeline().events;
    const runtimeEvent = events[events.length - 1];
    expect(runtimeEvent?.category).toBe('runtime');
    expect(runtimeEvent?.detail).toMatchObject({
      kind: 'exception',
      message: 'boom',
      stack: error.stack,
      triggeredBySequence: events[0]!.sequence
    });
  });

  it('records an unhandled rejection whose reason is an Error', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachRuntimeCapture(store);

    const reason = new Error('rejected');
    const event = new Event('unhandledrejection') as PromiseRejectionEvent;
    Object.defineProperty(event, 'reason', { value: reason });
    window.dispatchEvent(event);

    const [recorded] = store.getTimeline().events;
    expect(recorded?.detail).toMatchObject({
      kind: 'unhandled-rejection',
      message: 'rejected',
      stack: reason.stack
    });
  });

  it('stringifies a non-Error rejection reason instead of throwing', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachRuntimeCapture(store);

    const event = new Event('unhandledrejection') as PromiseRejectionEvent;
    Object.defineProperty(event, 'reason', { value: 'plain string reason' });
    window.dispatchEvent(event);

    const [recorded] = store.getTimeline().events;
    expect(recorded?.detail).toMatchObject({
      kind: 'unhandled-rejection',
      message: 'plain string reason',
      stack: undefined
    });
  });

  it('stops recording once detached', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachRuntimeCapture(store);
    detach();
    detach = null;

    window.dispatchEvent(new ErrorEvent('error', { message: 'after detach' }));

    expect(store.getTimeline().events).toHaveLength(0);
  });
});

describe('captureReactError', () => {
  it('joins the error stack and the component stack into one message', () => {
    const store = createRecorderStore();
    store.start();
    const error = new Error('render failed');

    captureReactError(store, error, 'in <Widget>');

    const [event] = store.getTimeline().events;
    expect(event?.category).toBe('runtime');
    expect(event?.detail).toMatchObject({
      kind: 'react-error',
      message: 'render failed'
    });
    expect((event?.detail as { stack?: string }).stack).toContain('in <Widget>');
  });
});

describe('captureErrorBoundary', () => {
  it('records the caught error under the error-boundary kind', () => {
    const store = createRecorderStore();
    store.start();
    const error = new Error('caught');

    captureErrorBoundary(store, error);

    const [event] = store.getTimeline().events;
    expect(event?.detail).toMatchObject({ kind: 'error-boundary', message: 'caught' });
  });
});
