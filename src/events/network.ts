import type { RecorderStore } from '../runtime/store.js';

function pushNetworkEvent(
  store: RecorderStore,
  method: string,
  url: string,
  startTime: number,
  finishTime: number,
  status: number | null,
  responseSize: number | null,
  failed: boolean
) {
  store.push({
    category: 'network',
    detail: {
      method,
      url,
      startTime,
      finishTime,
      durationMs: finishTime - startTime,
      status,
      responseSize,
      failed
    }
  });
}

function responseSizeOf(response: Response): number | null {
  const contentLength = response.headers.get('content-length');
  return contentLength ? Number(contentLength) : null;
}

/**
 * Wraps `fetch` and `XMLHttpRequest`. Reads only the `content-length`
 * response header for size — cloning and reading full bodies would add
 * overhead the spec's Performance Requirements explicitly rule out, and
 * bodies aren't part of what's recorded per the Network Recording section.
 */
export function attachNetworkCapture(store: RecorderStore): () => void {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function')
    return () => {};

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const [input, init] = args;
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
    const url = input instanceof Request ? input.url : String(input);
    const startTime = Date.now();
    try {
      const response = await originalFetch(...args);
      pushNetworkEvent(
        store,
        method,
        url,
        startTime,
        Date.now(),
        response.status,
        responseSizeOf(response),
        !response.ok
      );
      return response;
    } catch (error) {
      pushNetworkEvent(store, method, url, startTime, Date.now(), null, null, true);
      throw error;
    }
  };

  const OriginalXHR = window.XMLHttpRequest;
  const requestInfo = new WeakMap<
    XMLHttpRequest,
    { method: string; url: string; startTime: number }
  >();

  class RecordingXMLHttpRequest extends OriginalXHR {
    open(method: string, url: string | URL, ...rest: unknown[]) {
      requestInfo.set(this, { method, url: String(url), startTime: Date.now() });
      // @ts-expect-error -- forwarding the native overload set verbatim
      return super.open(method, url, ...rest);
    }

    send(...args: unknown[]) {
      this.addEventListener('loadend', () => {
        const info = requestInfo.get(this);
        if (!info) return;
        const finishTime = Date.now();
        const contentLength = this.getResponseHeader('content-length');
        pushNetworkEvent(
          store,
          info.method,
          info.url,
          info.startTime,
          finishTime,
          this.status || null,
          contentLength ? Number(contentLength) : null,
          this.status === 0 || this.status >= 400
        );
      });
      // @ts-expect-error -- forwarding the native overload set verbatim
      return super.send(...args);
    }
  }

  window.XMLHttpRequest = RecordingXMLHttpRequest;

  return () => {
    window.fetch = originalFetch;
    window.XMLHttpRequest = OriginalXHR;
  };
}
