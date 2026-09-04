import { afterEach, describe, expect, it } from 'vitest';

import { attachDragAndDropCapture } from './dragdrop.js';
import { createRecorderStore } from '../runtime/store.js';

// jsdom (as configured here) has no native `DragEvent` constructor, so the
// module's own `event instanceof DragEvent` guard would otherwise be
// untestable — a minimal `Event` subclass under the same global name lets
// both the source module and this test agree on what a `DragEvent` is.
class TestDragEvent extends Event {}
const globalWithDragEvent = globalThis as unknown as { DragEvent?: typeof Event };
if (typeof globalWithDragEvent.DragEvent === 'undefined')
  globalWithDragEvent.DragEvent = TestDragEvent;

function dragEvent(type: string) {
  return new globalWithDragEvent.DragEvent!(type, { bubbles: true });
}

describe('attachDragAndDropCapture', () => {
  let detach: (() => void) | null = null;

  afterEach(() => {
    detach?.();
    detach = null;
    document.body.innerHTML = '';
  });

  it('records the source and destination, with their index within their parent, on a drop', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachDragAndDropCapture(store);

    const list = document.createElement('div');
    list.id = 'list';
    const first = document.createElement('div');
    first.id = 'item-1';
    const second = document.createElement('div');
    second.id = 'item-2';
    list.append(first, second);
    document.body.appendChild(list);

    first.dispatchEvent(dragEvent('dragstart'));
    second.dispatchEvent(dragEvent('drop'));

    const [event] = store.getTimeline().events;
    expect(event?.category).toBe('drag-and-drop');
    expect(event?.detail).toMatchObject({
      source: { selector: '#item-1' },
      destination: { selector: '#item-2' },
      indexBefore: 0,
      indexAfter: 1
    });
  });

  it('records a null indexBefore when the drag source has no parent Element (e.g. <html> itself)', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachDragAndDropCapture(store);

    // A detached node never reaches the document-level capture listener at
    // all, so the one real case of "no parentElement" for an event that
    // still propagates through `document` is the root <html> element itself
    // — its parent is the Document, not an Element.
    document.documentElement.dispatchEvent(dragEvent('dragstart'));

    const target = document.createElement('div');
    target.id = 'target';
    document.body.appendChild(target);
    target.dispatchEvent(dragEvent('drop'));

    const [event] = store.getTimeline().events;
    expect(event?.detail).toMatchObject({ indexBefore: null });
  });

  it('records a null destination/indexAfter when the drop target is not an Element', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachDragAndDropCapture(store);

    const source = document.createElement('div');
    source.id = 'source';
    document.body.appendChild(source);
    source.dispatchEvent(dragEvent('dragstart'));

    document.dispatchEvent(dragEvent('drop'));

    const [event] = store.getTimeline().events;
    expect(event?.detail).toMatchObject({ destination: null, indexAfter: null });
  });

  it('ignores a drop with no preceding dragstart', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachDragAndDropCapture(store);

    const target = document.createElement('div');
    document.body.appendChild(target);
    target.dispatchEvent(dragEvent('drop'));

    expect(store.getTimeline().events).toHaveLength(0);
  });

  it('ignores a non-DragEvent dispatched as "dragstart" (defensive instanceof guard)', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachDragAndDropCapture(store);

    const source = document.createElement('div');
    document.body.appendChild(source);
    source.dispatchEvent(new Event('dragstart', { bubbles: true }));
    source.dispatchEvent(dragEvent('drop'));

    expect(store.getTimeline().events).toHaveLength(0);
  });

  it('stops recording drags and drops once detached', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachDragAndDropCapture(store);
    detach();
    detach = null;

    const source = document.createElement('div');
    document.body.appendChild(source);
    source.dispatchEvent(dragEvent('dragstart'));
    source.dispatchEvent(dragEvent('drop'));

    expect(store.getTimeline().events).toHaveLength(0);
  });
});
