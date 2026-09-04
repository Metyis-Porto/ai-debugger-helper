import { buildDomReference } from '../utils/dom-reference.js';
import type { RecorderStore } from '../runtime/store.js';

function indexWithinParent(element: Element): number | null {
  const parent = element.parentElement;
  if (!parent) return null;
  return [...parent.children].indexOf(element);
}

/**
 * Native HTML5 drag-and-drop only (`draggable` elements). Libraries that
 * reposition via mouse tracking instead of the native DnD API (as
 * react-grid-layout does) aren't observable this way — those interactions
 * should be reported through `recordAction` by the consuming application.
 */
export function attachDragAndDropCapture(store: RecorderStore): () => void {
  if (typeof document === 'undefined') return () => {};

  let source: Element | null = null;
  let indexBefore: number | null = null;

  const onDragStart = (event: Event) => {
    if (!(event instanceof DragEvent) || !(event.target instanceof Element)) return;
    source = event.target;
    indexBefore = indexWithinParent(source);
  };

  const onDrop = (event: Event) => {
    if (!(event instanceof DragEvent) || !source) return;
    const destination = event.target instanceof Element ? event.target : null;
    store.push({
      category: 'drag-and-drop',
      detail: {
        source: buildDomReference(source),
        destination: destination ? buildDomReference(destination) : null,
        indexBefore,
        indexAfter: destination ? indexWithinParent(destination) : null
      }
    });
    source = null;
    indexBefore = null;
  };

  document.addEventListener('dragstart', onDragStart, { capture: true });
  document.addEventListener('drop', onDrop, { capture: true });

  return () => {
    document.removeEventListener('dragstart', onDragStart, { capture: true });
    document.removeEventListener('drop', onDrop, { capture: true });
  };
}
