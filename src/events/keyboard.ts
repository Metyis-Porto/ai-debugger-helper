import { isSensitiveInputElement } from '../serializers/sanitize.js';
import { attachListeners } from '../utils/attach-listeners.js';
import { buildDomReference } from '../utils/dom-reference.js';
import type { RecorderStore } from '../runtime/store.js';

const REDACTED_KEY = '[redacted]';

function isShortcut(event: KeyboardEvent): boolean {
  return (event.ctrlKey || event.metaKey || event.altKey) && event.key !== 'Control';
}

export function attachKeyboardCapture(store: RecorderStore): () => void {
  if (typeof document === 'undefined') return () => {};

  function handle(kind: 'keydown' | 'keyup') {
    return (event: Event) => {
      if (!(event instanceof KeyboardEvent) || !(event.target instanceof Element))
        return;
      const sensitive = isSensitiveInputElement(event.target);
      store.push({
        category: 'keyboard',
        detail: {
          kind,
          key: sensitive ? REDACTED_KEY : event.key,
          target: buildDomReference(event.target),
          isShortcut: isShortcut(event)
        }
      });
    };
  }

  return attachListeners([
    {
      target: document,
      type: 'keydown',
      listener: handle('keydown'),
      options: { capture: true }
    },
    {
      target: document,
      type: 'keyup',
      listener: handle('keyup'),
      options: { capture: true }
    }
  ]);
}
