import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RecorderErrorBoundary } from './RecorderErrorBoundary.js';
import { createRecorderStore } from '../runtime/store.js';

function Boom(): never {
  throw new Error('render failed');
}

describe('RecorderErrorBoundary', () => {
  it('renders its children when nothing throws', () => {
    const store = createRecorderStore();
    render(
      <RecorderErrorBoundary store={store}>
        <p>All good</p>
      </RecorderErrorBoundary>
    );
    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('renders the fallback and reports a runtime "react-error" event when a child throws', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = createRecorderStore();
    store.start();

    render(
      <RecorderErrorBoundary store={store} fallback={<p>Something broke</p>}>
        <Boom />
      </RecorderErrorBoundary>
    );

    expect(screen.getByText('Something broke')).toBeInTheDocument();
    const [event] = store.getTimeline().events;
    expect(event?.category).toBe('runtime');
    expect(event?.detail).toMatchObject({
      kind: 'react-error',
      message: 'render failed'
    });

    consoleError.mockRestore();
  });

  it('renders nothing (not a crash) when a child throws and no fallback was supplied', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = createRecorderStore();
    store.start();

    const { container } = render(
      <RecorderErrorBoundary store={store}>
        <Boom />
      </RecorderErrorBoundary>
    );

    expect(container).toBeEmptyDOMElement();
    consoleError.mockRestore();
  });
});
