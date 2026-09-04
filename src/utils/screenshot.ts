import html2canvasImport from 'html2canvas';

// html2canvas ships no `exports` map, and its `.d.ts` resolves to the whole
// module namespace rather than the declared default export under
// `moduleResolution: NodeNext` — a known friction point for this package,
// unrelated to anything in this repo. Confirmed at runtime (Node's ESM/CJS
// interop) that the default import IS the callable function the types
// describe; this cast just tells TypeScript what's already true.
type Html2CanvasOptions = Partial<{
  logging: boolean;
  useCORS: boolean;
  windowWidth: number;
  windowHeight: number;
  scrollX: number;
  scrollY: number;
}>;

const html2canvas = html2canvasImport as unknown as (
  element: HTMLElement,
  options?: Html2CanvasOptions
) => Promise<HTMLCanvasElement>;

/**
 * Renders the page to a canvas and returns it as a PNG data URL. Deliberately
 * not a native screen-capture API (`getDisplayMedia`) — that requires a
 * permission prompt on every single call, which is incompatible with
 * automatic per-event capture (see IMPLEMENT_BROWSER_DEBUG_RECORDER.md's
 * "Screenshot Capture" section).
 *
 * html2canvas's own rendering pipeline is asynchronous and non-trivial (it
 * walks and clones the DOM before it ever touches a canvas), so if the
 * viewport changes again while a capture is still in flight — entirely
 * possible while resizing continuously, exactly when `page-resize` actions
 * fire — a capture invoked for one viewport size can end up describing a
 * later one instead. Snapshotting dimensions synchronously, before any
 * `await`, and pinning html2canvas to those explicit values (rather than
 * letting it read them itself, later, mid-render) keeps the captured frame
 * anchored to what was actually on screen at the moment this was called.
 *
 * `document.documentElement.clientWidth/clientHeight` is used instead of
 * `window.innerWidth/innerHeight` deliberately: the layout engine updates
 * `clientWidth` synchronously with reflow, whereas `window.innerWidth` is a
 * separate window-level property that some browsers only refresh once a
 * live resize gesture (e.g. dragging a DevTools device-toolbar handle)
 * settles — which would make every screenshot taken *during* such a drag
 * describe the gesture's starting size instead of its current one, even
 * though the on-screen layout (and this recorder's own breakpoint
 * detection, which watches the grid container's actual size) already
 * reflects the new size.
 */
export async function captureScreenshot(target?: HTMLElement): Promise<string> {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    throw new Error('captureScreenshot can only run in a browser environment.');
  }
  const element = target ?? document.documentElement;
  const windowWidth = document.documentElement.clientWidth;
  const windowHeight = document.documentElement.clientHeight;
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const canvas = await html2canvas(element, {
    logging: false,
    useCORS: true,
    windowWidth,
    windowHeight,
    scrollX,
    scrollY
  });
  return canvas.toDataURL('image/png');
}
