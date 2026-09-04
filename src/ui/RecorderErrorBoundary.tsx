import { Component, type ErrorInfo, type ReactNode } from 'react';

import { captureReactError } from '../events/runtime.js';
import type { RecorderStore } from '../runtime/store.js';

export type RecorderErrorBoundaryProps = {
  readonly store: RecorderStore;
  readonly children: ReactNode;
  /** Rendered instead of the crashed subtree; defaults to rendering nothing. */
  readonly fallback?: ReactNode;
};

type RecorderErrorBoundaryState = { readonly hasError: boolean };

/**
 * Reports React rendering errors to the recorder without changing how the
 * rest of the app handles them — this boundary is additive instrumentation,
 * not the application's own error-boundary strategy.
 */
export class RecorderErrorBoundary extends Component<
  RecorderErrorBoundaryProps,
  RecorderErrorBoundaryState
> {
  state: RecorderErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): RecorderErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    captureReactError(this.props.store, error, errorInfo.componentStack ?? undefined);
  }

  render(): ReactNode {
    if (this.state.hasError) return this.props.fallback ?? null;
    return this.props.children;
  }
}
