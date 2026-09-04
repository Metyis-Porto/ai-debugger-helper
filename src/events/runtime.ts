import { attachListeners } from '../utils/attach-listeners.js';
import type { RecorderStore } from '../runtime/store.js';
import type { RuntimeEventDetail } from '../types/index.js';

function pushRuntimeEvent(
  store: RecorderStore,
  kind: RuntimeEventDetail['kind'],
  message: string,
  stack?: string
) {
  store.push({
    category: 'runtime',
    detail: { kind, message, stack, triggeredBySequence: store.getLastSequence() }
  });
}

/** Uncaught exceptions and rejected promises. React error boundaries report via `captureReactError`. */
export function attachRuntimeCapture(store: RecorderStore): () => void {
  if (typeof window === 'undefined') return () => {};

  const onError = (event: ErrorEvent) => {
    pushRuntimeEvent(store, 'exception', event.message, event.error?.stack);
  };
  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason as unknown;
    const message = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;
    pushRuntimeEvent(store, 'unhandled-rejection', message, stack);
  };

  return attachListeners([
    { target: window, type: 'error', listener: onError as EventListener },
    {
      target: window,
      type: 'unhandledrejection',
      listener: onUnhandledRejection as EventListener
    }
  ]);
}

/** Called by `<RecorderErrorBoundary>` when it catches a React rendering error. */
export function captureReactError(
  store: RecorderStore,
  error: Error,
  componentStack?: string
): void {
  pushRuntimeEvent(
    store,
    'react-error',
    error.message,
    [error.stack, componentStack].filter(Boolean).join('\n')
  );
}

/** Called explicitly when an app wants to report a caught error as an Error Boundary event. */
export function captureErrorBoundary(store: RecorderStore, error: Error): void {
  pushRuntimeEvent(store, 'error-boundary', error.message, error.stack);
}
