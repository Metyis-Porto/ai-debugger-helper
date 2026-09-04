import { attachListeners } from '../utils/attach-listeners.js';
import { buildDomReference } from '../utils/dom-reference.js';
import type { RecorderStore } from '../runtime/store.js';
import type { SelectionEventDetail } from '../types/index.js';

function push(
  store: RecorderStore,
  kind: SelectionEventDetail['kind'],
  target: Element,
  value?: string
) {
  store.push({
    category: 'selection',
    detail: { kind, target: buildDomReference(target), value }
  });
}

export function attachSelectionCapture(store: RecorderStore): () => void {
  if (typeof document === 'undefined') return () => {};

  const onChange = (event: Event) => {
    const target = event.target;
    if (target instanceof HTMLSelectElement) {
      push(store, 'dropdown', target, target.value);
      return;
    }
    if (target instanceof HTMLInputElement && target.type === 'radio') {
      push(store, 'radio', target, target.value);
      return;
    }
    if (target instanceof HTMLInputElement && target.type === 'checkbox') {
      push(store, 'checkbox', target, String(target.checked));
    }
  };

  const onClick = (event: Event) => {
    if (!(event.target instanceof Element)) return;
    const tab = event.target.closest('[role="tab"]');
    if (tab) {
      push(store, 'tab', tab);
      return;
    }
    const menuItem = event.target.closest('[role="menuitem"], [role="menu"]');
    if (menuItem) push(store, 'menu', menuItem);
  };

  return attachListeners([
    {
      target: document,
      type: 'change',
      listener: onChange,
      options: { capture: true }
    },
    { target: document, type: 'click', listener: onClick, options: { capture: true } }
  ]);
}
