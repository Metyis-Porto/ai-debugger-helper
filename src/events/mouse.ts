import { attachListeners } from '../utils/attach-listeners.js';
import { buildDomReference } from '../utils/dom-reference.js';
import type { RecorderStore } from '../runtime/store.js';
import type { MouseEventDetail } from '../types/index.js';

const MOUSE_EVENTS: readonly [string, MouseEventDetail['kind']][] = [
  ['click', 'click'],
  ['dblclick', 'dblclick'],
  ['contextmenu', 'contextmenu'],
  ['mousedown', 'mousedown'],
  ['mouseup', 'mouseup']
];

/** Listens in the capture phase so a later `stopPropagation()` can't hide the interaction. */
export function attachMouseCapture(store: RecorderStore): () => void {
  if (typeof document === 'undefined') return () => {};

  return attachListeners(
    MOUSE_EVENTS.map(([eventName, kind]) => ({
      target: document,
      type: eventName,
      options: { capture: true },
      listener: (event: Event) => {
        if (!(event instanceof MouseEvent) || !(event.target instanceof Element))
          return;
        store.push({
          category: 'mouse',
          detail: {
            kind,
            target: buildDomReference(event.target),
            x: event.clientX,
            y: event.clientY
          }
        });
      }
    }))
  );
}
