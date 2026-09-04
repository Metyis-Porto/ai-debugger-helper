import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { attachNetworkCapture } from './network.js';
import { createRecorderStore } from '../runtime/store.js';

describe('attachNetworkCapture — fetch', () => {
  let detach: (() => void) | null = null;
  const originalFetch = window.fetch;
  const originalXHR = window.XMLHttpRequest;

  afterEach(() => {
    detach?.();
    detach = null;
    window.fetch = originalFetch;
    window.XMLHttpRequest = originalXHR;
  });

  it('records a successful fetch with its status and response size', async () => {
    const store = createRecorderStore();
    store.start();
    window.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response('{}', { status: 200, headers: { 'content-length': '2' } })
      );
    detach = attachNetworkCapture(store);

    await window.fetch('/api/data');

    const [event] = store.getTimeline().events;
    expect(event?.category).toBe('network');
    expect(event?.detail).toMatchObject({
      method: 'GET',
      url: '/api/data',
      status: 200,
      responseSize: 2,
      failed: false
    });
  });

  it('uses the method from an explicit RequestInit and marks a non-ok response as failed', async () => {
    const store = createRecorderStore();
    store.start();
    window.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
    detach = attachNetworkCapture(store);

    await window.fetch('/api/data', { method: 'POST' });

    const [event] = store.getTimeline().events;
    expect(event?.detail).toMatchObject({ method: 'POST', status: 500, failed: true });
  });

  it('resolves the method/url from a Request instance when no plain URL is passed', async () => {
    const store = createRecorderStore();
    store.start();
    window.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    detach = attachNetworkCapture(store);

    await window.fetch(new Request('https://example.test/resource', { method: 'PUT' }));

    const [event] = store.getTimeline().events;
    expect(event?.detail).toMatchObject({
      method: 'PUT',
      url: 'https://example.test/resource'
    });
  });

  it('records a failed (rejected) fetch and still rethrows the original error', async () => {
    const store = createRecorderStore();
    store.start();
    const networkError = new Error('network down');
    window.fetch = vi.fn().mockRejectedValue(networkError);
    detach = attachNetworkCapture(store);

    await expect(window.fetch('/api/data')).rejects.toThrow('network down');

    const [event] = store.getTimeline().events;
    expect(event?.detail).toMatchObject({
      status: null,
      responseSize: null,
      failed: true
    });
  });

  it('stops recording fetch calls once detached', async () => {
    const store = createRecorderStore();
    store.start();
    window.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    detach = attachNetworkCapture(store);
    detach();
    detach = null;

    await window.fetch('/after-detach');

    expect(store.getTimeline().events).toHaveLength(0);
  });
});

describe('attachNetworkCapture — XMLHttpRequest', () => {
  let detach: (() => void) | null = null;
  const originalXHR = window.XMLHttpRequest;

  beforeEach(() => {
    // `attachNetworkCapture` bails out entirely when `window.fetch` isn't a
    // function — give it a harmless stand-in so the XHR half still attaches.
    window.fetch = vi.fn().mockResolvedValue(new Response(null));
  });

  afterEach(() => {
    detach?.();
    detach = null;
    window.XMLHttpRequest = originalXHR;
  });

  it('records the request once "loadend" fires, without waiting on a real network round-trip', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachNetworkCapture(store);

    const xhr = new window.XMLHttpRequest();
    xhr.open('GET', '/api/widgets');
    xhr.send();
    Object.defineProperty(xhr, 'status', { value: 200, configurable: true });
    xhr.getResponseHeader = () => '128';
    xhr.dispatchEvent(new Event('loadend'));

    const [event] = store.getTimeline().events;
    expect(event?.category).toBe('network');
    expect(event?.detail).toMatchObject({
      method: 'GET',
      url: '/api/widgets',
      status: 200,
      responseSize: 128,
      failed: false
    });
  });

  it('marks a request with status 0 or >= 400 as failed', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachNetworkCapture(store);

    const xhr = new window.XMLHttpRequest();
    xhr.open('POST', '/api/widgets');
    xhr.send();
    Object.defineProperty(xhr, 'status', { value: 404, configurable: true });
    xhr.getResponseHeader = () => null;
    xhr.dispatchEvent(new Event('loadend'));

    const [event] = store.getTimeline().events;
    expect(event?.detail).toMatchObject({
      status: 404,
      responseSize: null,
      failed: true
    });
  });

  it('restores the native XMLHttpRequest constructor on detach', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachNetworkCapture(store);
    detach();
    detach = null;

    expect(window.XMLHttpRequest).toBe(originalXHR);
  });
});
