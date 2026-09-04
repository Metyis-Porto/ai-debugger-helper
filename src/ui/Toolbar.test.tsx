import '@testing-library/jest-dom/vitest';

import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RecorderToolbar } from './Toolbar.js';
import { createRecorderStore } from '../runtime/store.js';

/**
 * This sandbox's jsdom environment doesn't populate `window.localStorage`
 * (see `apps/web/lib/dashboard-favorites.test.ts` for the same gap) —
 * install a minimal in-memory `Storage` so the hidden-preference tests
 * exercise the real read/write round-trip `RecorderToolbar` uses, not a
 * mock of the toolbar itself.
 */
function installMemoryLocalStorage(): void {
  const data = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value);
      },
      removeItem: (key: string) => {
        data.delete(key);
      },
      clear: () => data.clear(),
      key: (index: number) => [...data.keys()][index] ?? null,
      get length() {
        return data.size;
      }
    },
    configurable: true
  });
}

describe('RecorderToolbar', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the current status and event count, with only the idle-state actions available', () => {
    const store = createRecorderStore();
    render(<RecorderToolbar store={store} onExport={() => {}} />);

    expect(screen.getByTestId('browser-debug-recorder-toolbar')).toHaveTextContent(
      'idle (0)'
    );
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export' })).not.toBeInTheDocument();
  });

  it('Start begins recording and swaps the available actions to Pause/Stop', () => {
    const store = createRecorderStore();
    render(<RecorderToolbar store={store} onExport={() => {}} />);

    act(() => screen.getByRole('button', { name: 'Start' }).click());

    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument();
  });

  it('Pause then Resume round-trips back to the recording actions', () => {
    const store = createRecorderStore();
    render(<RecorderToolbar store={store} onExport={() => {}} />);
    act(() => store.start());

    act(() => screen.getByRole('button', { name: 'Pause' }).click());
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();

    act(() => screen.getByRole('button', { name: 'Resume' }).click());
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  });

  it('Stop reveals the Export action', () => {
    const store = createRecorderStore();
    render(<RecorderToolbar store={store} onExport={() => {}} />);
    act(() => store.start());

    act(() => screen.getByRole('button', { name: 'Stop' }).click());

    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
  });

  it('Export calls the supplied onExport callback', () => {
    const store = createRecorderStore();
    const onExport = vi.fn();
    render(<RecorderToolbar store={store} onExport={onExport} />);
    act(() => {
      store.start();
      store.stop();
    });

    act(() => screen.getByRole('button', { name: 'Export' }).click());

    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it('Clear resets the store to idle regardless of the current status', () => {
    const store = createRecorderStore();
    render(<RecorderToolbar store={store} onExport={() => {}} />);
    act(() => store.start());

    act(() => screen.getByRole('button', { name: 'Clear' }).click());

    expect(screen.getByTestId('browser-debug-recorder-toolbar')).toHaveTextContent(
      'idle (0)'
    );
  });

  it('polls the event count every 500ms while mounted', () => {
    vi.useFakeTimers();
    const store = createRecorderStore();
    render(<RecorderToolbar store={store} onExport={() => {}} />);
    act(() => store.start());
    act(() => {
      store.push({ category: 'mouse', detail: { kind: 'click' } as never });
    });

    act(() => vi.advanceTimersByTime(500));

    expect(screen.getByTestId('browser-debug-recorder-toolbar')).toHaveTextContent(
      'recording (1)'
    );
  });

  it('unsubscribes and stops polling on unmount', () => {
    vi.useFakeTimers();
    const store = createRecorderStore();
    const { unmount } = render(<RecorderToolbar store={store} onExport={() => {}} />);

    unmount();
    act(() => store.start());

    expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
  });

  describe('hiding and reopening', () => {
    it('Hide replaces the panel with a small reopen control', () => {
      const store = createRecorderStore();
      render(<RecorderToolbar store={store} onExport={() => {}} />);

      act(() => screen.getByRole('button', { name: 'Hide debug recorder' }).click());

      expect(
        screen.queryByTestId('browser-debug-recorder-toolbar')
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Show debug recorder' })
      ).toBeInTheDocument();
    });

    it('the reopen control restores the full toolbar', () => {
      const store = createRecorderStore();
      render(<RecorderToolbar store={store} onExport={() => {}} />);
      act(() => screen.getByRole('button', { name: 'Hide debug recorder' }).click());

      act(() => screen.getByRole('button', { name: 'Show debug recorder' }).click());

      expect(screen.getByTestId('browser-debug-recorder-toolbar')).toHaveTextContent(
        'idle (0)'
      );
    });

    it('the hidden preference survives a reload, unlike before this fix', () => {
      const store = createRecorderStore();
      const { unmount } = render(<RecorderToolbar store={store} onExport={() => {}} />);
      act(() => screen.getByRole('button', { name: 'Hide debug recorder' }).click());
      unmount();

      // A fresh mount — e.g. after a page reload — with the same persisted
      // preference still in `localStorage`.
      render(<RecorderToolbar store={store} onExport={() => {}} />);

      expect(
        screen.queryByTestId('browser-debug-recorder-toolbar')
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Show debug recorder' })
      ).toBeInTheDocument();
    });

    it('reopening persists too, so the next reload starts visible again', () => {
      const store = createRecorderStore();
      const first = render(<RecorderToolbar store={store} onExport={() => {}} />);
      act(() => screen.getByRole('button', { name: 'Hide debug recorder' }).click());
      act(() => screen.getByRole('button', { name: 'Show debug recorder' }).click());
      first.unmount();

      render(<RecorderToolbar store={store} onExport={() => {}} />);

      expect(screen.getByTestId('browser-debug-recorder-toolbar')).toBeInTheDocument();
    });
  });
});
