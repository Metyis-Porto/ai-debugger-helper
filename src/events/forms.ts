import { isSensitiveInputElement } from '../serializers/sanitize.js';
import { attachListeners } from '../utils/attach-listeners.js';
import type { RecorderStore } from '../runtime/store.js';
import type { FormEventDetail } from '../types/index.js';

type ValidatableElement = HTMLInputElement | HTMLTextAreaElement;

/** select/radio/checkbox changes are the Selection category's concern (see selection.ts). */
function isHandledElsewhere(element: Element): boolean {
  if (element instanceof HTMLSelectElement) return true;
  if (element instanceof HTMLInputElement)
    return element.type === 'radio' || element.type === 'checkbox';
  return false;
}

function isValidatable(target: EventTarget | null): target is ValidatableElement {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

function validationResultFor(
  element: ValidatableElement
): FormEventDetail['validationResult'] {
  if (typeof element.checkValidity !== 'function') return 'unknown';
  return element.checkValidity() ? 'valid' : 'invalid';
}

/**
 * Field identifier/name and value LENGTH only — never the value itself, per
 * IMPLEMENT_BROWSER_DEBUG_RECORDER.md's Forms section, doubly so for
 * anything `isSensitiveInputElement` flags.
 */
export function attachFormCapture(store: RecorderStore): () => void {
  if (typeof document === 'undefined') return () => {};

  const onChange = (event: Event) => {
    const target = event.target;
    if (!isValidatable(target)) return;
    if (isHandledElsewhere(target)) return;

    store.push({
      category: 'form',
      detail: {
        fieldId: target.id || '(no id)',
        fieldName: target.name || '(no name)',
        valueLength: isSensitiveInputElement(target) ? 0 : target.value.length,
        validationResult: validationResultFor(target)
      }
    });
  };

  return attachListeners([
    { target: document, type: 'input', listener: onChange, options: { capture: true } },
    { target: document, type: 'change', listener: onChange, options: { capture: true } }
  ]);
}
