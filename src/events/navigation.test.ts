import { afterEach, describe, expect, it } from 'vitest';

import { attachNavigationCapture } from './navigation.js';
import { createRecorderStore } from '../runtime/store.js';
import type { NavigationEventDetail } from '../types/index.js';

function navigationDetailOf(event: { readonly detail: unknown } | undefined) {
  return event?.detail as NavigationEventDetail | undefined;
}

describe('attachNavigationCapture', () => {
  let detach: (() => void) | null = null;

  afterEach(() => {
    detach?.();
    detach = null;
    window.history.replaceState({}, '', '/');
  });

  it('records the initial location as a "load" event as soon as it attaches', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachNavigationCapture(store);

    const [event] = store.getTimeline().events;
    expect(event?.category).toBe('navigation');
    expect(event?.detail).toMatchObject({ kind: 'load' });
  });

  it('records a pushState navigation with the new URL', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachNavigationCapture(store);

    window.history.pushState({}, '', '/dashboards/1');

    const events = store.getTimeline().events;
    const pushEvent = events.find(
      (event) => navigationDetailOf(event)?.kind === 'push-state'
    );
    expect(navigationDetailOf(pushEvent)?.url).toContain('/dashboards/1');
  });

  it('records a replaceState navigation with the new URL', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachNavigationCapture(store);

    window.history.replaceState({}, '', '/dashboards/2/edit');

    const events = store.getTimeline().events;
    const replaceEvent = events.find(
      (event) => navigationDetailOf(event)?.kind === 'replace-state'
    );
    expect(navigationDetailOf(replaceEvent)?.url).toContain('/dashboards/2/edit');
  });

  it('records a popstate navigation', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachNavigationCapture(store);

    window.dispatchEvent(new PopStateEvent('popstate'));

    const events = store.getTimeline().events;
    expect(
      events.some((event) => navigationDetailOf(event)?.kind === 'pop-state')
    ).toBe(true);
  });

  it('records a hashchange navigation', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachNavigationCapture(store);

    window.dispatchEvent(new HashChangeEvent('hashchange'));

    const events = store.getTimeline().events;
    expect(
      events.some((event) => navigationDetailOf(event)?.kind === 'hash-change')
    ).toBe(true);
  });

  it('stops recording pushState and popstate navigations once detached', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachNavigationCapture(store);
    const countAfterAttach = store.getTimeline().events.length;
    detach();
    detach = null;

    // The native pushState still updates the URL after detach — only the
    // recorder's own patch is undone, not history navigation itself.
    window.history.pushState({}, '', '/after-detach');
    expect(window.location.pathname).toBe('/after-detach');
    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(store.getTimeline().events).toHaveLength(countAfterAttach);
  });
});
